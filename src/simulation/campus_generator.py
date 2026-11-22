from pathlib import Path

import numpy as np
import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[2]
RAW_DATA_DIR = PROJECT_ROOT / "data" / "raw"

RANDOM_SEED = 42
START_DATE = "2026-05-24"
DAYS = 182  # last day = 2026-11-21

# Approximate academic calendar (simulation only)
EXAM_PERIOD = ("2026-05-24", "2026-06-25")
SUMMER_BREAK = ("2026-06-27", "2026-09-19")
HOLIDAYS = {"2026-06-30", "2026-07-23", "2026-08-25", "2026-10-06"}

# Waste behaviour
EVENT_RATE_PER_MONTH = 1.5   # average after-hours waste events per room
FAULT_RATE_PER_MONTH = 0.15  # average multi-day HVAC faults per room

BUILDINGS = [
    ("B01", "Engineering Building", {"Classroom": 5, "Lab": 2, "Lecture Hall": 1}),
    ("B02", "Science Building", {"Classroom": 4, "Lab": 3, "Lecture Hall": 1}),
    ("B03", "Administration Building", {"Office": 6, "Meeting Room": 2}),
]

# (idle_kw, active_kw, kw_per_person) for each load component
PROFILES = {
    "Classroom": dict(cap=(25, 60), hvac=(0.15, 0.90, 0.008), light=(0.05, 0.30, 0.004),
                      equip=(0.08, 0.20, 0.003), util=(0.45, 0.80), fill=(4, 2.5), kind="teaching"),
    "Lab": dict(cap=(20, 35), hvac=(0.18, 1.00, 0.010), light=(0.06, 0.35, 0.004),
                equip=(0.25, 0.70, 0.015), util=(0.35, 0.70), fill=(4, 2), kind="teaching"),
    "Lecture Hall": dict(cap=(120, 200), hvac=(0.25, 1.80, 0.006), light=(0.08, 0.70, 0.002),
                         equip=(0.10, 0.40, 0.002), util=(0.35, 0.65), fill=(3, 3), kind="teaching"),
    "Office": dict(cap=(4, 12), hvac=(0.12, 0.35, 0.030), light=(0.04, 0.12, 0.010),
                   equip=(0.10, 0.25, 0.050), util=(1, 1), fill=(7, 3), kind="office"),
    "Meeting Room": dict(cap=(8, 20), hvac=(0.10, 0.45, 0.020), light=(0.03, 0.15, 0.005),
                         equip=(0.05, 0.20, 0.010), util=(0.20, 0.50), fill=(3, 3), kind="meeting"),
}


# ---------------------------------------------------------------- campus
def create_campus_rooms(rng):
    rooms = []
    room_number = 1
    for building_id, building_name, composition in BUILDINGS:
        for room_type, count in composition.items():
            lo, hi = PROFILES[room_type]["cap"]
            for local in range(1, count + 1):
                rooms.append({
                    "building_id": building_id,
                    "building_name": building_name,
                    "room_id": f"R{room_number:02d}",
                    "room_name": f"{room_type} {local:02d}",
                    "room_type": room_type,
                    "capacity": int(rng.integers(lo, hi + 1)),
                })
                room_number += 1
    return pd.DataFrame(rooms)


# -------------------------------------------------------------- calendar
def build_calendar():
    dates = pd.date_range(START_DATE, periods=DAYS, freq="D")
    exam_s, exam_e = map(pd.Timestamp, EXAM_PERIOD)
    brk_s, brk_e = map(pd.Timestamp, SUMMER_BREAK)

    day_types = []
    for d in dates:
        if d.strftime("%Y-%m-%d") in HOLIDAYS:
            day_types.append("holiday")
        elif d.weekday() in (4, 5):  # Friday, Saturday
            day_types.append("weekend")
        elif brk_s <= d <= brk_e:
            day_types.append("break")
        elif exam_s <= d <= exam_e:
            day_types.append("exam")
        else:
            day_types.append("regular")

    day_types = np.array(day_types)
    ctx = {
        "timestamps": pd.date_range(START_DATE, periods=DAYS * 24, freq="h"),
        "hour": np.tile(np.arange(24), DAYS),
        "weekday": np.repeat(dates.weekday.values, 24),
        "day_idx": np.repeat(np.arange(DAYS), 24),
        "day_type": np.repeat(day_types, 24),
        "day_types": day_types,
    }
    return ctx


def simulate_weather(rng, ctx):
    ts = ctx["timestamps"]
    seasonal = 25 + 6 * np.cos(2 * np.pi * (ts.dayofyear.values - 205) / 365)
    diurnal = 5 * np.sin(2 * np.pi * (ctx["hour"] - 9) / 24)

    anomaly = np.zeros(DAYS)
    for i in range(1, DAYS):
        anomaly[i] = 0.7 * anomaly[i - 1] + rng.normal(0, 1.2)
    for _ in range(3):  # a few summer heat waves
        s = int(rng.integers(0, 100))
        anomaly[s:s + int(rng.integers(2, 5))] += rng.uniform(3, 5)

    temp = seasonal + diurnal + np.repeat(anomaly, 24) + rng.normal(0, 0.4, len(ts))
    return np.round(temp, 1)


# ------------------------------------------------------- room behaviour
def build_schedule(rng, profile, ctx):
    hour, weekday = ctx["hour"], ctx["weekday"]
    day_idx, dtype = ctx["day_idx"], ctx["day_type"]
    regular, exam, brk = dtype == "regular", dtype == "exam", dtype == "break"
    kind = profile["kind"]

    if kind == "office":
        return ((regular | exam) & (hour >= 8) & (hour < 16)) | (brk & (hour >= 8) & (hour < 14))

    util = rng.uniform(*profile["util"])
    timetable = np.zeros((7, 24), dtype=bool)
    for wd in range(7):
        for start in (8, 10, 12, 14):
            if rng.random() < util:
                timetable[wd, start:start + 2] = True
        if rng.random() < util * 0.5:
            timetable[wd, 16] = True
    weekly = timetable[weekday, hour]

    if kind == "meeting":
        return (regular | exam | brk) & weekly

    exam_day_use = rng.random(DAYS) < 0.6
    summer_day_use = rng.random(DAYS) < 0.05
    exam_sched = exam & exam_day_use[day_idx] & (hour >= 9) & (hour < 16)
    break_sched = brk & summer_day_use[day_idx] & (hour >= 9) & (hour < 13)
    return (regular & weekly) | exam_sched | break_sched


def build_occupancy(rng, profile, capacity, scheduled, ctx):
    n = len(scheduled)
    a, b = profile["fill"]
    frac = rng.beta(a, b, n)
    kind = profile["kind"]

    if kind == "teaching":
        frac = np.where(ctx["day_type"] == "exam", np.clip(frac * 1.25, 0, 1), frac)
        frac = np.where(rng.random(n) < 0.08, 0, frac)  # cancelled class
    elif kind == "office":
        frac = np.where((ctx["hour"] >= 12) & (ctx["hour"] < 13), frac * 0.5, frac)
    else:
        frac = np.where(rng.random(n) < 0.25, 0, frac)  # unused booking

    return np.where(scheduled, np.rint(frac * capacity), 0).astype(int)


def build_power(profile, scheduled, occupancy, temp):
    h_idle, h_act, h_pp = profile["hvac"]
    l_idle, l_act, l_pp = profile["light"]
    e_idle, e_act, e_pp = profile["equip"]

    cooling = np.clip(1 + 0.05 * (temp - 28), 0.5, 1.6)
    idle_temp = np.clip(1 + 0.02 * (temp - 28), 0.7, 1.3)
    occupied = occupancy > 0

    hvac = np.where(
        scheduled,
        (h_idle + h_act + h_pp * occupancy) * cooling * np.where(occupied, 1.0, 0.7),
        h_idle * idle_temp,
    )
    light = np.where(
        scheduled,
        l_idle + (l_act + l_pp * occupancy) * np.where(occupied, 1.0, 0.3),
        l_idle,
    )
    equip = np.where(
        scheduled,
        e_idle + (e_act + e_pp * occupancy) * np.where(occupied, 1.0, 0.4),
        e_idle,
    )
    return hvac, light, equip


def inject_waste(rng, profile, ctx, scheduled, propensity):
    n = len(scheduled)
    extra_h, extra_l, extra_e = np.zeros(n), np.zeros(n), np.zeros(n)
    flag = np.zeros(n, dtype=bool)
    wtype = np.full(n, "none", dtype=object)

    # Waste size scales with the room's equipment size
    sz_h = profile["hvac"][1] / 0.9
    sz_l = profile["light"][1] / 0.3
    sz_e = profile["equip"][1] / 0.2
    months = DAYS / 30
    day_types = ctx["day_types"]

    kinds = ["AFTER_HOURS_FULL", "HVAC_LEFT_ON", "LIGHTS_LEFT_ON", "EQUIPMENT_LEFT_ON"]
    probs = [0.35, 0.30, 0.20, 0.15]

    for _ in range(rng.poisson(EVENT_RATE_PER_MONTH * propensity * months)):
        d = int(rng.integers(0, DAYS))
        if day_types[d] in ("weekend", "holiday", "break"):
            start_h = int(rng.integers(9, 21))
        else:
            start_h = int(rng.integers(17, 23))
        duration = int(rng.integers(2, 9))
        idx = np.arange(d * 24 + start_h, min(d * 24 + start_h + duration, n))
        idx = idx[~scheduled[idx]]
        if idx.size == 0:
            continue

        kind = rng.choice(kinds, p=probs)
        severity = rng.uniform(0.35, 1.3)  # some events are subtle
        if kind in ("AFTER_HOURS_FULL", "HVAC_LEFT_ON"):
            extra_h[idx] += 1.20 * sz_h * severity
        if kind in ("AFTER_HOURS_FULL", "LIGHTS_LEFT_ON"):
            extra_l[idx] += 0.45 * sz_l * severity
        if kind in ("AFTER_HOURS_FULL", "EQUIPMENT_LEFT_ON"):
            extra_e[idx] += 0.25 * sz_e * severity
        flag[idx] = True
        wtype[idx] = kind

    # Multi-day HVAC faults during scheduled hours (hard for simple rules)
    for _ in range(rng.poisson(FAULT_RATE_PER_MONTH * propensity * months)):
        d0 = int(rng.integers(0, DAYS - 7))
        length = int(rng.integers(3, 8))
        mask = np.zeros(n, dtype=bool)
        mask[d0 * 24:(d0 + length) * 24] = True
        mask &= scheduled
        extra_h[mask] += 0.7 * sz_h * rng.uniform(0.6, 1.2)
        flag[mask] = True
        wtype[mask] = "HVAC_FAULT"

    return extra_h, extra_l, extra_e, flag, wtype


def noisy(rng, x):
    return x * np.clip(rng.normal(1, 0.03, len(x)), 0.9, 1.1)


# ------------------------------------------------------------------ main
def simulate_room(rng, room, ctx, temp):
    profile = PROFILES[room.room_type]
    scheduled = build_schedule(rng, profile, ctx)
    occupancy = build_occupancy(rng, profile, room.capacity, scheduled, ctx)

    hvac, light, equip = build_power(profile, scheduled, occupancy, temp)

    # Each room has its own efficiency level
    hvac, light, equip = (
        hvac * rng.uniform(0.85, 1.15),
        light * rng.uniform(0.85, 1.15),
        equip * rng.uniform(0.85, 1.15),
    )

    propensity = rng.gamma(2.0, 0.5)  # some rooms waste more than others
    eh, el, ee, flag, wtype = inject_waste(rng, profile, ctx, scheduled, propensity)

    hvac, light, equip = noisy(rng, hvac + eh), noisy(rng, light + el), noisy(rng, equip + ee)
    total = hvac + light + equip

    return pd.DataFrame({
        "timestamp": ctx["timestamps"],
        "building_id": room.building_id,
        "room_id": room.room_id,
        "occupancy": occupancy,
        "scheduled": scheduled,
        "waste_event": flag,
        "hvac_power_kw": hvac.round(3),
        "lighting_power_kw": light.round(3),
        "equipment_power_kw": equip.round(3),
        "total_power_kw": total.round(3),
        "energy_kwh": total.round(3),  # one record = one hour
        "room_type": room.room_type,
        "outside_temp_c": temp,
        "day_type": ctx["day_type"],
        "waste_type": wtype,
    })


def print_summary(rooms, data):
    waste = data["waste_event"]
    old_rule = (
        (~data["scheduled"]) & (data["occupancy"] == 0) & (data["total_power_kw"] > 0.80)
    )
    caught = (old_rule & waste).sum()

    print("Campus simulation completed successfully!")
    print(f"Buildings: {rooms['building_id'].nunique()}  Rooms: {len(rooms)}  Rows: {len(data):,}")
    print(f"Period: {data['timestamp'].min()} -> {data['timestamp'].max()}")
    print(f"Temperature range: {data['outside_temp_c'].min()} .. {data['outside_temp_c'].max()} C")
    print(f"Waste hours: {int(waste.sum()):,} ({waste.mean() * 100:.2f}% of rows)")
    print(data.loc[waste, "waste_type"].value_counts().to_string())
    print(f"Old fixed-threshold rule catches {caught / max(waste.sum(), 1) * 100:.1f}% of waste hours "
          f"(false alarms: {int((old_rule & ~waste).sum())})")


def main():
    rng = np.random.default_rng(RANDOM_SEED)
    RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)

    rooms = create_campus_rooms(rng)
    ctx = build_calendar()
    temp = simulate_weather(rng, ctx)

    frames = [simulate_room(rng, room, ctx, temp) for room in rooms.itertuples(index=False)]
    data = pd.concat(frames, ignore_index=True)

    rooms.to_csv(RAW_DATA_DIR / "campus_rooms.csv", index=False)
    data.to_csv(RAW_DATA_DIR / "simulated_energy_data.csv", index=False)

    print_summary(rooms, data)


if __name__ == "__main__":
    main()
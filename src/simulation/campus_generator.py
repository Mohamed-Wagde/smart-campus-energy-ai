from pathlib import Path

import numpy as np
import pandas as pd


# Project paths
PROJECT_ROOT = Path(__file__).resolve().parents[2]
RAW_DATA_DIR = PROJECT_ROOT / "data" / "raw"

# Reproducible simulation
RANDOM_SEED = 42
DAYS = 30
ROOMS_PER_BUILDING = [6, 7, 7]

BUILDINGS = [
    "Engineering Building",
    "Science Building",
    "Administration Building",
]


def create_campus_rooms():
    """Create the virtual campus structure."""
    rooms = []

    room_number = 1

    for building_index, building in enumerate(BUILDINGS, start=1):
        for local_room in range(1, ROOMS_PER_BUILDING[building_index - 1] + 1):
            rooms.append({
                "building_id": f"B{building_index:02d}",
                "building_name": building,
                "room_id": f"R{room_number:02d}",
                "room_name": f"Room {local_room:02d}",
                "room_type": "Classroom",
                "capacity": int(np.random.randint(25, 61)),
            })
            room_number += 1

    return pd.DataFrame(rooms)


def simulate_room_data(rooms):
    """Generate hourly electricity data for every room."""
    timestamps = pd.date_range(
        start="2026-10-01 00:00:00",
        periods=DAYS * 24,
        freq="h",
    )

    records = []

    for room in rooms.itertuples(index=False):
        for timestamp in timestamps:
            hour = timestamp.hour
            weekday = timestamp.weekday()

            # University operating schedule: Sunday to Thursday
            scheduled = (
                weekday in [6, 0, 1, 2, 3]
                and 8 <= hour < 17
            )

            # Random occupancy during scheduled hours
            if scheduled:
                occupancy = int(
                    np.random.choice(
                        [0, 0.25, 0.50, 0.75, 1.0],
                        p=[0.10, 0.15, 0.25, 0.30, 0.20],
                    ) * room.capacity
                )
            else:
                occupancy = 0

            # Simulated electrical loads (kW)
            hvac_power = 0.15
            lighting_power = 0.05
            equipment_power = 0.08

            if scheduled:
                hvac_power += 0.90
                lighting_power += 0.30
                equipment_power += 0.20

                hvac_power += occupancy * 0.008
                lighting_power += occupancy * 0.004
                equipment_power += occupancy * 0.003

            # Inject deliberate waste events for testing
            waste_event = (
                not scheduled
                and timestamp.hour in [19, 20]
                and int(room.room_id[-2:]) % 5 == 0
                and timestamp.day % 3 == 0
            )

            if waste_event:
                hvac_power += 1.20
                lighting_power += 0.45
                equipment_power += 0.25

            # Add small random variation
            hvac_power *= np.random.uniform(0.95, 1.05)
            lighting_power *= np.random.uniform(0.95, 1.05)
            equipment_power *= np.random.uniform(0.95, 1.05)

            total_power = (
                hvac_power
                + lighting_power
                + equipment_power
            )

            # Each record represents one hour
            energy_kwh = total_power * 1.0

            records.append({
                "timestamp": timestamp,
                "building_id": room.building_id,
                "room_id": room.room_id,
                "occupancy": occupancy,
                "scheduled": scheduled,
                "waste_event": waste_event,
                "hvac_power_kw": round(hvac_power, 3),
                "lighting_power_kw": round(lighting_power, 3),
                "equipment_power_kw": round(equipment_power, 3),
                "total_power_kw": round(total_power, 3),
                "energy_kwh": round(energy_kwh, 3),
            })

    return pd.DataFrame(records)


def main():
    np.random.seed(RANDOM_SEED)

    RAW_DATA_DIR.mkdir(parents=True, exist_ok=True)

    rooms = create_campus_rooms()
    energy_data = simulate_room_data(rooms)

    rooms_path = RAW_DATA_DIR / "campus_rooms.csv"
    energy_path = RAW_DATA_DIR / "simulated_energy_data.csv"

    rooms.to_csv(rooms_path, index=False)
    energy_data.to_csv(energy_path, index=False)

    print("Campus simulation completed successfully!")
    print(f"Buildings: {rooms['building_id'].nunique()}")
    print(f"Rooms: {len(rooms)}")
    print(f"Energy records: {len(energy_data)}")
    print(f"Simulated waste events: {energy_data['waste_event'].sum()}")
    print(f"\nRooms file: {rooms_path}")
    print(f"Energy file: {energy_path}")
    print("\nFirst five energy records:")
    print(energy_data.head())


if __name__ == "__main__":
    main()

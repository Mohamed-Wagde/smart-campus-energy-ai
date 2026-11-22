from pathlib import Path

import pandas as pd


# Project paths
PROJECT_ROOT = Path(__file__).resolve().parents[2]

ENERGY_DATA_PATH = (
    PROJECT_ROOT / "data" / "raw" / "simulated_energy_data.csv"
)

OUTPUT_DIR = PROJECT_ROOT / "data" / "processed"


# Detection rule
# Expected idle consumption is approximately 0.28 kW.
# We use 0.80 kW as an initial detection threshold.
IDLE_POWER_THRESHOLD_KW = 0.80


def load_energy_data():
    """Load and validate the simulated energy dataset."""

    if not ENERGY_DATA_PATH.exists():
        raise FileNotFoundError(
            f"Energy dataset not found: {ENERGY_DATA_PATH}"
        )

    data = pd.read_csv(ENERGY_DATA_PATH)

    required_columns = [
        "timestamp",
        "building_id",
        "room_id",
        "occupancy",
        "scheduled",
        "total_power_kw",
        "energy_kwh",
    ]

    missing_columns = [
        column for column in required_columns
        if column not in data.columns
    ]

    if missing_columns:
        raise ValueError(
            f"Missing required columns: {missing_columns}"
        )

    data["timestamp"] = pd.to_datetime(data["timestamp"])

    return data


def calculate_overall_metrics(data):
    """Calculate campus-wide energy metrics."""

    total_energy = data["energy_kwh"].sum()
    average_power = data["total_power_kw"].mean()
    peak_power = data["total_power_kw"].max()

    return {
        "total_energy_kwh": round(total_energy, 2),
        "average_power_kw": round(average_power, 3),
        "peak_power_kw": round(peak_power, 3),
        "total_records": len(data),
        "number_of_buildings": data["building_id"].nunique(),
        "number_of_rooms": data["room_id"].nunique(),
    }


def analyze_by_building(data):
    """Calculate energy consumption for each building."""

    summary = (
        data.groupby("building_id")
        .agg(
            total_energy_kwh=("energy_kwh", "sum"),
            average_power_kw=("total_power_kw", "mean"),
            peak_power_kw=("total_power_kw", "max"),
        )
        .reset_index()
    )

    summary = summary.round(3)

    return summary


def analyze_by_room(data):
    """Calculate energy consumption for each room."""

    summary = (
        data.groupby(["building_id", "room_id"])
        .agg(
            total_energy_kwh=("energy_kwh", "sum"),
            average_power_kw=("total_power_kw", "mean"),
            peak_power_kw=("total_power_kw", "max"),
        )
        .reset_index()
    )

    return summary.round(3)


def create_hourly_load_profile(data):
    """Calculate total campus demand for every hour."""

    profile = (
        data.groupby("timestamp")
        .agg(
            campus_power_kw=("total_power_kw", "sum"),
            campus_energy_kwh=("energy_kwh", "sum"),
        )
        .reset_index()
    )

    profile["campus_power_kw"] = profile["campus_power_kw"].round(3)
    profile["campus_energy_kwh"] = profile["campus_energy_kwh"].round(3)




    return profile


def detect_energy_waste(data):
    """
    Detect suspicious energy consumption outside
    scheduled operating hours.

    The detection rule does not use the waste_event
    column. That column is reserved for evaluation.
    """

    alerts = data[
        (data["scheduled"] == False)
        & (data["occupancy"] == 0)
        & (
            data["total_power_kw"]
            > IDLE_POWER_THRESHOLD_KW
        )
    ].copy()

    alerts["alert_reason"] = (
        "High electricity consumption outside "
        "scheduled hours with zero occupancy"
    )

    alerts["alert_severity"] = "High"

    return alerts


def evaluate_detection(data, alerts):
    """Compare detected alerts with injected simulation events."""

    actual_events = data["waste_event"].astype(bool)
    detected_events = data.index.isin(alerts.index)

    true_positives = int(
        (actual_events & detected_events).sum()
    )

    false_positives = int(
        (~actual_events & detected_events).sum()
    )

    false_negatives = int(
        (actual_events & ~detected_events).sum()
    )

    precision = (
        true_positives / (true_positives + false_positives)
        if true_positives + false_positives > 0
        else 0
    )

    recall = (
        true_positives / (true_positives + false_negatives)
        if true_positives + false_negatives > 0
        else 0
    )

    return {
        "actual_simulated_events": int(actual_events.sum()),
        "detected_alerts": len(alerts),
        "true_positives": true_positives,
        "false_positives": false_positives,
        "false_negatives": false_negatives,
        "precision": round(precision, 3),
        "recall": round(recall, 3),
    }


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    data = load_energy_data()

    # Overall campus metrics
    metrics = calculate_overall_metrics(data)

    # Building and room analysis
    building_summary = analyze_by_building(data)
    room_summary = analyze_by_room(data)

    # Hourly campus load profile
    hourly_profile = create_hourly_load_profile(data)

    # Rule-based waste detection
    alerts = detect_energy_waste(data)

    # Evaluate detection against injected simulation events
    evaluation = evaluate_detection(data, alerts)

    # Save analysis outputs
    building_summary.to_csv(
        OUTPUT_DIR / "building_energy_summary.csv",
        index=False,
    )

    room_summary.to_csv(
        OUTPUT_DIR / "room_energy_summary.csv",
        index=False,
    )

    hourly_profile.to_csv(
        OUTPUT_DIR / "hourly_load_profile.csv",
        index=False,
    )

    alerts.to_csv(
        OUTPUT_DIR / "detected_waste_alerts.csv",
        index=False,
    )

    # Display results
    print("\n========== CAMPUS ENERGY ANALYSIS ==========")

    for key, value in metrics.items():
        print(f"{key}: {value}")

    print("\n========== BUILDING ENERGY SUMMARY ==========")
    print(building_summary.to_string(index=False))

    print("\n========== WASTE DETECTION ==========")
    for key, value in evaluation.items():
        print(f"{key}: {value}")

    print("\n========== OUTPUT FILES ==========")
    print(f"Results saved in: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()

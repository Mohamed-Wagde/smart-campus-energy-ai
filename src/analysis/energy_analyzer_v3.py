from pathlib import Path
import hashlib
import json
import math

import pandas as pd


# --------------------------------------------------
# PROJECT PATHS
# --------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[2]

DATA_PATH = (
    PROJECT_ROOT / "data" / "raw" / "simulated_energy_data.csv"
)

CONFIG_PATH = (
    PROJECT_ROOT / "models" / "after_hours_thresholds_v3.json"
)

OUTPUT_PATH = (
    PROJECT_ROOT / "data" / "processed"
    / "detected_waste_alerts_v3.csv"
)


# --------------------------------------------------
# COMPONENT DEFINITIONS
# --------------------------------------------------

COMPONENTS = {
    "HVAC": "hvac_power_kw",
    "Lighting": "lighting_power_kw",
    "Equipment": "equipment_power_kw",
}

REQUIRED_COLUMNS = [
    "timestamp",
    "building_id",
    "room_id",
    "room_type",
    "occupancy",
    "scheduled",
    *COMPONENTS.values(),
]


# --------------------------------------------------
# DATA LOADING
# --------------------------------------------------

def load_energy_data():
    """Load energy data and validate required columns."""

    if not DATA_PATH.exists():
        raise FileNotFoundError(
            f"Energy dataset not found: {DATA_PATH}"
        )

    data = pd.read_csv(DATA_PATH)

    missing = [
        column for column in REQUIRED_COLUMNS
        if column not in data.columns
    ]

    if missing:
        raise ValueError(
            f"Missing required columns: {missing}"
        )

    data["timestamp"] = pd.to_datetime(
        data["timestamp"],
        errors="raise"
    )

    return data


# --------------------------------------------------
# CONFIGURATION VALIDATION
# --------------------------------------------------

def load_threshold_config():
    """Load and validate room-specific P99 thresholds."""

    if not CONFIG_PATH.exists():
        raise FileNotFoundError(
            f"Threshold configuration not found: {CONFIG_PATH}"
        )

    with CONFIG_PATH.open("r", encoding="utf-8") as file:
        config = json.load(file)

    if config.get("config_version") != "3.0":
        raise ValueError("Unsupported threshold config version.")

    if config.get("quantile") != 0.99:
        raise ValueError("Expected P99 threshold configuration.")

    if config.get("comparison") != "strictly_greater_than":
        raise ValueError("Unsupported threshold comparison rule.")

    if config.get("calibration", {}).get("grouping") != [
        "building_id",
        "room_id",
    ]:
        raise ValueError("Incorrect calibration grouping.")

    current_hash = hashlib.sha256(
        DATA_PATH.read_bytes()
    ).hexdigest()

    expected_hash = config.get(
        "calibration", {}
    ).get("dataset_sha256")

    if current_hash != expected_hash:
        raise ValueError(
            "Dataset fingerprint does not match calibration config."
        )

    rooms = config.get("rooms", {})

    if not rooms:
        raise ValueError("No room-specific thresholds found.")

    for key, room_config in rooms.items():

        building_id = str(room_config.get("building_id"))
        room_id = str(room_config.get("room_id"))

        expected_key = f"{building_id}::{room_id}"

        if key != expected_key:
            raise ValueError(
                f"Invalid room key: {key}"
            )

        if int(room_config.get("sample_count", 0)) <= 0:
            raise ValueError(
                f"Invalid calibration sample count for {key}"
            )

        if not room_config.get("room_type"):
            raise ValueError(
                f"Missing room_type for {key}"
            )

        for component, column in COMPONENTS.items():

            details = room_config.get(
                "components", {}
            ).get(component)

            if not details:
                raise ValueError(
                    f"Missing {component} threshold for {key}"
                )

            if details.get("column") != column:
                raise ValueError(
                    f"Incorrect column mapping for {key}/{component}"
                )

            value = details.get("threshold_kw")

            if (
                not isinstance(value, (int, float))
                or isinstance(value, bool)
                or not math.isfinite(value)
                or value < 0
            ):
                raise ValueError(
                    f"Invalid threshold for {key}/{component}"
                )

            if int(details.get("sample_count", 0)) <= 0:
                raise ValueError(
                    f"Invalid sample count for {key}/{component}"
                )

    return config


# --------------------------------------------------
# AFTER-HOURS COMPONENT DETECTOR V3
# --------------------------------------------------

def detect_energy_waste_v3(data, config):
    """
    Detect abnormal component consumption outside scheduled
    hours when occupancy is zero.

    Thresholds are specific to building_id + room_id.

    Ground-truth labels such as waste_event and waste_type
    are never used to make detection decisions.
    """

    missing = [
        column for column in REQUIRED_COLUMNS
        if column not in data.columns
    ]

    if missing:
        raise ValueError(
            f"Missing required columns: {missing}"
        )

    if not data.index.is_unique:
        raise ValueError(
            "DataFrame index must be unique for reliable evaluation."
        )

    result = data.copy()

    if result[
        ["building_id", "room_id", "room_type"]
    ].isna().any().any():
        raise ValueError(
            "Missing building_id, room_id, or room_type values."
        )

    result["building_id"] = (
        result["building_id"].astype(str)
    )

    result["room_id"] = (
        result["room_id"].astype(str)
    )

    result["room_type"] = (
        result["room_type"].astype(str)
    )

    result["room_calibration_key"] = (
        result["building_id"]
        + "::"
        + result["room_id"]
    )

    thresholds = config["rooms"]

    unknown_rooms = (
        set(result["room_calibration_key"].unique())
        - set(thresholds.keys())
    )

    if unknown_rooms:
        raise ValueError(
            "Rooms without calibration thresholds: "
            f"{sorted(unknown_rooms)}"
        )

    # Verify that room types agree with calibration metadata.
    for key, group in result.groupby(
        "room_calibration_key"
    ):
        expected_type = thresholds[key]["room_type"]

        if not (group["room_type"] == expected_type).all():
            raise ValueError(
                f"Room type mismatch for calibrated room {key}"
            )

    result["scheduled"] = result["scheduled"].astype(bool)

    numeric_columns = [
        "occupancy",
        *COMPONENTS.values(),
    ]

    for column in numeric_columns:
        result[column] = pd.to_numeric(
            result[column],
            errors="raise"
        )

        if result[column].isna().any():
            raise ValueError(
                f"Missing numeric values in {column}"
            )

    after_hours = (
        (~result["scheduled"])
        & (result["occupancy"] == 0)
    )

    for component, column in COMPONENTS.items():

        threshold_map = {
            key: room_config["components"][component][
                "threshold_kw"
            ]
            for key, room_config in thresholds.items()
        }

        threshold_values = (
            result["room_calibration_key"]
            .map(threshold_map)
        )

        if threshold_values.isna().any():
            raise ValueError(
                f"Missing room-specific {component} thresholds."
            )

        threshold_column = (
            f"{component.lower()}_threshold_kw"
        )

        flag_column = (
            f"{component.lower()}_exceeded"
        )

        result[threshold_column] = threshold_values

        result[flag_column] = (
            after_hours
            & (
                result[column]
                > threshold_values
            )
        )

    flag_columns = [
        f"{component.lower()}_exceeded"
        for component in COMPONENTS
    ]

    result["exceeded_component_count"] = (
        result[flag_columns].sum(axis=1)
    )

    result["detected_components"] = result.apply(
        lambda row: ", ".join(
            component
            for component in COMPONENTS
            if row[f"{component.lower()}_exceeded"]
        ),
        axis=1,
    )

    alerts = result[
        result["exceeded_component_count"] > 0
    ].copy()

    alerts["alert_reason"] = alerts.apply(
        lambda row: (
            "Abnormal after-hours consumption detected in: "
            f"{row['detected_components']}"
        ),
        axis=1,
    )

    alerts["alert_severity"] = (
        alerts["exceeded_component_count"]
        .map(
            lambda count: (
                "High" if count >= 2 else "Medium"
            )
        )
    )

    return alerts


# --------------------------------------------------
# DETECTION EVALUATION
# --------------------------------------------------

def evaluate_after_hours_detection(data, alerts):
    """
    Evaluate after-hours events only.

    waste_event and waste_type are used for evaluation,
    never for detector decisions.

    Scheduled HVAC_FAULT records are outside this detector's
    event evaluation scope.
    """

    evaluation_columns = [
        "scheduled",
        "occupancy",
        "waste_event",
    ]

    missing = [
        column for column in evaluation_columns
        if column not in data.columns
    ]

    if missing:
        raise ValueError(
            f"Missing evaluation columns: {missing}"
        )

    if not data.index.is_unique or not alerts.index.is_unique:
        raise ValueError(
            "Unique DataFrame indexes are required."
        )

    flag_columns = [
        f"{component.lower()}_exceeded"
        for component in COMPONENTS
    ]

    missing_flags = [
        column for column in flag_columns
        if column not in alerts.columns
    ]

    if missing_flags:
        raise ValueError(
            f"Missing detector flags: {missing_flags}"
        )

    aligned = alerts.reindex(data.index)

    flags = (
        aligned[flag_columns]
        .fillna(False)
        .astype(bool)
    )

    detected_rows = flags.any(axis=1)

    after_hours = (
        (~data["scheduled"].astype(bool))
        & (pd.to_numeric(data["occupancy"]) == 0)
    )

    normal_idle = (
        after_hours
        & (~data["waste_event"].astype(bool))
    )

    actual_after_hours_events = (
        after_hours
        & data["waste_event"].astype(bool)
    )

    normal_count = int(normal_idle.sum())
    event_count = int(actual_after_hours_events.sum())

    false_positive_rows = int(
        (detected_rows & normal_idle).sum()
    )

    detected_event_rows = int(
        (detected_rows & actual_after_hours_events).sum()
    )

    result = {
        "normal_idle_rows": normal_count,
        "after_hours_event_rows": event_count,
        "detected_alert_rows": int(detected_rows.sum()),
        "false_positive_rows": false_positive_rows,
        "row_level_false_positive_rate": round(
            false_positive_rows / normal_count, 5
        ) if normal_count else None,
        "detected_after_hours_event_rows": detected_event_rows,
        "row_level_event_detection_rate": round(
            detected_event_rows / event_count, 5
        ) if event_count else None,
        "component_metrics": {},
        "event_type_metrics": {},
    }

    for component, flag_column in zip(
        COMPONENTS, flag_columns
    ):
        component_flags = flags[flag_column]

        component_fp = int(
            (component_flags & normal_idle).sum()
        )

        result["component_metrics"][component] = {
            "false_positive_rows": component_fp,
            "false_positive_rate": round(
                component_fp / normal_count, 5
            ) if normal_count else None,
        }

    if "waste_type" in data.columns:

        event_types = data.loc[
            actual_after_hours_events,
            "waste_type"
        ]

        for event_type in sorted(
            event_types.dropna().unique()
        ):
            mask = (
                actual_after_hours_events
                & (data["waste_type"] == event_type)
            )

            total = int(mask.sum())
            detected = int(
                (detected_rows & mask).sum()
            )

            result["event_type_metrics"][
                str(event_type)
            ] = {
                "total_rows": total,
                "detected_rows": detected,
                "detection_rate": round(
                    detected / total, 5
                ) if total else None,
            }

    return result


# --------------------------------------------------
# MAIN
# --------------------------------------------------

def main():

    OUTPUT_PATH.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    data = load_energy_data()
    config = load_threshold_config()

    alerts = detect_energy_waste_v3(
        data,
        config
    )

    evaluation = evaluate_after_hours_detection(
        data,
        alerts
    )

    alerts.to_csv(
        OUTPUT_PATH,
        index=False
    )

    print("\n========== ENERGY DETECTION V3 ==========")
    print(f"Total input records: {len(data)}")
    print(f"Calibrated rooms: {len(config['rooms'])}")
    print(f"Detected alert rows: {len(alerts)}")

    print(
        "Rows with multiple exceeded components: "
        f"{int((alerts['exceeded_component_count'] >= 2).sum())}"
    )

    print("\n========== EVALUATION ==========")

    for key, value in evaluation.items():
        print(f"\n{key}:")

        if isinstance(value, dict):
            for sub_key, sub_value in value.items():
                print(f"  {sub_key}: {sub_value}")
        else:
            print(f"  {value}")

    print("\n========== ALERT DISTRIBUTION ==========")

    if not alerts.empty:
        print(
            alerts["detected_components"]
            .value_counts()
            .to_string()
        )
    else:
        print("No alerts detected.")

    print("\n========== OUTPUT ==========")
    print(OUTPUT_PATH)


if __name__ == "__main__":
    main()

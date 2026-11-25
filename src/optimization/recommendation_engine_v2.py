from pathlib import Path
import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[2]

ALERTS_PATH = (
    PROJECT_ROOT / "data" / "processed"
    / "detected_waste_alerts_v3.csv"
)

OUTPUT_PATH = (
    PROJECT_ROOT / "data" / "processed"
    / "energy_recommendations_v2.csv"
)

COMPONENTS = {
    "HVAC": {
        "flag": "hvac_exceeded",
        "power": "hvac_power_kw",
        "threshold": "hvac_threshold_kw",
        "action": (
            "Inspect HVAC operation and adjust its operating "
            "schedule when rooms are unoccupied."
        ),
    },
    "Lighting": {
        "flag": "lighting_exceeded",
        "power": "lighting_power_kw",
        "threshold": "lighting_threshold_kw",
        "action": (
            "Inspect lighting controls and switch off "
            "unnecessary lights in unoccupied rooms."
        ),
    },
    "Equipment": {
        "flag": "equipment_exceeded",
        "power": "equipment_power_kw",
        "threshold": "equipment_threshold_kw",
        "action": (
            "Inspect electrical equipment and switch off "
            "devices that are not required."
        ),
    },
}


def load_alerts():
    if not ALERTS_PATH.exists():
        raise FileNotFoundError(
            f"V3 alerts file not found: {ALERTS_PATH}"
        )

    alerts = pd.read_csv(ALERTS_PATH)

    required = [
        "timestamp",
        "building_id",
        "room_id",
        "room_type",
        "occupancy",
        "scheduled",
        *[
            item[key]
            for item in COMPONENTS.values()
            for key in ("flag", "power", "threshold")
        ],
    ]

    missing = [
        column for column in required
        if column not in alerts.columns
    ]

    if missing:
        raise ValueError(
            f"Missing required V3 alert columns: {missing}"
        )

    alerts["timestamp"] = pd.to_datetime(
        alerts["timestamp"],
        errors="raise"
    )

    if alerts.duplicated(
        ["building_id", "room_id", "timestamp"]
    ).any():
        raise ValueError(
            "Duplicate room/timestamp alert records found."
        )

    for component, details in COMPONENTS.items():
        flag = details["flag"]

        if alerts[flag].isna().any():
            raise ValueError(
                f"Missing detector flags for {component}"
            )

        if not alerts[flag].isin([True, False]).all():
            raise ValueError(
                f"Invalid detector flags for {component}"
            )

        for column in [details["power"], details["threshold"]]:
            alerts[column] = pd.to_numeric(
                alerts[column],
                errors="raise"
            )

            if alerts[column].isna().any():
                raise ValueError(
                    f"Missing numeric values in {column}"
                )

    return alerts


def generate_recommendations(alerts):
    recommendations = []

    for (building_id, room_id), room_alerts in alerts.groupby(
        ["building_id", "room_id"],
        sort=True
    ):
        room_type_values = room_alerts["room_type"].dropna().unique()

        if len(room_type_values) != 1:
            raise ValueError(
                f"Inconsistent room type: {building_id}/{room_id}"
            )

        for component, details in COMPONENTS.items():
            component_alerts = room_alerts[
                room_alerts[details["flag"]]
            ].copy()

            if component_alerts.empty:
                continue

            alert_count = len(component_alerts)

            excess = (
                component_alerts[details["power"]]
                - component_alerts[details["threshold"]]
            ).clip(lower=0)

            estimated_excess = float(excess.sum())

            if alert_count >= 5:
                priority = "High"
            elif alert_count >= 2:
                priority = "Medium"
            else:
                priority = "Low"

            recommendation_id = (
                f"{building_id}-{room_id}-{component.upper()}"
            )

            recommendations.append({
                "recommendation_id": recommendation_id,
                "detector_version": "3.0",
                "building_id": building_id,
                "room_id": room_id,
                "room_type": room_type_values[0],
                "component": component,
                "component_power_column": details["power"],
                "component_threshold_column": details["threshold"],
                "alert_count": alert_count,
                "normal_baseline_kw": round(
                    float(component_alerts[
                        details["threshold"]
                    ].iloc[0]), 4
                ),
                "estimated_excess_kwh": round(
                    estimated_excess, 4
                ),
                "priority": priority,
                "recommended_action": details["action"],
                "approval_required": True,
            })

    result = pd.DataFrame(recommendations)

    if not result.empty:
        if result["recommendation_id"].duplicated().any():
            raise ValueError("Duplicate recommendation IDs generated.")

        result = result.sort_values(
            ["estimated_excess_kwh"],
            ascending=False
        ).reset_index(drop=True)

    return result


def main():
    alerts = load_alerts()
    recommendations = generate_recommendations(alerts)

    OUTPUT_PATH.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    recommendations.to_csv(
        OUTPUT_PATH,
        index=False
    )

    print("\n========== RECOMMENDATION ENGINE V2 ==========")
    print("Detector version: 3.0")
    print("Input alert rows:", len(alerts))
    print("Unique rooms:", alerts[
        ["building_id", "room_id"]
    ].drop_duplicates().shape[0])

    print("Generated recommendations:", len(recommendations))

    if not recommendations.empty:
        print("\nRecommendations by component:")
        print(
            recommendations["component"]
            .value_counts()
            .to_string()
        )

        print("\nRecommendations by priority:")
        print(
            recommendations["priority"]
            .value_counts()
            .to_string()
        )

        print("\nEstimated excess by component:")
        print(
            recommendations.groupby("component")[
                "estimated_excess_kwh"
            ].sum().round(3).to_string()
        )

        print("\nTop recommendations:")
        print(recommendations.head(10).to_string(index=False))

    print("\nOutput:", OUTPUT_PATH)


if __name__ == "__main__":
    main()

from pathlib import Path

import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[2]

ALERTS_PATH = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "detected_waste_alerts.csv"
)

ENERGY_DATA_PATH = (
    PROJECT_ROOT
    / "data"
    / "raw"
    / "simulated_energy_data.csv"
)

OUTPUT_DIR = PROJECT_ROOT / "data" / "processed"

COMPONENTS = {
    "hvac_power_kw": {
        "name": "HVAC",
        "action": (
            "Inspect HVAC operation and adjust its "
            "operating schedule when rooms are unoccupied."
        ),
    },
    "lighting_power_kw": {
        "name": "Lighting",
        "action": (
            "Inspect lighting controls and switch off "
            "unnecessary lights in unoccupied rooms."
        ),
    },
    "equipment_power_kw": {
        "name": "Equipment",
        "action": (
            "Inspect electrical equipment and switch off "
            "devices that are not required."
        ),
    },
}


def load_data():
    """Load alerts and the complete energy dataset."""

    if not ALERTS_PATH.exists():
        raise FileNotFoundError(
            f"Alerts file not found: {ALERTS_PATH}"
        )

    if not ENERGY_DATA_PATH.exists():
        raise FileNotFoundError(
            f"Energy dataset not found: {ENERGY_DATA_PATH}"
        )

    alerts = pd.read_csv(ALERTS_PATH)
    energy = pd.read_csv(ENERGY_DATA_PATH)

    alerts["timestamp"] = pd.to_datetime(
        alerts["timestamp"]
    )

    energy["timestamp"] = pd.to_datetime(
        energy["timestamp"]
    )

    return alerts, energy



def identify_main_waste_source(room_alerts, room_history):
    """Identify the component with the largest excess over idle baseline."""

    IDLE_BASELINES = {
        "hvac_power_kw": 0.15,
        "lighting_power_kw": 0.05,
        "equipment_power_kw": 0.08,
    }

    component_excess = {}

    for column, details in COMPONENTS.items():

        baseline = IDLE_BASELINES[column]

        excess = (
            room_alerts[column] - baseline
        ).clip(lower=0).sum()

        component_excess[column] = {
            "name": details["name"],
            "action": details["action"],
            "baseline_kw": baseline,
            "estimated_excess_kwh": excess,
        }

    main_component = max(
        component_excess,
        key=lambda key: component_excess[key][
            "estimated_excess_kwh"
        ],
    )

    return component_excess[main_component]


def generate_recommendations(alerts, energy):
    """Generate component-specific recommendations."""

    recommendations = []

    grouped = alerts.groupby(
        ["building_id", "room_id"]
    )

    for (building_id, room_id), room_alerts in grouped:

        room_history = energy[
            (energy["building_id"] == building_id)
            & (energy["room_id"] == room_id)
        ]

        source = identify_main_waste_source(
            room_alerts,
            room_history,
        )

        alert_count = len(room_alerts)

        if alert_count >= 5:
            priority = "High"
        elif alert_count >= 2:
            priority = "Medium"
        else:
            priority = "Low"

        recommendations.append({
            "building_id": building_id,
            "room_id": room_id,
            "alert_count": alert_count,
            "main_waste_source": source["name"],
            "normal_baseline_kw": round(
                source["baseline_kw"], 3
            ),
            "estimated_excess_kwh": round(
                source["estimated_excess_kwh"], 3
            ),
            "priority": priority,
            "recommended_action": source["action"],
            "approval_required": True,
        })

    result = pd.DataFrame(recommendations)

    if not result.empty:
        result = result.sort_values(
            by="estimated_excess_kwh",
            ascending=False,
        )

    return result


def main():

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    alerts, energy = load_data()

    recommendations = generate_recommendations(
        alerts,
        energy,
    )

    output_path = (
        OUTPUT_DIR / "energy_recommendations.csv"
    )

    recommendations.to_csv(
        output_path,
        index=False,
    )

    print("\n========== SMART ENERGY RECOMMENDATIONS ==========")

    print(f"Total alerts analyzed: {len(alerts)}")

    print(
        f"Rooms with recommendations: "
        f"{len(recommendations)}"
    )

    if not recommendations.empty:

        print("\nWaste source distribution:")

        print(
            recommendations["main_waste_source"]
            .value_counts()
            .to_string()
        )

        print("\nTop recommendations:")

        print(
            recommendations.to_string(index=False)
        )

        print(
            "\nTotal estimated excess energy: "
            f"{recommendations['estimated_excess_kwh'].sum():.3f} kWh"
        )

    print("\n========== OUTPUT ==========")
    print(f"Saved to: {output_path}")


if __name__ == "__main__":
    main()

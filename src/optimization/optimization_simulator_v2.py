from pathlib import Path
import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[2]

ENERGY_PATH = (
    PROJECT_ROOT / "data" / "raw"
    / "simulated_energy_data.csv"
)

RECOMMENDATIONS_PATH = (
    PROJECT_ROOT / "data" / "processed"
    / "energy_recommendations_v2.csv"
)

APPROVALS_PATH = (
    PROJECT_ROOT / "data" / "processed"
    / "optimization_approvals_v2.csv"
)

OUTPUT_DIR = PROJECT_ROOT / "data" / "processed"

DETAILS_PATH = (
    OUTPUT_DIR / "optimization_simulation_details_v2.csv"
)

SUMMARY_PATH = (
    OUTPUT_DIR / "optimization_simulation_summary_v2.csv"
)

COMPONENTS = {
    "HVAC": "hvac_power_kw",
    "Lighting": "lighting_power_kw",
    "Equipment": "equipment_power_kw",
}

ELIGIBLE_CONDITIONS = {
    "occupancy": 0,
    "scheduled": False,
}

SMART_REDUCTION_RATE = 0.30


def load_inputs():
    for path in [
        ENERGY_PATH,
        RECOMMENDATIONS_PATH,
        APPROVALS_PATH,
    ]:
        if not path.exists():
            raise FileNotFoundError(
                f"Required input file not found: {path}"
            )

    energy = pd.read_csv(ENERGY_PATH)
    recommendations = pd.read_csv(RECOMMENDATIONS_PATH)
    approvals = pd.read_csv(APPROVALS_PATH)

    energy_required = [
        "timestamp",
        "building_id",
        "room_id",
        "occupancy",
        "scheduled",
        "hvac_power_kw",
        "lighting_power_kw",
        "equipment_power_kw",
    ]

    recommendation_required = [
        "recommendation_id",
        "building_id",
        "room_id",
        "component",
        "normal_baseline_kw",
        "approval_required",
    ]

    approval_required = [
        "recommendation_id",
        "approval_status",
    ]

    for name, df, required in [
        ("Energy", energy, energy_required),
        ("Recommendations", recommendations, recommendation_required),
        ("Approvals", approvals, approval_required),
    ]:
        missing = [c for c in required if c not in df.columns]

        if missing:
            raise ValueError(
                f"{name} file is missing columns: {missing}"
            )

    energy["timestamp"] = pd.to_datetime(
        energy["timestamp"],
        errors="raise"
    )

    if energy.duplicated(
        ["building_id", "room_id", "timestamp"]
    ).any():
        raise ValueError(
            "Duplicate room/timestamp records in energy data."
        )

    if recommendations["recommendation_id"].duplicated().any():
        raise ValueError("Duplicate recommendation IDs.")

    if approvals["recommendation_id"].duplicated().any():
        raise ValueError("Duplicate approval IDs.")

    if set(approvals["recommendation_id"]) != set(
        recommendations["recommendation_id"]
    ):
        raise ValueError(
            "Approval IDs do not exactly match recommendation IDs. "
            "Run approval_manager_v2.py first."
        )

    return energy, recommendations, approvals


def validate_approvals(recommendations, approvals):
    merged = recommendations.merge(
        approvals[
            ["recommendation_id", "approval_status"]
        ],
        on="recommendation_id",
        how="left",
        validate="one_to_one",
    )

    valid_statuses = {"Pending", "Approved", "Rejected"}

    invalid = set(
        merged["approval_status"].dropna().astype(str)
    ) - valid_statuses

    if invalid:
        raise ValueError(
            f"Invalid approval statuses: {sorted(invalid)}"
        )

    approved = merged[
        merged["approval_status"] == "Approved"
    ].copy()

    if not approved.empty:
        if not approved["component"].isin(COMPONENTS).all():
            raise ValueError(
                "Unknown component in approved recommendations."
            )

        approved["normal_baseline_kw"] = pd.to_numeric(
            approved["normal_baseline_kw"],
            errors="raise"
        )

        if approved["normal_baseline_kw"].isna().any():
            raise ValueError("Missing component thresholds.")

        if (approved["normal_baseline_kw"] < 0).any():
            raise ValueError("Negative component thresholds.")

        if approved.duplicated(
            ["building_id", "room_id", "component"]
        ).any():
            raise ValueError(
                "More than one approved recommendation for "
                "the same room and component."
            )

    return approved


def simulate(energy, approved):
    details_columns = [
        "timestamp",
        "building_id",
        "room_id",
        "approved_components",
        "original_total_power_kw",
        "smart_reduction_power_kw",
        "baseline_reduction_power_kw",
        "smart_savings_kwh",
        "baseline_savings_kwh",
    ]

    if approved.empty:
        return pd.DataFrame(columns=details_columns)

    approved_rooms = approved[
        ["building_id", "room_id"]
    ].drop_duplicates()

    data = energy.merge(
        approved_rooms,
        on=["building_id", "room_id"],
        how="inner",
        validate="many_to_one",
    )

    data = data[
        (data["occupancy"] == ELIGIBLE_CONDITIONS["occupancy"])
        & (data["scheduled"] == ELIGIBLE_CONDITIONS["scheduled"])
    ].copy()

    for column in COMPONENTS.values():
        data[column] = pd.to_numeric(
            data[column],
            errors="raise"
        )

        if data[column].isna().any():
            raise ValueError(
                f"Missing component measurements: {column}"
            )

        if (data[column] < 0).any():
            raise ValueError(
                f"Negative component measurements: {column}"
            )

    data["original_total_power_kw"] = sum(
        data[column] for column in COMPONENTS.values()
    )

    data["smart_reduction_power_kw"] = (
        data["original_total_power_kw"].copy()
    )

    data["baseline_reduction_power_kw"] = (
        data["original_total_power_kw"].copy()
    )

    approved_map = {}

    for _, recommendation in approved.iterrows():
        key = (
            recommendation["building_id"],
            recommendation["room_id"],
        )

        approved_map.setdefault(key, {})[
            recommendation["component"]
        ] = float(recommendation["normal_baseline_kw"])

    component_names = []

    for index, row in data.iterrows():
        key = (row["building_id"], row["room_id"])
        room_approvals = approved_map[key]

        active_components = []

        for component, column in COMPONENTS.items():
            if component not in room_approvals:
                continue

            threshold = room_approvals[component]
            current_power = float(row[column])

            excess = max(current_power - threshold, 0.0)

            smart_power = (
                current_power
                - SMART_REDUCTION_RATE * excess
            )

            baseline_power = min(
                current_power,
                threshold
            )

            data.at[index, "smart_reduction_power_kw"] += (
                smart_power - current_power
            )

            data.at[index, "baseline_reduction_power_kw"] += (
                baseline_power - current_power
            )

            if excess > 0:
                active_components.append(component)

        component_names.append(
            ", ".join(active_components)
        )

    data["approved_components"] = component_names

    data["smart_savings_kwh"] = (
        data["original_total_power_kw"]
        - data["smart_reduction_power_kw"]
    )

    data["baseline_savings_kwh"] = (
        data["original_total_power_kw"]
        - data["baseline_reduction_power_kw"]
    )

    result = data[details_columns].copy()

    return result


def build_summary(details, approved):
    scenarios = [
        ("Smart Reduction", "smart_reduction_power_kw"),
        ("Baseline Reduction", "baseline_reduction_power_kw"),
    ]

    rows = []

    rooms_simulated = (
        approved[["building_id", "room_id"]]
        .drop_duplicates()
        .shape[0]
        if not approved.empty else 0
    )

    for scenario, simulated_column in scenarios:
        original_energy = float(
            details["original_total_power_kw"].sum()
        )

        simulated_energy = float(
            details[simulated_column].sum()
        ) if not details.empty else 0.0

        savings = original_energy - simulated_energy

        savings_percentage = (
            savings / original_energy * 100
            if original_energy > 0 else 0.0
        )

        rows.append({
            "scenario": scenario,
            "approved_recommendations": len(approved),
            "rooms_simulated": rooms_simulated,
            "eligible_records": len(details),
            "original_energy_kwh": round(original_energy, 4),
            "simulated_energy_kwh": round(simulated_energy, 4),
            "estimated_savings_kwh": round(savings, 4),
            "savings_percentage": round(
                savings_percentage, 4
            ),
        })

    return pd.DataFrame(rows)


def main():
    energy, recommendations, approvals = load_inputs()

    approved = validate_approvals(
        recommendations,
        approvals
    )

    details = simulate(energy, approved)
    summary = build_summary(details, approved)

    OUTPUT_DIR.mkdir(
        parents=True,
        exist_ok=True
    )

    # Always overwrite both V2 outputs, including zero-approval runs.
    details.to_csv(DETAILS_PATH, index=False)
    summary.to_csv(SUMMARY_PATH, index=False)

    print("\n========== OPTIMIZATION SIMULATOR V2 ==========")
    print("Total recommendations:", len(recommendations))
    print("Approved recommendations:", len(approved))
    print("Pending recommendations:", (
        approvals["approval_status"] == "Pending"
    ).sum())
    print("Rejected recommendations:", (
        approvals["approval_status"] == "Rejected"
    ).sum())

    print("\nApproved components:")
    if approved.empty:
        print("No approved components.")
    else:
        print(
            approved["component"]
            .value_counts()
            .to_string()
        )

    print("\nSimulation summary:")
    print(summary.to_string(index=False))

    print("\nDetails output:", DETAILS_PATH)
    print("Summary output:", SUMMARY_PATH)


if __name__ == "__main__":
    main()

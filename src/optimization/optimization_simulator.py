from pathlib import Path
import pandas as pd


# Project paths
PROJECT_ROOT = Path(__file__).resolve().parents[2]

ENERGY_FILE = PROJECT_ROOT / "data" / "raw" / "simulated_energy_data.csv"
RECOMMENDATIONS_FILE = PROJECT_ROOT / "data" / "processed" / "energy_recommendations.csv"
APPROVALS_FILE = PROJECT_ROOT / "data" / "processed" / "optimization_approvals.csv"

OUTPUT_DIR = PROJECT_ROOT / "data" / "processed"

# Simulation settings
SMART_REDUCTION_RATE = 0.30


def load_data():
    """Load energy data, recommendations, and approval decisions."""

    energy = pd.read_csv(ENERGY_FILE)
    recommendations = pd.read_csv(RECOMMENDATIONS_FILE)
    approvals = pd.read_csv(APPROVALS_FILE)

    required_energy_columns = {
        "building_id",
        "room_id",
        "occupancy",
        "scheduled",
        "hvac_power_kw",
        "lighting_power_kw",
        "equipment_power_kw",
    }

    missing = required_energy_columns - set(energy.columns)

    if missing:
        raise ValueError(f"Missing energy columns: {missing}")

    return energy, recommendations, approvals


def run_simulation():
    energy, recommendations, approvals = load_data()

    # Keep only recommendations that have an explicit approval
    approvals["approval_status"] = (
        approvals["approval_status"].astype(str).str.strip().str.lower()
    )

    approved = approvals[
        approvals["approval_status"] == "approved"
    ].copy()

    if approved.empty:
        print("No approved recommendations found.")
        print("All recommendations are still Pending or Rejected.")
        print("Update approval_status to Approved before running the simulation.")
        return

    # Attach each approved room's normal HVAC baseline
    approved = approved.merge(
        recommendations[
            ["building_id", "room_id", "normal_baseline_kw"]
        ],
        on=["building_id", "room_id"],
        how="left",
    )

    if approved["normal_baseline_kw"].isna().any():
        raise ValueError(
            "A baseline value is missing for at least one approved room."
        )

    # Select energy records only for approved rooms
    approved_rooms = approved[
        ["building_id", "room_id", "normal_baseline_kw"]
    ].drop_duplicates(subset=["building_id", "room_id"])

    selected = energy.merge(
        approved_rooms,
        on=["building_id", "room_id"],
        how="inner",
    )

    if selected.empty:
        print("No energy records were found for the approved rooms.")
        return

    # Only reduce HVAC when the room is both unoccupied and unscheduled
    eligible = (
        (selected["occupancy"] == 0)
        & (selected["scheduled"] == 0)
    )

    selected["eligible_for_optimization"] = eligible

    # Original energy consumption
    selected["original_total_power_kw"] = (
        selected["hvac_power_kw"]
        + selected["lighting_power_kw"]
        + selected["equipment_power_kw"]
    )

    # Scenario 1: Smart Reduction
    selected["smart_hvac_power_kw"] = selected["hvac_power_kw"]

    reducible_excess = (
        selected["hvac_power_kw"] - selected["normal_baseline_kw"]
    ).clip(lower=0)

    selected.loc[eligible, "smart_hvac_power_kw"] = (
        selected.loc[eligible, "hvac_power_kw"]
        - SMART_REDUCTION_RATE * reducible_excess.loc[eligible]
    )

    # Scenario 2: Shutdown Simulation
    # Reduce HVAC to its baseline, not to zero.
    selected["shutdown_hvac_power_kw"] = selected["hvac_power_kw"]

    
    selected.loc[eligible, "shutdown_hvac_power_kw"] = (
    selected.loc[
        eligible,
        ["hvac_power_kw", "normal_baseline_kw"]
    ].min(axis=1)
)

    # Calculate total power for each scenario
    selected["smart_total_power_kw"] = (
        selected["smart_hvac_power_kw"]
        + selected["lighting_power_kw"]
        + selected["equipment_power_kw"]
    )

    selected["shutdown_total_power_kw"] = (
        selected["shutdown_hvac_power_kw"]
        + selected["lighting_power_kw"]
        + selected["equipment_power_kw"]
    )

    # Each record represents one hour, so kW for that record = kWh
    selected["original_energy_kwh"] = selected["original_total_power_kw"]
    selected["smart_energy_kwh"] = selected["smart_total_power_kw"]
    selected["shutdown_energy_kwh"] = selected["shutdown_total_power_kw"]

    # Calculate savings
    selected["smart_savings_kwh"] = (
        selected["original_energy_kwh"] - selected["smart_energy_kwh"]
    )

    selected["shutdown_savings_kwh"] = (
        selected["original_energy_kwh"] - selected["shutdown_energy_kwh"]
    )

    # Save detailed simulation results
    detail_file = OUTPUT_DIR / "optimization_simulation_details.csv"
    selected.to_csv(detail_file, index=False)

    # Build a comparison summary
    original_total = selected["original_energy_kwh"].sum()
    smart_total = selected["smart_energy_kwh"].sum()
    shutdown_total = selected["shutdown_energy_kwh"].sum()

    summary = pd.DataFrame([
        {
            "scenario": "Smart Reduction",
            "rooms_simulated": len(approved_rooms),
            "eligible_records": int(eligible.sum()),
            "original_energy_kwh": original_total,
            "simulated_energy_kwh": smart_total,
            "estimated_savings_kwh": original_total - smart_total,
        },
        {
            "scenario": "Shutdown Simulation",
            "rooms_simulated": len(approved_rooms),
            "eligible_records": int(eligible.sum()),
            "original_energy_kwh": original_total,
            "simulated_energy_kwh": shutdown_total,
            "estimated_savings_kwh": original_total - shutdown_total,
        },
    ])

    summary["savings_percentage"] = (
        summary["estimated_savings_kwh"] / original_total * 100
        if original_total > 0
        else 0
    )

    summary_file = OUTPUT_DIR / "optimization_simulation_summary.csv"
    summary.to_csv(summary_file, index=False)

    print("\n========== OPTIMIZATION SIMULATION ==========")
    print(f"Approved rooms: {len(approved_rooms)}")
    print(f"Eligible hourly records: {int(eligible.sum())}")
    print(f"Total selected records: {len(selected)}")

    print("\n========== SCENARIO COMPARISON ==========")
    print(summary.to_string(index=False))

    print("\nFiles created:")
    print(detail_file)
    print(summary_file)


if __name__ == "__main__":
    run_simulation()
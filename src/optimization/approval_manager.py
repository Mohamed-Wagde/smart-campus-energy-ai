from pathlib import Path

import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[2]

RECOMMENDATIONS_PATH = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "energy_recommendations.csv"
)

APPROVALS_PATH = (
    PROJECT_ROOT
    / "data"
    / "processed"
    / "optimization_approvals.csv"
)


def main():
    if not RECOMMENDATIONS_PATH.exists():
        raise FileNotFoundError(
            f"Recommendations file not found: {RECOMMENDATIONS_PATH}"
        )

    recommendations = pd.read_csv(
        RECOMMENDATIONS_PATH
    )

    required_columns = [
        "building_id",
        "room_id",
        "main_waste_source",
        "estimated_excess_kwh",
        "recommended_action",
        "approval_required",
    ]

    missing = [
        col for col in required_columns
        if col not in recommendations.columns
    ]

    if missing:
        raise ValueError(
            f"Missing columns: {missing}"
        )

    if APPROVALS_PATH.exists():
        print(
            "Approval file already exists. "
            "Existing decisions were preserved."
        )

        approvals = pd.read_csv(APPROVALS_PATH)

    else:
        approvals = recommendations[required_columns].copy()

        approvals["approval_status"] = "Pending"
        approvals["approved_by"] = ""
        approvals["approval_notes"] = ""

        approvals.to_csv(
            APPROVALS_PATH,
            index=False,
        )

        print("Approval file created successfully.")

    print("\n========== APPROVAL STATUS ==========")

    print(
        approvals[
            [
                "building_id",
                "room_id",
                "main_waste_source",
                "approval_status",
            ]
        ].to_string(index=False)
    )

    print("\n========== SUMMARY ==========")

    print(
        approvals["approval_status"]
        .value_counts()
        .to_string()
    )

    print(f"\nSaved at: {APPROVALS_PATH}")


if __name__ == "__main__":
    main()

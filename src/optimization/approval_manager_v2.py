from pathlib import Path
import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[2]

RECOMMENDATIONS_PATH = (
    PROJECT_ROOT / "data" / "processed"
    / "energy_recommendations_v2.csv"
)

APPROVALS_PATH = (
    PROJECT_ROOT / "data" / "processed"
    / "optimization_approvals_v2.csv"
)

IDENTITY_COLUMNS = [
    "recommendation_id",
    "building_id",
    "room_id",
    "component",
    "recommended_action",
    "normal_baseline_kw",
]


def load_recommendations():
    if not RECOMMENDATIONS_PATH.exists():
        raise FileNotFoundError(
            f"Recommendations not found: {RECOMMENDATIONS_PATH}"
        )

    df = pd.read_csv(RECOMMENDATIONS_PATH)

    required = IDENTITY_COLUMNS + [
        "estimated_excess_kwh",
        "approval_required",
        "priority",
    ]

    missing = [c for c in required if c not in df.columns]

    if missing:
        raise ValueError(
            f"Missing recommendation columns: {missing}"
        )

    if df["recommendation_id"].duplicated().any():
        raise ValueError("Duplicate recommendation IDs found.")

    return df


def create_approvals(recommendations):
    current = recommendations.copy()

    if APPROVALS_PATH.exists():
        previous = pd.read_csv(APPROVALS_PATH)

        required_previous = (
            IDENTITY_COLUMNS
            + ["approval_status", "approved_by", "approval_notes"]
        )

        missing = [
            c for c in required_previous
            if c not in previous.columns
        ]

        if missing:
            raise ValueError(
                "Existing approvals file has unexpected schema. "
                f"Missing: {missing}"
            )

        if previous["recommendation_id"].duplicated().any():
            raise ValueError(
                "Duplicate recommendation IDs in existing approvals."
            )

        previous = previous.set_index("recommendation_id")

        preserved = []

        for _, row in current.iterrows():
            rec_id = row["recommendation_id"]

            if rec_id not in previous.index:
                preserved.append({
                    "approval_status": "Pending",
                    "approved_by": "",
                    "approval_notes": "",
                })
                continue

            old = previous.loc[rec_id]

            unchanged = all(
                str(row[column]) == str(old[column])
                for column in IDENTITY_COLUMNS[1:]
            )

            if unchanged:
                status = str(old["approval_status"]).strip()

                if status not in ["Pending", "Approved", "Rejected"]:
                    raise ValueError(
                        f"Invalid approval status for {rec_id}: {status}"
                    )

                preserved.append({
                    "approval_status": status,
                    "approved_by": old["approved_by"],
                    "approval_notes": old["approval_notes"],
                })
            else:
                preserved.append({
                    "approval_status": "Pending",
                    "approved_by": "",
                    "approval_notes": "Reset: recommendation details changed.",
                })

        approval_fields = pd.DataFrame(preserved)

        result = pd.concat(
            [
                current.reset_index(drop=True),
                approval_fields.reset_index(drop=True),
            ],
            axis=1,
        )

    else:
        result = current.copy()

        result["approval_status"] = "Pending"
        result["approved_by"] = ""
        result["approval_notes"] = ""

    return result


def main():
    recommendations = load_recommendations()
    approvals = create_approvals(recommendations)

    APPROVALS_PATH.parent.mkdir(
        parents=True,
        exist_ok=True
    )

    approvals.to_csv(
        APPROVALS_PATH,
        index=False
    )

    print("\n========== APPROVAL MANAGER V2 ==========")
    print("Recommendations:", len(recommendations))
    print("Approval records:", len(approvals))

    print("\nApproval status:")
    print(
        approvals["approval_status"]
        .value_counts(dropna=False)
        .to_string()
    )

    print("\nApproval distribution by component:")
    print(
        approvals.groupby(
            ["component", "approval_status"]
        ).size().to_string()
    )

    print("\nSample approval records:")
    print(
        approvals[
            [
                "recommendation_id",
                "component",
                "estimated_excess_kwh",
                "approval_status",
                "approved_by",
            ]
        ].head(10).to_string(index=False)
    )

    print("\nOutput:", APPROVALS_PATH)


if __name__ == "__main__":
    main()

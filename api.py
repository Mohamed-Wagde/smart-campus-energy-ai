from pathlib import Path

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware


# Project paths
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data" / "processed"

app = FastAPI(
    title="Smart Campus Energy Optimization API",
    description="Read-only API for the Smart Campus Dashboard",
    version="1.0.0",
)

# Allow the local React/Vite dashboard to communicate with the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def read_csv(filename: str) -> pd.DataFrame:
    """Read a processed CSV file without modifying it."""
    file_path = DATA_DIR / filename

    if not file_path.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Data file not found: {filename}",
        )

    try:
        return pd.read_csv(file_path)
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Could not read {filename}: {str(exc)}",
        )


def to_records(df: pd.DataFrame) -> list:
    """Convert a DataFrame to JSON-friendly records."""
    clean_df = df.astype(object).where(pd.notna(df), None)
    return clean_df.to_dict(orient="records")


def get_overview() -> dict:
    hourly = read_csv("hourly_load_profile.csv")
    alerts = read_csv("detected_waste_alerts.csv")
    approvals = read_csv("optimization_approvals.csv")
    optimization = read_csv("optimization_simulation_summary.csv")

    energy = pd.to_numeric(
        hourly["campus_energy_kwh"], errors="coerce"
    )
    power = pd.to_numeric(
        hourly["campus_power_kw"], errors="coerce"
    )

    timestamps = pd.to_datetime(
        hourly["timestamp"], errors="coerce"
    )

    approved_count = 0
    if "approval_status" in approvals.columns:
        approved_count = int(
            approvals["approval_status"]
            .astype(str)
            .str.strip()
            .str.lower()
            .eq("approved")
            .sum()
        )

    return {
        "total_energy_kwh": round(float(energy.sum()), 2),
        "average_power_kw": round(float(power.mean()), 2),
        "peak_power_kw": round(float(power.max()), 2),
        "active_alerts": int(len(alerts)),
        "approved_rooms": approved_count,
        "data_start": (
            timestamps.min().isoformat()
            if timestamps.notna().any()
            else None
        ),
        "data_end": (
            timestamps.max().isoformat()
            if timestamps.notna().any()
            else None
        ),
        "data_type": "Historical simulation data",
        "optimization_scenarios": to_records(optimization),
    }


@app.get("/")
def root():
    return {
        "message": "Smart Campus Energy Optimization API",
        "docs": "/docs",
        "health": "/api/health",
    }


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "message": "API is running",
    }


@app.get("/api/overview")
def overview():
    return get_overview()


@app.get("/api/hourly")
def hourly_load():
    df = read_csv("hourly_load_profile.csv")
    return to_records(df)


@app.get("/api/buildings")
def buildings():
    df = read_csv("building_energy_summary.csv")
    return to_records(df)


@app.get("/api/rooms")
def rooms():
    df = read_csv("room_energy_summary.csv")
    return to_records(df)


@app.get("/api/alerts")
def alerts():
    df = read_csv("detected_waste_alerts.csv")

    if "timestamp" in df.columns:
        df = df.sort_values("timestamp", ascending=False)

    return to_records(df)


@app.get("/api/recommendations")
def recommendations():
    df = read_csv("energy_recommendations.csv")
    return to_records(df)


@app.get("/api/approvals")
def approvals():
    df = read_csv("optimization_approvals.csv")
    return to_records(df)


@app.get("/api/optimization")
def optimization():
    df = read_csv("optimization_simulation_summary.csv")
    return to_records(df)


@app.get("/api/dashboard")
def dashboard():
    """Return the main dashboard data in one response."""
    return {
        "overview": get_overview(),
        "hourly": hourly_load(),
        "buildings": buildings(),
        "alerts": alerts(),
        "recommendations": recommendations(),
        "approvals": approvals(),
        "optimization": optimization(),
    }


# ============================================================
# API V2 - Detection, Recommendations, Approvals, Simulation
# ============================================================

import subprocess
import sys
import threading
from typing import Literal

from pydantic import BaseModel, Field


V2_ALERTS_FILE = "detected_waste_alerts_v3.csv"
V2_RECOMMENDATIONS_FILE = "energy_recommendations_v2.csv"
V2_APPROVALS_FILE = "optimization_approvals_v2.csv"
V2_SIMULATION_SUMMARY_FILE = "optimization_simulation_summary_v2.csv"
V2_SIMULATION_DETAILS_FILE = "optimization_simulation_details_v2.csv"

V2_SIMULATOR_PATH = (
    BASE_DIR / "src" / "optimization"
    / "optimization_simulator_v2.py"
)

# Prevent simultaneous approval writes or overlapping simulations.
v2_operation_lock = threading.Lock()


class ApprovalUpdate(BaseModel):
    approval_status: Literal["Pending", "Approved", "Rejected"]
    approved_by: str | None = Field(default=None, max_length=120)
    approval_notes: str | None = Field(default=None, max_length=1000)


def write_csv_atomically(df: pd.DataFrame, filename: str):
    """Write a CSV through a temporary file to reduce partial-write risk."""
    target = DATA_DIR / filename
    temporary = DATA_DIR / f".{filename}.tmp"

    try:
        df.to_csv(temporary, index=False)
        temporary.replace(target)
    except Exception:
        if temporary.exists():
            temporary.unlink()
        raise


def read_v2_csv(filename: str) -> pd.DataFrame:
    return read_csv(filename)


@app.get("/api/v2/alerts")
def v2_alerts():
    df = read_v2_csv(V2_ALERTS_FILE)

    if "timestamp" in df.columns:
        df = df.sort_values("timestamp", ascending=False)

    return to_records(df)


@app.get("/api/v2/recommendations")
def v2_recommendations():
    df = read_v2_csv(V2_RECOMMENDATIONS_FILE)

    if "priority" in df.columns:
        priority_order = {"High": 0, "Medium": 1, "Low": 2}
        df["_priority_order"] = (
            df["priority"].map(priority_order).fillna(3)
        )
        df = df.sort_values(
            ["_priority_order", "estimated_excess_kwh"],
            ascending=[True, False],
        ).drop(columns=["_priority_order"])

    return to_records(df)


@app.get("/api/v2/approvals")
def v2_approvals():
    df = read_v2_csv(V2_APPROVALS_FILE)

    if "approval_status" not in df.columns:
        raise HTTPException(
            status_code=500,
            detail="V2 approvals file has no approval_status column.",
        )

    return to_records(df)


@app.post("/api/v2/approvals/{recommendation_id}")
def update_v2_approval(
    recommendation_id: str,
    payload: ApprovalUpdate,
):
    if (
        payload.approval_status == "Approved"
        and not (payload.approved_by or "").strip()
    ):
        raise HTTPException(
            status_code=422,
            detail="approved_by is required when approving a recommendation.",
        )

    with v2_operation_lock:
        df = read_v2_csv(V2_APPROVALS_FILE)

        required_columns = {
            "recommendation_id",
            "approval_status",
            "approved_by",
            "approval_notes",
        }

        missing = required_columns - set(df.columns)

        if missing:
            raise HTTPException(
                status_code=500,
                detail=f"Approvals file is missing columns: {sorted(missing)}",
            )

        matches = df.index[
            df["recommendation_id"].astype(str)
            == recommendation_id
        ].tolist()

        if not matches:
            raise HTTPException(
                status_code=404,
                detail=f"Recommendation not found: {recommendation_id}",
            )

        if len(matches) > 1:
            raise HTTPException(
                status_code=409,
                detail="Duplicate recommendation IDs found in approvals file.",
            )

        index = matches[0]

        # CSV columns containing only empty values may be inferred as float64.
        # Convert editable text columns explicitly before assigning strings.
        for column in ["approval_status", "approved_by", "approval_notes"]:
            df[column] = df[column].fillna("").astype(object)

        df.at[index, "approval_status"] = payload.approval_status
        df.at[index, "approved_by"] = (
            (payload.approved_by or "").strip()
        )
        df.at[index, "approval_notes"] = (
            (payload.approval_notes or "").strip()
        )

        try:
            write_csv_atomically(df, V2_APPROVALS_FILE)
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Could not save approval: {str(exc)}",
            )

        updated = df.loc[index].to_dict()
        updated = {
            key: value if pd.notna(value) else None
            for key, value in updated.items()
        }

    return {
        "message": "Approval updated successfully.",
        "approval": updated,
        "simulation_run": False,
    }


@app.post("/api/v2/simulate")
def run_v2_simulation():
    if not V2_SIMULATOR_PATH.exists():
        raise HTTPException(
            status_code=500,
            detail="V2 simulator script was not found.",
        )

    with v2_operation_lock:
        try:
            result = subprocess.run(
                [sys.executable, str(V2_SIMULATOR_PATH)],
                cwd=str(BASE_DIR),
                capture_output=True,
                text=True,
                timeout=300,
                check=False,
            )
        except subprocess.TimeoutExpired:
            raise HTTPException(
                status_code=504,
                detail="V2 simulation exceeded the 300-second time limit.",
            )
        except Exception as exc:
            raise HTTPException(
                status_code=500,
                detail=f"Could not start V2 simulation: {str(exc)}",
            )

        if result.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail={
                    "message": "V2 simulation failed.",
                    "return_code": result.returncode,
                    "stderr": result.stderr[-5000:],
                    "stdout": result.stdout[-5000:],
                },
            )

        try:
            summary = read_v2_csv(V2_SIMULATION_SUMMARY_FILE)
        except HTTPException:
            raise HTTPException(
                status_code=500,
                detail="Simulation finished but its summary file is missing.",
            )

    return {
        "message": "V2 simulation completed successfully.",
        "stdout": result.stdout,
        "summary": to_records(summary),
    }


@app.get("/api/v2/optimization")
def v2_optimization():
    summary = read_v2_csv(V2_SIMULATION_SUMMARY_FILE)
    return to_records(summary)


@app.get("/api/v2/optimization/details")
def v2_optimization_details():
    details = read_v2_csv(V2_SIMULATION_DETAILS_FILE)
    return to_records(details)

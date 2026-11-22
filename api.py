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

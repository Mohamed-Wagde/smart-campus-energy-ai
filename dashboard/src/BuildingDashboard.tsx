import {
  Activity,
  ArrowLeft,
  BellRing,
  CheckCircle2,
  Clock3,
  Lightbulb,
  Zap,
  XCircle,
} from "lucide-react";
import "./BuildingDashboard.css";

import type {
  AlertRecord,
  ApprovalRecord,
  BuildingRecord,
  RecommendationRecord,
} from "./api";

interface BuildingDashboardProps {
  building: BuildingRecord;
  alerts: AlertRecord[];
  recommendations: RecommendationRecord[];
  approvals: ApprovalRecord[];
  onBack: () => void;
  onOpenManagement: () => void;
}

const BUILDING_INFO: Record<
  string,
  { name: string; subtitle: string; accent: string; code: string }
> = {
  B01: {
    name: "Academic Building",
    subtitle: "Learning & Education",
    accent: "#287bd4",
    code: "01",
  },
  B02: {
    name: "Technology Building",
    subtitle: "Research & Computing",
    accent: "#13a6b5",
    code: "02",
  },
  B03: {
    name: "Innovation Building",
    subtitle: "Innovation & Development",
    accent: "#8875e8",
    code: "03",
  },
};

const number = (value: number, decimals = 2) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

function StatCard({
  label,
  value,
  unit,
  icon,
  accent,
  description,
}: {
  label: string;
  value: string;
  unit: string;
  icon: React.ReactNode;
  accent: string;
  description: string;
}) {
  return (
    <article className="building-stat-card">
      <div className="building-stat-top">
        <span>{label}</span>
        <span
          className="building-stat-icon"
          style={{ color: accent, background: `${accent}18` }}
        >
          {icon}
        </span>
      </div>

      <div className="building-stat-value">
        {value}
        <span>{unit}</span>
      </div>

      <p>{description}</p>
    </article>
  );
}

function StatusCount({
  label,
  count,
  color,
  icon,
}: {
  label: string;
  count: number;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="building-status-count">
      <span style={{ color }}>{icon}</span>
      <div>
        <strong>{count}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

export default function BuildingDashboard({
  building,
  alerts,
  recommendations,
  approvals,
  onBack,
  onOpenManagement,
}: BuildingDashboardProps) {
  const info = BUILDING_INFO[building.building_id] ?? {
    name: building.building_id,
    subtitle: "Campus facility",
    accent: "#48caff",
    code: building.building_id,
  };

  const pending = approvals.filter(
    (item) => item.approval_status === "Pending",
  ).length;

  const approved = approvals.filter(
    (item) => item.approval_status === "Approved",
  ).length;

  const rejected = approvals.filter(
    (item) => item.approval_status === "Rejected",
  ).length;

  const componentTotals = [
    {
      name: "HVAC",
      value: alerts.reduce((sum, item) => sum + item.hvac_power_kw, 0),
      color: "#48caff",
    },
    {
      name: "Lighting",
      value: alerts.reduce((sum, item) => sum + item.lighting_power_kw, 0),
      color: "#f5bd65",
    },
    {
      name: "Equipment",
      value: alerts.reduce((sum, item) => sum + item.equipment_power_kw, 0),
      color: "#a78bfa",
    },
  ];

  const componentTotal = componentTotals.reduce(
    (sum, item) => sum + item.value,
    0,
  );

  const recentAlerts = [...alerts]
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() -
        new Date(a.timestamp).getTime(),
    )
    .slice(0, 6);

  const totalEstimatedExcess = recommendations.reduce(
    (sum, item) => sum + item.estimated_excess_kwh,
    0,
  );

  return (
    <div
      className="building-dashboard"
      style={{ "--building-accent": info.accent } as React.CSSProperties}
    >
      <div className="building-breadcrumb">
        <button onClick={onBack}>
          <ArrowLeft size={16} />
          Campus Overview
        </button>
        <span>/</span>
        <strong>{building.building_id}</strong>
      </div>

      <section className="building-hero">
        <div className="building-hero-copy">
          <div className="building-eyebrow">
            <span />
            BUILDING ENERGY PROFILE
          </div>

          <div className="building-title-row">
            <div className="building-code">{info.code}</div>
            <div>
              <h1>{info.name}</h1>
              <p>{info.subtitle}</p>
            </div>
          </div>

          <p className="building-hero-description">
            Monitor energy consumption, review detected waste events, and
            manage optimization recommendations for this building.
          </p>

          <div className="building-hero-meta">
            <span>
              <Zap size={14} />
              Historical energy data
            </span>
            <span>
              <Activity size={14} />
              {alerts.length} detected alerts
            </span>
          </div>
        </div>

        <div className="building-hero-visual">
          <div className="building-visual-ring building-ring-one" />
          <div className="building-visual-ring building-ring-two" />
          <div className="building-visual-core">
            <Zap size={38} />
          </div>
        </div>
      </section>

      <section className="building-section-heading">
        <div>
          <span>ENERGY PERFORMANCE</span>
          <h2>Building at a glance</h2>
          <p>Recorded metrics for {building.building_id}</p>
        </div>
        <span className="building-simulated-badge">SIMULATED DATA</span>
      </section>

      <section className="building-stats-grid">
        <StatCard
          label="Total Energy"
          value={number(building.total_energy_kwh)}
          unit="kWh"
          icon={<Zap size={19} />}
          accent="#48caff"
          description="Recorded building consumption"
        />

        <StatCard
          label="Average Demand"
          value={number(building.average_power_kw)}
          unit="kW"
          icon={<Activity size={19} />}
          accent="#37d6b0"
          description="Average recorded power"
        />

        <StatCard
          label="Peak Demand"
          value={number(building.peak_power_kw)}
          unit="kW"
          icon={<BellRing size={19} />}
          accent="#b18aff"
          description="Highest recorded power"
        />

        <StatCard
          label="Waste Alerts"
          value={number(alerts.length, 0)}
          unit="alerts"
          icon={<Clock3 size={19} />}
          accent="#ffb45c"
          description="Detected events in this building"
        />
      </section>

      <section className="building-content-grid">
        <article className="building-panel building-components-panel">
          <div className="building-panel-heading">
            <div>
              <h3>Component power samples</h3>
              <p>Sum of component power values across detected alert records</p>
            </div>
            <Zap size={19} />
          </div>

          {componentTotal > 0 ? (
            <div className="building-component-list">
              {componentTotals.map((item) => {
                const share = (item.value / componentTotal) * 100;

                return (
                  <div className="building-component-item" key={item.name}>
                    <div className="building-component-label">
                      <strong>{item.name}</strong>
                      <span>
                        {number(item.value)} kW-samples · {number(share, 1)}%
                      </span>
                    </div>
                    <div className="building-component-track">
                      <span
                        style={{
                          width: `${share}%`,
                          background: item.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="building-empty">No component alert samples available.</p>
          )}

          <p className="building-chart-note">
            These are aggregated power samples from detected alert records,
            not total building energy consumption by component.
          </p>
        </article>

        <article className="building-panel building-approval-panel">
          <div className="building-panel-heading">
            <div>
              <h3>Approval workflow</h3>
              <p>Recommendation decisions for this building</p>
            </div>
            <CheckCircle2 size={19} />
          </div>

          <div className="building-approval-total">
            <strong>{approvals.length}</strong>
            <span>Total approvals</span>
          </div>

          <div className="building-status-list">
            <StatusCount
              label="Pending"
              count={pending}
              color="#f5bd65"
              icon={<Clock3 size={17} />}
            />
            <StatusCount
              label="Approved"
              count={approved}
              color="#37d6b0"
              icon={<CheckCircle2 size={17} />}
            />
            <StatusCount
              label="Rejected"
              count={rejected}
              color="#ff777f"
              icon={<XCircle size={17} />}
            />
          </div>

          <button
            className="building-management-button"
            onClick={onOpenManagement}
          >
            Manage recommendations
            <ArrowLeft size={15} />
          </button>
        </article>
      </section>

      <section className="building-panel building-recommendations-panel">
        <div className="building-panel-heading">
          <div>
            <h3>Optimization recommendations</h3>
            <p>Suggested actions generated for this building</p>
          </div>
          <Lightbulb size={20} />
        </div>

        <div className="building-recommendation-summary">
          <div>
            <strong>{recommendations.length}</strong>
            <span>Recommendations</span>
          </div>
          <div>
            <strong>{number(totalEstimatedExcess)} kWh</strong>
            <span>Estimated excess energy</span>
          </div>
        </div>

        {recommendations.length > 0 ? (
          <div className="building-recommendation-list">
            {recommendations.map((item, index) => (
              <article
                className="building-recommendation-item"
                key={`${item.building_id}-${item.room_id}-${item.main_waste_source}-${index}`}
              >
                <div className="building-recommendation-symbol">
                  <Lightbulb size={17} />
                </div>
                <div className="building-recommendation-copy">
                  <div className="building-recommendation-title">
                    <strong>{item.main_waste_source} · {item.room_id}</strong>
                    <span>{item.priority} priority</span>
                  </div>
                  <p>{item.recommended_action}</p>
                  <small>
                    Estimated excess: {number(item.estimated_excess_kwh)} kWh
                    · {item.alert_count} alert(s)
                  </small>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="building-empty">No recommendations for this building.</p>
        )}
      </section>

      <section className="building-panel building-alerts-panel">
        <div className="building-panel-heading">
          <div>
            <h3>Recent detected alerts</h3>
            <p>Latest available alert records for this building</p>
          </div>
          <BellRing size={19} />
        </div>

        {recentAlerts.length > 0 ? (
          <div className="building-alert-list">
            {recentAlerts.map((alert, index) => (
              <div
                className="building-alert-item"
                key={`${alert.room_id}-${alert.timestamp}-${index}`}
              >
                <div className="building-alert-indicator" />
                <div className="building-alert-main">
                  <strong>{alert.room_id}</strong>
                  <span>{alert.alert_reason || "Detected energy waste"}</span>
                </div>
                <div className="building-alert-meta">
                  <span>{alert.alert_severity || "Detected"}</span>
                  <small>
                    {new Date(alert.timestamp.replace(" ", "T")).toLocaleString(
                      "en-US",
                      {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}
                  </small>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="building-empty">No alerts recorded for this building.</p>
        )}
      </section>

      <p className="building-dashboard-disclaimer">
        All figures are derived from the project's historical simulated
        dataset. Component samples are based on detected alert records;
        estimated excess energy is not guaranteed savings.
      </p>
    </div>
  );
}

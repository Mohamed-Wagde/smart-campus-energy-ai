import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Play,
  RefreshCw,
  XCircle,
  Zap,
} from "lucide-react";

import {
  fetchV2DashboardData,
  updateV2Approval,
  runV2Simulation,
  type V2DashboardData,
  type V2ApprovalRecord,
} from "./api";

type ApprovalFilter = "All" | "Pending" | "Approved" | "Rejected";

function formatNumber(value: number): string {
  return Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string): string {
  const date = new Date(value.replace(" ", "T"));

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function V2Management() {
  const [data, setData] = useState<V2DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [simulating, setSimulating] = useState(false);

  const [approver, setApprover] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const [componentFilter, setComponentFilter] = useState("All");
  const [statusFilter, setStatusFilter] =
    useState<ApprovalFilter>("All");

  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadData(initial = false) {
    try {
      if (initial) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      setError("");

      const result = await fetchV2DashboardData();
      setData(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load V2 management data."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadData(true);
  }, []);

  const approvals = data?.approvals ?? [];

  const filteredApprovals = useMemo(() => {
    return approvals.filter((item) => {
      const matchesComponent =
        componentFilter === "All" ||
        item.component === componentFilter;

      const matchesStatus =
        statusFilter === "All" ||
        item.approval_status === statusFilter;

      return matchesComponent && matchesStatus;
    });
  }, [approvals, componentFilter, statusFilter]);

  const pendingCount = approvals.filter(
    (item) => item.approval_status === "Pending"
  ).length;

  const approvedCount = approvals.filter(
    (item) => item.approval_status === "Approved"
  ).length;

  const rejectedCount = approvals.filter(
    (item) => item.approval_status === "Rejected"
  ).length;

  async function handleApproval(
    recommendation: V2ApprovalRecord,
    status: "Approved" | "Rejected"
  ) {
    if (status === "Approved" && !approver.trim()) {
      setError("Enter the responsible person's name before approving.");
      return;
    }

    try {
      setBusyId(recommendation.recommendation_id);
      setError("");
      setMessage("");

      await updateV2Approval(recommendation.recommendation_id, {
        approval_status: status,
        approved_by: approver.trim(),
        approval_notes:
          notes[recommendation.recommendation_id]?.trim() ?? "",
      });

      await loadData();

      setMessage(
        `${recommendation.recommendation_id} was ${status.toLowerCase()} successfully.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not update this approval."
      );
    } finally {
      setBusyId("");
    }
  }

  async function handleSimulation() {
    try {
      setSimulating(true);
      setError("");
      setMessage("");

      const result = await runV2Simulation();

      setData((current) =>
        current
          ? { ...current, optimization: result.summary }
          : current
      );

      await loadData();

      setMessage("V2 optimization simulation completed successfully.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "The optimization simulation failed."
      );
    } finally {
      setSimulating(false);
    }
  }

  return (
    <section className="v2-management" id="v2-management">
      <div className="v2-heading">
        <div>
          <span className="v2-eyebrow">ADVANCED OPTIMIZATION · V2</span>
          <h2>Energy Optimization Control Center</h2>
          <p>
            Review detected waste, manage recommendations, and simulate
            approved energy-saving actions.
          </p>
        </div>

        <button
          className="v2-secondary-button"
          onClick={() => void loadData()}
          disabled={loading || refreshing}
        >
          <RefreshCw size={16} />
          {refreshing ? "Refreshing..." : "Refresh data"}
        </button>
      </div>

      {error && (
        <div className="v2-message v2-error" role="alert">
          <AlertTriangle size={17} />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="v2-message v2-success" role="status">
          <CheckCircle2 size={17} />
          <span>{message}</span>
        </div>
      )}

      {loading ? (
        <div className="v2-empty">Loading V2 management data...</div>
      ) : (
        <>
          <div className="v2-stats-grid">
            <article className="v2-stat-card">
              <span className="v2-stat-icon blue">
                <AlertTriangle size={19} />
              </span>
              <span className="v2-stat-label">Detected V3 Alerts</span>
              <strong>{formatNumber(data?.alerts.length ?? 0)}</strong>
              <small>Detection records</small>
            </article>

            <article className="v2-stat-card">
              <span className="v2-stat-icon purple">
                <Zap size={19} />
              </span>
              <span className="v2-stat-label">Recommendations</span>
              <strong>{formatNumber(approvals.length)}</strong>
              <small>Component-level actions</small>
            </article>

            <article className="v2-stat-card">
              <span className="v2-stat-icon orange">
                <RefreshCw size={19} />
              </span>
              <span className="v2-stat-label">Pending Review</span>
              <strong>{formatNumber(pendingCount)}</strong>
              <small>Awaiting a decision</small>
            </article>

            <article className="v2-stat-card">
              <span className="v2-stat-icon green">
                <CheckCircle2 size={19} />
              </span>
              <span className="v2-stat-label">Approved</span>
              <strong>{formatNumber(approvedCount)}</strong>
              <small>{rejectedCount} rejected</small>
            </article>
          </div>

          <div className="v2-panel">
            <div className="v2-panel-heading">
              <div>
                <h3>Recommendation Approvals</h3>
                <p>
                  Approve or reject individual component recommendations.
                </p>
              </div>
              <span className="v2-total-count">
                {filteredApprovals.length} records
              </span>
            </div>

            <div className="v2-approval-controls">
              <label>
                Responsible person
                <input
                  type="text"
                  value={approver}
                  onChange={(event) => setApprover(event.target.value)}
                  placeholder="Enter approver name"
                  maxLength={120}
                />
              </label>

              <label>
                Component
                <select
                  value={componentFilter}
                  onChange={(event) =>
                    setComponentFilter(event.target.value)
                  }
                >
                  <option value="All">All components</option>
                  <option value="HVAC">HVAC</option>
                  <option value="Lighting">Lighting</option>
                  <option value="Equipment">Equipment</option>
                </select>
              </label>

              <label>
                Approval status
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as ApprovalFilter)
                  }
                >
                  <option value="All">All statuses</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </label>
            </div>

            <div className="v2-recommendations-list">
              {filteredApprovals.map((item) => (
                <article
                  className="v2-recommendation"
                  key={item.recommendation_id}
                >
                  <div className="v2-recommendation-top">
                    <div>
                      <span className="v2-recommendation-id">
                        {item.recommendation_id}
                      </span>
                      <h4>{item.component} Optimization</h4>
                      <p>
                        {item.building_id} · Room {item.room_id} ·{" "}
                        {item.room_type}
                      </p>
                    </div>

                    <span
                      className={`v2-status ${item.approval_status.toLowerCase()}`}
                    >
                      {item.approval_status}
                    </span>
                  </div>

                  <p className="v2-action-text">
                    {item.recommended_action}
                  </p>

                  <div className="v2-recommendation-metrics">
                    <span>
                      <strong>{item.alert_count}</strong>
                      Alerts
                    </span>
                    <span>
                      <strong>
                        {formatNumber(item.estimated_excess_kwh)} kWh
                      </strong>
                      Estimated excess
                    </span>
                    <span>
                      <strong>{formatNumber(item.normal_baseline_kw)} kW</strong>
                      Normal baseline
                    </span>
                    <span>
                      <strong>{item.priority}</strong>
                      Priority
                    </span>
                  </div>

                  <label className="v2-notes-field">
                    Approval notes
                    <textarea
                      value={notes[item.recommendation_id] ?? ""}
                      onChange={(event) =>
                        setNotes((current) => ({
                          ...current,
                          [item.recommendation_id]: event.target.value,
                        }))
                      }
                      placeholder="Optional notes for this recommendation"
                      rows={2}
                      maxLength={1000}
                    />
                  </label>

                  {item.approval_status === "Pending" ? (
                    <div className="v2-action-buttons">
                      <button
                        className="v2-approve-button"
                        onClick={() =>
                          void handleApproval(item, "Approved")
                        }
                        disabled={busyId === item.recommendation_id}
                      >
                        <CheckCircle2 size={16} />
                        {busyId === item.recommendation_id
                          ? "Saving..."
                          : "Approve"}
                      </button>

                      <button
                        className="v2-reject-button"
                        onClick={() =>
                          void handleApproval(item, "Rejected")
                        }
                        disabled={busyId === item.recommendation_id}
                      >
                        <XCircle size={16} />
                        Reject
                      </button>
                    </div>
                  ) : (
                    <div className="v2-approval-meta">
                      {item.approved_by
                        ? `Updated by: ${item.approved_by}`
                        : "No responsible person recorded"}
                      {item.approval_notes
                        ? ` · ${item.approval_notes}`
                        : ""}
                    </div>
                  )}
                </article>
              ))}

              {filteredApprovals.length === 0 && (
                <div className="v2-empty">
                  No recommendations match the selected filters.
                </div>
              )}
            </div>
          </div>

          <div className="v2-panel">
            <div className="v2-panel-heading">
              <div>
                <h3>Optimization Simulation</h3>
                <p>
                  Run the simulator using recommendations marked as Approved.
                </p>
              </div>

              <button
                className="v2-run-button"
                onClick={() => void handleSimulation()}
                disabled={simulating}
              >
                <Play size={16} />
                {simulating ? "Running simulation..." : "Run simulation"}
              </button>
            </div>

            <div className="v2-simulation-grid">
              {(data?.optimization ?? []).map((scenario) => (
                <article
                  className="v2-simulation-card"
                  key={scenario.scenario}
                >
                  <span>{scenario.scenario}</span>
                  <strong>
                    {formatNumber(scenario.estimated_savings_kwh)}
                    <small> kWh</small>
                  </strong>
                  <div className="v2-simulation-details">
                    <span>
                      {formatNumber(scenario.savings_percentage)}% estimated
                      savings
                    </span>
                    <span>
                      {scenario.approved_recommendations} approved
                      recommendation(s)
                    </span>
                    <span>
                      {formatNumber(scenario.rooms_simulated)} room(s)
                    </span>
                    <span>
                      {formatNumber(scenario.eligible_records)} eligible
                      records
                    </span>
                  </div>
                </article>
              ))}

              {(data?.optimization.length ?? 0) === 0 && (
                <div className="v2-empty">
                  No simulation results available yet.
                </div>
              )}
            </div>

            <p className="v2-disclaimer">
              Simulation outputs are estimated results based on the project
              model and its assumptions. They are not measured or guaranteed
              real-world energy savings.
            </p>
          </div>

          <div className="v2-panel">
            <div className="v2-panel-heading">
              <div>
                <h3>Latest V3 Detection Alerts</h3>
                <p>Most recent records from the waste detection engine.</p>
              </div>
              <span className="v2-total-count">
                {data?.alerts.length ?? 0} total
              </span>
            </div>

            <div className="v2-alerts-list">
              {(data?.alerts ?? []).slice(0, 5).map((alert, index) => (
                <article
                  className="v2-alert-row"
                  key={`${alert.timestamp}-${alert.room_id}-${index}`}
                >
                  <span className="v2-alert-symbol">
                    <AlertTriangle size={17} />
                  </span>
                  <div>
                    <strong>{alert.alert_reason}</strong>
                    <p>
                      {alert.building_id} · Room {alert.room_id} ·{" "}
                      {alert.detected_components || alert.waste_type}
                    </p>
                  </div>
                  <time>{formatDate(alert.timestamp)}</time>
                </article>
              ))}

              {(data?.alerts.length ?? 0) === 0 && (
                <div className="v2-empty">No V3 alerts available.</div>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

export default V2Management;

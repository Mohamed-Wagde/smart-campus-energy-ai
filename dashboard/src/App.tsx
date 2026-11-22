import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  Bell,
  Building2,
  CalendarDays,
  ChevronDown,
  CircleHelp,
  Download,
  LayoutDashboard,
  Lightbulb,
  Menu,
  Settings,
  TrendingUp,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  fetchDashboardData,
  type DashboardData,
  type AlertRecord,
  type RecommendationRecord,
} from "./api";
import "./App.css";

function AnimatedNumber({
  value,
  decimals = 0,
}: {
  value: number;
  decimals?: number;
}) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let frame = 0;
    const duration = 1100;
    const start = performance.now();

    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(value * eased);

      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      }
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <>
      {count.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
    </>
  );
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp.replace(" ", "T"));

  if (Number.isNaN(date.getTime())) return timestamp;

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getAlertType(severity: string) {
  const value = severity.toLowerCase();

  if (value.includes("high") || value.includes("critical")) return "danger";
  if (value.includes("medium") || value.includes("warning")) return "warning";

  return "success";
}

function App() {
  const [period, setPeriod] = useState("24 Hours");
  const [building, setBuilding] = useState("All Buildings");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      try {
        setLoading(true);
        setError("");

        const result = await fetchDashboardData();

        if (mounted) {
          setDashboard(result);
        }
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to connect to the dashboard API."
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  const hourlyData = useMemo(() => {
    if (!dashboard) return [];

    const hours =
      period === "24 Hours" ? 24 : period === "7 Days" ? 168 : 720;

    return dashboard.hourly.slice(-hours).map((record) => {
      const date = new Date(record.timestamp.replace(" ", "T"));

      return {
        time:
          period === "24 Hours"
            ? date.toLocaleTimeString("en-US", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })
            : date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              }),
        energy: record.campus_energy_kwh,
      };
    });
  }, [dashboard, period]);

  const buildingData = useMemo(() => {
    if (!dashboard) return [];

    return dashboard.buildings
      .filter(
        (item) =>
          building === "All Buildings" || item.building_id === building
      )
      .map((item) => ({
        name: item.building_id,
        energy: item.total_energy_kwh,
      }));
  }, [dashboard, building]);

  const latestAlerts = useMemo(() => {
    if (!dashboard) return [];

    return [...dashboard.alerts]
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() -
          new Date(a.timestamp).getTime()
      )
      .slice(0, 5);
  }, [dashboard]);

  const topRecommendation: RecommendationRecord | undefined =
    dashboard?.recommendations[0];

  const highestBuilding = useMemo(() => {
    if (!dashboard || dashboard.buildings.length === 0) return null;

    return [...dashboard.buildings].sort(
      (a, b) => b.total_energy_kwh - a.total_energy_kwh
    )[0];
  }, [dashboard]);

  const chartTotal = hourlyData.reduce(
    (sum, item) => sum + item.energy,
    0
  );

  const dataRange =
    dashboard?.overview.data_start && dashboard?.overview.data_end
      ? `${dashboard.overview.data_start.slice(0, 10)} to ${dashboard.overview.data_end.slice(0, 10)}`
      : "Historical data";

  const formatKwh = (value: number) =>
    value.toLocaleString("en-US", {
      maximumFractionDigits: 2,
    });

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-icon"><Zap size={22} /></div>
          <div>
            <h2>EcoCampus</h2>
            <span>ENERGY MANAGEMENT</span>
          </div>
        </div>

        <div className="nav-label">WORKSPACE</div>
        <nav className="navigation">
          <a className="nav-item active" href="#overview">
            <LayoutDashboard size={19} /> <span>Overview</span>
          </a>
          <a className="nav-item" href="#buildings">
            <Building2 size={19} /> <span>Buildings & Rooms</span>
          </a>
          <a className="nav-item" href="#analytics">
            <Activity size={19} /> <span>Energy Analytics</span>
          </a>
          <a className="nav-item" href="#alerts">
            <Bell size={19} /> <span>Alerts & Anomalies</span>
            {dashboard && (
              <span className="nav-count">
                {dashboard.overview.active_alerts}
              </span>
            )}
          </a>
          <a className="nav-item" href="#recommendations">
            <Lightbulb size={19} /> <span>Recommendations</span>
          </a>
        </nav>

        <div className="sidebar-bottom">
          <a className="nav-item" href="#help">
            <CircleHelp size={19} /> <span>Help & Support</span>
          </a>
          <a className="nav-item" href="#settings">
            <Settings size={19} /> <span>Settings</span>
          </a>
          <div className="profile">
            <div className="avatar">AD</div>
            <div className="profile-info">
              <strong>Admin User</strong>
              <span>University Admin</span>
            </div>
            <ChevronDown size={16} />
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <main className="main-content" id="overview">
        <header className="topbar">
          <button
            className="mobile-menu"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle menu"
          >
            <Menu size={22} />
          </button>

          <div className="breadcrumb">
            <span>Workspace</span>
            <span className="breadcrumb-divider">/</span>
            <strong>Overview</strong>
          </div>

          <div className="topbar-actions">
            <span className="live-status"><span /> SIMULATION MODE</span>
            <button className="icon-button" aria-label="Notifications">
              <Bell size={19} />
              <i />
            </button>
            <div className="top-avatar">AD</div>
          </div>
        </header>

        <div className="page-container">
          <section className="welcome-row">
            <div>
              <div className="eyebrow">CAMPUS ENERGY OVERVIEW</div>
              <h1>Good morning, Admin <span>✦</span></h1>
              <p>Monitor campus energy consumption and optimization insights.</p>
            </div>
            <button className="export-button" onClick={() => window.print()}>
              <Download size={17} /> Export report
            </button>
          </section>

          {loading && (
            <div className="panel" style={{ padding: 24 }}>
              Loading campus data from the API...
            </div>
          )}

          {error && (
            <div className="panel" style={{ padding: 24 }}>
              <strong>Could not load dashboard data.</strong>
              <p>{error}</p>
              <p>
                Make sure the FastAPI backend is running on
                http://127.0.0.1:8000.
              </p>
              <button
                className="export-button"
                onClick={() => window.location.reload()}
              >
                Retry
              </button>
            </div>
          )}

          {dashboard && (
            <>
              <section className="filter-row">
                <label className="filter-select">
                  <Building2 size={17} />
                  <select
                    value={building}
                    onChange={(e) => setBuilding(e.target.value)}
                  >
                    <option>All Buildings</option>
                    {dashboard.buildings.map((item) => (
                      <option key={item.building_id} value={item.building_id}>
                        {item.building_id}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={15} />
                </label>

                <div className="period-control">
                  <CalendarDays size={17} />
                  {["24 Hours", "7 Days", "30 Days"].map((item) => (
                    <button
                      key={item}
                      className={period === item ? "period-active" : ""}
                      onClick={() => setPeriod(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </section>

              <section className="kpi-grid">
                <article className="kpi-card">
                  <div className="kpi-top">
                    <span className="kpi-icon blue"><Zap size={20} /></span>
                  </div>
                  <p>Total Energy Consumption</p>
                  <div className="kpi-value">
                    <AnimatedNumber
                      value={dashboard.overview.total_energy_kwh}
                      decimals={2}
                    />
                    <span>kWh</span>
                  </div>
                  <div className="kpi-foot">Historical campus energy</div>
                </article>

                <article className="kpi-card">
                  <div className="kpi-top">
                    <span className="kpi-icon purple">
                      <TrendingUp size={20} />
                    </span>
                  </div>
                  <p>Peak Power Demand</p>
                  <div className="kpi-value">
                    <AnimatedNumber
                      value={dashboard.overview.peak_power_kw}
                      decimals={2}
                    />
                    <span>kW</span>
                  </div>
                  <div className="kpi-foot">Highest recorded power demand</div>
                </article>

                <article className="kpi-card">
                  <div className="kpi-top">
                    <span className="kpi-icon orange">
                      <Activity size={20} />
                    </span>
                  </div>
                  <p>Average Power Demand</p>
                  <div className="kpi-value">
                    <AnimatedNumber
                      value={dashboard.overview.average_power_kw}
                      decimals={2}
                    />
                    <span>kW</span>
                  </div>
                  <div className="kpi-foot">Campus average power</div>
                </article>

                <article className="kpi-card">
                  <div className="kpi-top">
                    <span className="kpi-icon red">
                      <AlertTriangle size={20} />
                    </span>
                    <span className="alert-pill">Needs attention</span>
                  </div>
                  <p>Active Alerts</p>
                  <div className="kpi-value">
                    <AnimatedNumber value={dashboard.overview.active_alerts} />
                  </div>
                  <div className="kpi-foot">
                    Detected energy waste events
                  </div>
                </article>
              </section>

              <section className="charts-grid" id="analytics">
                <article className="panel energy-panel">
                  <div className="panel-heading">
                    <div>
                      <h3>Energy Consumption</h3>
                      <p>Hourly energy usage across campus</p>
                    </div>
                    <button className="chart-menu">•••</button>
                  </div>

                  <div className="chart-summary">
                    <strong>
                      {formatKwh(chartTotal)} <span>kWh</span>
                    </strong>
                    <span className="chart-change">
                      <ArrowDownRight size={15} />
                      <small>{period} selected</small>
                    </span>
                  </div>

                  <div className="chart-area">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={hourlyData}
                        margin={{ top: 12, right: 8, left: -18, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient
                            id="energyGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#3978ed"
                              stopOpacity={0.22}
                            />
                            <stop
                              offset="95%"
                              stopColor="#3978ed"
                              stopOpacity={0.01}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="#edf0f5" vertical={false} />
                        <XAxis
                          dataKey="time"
                          axisLine={false}
                          tickLine={false}
                          minTickGap={25}
                          tick={{ fill: "#929bad", fontSize: 11 }}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#929bad", fontSize: 11 }}
                        />
                        <Tooltip />
                        <Area
                          type="monotone"
                          dataKey="energy"
                          name="Energy (kWh)"
                          stroke="#3978ed"
                          strokeWidth={3}
                          fill="url(#energyGradient)"
                          activeDot={{
                            r: 6,
                            strokeWidth: 3,
                            stroke: "#fff",
                          }}
                          isAnimationActive
                          animationDuration={1000}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="chart-legend">
                    <span /> Energy usage <small>·</small>
                    <span className="legend-muted">{dataRange}</span>
                  </div>
                </article>

                <article className="panel buildings-panel" id="buildings">
                  <div className="panel-heading">
                    <div>
                      <h3>Building Comparison</h3>
                      <p>Consumption by building</p>
                    </div>
                    <button className="chart-menu">•••</button>
                  </div>

                  <div className="building-total">
                    {formatKwh(
                      buildingData.reduce((sum, item) => sum + item.energy, 0)
                    )}
                    <span> kWh total</span>
                  </div>

                  <div className="bar-chart">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={buildingData}
                        layout="vertical"
                        margin={{ top: 8, right: 12, left: 5, bottom: 0 }}
                      >
                        <CartesianGrid
                          stroke="#edf0f5"
                          horizontal={false}
                        />
                        <XAxis
                          type="number"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#929bad", fontSize: 10 }}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={65}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#657087", fontSize: 10 }}
                        />
                        <Tooltip />
                        <Bar
                          dataKey="energy"
                          name="Energy (kWh)"
                          fill="#6b8ff0"
                          radius={[0, 6, 6, 0]}
                          barSize={19}
                          isAnimationActive
                          animationDuration={1000}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="building-foot">
                    <span className="building-dot" />
                    {building === "All Buildings"
                      ? highestBuilding
                        ? `Highest consumption: ${highestBuilding.building_id}`
                        : "No building data"
                      : `Selected building: ${building}`}
                  </div>
                </article>
              </section>

              <section className="bottom-grid">
                <article className="panel alerts-panel" id="alerts">
                  <div className="panel-heading">
                    <div>
                      <h3>Recent Alerts</h3>
                      <p>Latest detected energy waste events</p>
                    </div>
                    <a href="#alerts">Latest 5</a>
                  </div>

                  <div className="alerts-list">
                    {latestAlerts.map((alert: AlertRecord, index) => {
                      const type = getAlertType(alert.alert_severity);

                      return (
                        <div className="alert-item" key={`${alert.timestamp}-${index}`}>
                          <span className={`alert-icon ${type}`}>
                            {type === "success" ? (
                              <Activity size={17} />
                            ) : (
                              <AlertTriangle size={17} />
                            )}
                          </span>
                          <div className="alert-copy">
                            <strong>{alert.alert_reason}</strong>
                            <span>
                              {alert.building_id} · Room {alert.room_id} ·{" "}
                              {alert.alert_severity}
                            </span>
                          </div>
                          <time>{formatTimestamp(alert.timestamp)}</time>
                        </div>
                      );
                    })}

                    {latestAlerts.length === 0 && (
                      <p>No alerts available.</p>
                    )}
                  </div>
                </article>

                <article
                  className="panel recommendation-panel"
                  id="recommendations"
                >
                  <div className="recommendation-icon">
                    <Lightbulb size={21} />
                  </div>
                  <div className="recommendation-content">
                    <span className="recommendation-tag">
                      SMART RECOMMENDATION
                    </span>

                    {topRecommendation ? (
                      <>
                        <h3>
                          {topRecommendation.main_waste_source} optimization
                        </h3>
                        <p>
                          {topRecommendation.recommended_action}
                        </p>
                        <p>
                          <strong>
                            {topRecommendation.building_id} · Room{" "}
                            {topRecommendation.room_id}
                          </strong>
                        </p>
                        <p>
                          Estimated excess energy:{" "}
                          {formatKwh(topRecommendation.estimated_excess_kwh)}{" "}
                          kWh
                        </p>
                        <a href="#buildings">
                          Explore building data <span>→</span>
                        </a>
                      </>
                    ) : (
                      <p>No recommendations available.</p>
                    )}
                  </div>
                </article>
              </section>

              <section className="panel" style={{ padding: 22, marginTop: 22 }}>
                <div className="panel-heading">
                  <div>
                    <h3>Optimization Simulation</h3>
                    <p>Estimated results from approved-room simulation</p>
                  </div>
                </div>

                <div className="kpi-grid">
                  {dashboard.optimization.map((scenario) => (
                    <article className="kpi-card" key={scenario.scenario}>
                      <p>{scenario.scenario}</p>
                      <div className="kpi-value">
                        {formatKwh(scenario.estimated_savings_kwh)}
                        <span>kWh saved</span>
                      </div>
                      <div className="kpi-foot">
                        {scenario.savings_percentage.toFixed(2)}% estimated
                        savings · {scenario.rooms_simulated} room(s) simulated
                      </div>
                    </article>
                  ))}
                </div>

                <p style={{ fontSize: 12, color: "#929bad", marginTop: 12 }}>
                  These are simulated estimates, not measured or realized
                  campus-wide savings.
                </p>
              </section>

              <footer className="page-footer">
                <span>
                  © 2026 EcoCampus · Smart Campus Energy Management
                </span>
                <span>
                  <span className="footer-dot" /> Historical simulation data
                </span>
              </footer>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;

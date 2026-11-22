
import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
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
import "./App.css";

const hourlyData = [
  { time: "00:00", energy: 32 },
  { time: "02:00", energy: 25 },
  { time: "04:00", energy: 22 },
  { time: "06:00", energy: 35 },
  { time: "08:00", energy: 68 },
  { time: "10:00", energy: 85 },
  { time: "12:00", energy: 92 },
  { time: "14:00", energy: 88 },
  { time: "16:00", energy: 76 },
  { time: "18:00", energy: 60 },
  { time: "20:00", energy: 48 },
  { time: "22:00", energy: 38 },
];

const buildingData = [
  { name: "Engineering", energy: 420 },
  { name: "Computer Science", energy: 350 },
  { name: "Administration", energy: 280 },
];

const alerts = [
  {
    title: "Unusual energy consumption",
    detail: "Engineering Building · Room 204",
    time: "10 minutes ago",
    type: "warning",
  },
  {
    title: "High usage detected",
    detail: "Computer Science · Floor 2",
    time: "35 minutes ago",
    type: "danger",
  },
  {
    title: "Energy target achieved",
    detail: "Administration Building",
    time: "1 hour ago",
    type: "success",
  },
];

function AnimatedNumber({ value }: { value: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let frame = 0;
    const duration = 1100;
    const start = performance.now();

    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(value * eased));

      if (progress < 1) {
        frame = requestAnimationFrame(animate);
      }
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{count.toLocaleString("en-US")}</>;
}

function App() {
  const [period, setPeriod] = useState("24 Hours");
  const [building, setBuilding] = useState("All Buildings");
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
            <span className="nav-count">3</span>
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
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
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
              <p>Here’s what’s happening with your campus energy today.</p>
            </div>
            <button className="export-button" onClick={() => window.print()}>
              <Download size={17} /> Export report
            </button>
          </section>

          <section className="filter-row">
            <label className="filter-select">
              <Building2 size={17} />
              <select value={building} onChange={(e) => setBuilding(e.target.value)}>
                <option>All Buildings</option>
                <option>Engineering Building</option>
                <option>Computer Science Building</option>
                <option>Administration Building</option>
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
                <span className="trend positive"><ArrowDownRight size={15} /> 8.2%</span>
              </div>
              <p>Total Energy Consumption</p>
              <div className="kpi-value"><AnimatedNumber value={1248} /><span>kWh</span></div>
              <div className="kpi-foot">Compared to previous period</div>
            </article>

            <article className="kpi-card">
              <div className="kpi-top">
                <span className="kpi-icon purple"><TrendingUp size={20} /></span>
                <span className="trend positive"><ArrowDownRight size={15} /> 5.4%</span>
              </div>
              <p>Estimated Energy Cost</p>
              <div className="kpi-value"><span className="currency">$</span><AnimatedNumber value={186} /></div>
              <div className="kpi-foot">Estimated simulated cost</div>
            </article>

            <article className="kpi-card">
              <div className="kpi-top">
                <span className="kpi-icon orange"><Activity size={20} /></span>
                <span className="trend negative"><ArrowUpRight size={15} /> 2.1%</span>
              </div>
              <p>Average Power Demand</p>
              <div className="kpi-value"><AnimatedNumber value={52} /><span>kW</span></div>
              <div className="kpi-foot">Across monitored buildings</div>
            </article>

            <article className="kpi-card">
              <div className="kpi-top">
                <span className="kpi-icon red"><AlertTriangle size={20} /></span>
                <span className="alert-pill">Needs attention</span>
              </div>
              <p>Active Alerts</p>
              <div className="kpi-value"><AnimatedNumber value={3} /></div>
              <div className="kpi-foot">2 warnings · 1 critical</div>
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
                <strong>1,248 <span>kWh</span></strong>
                <span className="chart-change"><ArrowDownRight size={15} /> 8.2% <small>vs previous period</small></span>
              </div>
              <div className="chart-area">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourlyData} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
                    <defs>
                      <linearGradient id="energyGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3978ed" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="#3978ed" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#edf0f5" vertical={false} />
                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: "#929bad", fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "#929bad", fontSize: 11 }} />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="energy"
                      name="Energy"
                      stroke="#3978ed"
                      strokeWidth={3}
                      fill="url(#energyGradient)"
                      activeDot={{ r: 6, strokeWidth: 3, stroke: "#fff" }}
                      isAnimationActive
                      animationDuration={1400}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-legend"><span /> Energy usage <small>·</small> <span className="legend-muted">Simulated hourly readings</span></div>
            </article>

            <article className="panel buildings-panel" id="buildings">
              <div className="panel-heading">
                <div>
                  <h3>Building Comparison</h3>
                  <p>Consumption by building</p>
                </div>
                <button className="chart-menu">•••</button>
              </div>
              <div className="building-total">1,050 <span>kWh total</span></div>
              <div className="bar-chart">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={buildingData} layout="vertical" margin={{ top: 8, right: 12, left: 5, bottom: 0 }}>
                    <CartesianGrid stroke="#edf0f5" horizontal={false} />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: "#929bad", fontSize: 10 }} />
                    <YAxis type="category" dataKey="name" width={105} axisLine={false} tickLine={false} tick={{ fill: "#657087", fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="energy" name="Energy (kWh)" fill="#6b8ff0" radius={[0, 6, 6, 0]} barSize={19} isAnimationActive animationDuration={1200} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="building-foot"><span className="building-dot" /> Highest consumption: Engineering</div>
            </article>
          </section>

          <section className="bottom-grid">
            <article className="panel alerts-panel" id="alerts">
              <div className="panel-heading">
                <div>
                  <h3>Recent Alerts</h3>
                  <p>Events that may need your attention</p>
                </div>
                <a href="#alerts">View all</a>
              </div>
              <div className="alerts-list">
                {alerts.map((alert, index) => (
                  <div className="alert-item" key={index}>
                    <span className={`alert-icon ${alert.type}`}>
                      {alert.type === "success" ? <Activity size={17} /> : <AlertTriangle size={17} />}
                    </span>
                    <div className="alert-copy">
                      <strong>{alert.title}</strong>
                      <span>{alert.detail}</span>
                    </div>
                    <time>{alert.time}</time>
                  </div>
                ))}
              </div>
            </article>

            <article className="panel recommendation-panel" id="recommendations">
              <div className="recommendation-icon"><Lightbulb size={21} /></div>
              <div className="recommendation-content">
                <span className="recommendation-tag">SMART RECOMMENDATION</span>
                <h3>Optimize after-hours usage</h3>
                <p>Some rooms show energy usage outside typical operating hours. Review lighting and HVAC schedules to identify potential savings.</p>
                <a href="#buildings">Explore recommendation <span>→</span></a>
              </div>
            </article>
          </section>

          <footer className="page-footer">
            <span>© 2026 EcoCampus · Smart Campus Energy Management</span>
            <span><span className="footer-dot" /> All displayed values are simulated</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;

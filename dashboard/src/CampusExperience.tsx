import {
  Building2,
  ChevronRight,
  Cpu,
  Zap,
} from "lucide-react";
import type { DashboardData } from "./api";
import CampusScene from "./CampusScene";
import "./CampusExperience.css";

interface CampusExperienceProps {
  dashboard: DashboardData;
  onBuildingSelect: (buildingId: string) => void;
  onOpenManagement: () => void;
}

const BUILDING_INFO: Record<
  string,
  { name: string; subtitle: string; accent: string; icon: string }
> = {
  B01: {
    name: "Academic Building",
    subtitle: "Learning & Education",
    accent: "#287bd4",
    icon: "01",
  },
  B02: {
    name: "Technology Building",
    subtitle: "Research & Computing",
    accent: "#13a6b5",
    icon: "02",
  },
  B03: {
    name: "Innovation Building",
    subtitle: "Innovation & Development",
    accent: "#8875e8",
    icon: "03",
  },
};

const formatNumber = (value: number, decimals = 0) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

export default function CampusExperience({
  dashboard,
  onBuildingSelect,
  onOpenManagement,
}: CampusExperienceProps) {
  const buildings = dashboard.buildings;

  const totalEnergy = dashboard.overview.total_energy_kwh;

  return (
    <div className="campus-experience">
      <section className="campus-hero">
        <div className="campus-hero-copy">
          <div className="campus-eyebrow">
            <span className="campus-eyebrow-dot" />
            SMART CAMPUS DIGITAL TWIN
          </div>

          <h1>
            Explore Your
            <br />
            <span>Campus in 3D.</span>
          </h1>

          <p>
            Navigate the digital campus, explore individual buildings,
            and access dedicated energy management dashboards.
          </p>

          <div className="campus-hero-actions">
            <button
              className="campus-primary-action"
              onClick={onOpenManagement}
            >
              Optimization Center
              <ChevronRight size={17} />
            </button>
          </div>
        </div>

        <div className="campus-hero-decoration">
          <div className="campus-orbit campus-orbit-one" />
          <div className="campus-orbit campus-orbit-two" />
          <div className="campus-orbit-core">
            <Zap size={38} />
          </div>
        </div>
      </section>

      <section className="campus-section-heading campus-model-heading">
        <div>
          <span className="campus-section-eyebrow">
            INTERACTIVE 3D ENVIRONMENT
          </span>
          <h2>Campus Digital Twin</h2>
          <p>
            Rotate, zoom, and select a building to open its dedicated dashboard
          </p>
        </div>

        <div className="campus-building-count">
          <Building2 size={16} />
          {buildings.length} Buildings
        </div>
      </section>

      <CampusScene
        buildings={buildings}
        onBuildingSelect={onBuildingSelect}
      />

      <section className="campus-building-section">
        <div className="campus-section-heading">
          <div>
            <span className="campus-section-eyebrow">
              BUILDING DIRECTORY
            </span>
            <h2>Explore Campus Buildings</h2>
            <p>
              Select any building to access its energy dashboard and insights
            </p>
          </div>
        </div>

        <div className="campus-building-grid">
          {buildings.map((building) => {
            const info = BUILDING_INFO[building.building_id] ?? {
              name: building.building_id,
              subtitle: "Campus facility",
              accent: "#48caff",
              icon: building.building_id,
            };

            const share =
              totalEnergy > 0
                ? (building.total_energy_kwh / totalEnergy) * 100
                : 0;

            return (
              <button
                type="button"
                className="campus-building-card"
                key={building.building_id}
                onClick={() => onBuildingSelect(building.building_id)}
                style={
                  { "--building-accent": info.accent } as React.CSSProperties
                }
              >
                <div className="campus-building-card-top">
                  <span className="campus-building-number">
                    {info.icon}
                  </span>
                  <span className="campus-building-open">
                    <ChevronRight size={17} />
                  </span>
                </div>

                <div className="campus-building-name">
                  <h3>{info.name}</h3>
                  <p>{info.subtitle}</p>
                </div>

                <div className="campus-building-energy">
                  <strong>
                    {formatNumber(building.total_energy_kwh, 2)}
                  </strong>
                  <span>kWh</span>
                </div>

                <div className="campus-building-progress">
                  <span
                    style={{ width: `${Math.min(share, 100)}%` }}
                  />
                </div>

                <div className="campus-building-stats">
                  <span>
                    Average: {formatNumber(building.average_power_kw, 2)} kW
                  </span>
                  <span>{formatNumber(share, 1)}% of total</span>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="campus-bottom-strip">
        <div className="campus-bottom-icon">
          <Cpu size={23} />
        </div>

        <div>
          <strong>Smart Optimization Workspace</strong>
          <p>
            Review recommendations, approval decisions, and estimated
            optimization scenarios.
          </p>
        </div>

        <button onClick={onOpenManagement}>
          Open workspace <ChevronRight size={16} />
        </button>
      </section>

      <footer className="campus-experience-footer">
        <span>ECocampus · SMART ENERGY INTELLIGENCE</span>
        <span>
          Historical campus dataset · {buildings.length} buildings
        </span>
      </footer>

      <p className="campus-data-disclaimer">
        All displayed figures are based on the project's historical simulated
        dataset. They do not represent live metering or verified energy savings.
      </p>
    </div>
  );
}

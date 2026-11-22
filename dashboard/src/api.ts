const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export interface OverviewData {
  total_energy_kwh: number;
  average_power_kw: number;
  peak_power_kw: number;
  active_alerts: number;
  approved_rooms: number;
  data_start: string | null;
  data_end: string | null;
  data_type: string;
  optimization_scenarios: OptimizationScenario[];
}

export interface HourlyRecord {
  timestamp: string;
  campus_power_kw: number;
  campus_energy_kwh: number;
}

export interface BuildingRecord {
  building_id: string;
  total_energy_kwh: number;
  average_power_kw: number;
  peak_power_kw: number;
}

export interface AlertRecord {
  timestamp: string;
  building_id: string;
  room_id: string;
  occupancy: number;
  scheduled: boolean;
  waste_event: boolean;
  hvac_power_kw: number;
  lighting_power_kw: number;
  equipment_power_kw: number;
  total_power_kw: number;
  energy_kwh: number;
  alert_reason: string;
  alert_severity: string;
}

export interface RecommendationRecord {
  building_id: string;
  room_id: string;
  alert_count: number;
  main_waste_source: string;
  normal_baseline_kw: number;
  estimated_excess_kwh: number;
  priority: string;
  recommended_action: string;
  approval_required: boolean;
}

export interface ApprovalRecord {
  building_id: string;
  room_id: string;
  main_waste_source: string;
  estimated_excess_kwh: number;
  recommended_action: string;
  approval_required: boolean;
  approval_status: string;
  approved_by: string | null;
  approval_notes: string | null;
}

export interface OptimizationScenario {
  scenario: string;
  rooms_simulated: number;
  eligible_records: number;
  original_energy_kwh: number;
  simulated_energy_kwh: number;
  estimated_savings_kwh: number;
  savings_percentage: number;
}

export interface DashboardData {
  overview: OverviewData;
  hourly: HourlyRecord[];
  buildings: BuildingRecord[];
  alerts: AlertRecord[];
  recommendations: RecommendationRecord[];
  approvals: ApprovalRecord[];
  optimization: OptimizationScenario[];
}

export async function fetchDashboardData(): Promise<DashboardData> {
  const response = await fetch(`${API_BASE_URL}/api/dashboard`);

  if (!response.ok) {
    throw new Error(
      `Dashboard API error: ${response.status} ${response.statusText}`
    );
  }

  return response.json() as Promise<DashboardData>;
}

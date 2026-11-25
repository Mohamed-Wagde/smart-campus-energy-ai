const API_BASE_URL =
  import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

// ==================================================
// V1 TYPES - KEEP EXISTING DASHBOARD COMPATIBILITY
// ==================================================

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

// ==================================================
// V2 TYPES
// ==================================================

export interface V2AlertRecord {
  timestamp: string;
  detector_version: number;
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
  room_type: string;
  temperature: number;
  day_type: string;
  waste_type: string;
  calibration_key: string;
  hvac_threshold_kw: number;
  lighting_threshold_kw: number;
  equipment_threshold_kw: number;
  hvac_exceeded: boolean;
  lighting_exceeded: boolean;
  equipment_exceeded: boolean;
  detected_components: string;
  alert_reason: string;
  severity: string;
}

export interface V2RecommendationRecord {
  recommendation_id: string;
  detector_version: number;
  building_id: string;
  room_id: string;
  room_type: string;
  component: string;
  component_power_column: string;
  component_threshold_column: string;
  alert_count: number;
  normal_baseline_kw: number;
  estimated_excess_kwh: number;
  priority: string;
  recommended_action: string;
  approval_required: boolean;
}

export interface V2ApprovalRecord extends V2RecommendationRecord {
  approval_status: "Pending" | "Approved" | "Rejected";
  approved_by: string | null;
  approval_notes: string | null;
}

export interface V2OptimizationScenario {
  scenario: string;
  approved_recommendations: number;
  rooms_simulated: number;
  eligible_records: number;
  original_energy_kwh: number;
  simulated_energy_kwh: number;
  estimated_savings_kwh: number;
  savings_percentage: number;
}

export interface V2DashboardData {
  alerts: V2AlertRecord[];
  recommendations: V2RecommendationRecord[];
  approvals: V2ApprovalRecord[];
  optimization: V2OptimizationScenario[];
}

export interface ApprovalUpdatePayload {
  approval_status: "Pending" | "Approved" | "Rejected";
  approved_by?: string;
  approval_notes?: string;
}

export interface ApprovalUpdateResponse {
  message: string;
  approval: V2ApprovalRecord;
  simulation_run: boolean;
}

export interface SimulationResponse {
  message: string;
  stdout: string;
  summary: V2OptimizationScenario[];
}

// ==================================================
// SHARED API HELPER
// ==================================================

async function apiRequest<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    let detail = response.statusText;

    try {
      const body = await response.json();
      detail =
        typeof body.detail === "string"
          ? body.detail
          : JSON.stringify(body.detail ?? body);
    } catch {
      // Keep the HTTP status text when the response is not JSON.
    }

    throw new Error(`API error ${response.status}: ${detail}`);
  }

  return response.json() as Promise<T>;
}

// ==================================================
// V1 API
// ==================================================

export async function fetchDashboardData(): Promise<DashboardData> {
  return apiRequest<DashboardData>("/api/dashboard");
}

// ==================================================
// V2 API
// ==================================================

export async function fetchV2Alerts(): Promise<V2AlertRecord[]> {
  return apiRequest<V2AlertRecord[]>("/api/v2/alerts");
}

export async function fetchV2Recommendations(): Promise<
  V2RecommendationRecord[]
> {
  return apiRequest<V2RecommendationRecord[]>("/api/v2/recommendations");
}

export async function fetchV2Approvals(): Promise<V2ApprovalRecord[]> {
  return apiRequest<V2ApprovalRecord[]>("/api/v2/approvals");
}

export async function fetchV2Optimization(): Promise<
  V2OptimizationScenario[]
> {
  return apiRequest<V2OptimizationScenario[]>("/api/v2/optimization");
}

export async function fetchV2DashboardData(): Promise<V2DashboardData> {
  const [alerts, recommendations, approvals, optimization] =
    await Promise.all([
      fetchV2Alerts(),
      fetchV2Recommendations(),
      fetchV2Approvals(),
      fetchV2Optimization(),
    ]);

  return {
    alerts,
    recommendations,
    approvals,
    optimization,
  };
}

export async function updateV2Approval(
  recommendationId: string,
  payload: ApprovalUpdatePayload
): Promise<ApprovalUpdateResponse> {
  return apiRequest<ApprovalUpdateResponse>(
    `/api/v2/approvals/${encodeURIComponent(recommendationId)}`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
}

export async function runV2Simulation(): Promise<SimulationResponse> {
  return apiRequest<SimulationResponse>("/api/v2/simulate", {
    method: "POST",
  });
}

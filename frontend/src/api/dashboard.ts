import apiClient from './client';

export interface AllocationSlice {
  label: string;
  value: number;        // absolute dollar/rupee value
  percentage: number;   // 0–100
  color: string;
}

export interface DashboardSummary {
  total_portfolio_value: number;
  total_unrealised_pnl: number;
  pnl_percentage: number;
  allocation: AllocationSlice[];
  last_updated: string;
}

export async function fetchDashboardSummary(userId: number): Promise<DashboardSummary> {
  const { data } = await apiClient.get(`/api/users/${userId}/dashboard`);
  return data;
}

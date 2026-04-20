import apiClient from './client';

export interface Alert {
  alert_type: 'rebalancing' | 'tax_loss_harvesting' | 'overvaluation';
  severity: 'high' | 'medium' | 'low';
  message: string;
  ticker?: string;
  asset_name?: string;
  // rebalancing extras
  actual_equity_pct?: number;
  target_equity_pct?: number;
  drift_pct?: number;
  // tax-loss extras
  avg_buy_price?: number;
  current_price?: number;
  loss_pct?: number;
  unrealised_loss?: number;
  // overvaluation extras
  trailing_pe?: number;
  pe_threshold?: number;
}

export interface InsightsResponse {
  user_id: number;
  user_name: string;
  total_portfolio_value: number;
  total_unrealised_pnl: number;
  alert_count: number;
  alerts: Alert[];
}

export async function fetchInsights(userId: number): Promise<InsightsResponse> {
  const { data } = await apiClient.get(`/api/users/${userId}/insights`);
  return data;
}

import apiClient from './client';

export interface AssetItem {
  id: number;
  ticker: string;
  name: string;
  asset_class: 'equity' | 'mutual_fund' | 'debt';
  target_allocation_pct: number;
  net_quantity: number;
  avg_cost: number;
  current_price: number;
  current_value: number;
  unrealised_pnl: number;
  pnl_percentage: number;
  xirr: number | null;
  beta: number | null;
  error?: string;
}

export async function fetchAssets(userId: number): Promise<AssetItem[]> {
  const { data } = await apiClient.get(`/api/users/${userId}/assets`);
  return data;
}

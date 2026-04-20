import apiClient from './client';

export type AssetClass = 'equity' | 'mutual_fund' | 'debt';
export type TransactionType = 'buy' | 'sell';

export interface NewTransactionPayload {
  user_id: number;
  ticker: string;
  asset_name: string;
  asset_class: AssetClass;
  transaction_type: TransactionType;
  quantity: number;
  price: number;
  date: string;           // ISO date: "YYYY-MM-DD"
  target_allocation_percentage: number;
}

export interface NewTransactionResponse {
  transaction_id: number;
  asset_id: number;
  ticker: string;
  message: string;
}

export async function postTransaction(
  payload: NewTransactionPayload,
): Promise<NewTransactionResponse> {
  const { data } = await apiClient.post('/api/transactions', payload);
  return data;
}

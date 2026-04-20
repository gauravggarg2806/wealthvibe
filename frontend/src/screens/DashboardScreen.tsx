import React, { useCallback, useEffect, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { fetchDashboardSummary, DashboardSummary } from '../api/dashboard';
import DonutChart from '../components/DonutChart';
import { DashboardSkeleton } from '../components/SkeletonLoader';
import ErrorState from '../components/ErrorState';
import { useTheme } from '../hooks/useTheme';
import { Colors } from '../theme/colors';

const USER_ID = 1;

function formatCurrency(value: number): string {
  if (value >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)} Cr`;
  if (value >= 100_000)    return `₹${(value / 100_000).toFixed(2)} L`;
  return `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

interface CardProps { children: React.ReactNode; style?: object }
function Card({ children, style }: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function StatRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.statRow, { borderBottomColor: theme.border }]}>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.statValue, { color: valueColor ?? theme.textPrimary }]}>{value}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function DashboardScreen() {
  const theme = useTheme();

  const [data, setData]         = useState<DashboardSummary | null>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else           setLoading(true);
    setError(null);
    try {
      const result = await fetchDashboardSummary(USER_ID);
      setData(result);
    } catch (err: any) {
      setError(err?.message ?? 'An unexpected error occurred.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // --- Loading skeleton (first load only) ---
  if (loading) return <DashboardSkeleton />;

  // --- Error state with Retry ---
  if (error) {
    return <ErrorState message={error} onRetry={() => load()} />;
  }

  const d = data!;
  const isGain   = d.total_unrealised_pnl >= 0;
  const pnlColor = isGain ? Colors.success : Colors.danger;

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: theme.bg }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => load(true)}
          tintColor={Colors.primary}
        />
      }
    >
      {/* Net Worth header */}
      <Card style={{ backgroundColor: Colors.primary }}>
        <Text style={styles.networthLabel}>Total Net Worth</Text>
        <Text style={styles.networthValue}>{formatCurrency(d.total_portfolio_value)}</Text>
        <View style={[styles.pnlBadge, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
          <Text style={styles.pnlBadgeText}>
            {isGain ? '▲' : '▼'} {formatCurrency(Math.abs(d.total_unrealised_pnl))}
            {'  '}({isGain ? '+' : ''}{d.pnl_percentage.toFixed(2)}%)
          </Text>
        </View>
        <Text style={styles.updatedAt}>Updated {formatDate(d.last_updated)}</Text>
      </Card>

      {/* Donut */}
      <Card style={{ backgroundColor: theme.card }}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Asset Allocation</Text>
        <View style={styles.chartWrap}>
          <DonutChart slices={d.allocation} size={200} strokeWidth={38} />
        </View>
      </Card>

      {/* Breakdown */}
      <Card style={{ backgroundColor: theme.card }}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Breakdown</Text>
        {d.allocation.map((slice, i) => (
          <View key={i} style={[
            styles.breakdownRow,
            i < d.allocation.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border },
          ]}>
            <View style={styles.breakdownLeft}>
              <View style={[styles.dot, { backgroundColor: slice.color }]} />
              <Text style={[styles.breakdownLabel, { color: theme.textPrimary }]}>{slice.label}</Text>
            </View>
            <View style={styles.breakdownRight}>
              <Text style={[styles.breakdownValue, { color: theme.textPrimary }]}>{formatCurrency(slice.value)}</Text>
              <View style={[styles.pctBadge, { backgroundColor: slice.color + '22' }]}>
                <Text style={[styles.pctText, { color: slice.color }]}>{slice.percentage.toFixed(1)}%</Text>
              </View>
            </View>
          </View>
        ))}
      </Card>

      {/* Quick Stats */}
      <Card style={{ backgroundColor: theme.card }}>
        <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Quick Stats</Text>
        <StatRow label="Invested Value" value={formatCurrency(d.total_portfolio_value - d.total_unrealised_pnl)} />
        <StatRow label="Current Value"  value={formatCurrency(d.total_portfolio_value)} />
        <StatRow label="Unrealised P&L"
          value={`${isGain ? '+' : ''}${formatCurrency(d.total_unrealised_pnl)}`}
          valueColor={pnlColor}
        />
        <StatRow label="Returns"
          value={`${isGain ? '+' : ''}${d.pnl_percentage.toFixed(2)}%`}
          valueColor={pnlColor}
        />
      </Card>
    </ScrollView>
  );
}

const SHADOW = {
  shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, gap: 14, paddingBottom: 32 },

  card: { borderRadius: 16, padding: 20, ...SHADOW },

  networthLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)', fontWeight: '500' },
  networthValue: { fontSize: 34, fontWeight: '800', color: '#fff', marginTop: 4 },
  pnlBadge: { alignSelf: 'flex-start', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 4, marginTop: 10 },
  pnlBadgeText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  updatedAt: { fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 12 },

  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 16 },
  chartWrap: { alignItems: 'center' },

  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  breakdownLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  breakdownLabel: { fontSize: 15, fontWeight: '500' },
  breakdownRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  breakdownValue: { fontSize: 15, fontWeight: '600' },
  pctBadge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  pctText: { fontSize: 12, fontWeight: '700' },

  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1 },
  statLabel: { fontSize: 14 },
  statValue: { fontSize: 14, fontWeight: '600' },
});

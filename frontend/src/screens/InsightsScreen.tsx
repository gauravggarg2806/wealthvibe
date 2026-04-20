import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { fetchInsights, Alert, InsightsResponse } from '../api/insights';
import { useTheme } from '../hooks/useTheme';
import { Colors } from '../theme/colors';

const USER_ID = 2;

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------
const MOCK: InsightsResponse = {
  user_id: 1,
  user_name: 'Gaurav',
  total_portfolio_value: 162534.50,
  total_unrealised_pnl: 1005.15,
  alert_count: 3,
  alerts: [
    {
      alert_type: 'rebalancing',
      severity: 'high',
      message: "Equity allocation is 42.3pp above target (97.3% actual vs 55.0% target). Consider selling equity or buying debt to rebalance.",
      actual_equity_pct: 97.3,
      target_equity_pct: 55.0,
      drift_pct: 42.3,
    },
    {
      alert_type: 'tax_loss_harvesting',
      severity: 'high',
      ticker: 'INTC',
      asset_name: 'Intel Corp.',
      message: "INTC is trading 31.5% below your average cost (₹68.50 vs avg ₹100.00). Consider harvesting this loss to offset capital gains.",
      avg_buy_price: 8400.0,
      current_price: 5754.0,
      loss_pct: 31.5,
      unrealised_loss: -1575,
    },
    {
      alert_type: 'overvaluation',
      severity: 'medium',
      ticker: 'INTC',
      asset_name: 'Intel Corp.',
      message: "INTC has a trailing P/E of 64.1, which exceeds the threshold of 40x. This may indicate the asset is potentially overvalued.",
      trailing_pe: 64.1,
      pe_threshold: 40,
    },
  ],
};

// ---------------------------------------------------------------------------
// Alert config — maps alert_type → display metadata
// ---------------------------------------------------------------------------
const ALERT_CONFIG: Record<Alert['alert_type'], {
  icon: string;
  label: string;
  color: string;
  bg: string;
  borderColor: string;
}> = {
  rebalancing: {
    icon: '⚖️',
    label: 'Rebalancing',
    color: Colors.primary,
    bg: Colors.primaryLight,
    borderColor: Colors.primary,
  },
  tax_loss_harvesting: {
    icon: '🌿',
    label: 'Tax-Loss Opportunity',
    color: Colors.success,
    bg: Colors.successLight,
    borderColor: Colors.success,
  },
  overvaluation: {
    icon: '🔴',
    label: 'Overvaluation Risk',
    color: Colors.danger,
    bg: Colors.dangerLight,
    borderColor: Colors.danger,
  },
};

const SEVERITY_COLOR: Record<Alert['severity'], string> = {
  high: Colors.danger,
  medium: Colors.warning,
  low: Colors.success,
};

// ---------------------------------------------------------------------------
// Alert Card
// ---------------------------------------------------------------------------
function AlertCard({ alert, theme }: { alert: Alert; theme: ReturnType<typeof useTheme> }) {
  const cfg = ALERT_CONFIG[alert.alert_type];
  const severityColor = SEVERITY_COLOR[alert.severity];

  return (
    <View style={[
      styles.alertCard,
      { backgroundColor: theme.card, borderLeftColor: cfg.borderColor },
    ]}>
      {/* Type header */}
      <View style={styles.alertHeader}>
        <View style={[styles.iconBubble, { backgroundColor: cfg.bg }]}>
          <Text style={styles.icon}>{cfg.icon}</Text>
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[styles.alertType, { color: cfg.color }]}>{cfg.label}</Text>
          {alert.ticker && (
            <Text style={[styles.alertTicker, { color: theme.textSecondary }]}>
              {alert.ticker} · {alert.asset_name}
            </Text>
          )}
        </View>
        <View style={[styles.severityBadge, { backgroundColor: severityColor + '22' }]}>
          <Text style={[styles.severityText, { color: severityColor }]}>
            {alert.severity.toUpperCase()}
          </Text>
        </View>
      </View>

      {/* Message */}
      <Text style={[styles.alertMessage, { color: theme.textSecondary }]}>{alert.message}</Text>

      {/* Contextual metrics */}
      {alert.alert_type === 'rebalancing' && alert.drift_pct != null && (
        <View style={[styles.metricsRow, { backgroundColor: theme.bg }]}>
          <Metric label="Actual Equity" value={`${alert.actual_equity_pct?.toFixed(1)}%`} color={Colors.danger} />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Metric label="Target Equity" value={`${alert.target_equity_pct?.toFixed(1)}%`} color={Colors.success} />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Metric label="Drift" value={`+${alert.drift_pct?.toFixed(1)}pp`} color={Colors.warning} />
        </View>
      )}

      {alert.alert_type === 'tax_loss_harvesting' && alert.loss_pct != null && (
        <View style={[styles.metricsRow, { backgroundColor: theme.bg }]}>
          <Metric label="Avg Cost" value={`₹${alert.avg_buy_price?.toFixed(2)}`} />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Metric label="Current" value={`₹${alert.current_price?.toFixed(2)}`} />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Metric label="Loss" value={`-${alert.loss_pct?.toFixed(1)}%`} color={Colors.danger} />
        </View>
      )}

      {alert.alert_type === 'overvaluation' && alert.trailing_pe != null && (
        <View style={[styles.metricsRow, { backgroundColor: theme.bg }]}>
          <Metric label="Trailing P/E" value={`${alert.trailing_pe?.toFixed(1)}x`} color={Colors.danger} />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Metric label="Threshold" value={`${alert.pe_threshold}x`} />
        </View>
      )}
    </View>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function InsightsScreen() {
  const theme = useTheme();
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [usingMock, setUsingMock] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const result = await fetchInsights(USER_ID);
      setData(result);
      setUsingMock(false);
    } catch {
      setData(MOCK);
      setUsingMock(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.bg }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const d = data!;
  const highCount  = d.alerts.filter(a => a.severity === 'high').length;
  const medCount   = d.alerts.filter(a => a.severity === 'medium').length;

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.primary} />
      }
    >
      {usingMock && (
        <View style={styles.mockBanner}>
          <Text style={styles.mockText}>Preview mode — showing sample data.</Text>
        </View>
      )}

      {/* Summary strip */}
      <View style={[styles.summaryStrip, { backgroundColor: theme.card }]}>
        <SummaryPill count={d.alert_count} label="Total Alerts" color={Colors.primary} />
        <View style={[styles.pillDivider, { backgroundColor: theme.border }]} />
        <SummaryPill count={highCount}   label="High"   color={Colors.danger} />
        <View style={[styles.pillDivider, { backgroundColor: theme.border }]} />
        <SummaryPill count={medCount}    label="Medium" color={Colors.warning} />
      </View>

      {/* Alert feed */}
      {d.alerts.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: theme.card }]}>
          <Text style={styles.emptyIcon}>✅</Text>
          <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>All clear!</Text>
          <Text style={[styles.emptyBody, { color: theme.textSecondary }]}>
            No alerts for your portfolio right now.
          </Text>
        </View>
      ) : (
        d.alerts.map((alert, i) => (
          <AlertCard key={i} alert={alert} theme={theme} />
        ))
      )}

      {/* Disclaimer */}
      <Text style={[styles.disclaimer, { color: theme.textMuted }]}>
        Alerts are generated automatically based on market data and your portfolio. They are not financial advice.
      </Text>
    </ScrollView>
  );
}

function SummaryPill({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <View style={styles.summaryPill}>
      <Text style={[styles.pillCount, { color }]}>{count}</Text>
      <Text style={styles.pillLabel}>{label}</Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const SHADOW = {
  shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.07, shadowRadius: 8, elevation: 3,
};

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 12, paddingBottom: 40 },

  mockBanner: {
    backgroundColor: Colors.warningLight, borderRadius: 10,
    padding: 10, borderLeftWidth: 3, borderLeftColor: Colors.warning,
  },
  mockText: { fontSize: 12, color: Colors.warning },

  summaryStrip: {
    borderRadius: 14, flexDirection: 'row',
    justifyContent: 'space-around', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 10,
    ...SHADOW,
  },
  summaryPill: { alignItems: 'center', flex: 1 },
  pillCount: { fontSize: 24, fontWeight: '800' },
  pillLabel: { fontSize: 11, color: Colors.textSecondary, marginTop: 2 },
  pillDivider: { width: 1, height: 36 },

  alertCard: {
    borderRadius: 14, borderLeftWidth: 4, padding: 16,
    ...SHADOW,
  },
  alertHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  iconBubble: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 20 },
  alertType: { fontSize: 14, fontWeight: '700' },
  alertTicker: { fontSize: 12, marginTop: 2 },
  severityBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  severityText: { fontSize: 10, fontWeight: '800' },
  alertMessage: { fontSize: 13, lineHeight: 19, marginBottom: 12 },

  metricsRow: {
    flexDirection: 'row', borderRadius: 10, padding: 12,
    justifyContent: 'space-around', alignItems: 'center',
  },
  metric: { alignItems: 'center', flex: 1 },
  metricLabel: { fontSize: 10, color: Colors.textMuted, textTransform: 'uppercase' },
  metricValue: { fontSize: 15, fontWeight: '700', color: Colors.textPrimary, marginTop: 3 },
  divider: { width: 1, height: 30 },

  emptyState: { borderRadius: 16, padding: 40, alignItems: 'center', ...SHADOW },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '700', marginBottom: 6 },
  emptyBody: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  disclaimer: { fontSize: 11, textAlign: 'center', lineHeight: 16, marginTop: 4 },
});

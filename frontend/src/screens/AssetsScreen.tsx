import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { fetchAssets, AssetItem } from '../api/assets';
import { useTheme } from '../hooks/useTheme';
import { Colors } from '../theme/colors';
import NewTransactionModal from '../components/NewTransactionModal';
import { AssetsSkeleton } from '../components/SkeletonLoader';
import ErrorState from '../components/ErrorState';

const USER_ID = 1;

const MOCK_ASSETS: AssetItem[] = [
  {
    id: 1, ticker: 'AAPL', name: 'Apple Inc.', asset_class: 'equity',
    target_allocation_pct: 30, net_quantity: 30, avg_cost: 188.5,
    current_price: 270.23, current_value: 8106.9, unrealised_pnl: 2476.9,
    pnl_percentage: 43.95, xirr: 19.61, beta: 1.02,
  },
  {
    id: 2, ticker: 'MSFT', name: 'Microsoft Corp.', asset_class: 'equity',
    target_allocation_pct: 25, net_quantity: 10, avg_cost: 410,
    current_price: 422.79, current_value: 4227.9, unrealised_pnl: 127.9,
    pnl_percentage: 3.12, xirr: 4.1, beta: 0.94,
  },
  {
    id: 3, ticker: 'TLT', name: 'iShares 20Y Treasury', asset_class: 'debt',
    target_allocation_pct: 45, net_quantity: 5, avg_cost: 92,
    current_price: 87.07, current_value: 435.35, unrealised_pnl: -24.65,
    pnl_percentage: -5.37, xirr: -3.2, beta: null,
  },
  {
    id: 4, ticker: 'INTC', name: 'Intel Corp.', asset_class: 'equity',
    target_allocation_pct: 0, net_quantity: 50, avg_cost: 100,
    current_price: 68.5, current_value: 3425, unrealised_pnl: -1575,
    pnl_percentage: -31.5, xirr: -28.4, beta: 1.18,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmt(v: number, prefix = '$') {
  return `${prefix}${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function classColor(ac: AssetItem['asset_class']): string {
  return ac === 'equity' ? Colors.equity : ac === 'debt' ? Colors.debt : Colors.mutualFund;
}

// ---------------------------------------------------------------------------
// Asset Detail Modal
// ---------------------------------------------------------------------------
interface ModalProps {
  asset: AssetItem | null;
  onClose: () => void;
  theme: ReturnType<typeof useTheme>;
}

function DetailModal({ asset, onClose, theme }: ModalProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: asset ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [asset]);

  if (!asset) return null;

  const isGain = asset.unrealised_pnl >= 0;
  const pnlColor = isGain ? Colors.success : Colors.danger;
  const cc = classColor(asset.asset_class);

  function Row({ label, value, color }: { label: string; value: string; color?: string }) {
    return (
      <View style={[mStyles.row, { borderBottomColor: theme.border }]}>
        <Text style={[mStyles.label, { color: theme.textSecondary }]}>{label}</Text>
        <Text style={[mStyles.value, { color: color ?? theme.textPrimary }]}>{value}</Text>
      </View>
    );
  }

  return (
    <Modal transparent animationType="slide" visible={!!asset} onRequestClose={onClose}>
      <Pressable style={mStyles.backdrop} onPress={onClose} />
      <Animated.View style={[mStyles.sheet, { backgroundColor: theme.card, opacity: fadeAnim }]}>
        {/* Handle */}
        <View style={[mStyles.handle, { backgroundColor: theme.border }]} />

        {/* Header */}
        <View style={mStyles.header}>
          <View style={[mStyles.tickerBadge, { backgroundColor: cc + '22' }]}>
            <Text style={[mStyles.tickerText, { color: cc }]}>{asset.ticker}</Text>
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[mStyles.assetName, { color: theme.textPrimary }]}>{asset.name}</Text>
            <Text style={[mStyles.assetClass, { color: cc }]}>
              {asset.asset_class.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} style={mStyles.closeBtn}>
            <Text style={mStyles.closeX}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Value banner */}
        <View style={[mStyles.valueBanner, { backgroundColor: cc + '11' }]}>
          <Text style={[mStyles.bannerValue, { color: cc }]}>{fmt(asset.current_value)}</Text>
          <Text style={[mStyles.bannerPnl, { color: pnlColor }]}>
            {isGain ? '+' : '-'}{fmt(asset.unrealised_pnl)} ({isGain ? '+' : ''}{asset.pnl_percentage.toFixed(2)}%)
          </Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          <Row label="Quantity Held"    value={`${asset.net_quantity} units`} />
          <Row label="Avg. Cost"        value={fmt(asset.avg_cost)} />
          <Row label="Current Price"    value={fmt(asset.current_price)} />
          <Row label="Invested Value"   value={fmt(asset.avg_cost * asset.net_quantity)} />
          <Row label="Current Value"    value={fmt(asset.current_value)} />
          <Row label="Unrealised P&L"   value={`${isGain ? '+' : '-'}${fmt(asset.unrealised_pnl)}`} color={pnlColor} />
          <Row label="XIRR"
            value={asset.xirr != null ? `${asset.xirr > 0 ? '+' : ''}${asset.xirr.toFixed(2)}%` : 'N/A'}
            color={asset.xirr != null ? (asset.xirr >= 0 ? Colors.success : Colors.danger) : undefined}
          />
          <Row label="Beta (1Y vs S&P)"
            value={asset.beta != null ? asset.beta.toFixed(3) : '—'}
          />
          <Row label="Target Allocation" value={`${asset.target_allocation_pct}%`} />
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const mStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 40,
    maxHeight: '75%',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 20,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  tickerBadge: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  tickerText: { fontWeight: '800', fontSize: 14 },
  assetName: { fontSize: 16, fontWeight: '700' },
  assetClass: { fontSize: 11, fontWeight: '600', marginTop: 2 },
  closeBtn: { padding: 6 },
  closeX: { fontSize: 16, color: Colors.textMuted },
  valueBanner: { borderRadius: 12, padding: 14, marginBottom: 16, alignItems: 'center' },
  bannerValue: { fontSize: 28, fontWeight: '800' },
  bannerPnl: { fontSize: 14, fontWeight: '600', marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1 },
  label: { fontSize: 14 },
  value: { fontSize: 14, fontWeight: '600' },
});

// ---------------------------------------------------------------------------
// Asset Card
// ---------------------------------------------------------------------------
function AssetCard({ item, onPress, theme }: { item: AssetItem; onPress: () => void; theme: ReturnType<typeof useTheme> }) {
  const isGain = item.unrealised_pnl >= 0;
  const pnlColor = isGain ? Colors.success : Colors.danger;
  const pnlBg = isGain ? Colors.successLight : Colors.dangerLight;
  const cc = classColor(item.asset_class);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[styles.card, { backgroundColor: theme.card }]}
    >
      {/* Left accent bar */}
      <View style={[styles.accentBar, { backgroundColor: cc }]} />

      <View style={styles.cardBody}>
        {/* Top row */}
        <View style={styles.row}>
          <View>
            <Text style={[styles.ticker, { color: theme.textPrimary }]}>{item.ticker}</Text>
            <Text style={[styles.name, { color: theme.textSecondary }]} numberOfLines={1}>
              {item.name}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.value, { color: theme.textPrimary }]}>{fmt(item.current_value)}</Text>
            <View style={[styles.pnlBadge, { backgroundColor: pnlBg }]}>
              <Text style={[styles.pnlText, { color: pnlColor }]}>
                {isGain ? '▲' : '▼'} {item.pnl_percentage.toFixed(2)}%
              </Text>
            </View>
          </View>
        </View>

        {/* Bottom row */}
        <View style={[styles.row, styles.bottomRow, { borderTopColor: theme.border }]}>
          <View style={styles.metaItem}>
            <Text style={[styles.metaLabel, { color: theme.textMuted }]}>Qty</Text>
            <Text style={[styles.metaValue, { color: theme.textPrimary }]}>{item.net_quantity}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={[styles.metaLabel, { color: theme.textMuted }]}>Avg Cost</Text>
            <Text style={[styles.metaValue, { color: theme.textPrimary }]}>{fmt(item.avg_cost)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={[styles.metaLabel, { color: theme.textMuted }]}>XIRR</Text>
            <Text style={[styles.metaValue, { color: item.xirr != null ? (item.xirr >= 0 ? Colors.success : Colors.danger) : theme.textMuted }]}>
              {item.xirr != null ? `${item.xirr > 0 ? '+' : ''}${item.xirr.toFixed(1)}%` : '—'}
            </Text>
          </View>
          <View style={[styles.classPill, { backgroundColor: cc + '22' }]}>
            <Text style={[styles.classText, { color: cc }]}>
              {item.asset_class.replace('_', ' ')}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------
export default function AssetsScreen() {
  const theme = useTheme();
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<AssetItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showNewTx, setShowNewTx] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else           setLoading(true);
    setError(null);
    try {
      const data = await fetchAssets(USER_ID);
      setAssets(data.filter(a => !a.error));
    } catch (err: any) {
      // On refresh, keep stale data visible — only replace with error on first load
      if (!isRefresh) setError(err?.message ?? 'Failed to load assets.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) return <AssetsSkeleton />;
  if (error)   return <ErrorState message={error} onRetry={() => load()} />;

  const totalValue = assets.reduce((s, a) => s + a.current_value, 0);

  return (
    <View style={{ flex: 1 }}>
      <FlatList
        data={assets}
        keyExtractor={a => String(a.id)}
        style={{ backgroundColor: theme.bg }}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={Colors.primary} />
        }
        ListHeaderComponent={
          <View style={[styles.summaryCard, { backgroundColor: Colors.primary }]}>
            <Text style={styles.summaryLabel}>Portfolio Value</Text>
            <Text style={styles.summaryValue}>{fmt(totalValue)}</Text>
            <Text style={styles.summaryCount}>{assets.length} holdings</Text>
          </View>
        }
        renderItem={({ item }) => (
          <AssetCard item={item} onPress={() => setSelected(item)} theme={theme} />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />
      <DetailModal asset={selected} onClose={() => setSelected(null)} theme={theme} />

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setShowNewTx(true)}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>+</Text>
      </TouchableOpacity>

      <NewTransactionModal
        visible={showNewTx}
        onClose={() => setShowNewTx(false)}
        onSuccess={() => load(true)}
      />
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
  list: { padding: 16, paddingBottom: 32, gap: 0 },
  summaryCard: {
    borderRadius: 16, padding: 20, marginBottom: 16,
    ...SHADOW,
  },
  summaryLabel: { fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: '500' },
  summaryValue: { fontSize: 30, fontWeight: '800', color: '#fff', marginTop: 4 },
  summaryCount: { fontSize: 13, color: 'rgba(255,255,255,0.65)', marginTop: 4 },
  card: {
    borderRadius: 14, flexDirection: 'row', overflow: 'hidden',
    ...SHADOW,
  },
  accentBar: { width: 4 },
  cardBody: { flex: 1, padding: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bottomRow: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, gap: 4 },
  ticker: { fontSize: 17, fontWeight: '800' },
  name: { fontSize: 12, marginTop: 2, maxWidth: 160 },
  value: { fontSize: 17, fontWeight: '700' },
  pnlBadge: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2, marginTop: 4 },
  pnlText: { fontSize: 12, fontWeight: '700' },
  metaItem: { alignItems: 'center' },
  metaLabel: { fontSize: 10, textTransform: 'uppercase' },
  metaValue: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  classPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  classText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  fab: {
    position: 'absolute', bottom: 28, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 10, elevation: 10,
  },
  fabIcon: { color: '#fff', fontSize: 28, lineHeight: 32, fontWeight: '300' },
});

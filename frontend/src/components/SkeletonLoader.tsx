import React, { useEffect, useRef } from 'react';
import { Animated, DimensionValue, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface SkeletonBoxProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonBox({ width = '100%', height = 16, borderRadius = 8, style }: SkeletonBoxProps) {
  const theme = useTheme();
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.7] });
  const base = theme.isDark ? '#334155' : '#E5E7EB';

  return (
    <Animated.View
      style={[{ width: width as any, height, borderRadius, backgroundColor: base, opacity }, style]}
    />
  );
}

// ---------------------------------------------------------------------------
// Dashboard skeleton
// ---------------------------------------------------------------------------
export function DashboardSkeleton() {
  const theme = useTheme();
  return (
    <View style={[sk.container, { backgroundColor: theme.bg }]}>
      {/* Header card */}
      <View style={[sk.card, { backgroundColor: theme.card }]}>
        <SkeletonBox width={120} height={14} />
        <SkeletonBox width={200} height={36} style={{ marginTop: 10 }} />
        <SkeletonBox width={160} height={28} style={{ marginTop: 10 }} />
        <SkeletonBox width={140} height={12} style={{ marginTop: 12 }} />
      </View>

      {/* Donut placeholder */}
      <View style={[sk.card, { backgroundColor: theme.card, alignItems: 'center' }]}>
        <SkeletonBox width={140} height={16} style={{ alignSelf: 'flex-start' }} />
        <SkeletonBox width={180} height={180} borderRadius={90} style={{ marginTop: 16 }} />
        <View style={sk.legendRow}>
          {[80, 100, 90].map((w, i) => <SkeletonBox key={i} width={w} height={12} />)}
        </View>
      </View>

      {/* Breakdown card */}
      <View style={[sk.card, { backgroundColor: theme.card }]}>
        <SkeletonBox width={100} height={16} />
        {[0, 1, 2].map(i => (
          <View key={i} style={sk.row}>
            <SkeletonBox width={120} height={14} />
            <SkeletonBox width={80} height={14} />
          </View>
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Assets skeleton
// ---------------------------------------------------------------------------
export function AssetsSkeleton() {
  const theme = useTheme();
  return (
    <View style={[sk.container, { backgroundColor: theme.bg }]}>
      {/* Summary */}
      <View style={[sk.card, { backgroundColor: theme.card }]}>
        <SkeletonBox width={100} height={14} />
        <SkeletonBox width={180} height={30} style={{ marginTop: 8 }} />
        <SkeletonBox width={80} height={12} style={{ marginTop: 8 }} />
      </View>
      {/* 4 asset cards */}
      {[0, 1, 2, 3].map(i => (
        <View key={i} style={[sk.card, { backgroundColor: theme.card, flexDirection: 'row', gap: 12 }]}>
          <View style={sk.accentBar} />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={sk.row}>
              <SkeletonBox width={60} height={18} />
              <SkeletonBox width={80} height={18} />
            </View>
            <SkeletonBox width={130} height={12} />
            <View style={sk.row}>
              {[50, 70, 60].map((w, j) => <SkeletonBox key={j} width={w} height={12} />)}
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

const sk = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 14 },
  card: { borderRadius: 16, padding: 20, gap: 0,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 },
  legendRow: { flexDirection: 'row', gap: 16, marginTop: 16 },
  accentBar: { width: 4, borderRadius: 2, backgroundColor: '#E5E7EB' },
});

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { G, Path, Circle } from 'react-native-svg';
import { Colors } from '../theme/colors';

interface Slice {
  label: string;
  value: number;
  percentage: number;
  color: string;
}

interface Props {
  slices: Slice[];
  size?: number;
  strokeWidth?: number;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export default function DonutChart({ slices, size = 200, strokeWidth = 36 }: Props) {
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - strokeWidth) / 2;
  const gap = 2; // degrees gap between slices

  let cursor = 0;
  const arcs = slices.map((slice) => {
    const sweep = (slice.percentage / 100) * 360;
    const start = cursor;
    const end = cursor + sweep - (slices.length > 1 ? gap : 0);
    cursor += sweep;
    return { ...slice, start, end };
  });

  // Find the largest slice to label in the centre
  const largest = slices.reduce((a, b) => (a.percentage > b.percentage ? a : b), slices[0]);

  return (
    <View style={styles.wrapper}>
      <Svg width={size} height={size}>
        <G>
          {arcs.map((arc, i) => (
            <Path
              key={i}
              d={describeArc(cx, cy, r, arc.start, arc.end)}
              stroke={arc.color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="butt"
            />
          ))}
        </G>
        {/* Centre hole label */}
        <Circle cx={cx} cy={cy} r={r - strokeWidth / 2} fill="white" />
      </Svg>

      {/* Centre text overlay */}
      <View style={[styles.centreLabel, { width: size, height: size }]}>
        <Text style={styles.centrePercent}>{largest?.percentage?.toFixed(1)}%</Text>
        <Text style={styles.centreTitle}>{largest?.label}</Text>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        {slices.map((s, i) => (
          <View key={i} style={styles.legendItem}>
            <View style={[styles.dot, { backgroundColor: s.color }]} />
            <Text style={styles.legendLabel}>{s.label}</Text>
            <Text style={styles.legendPct}>{s.percentage.toFixed(1)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center' },
  centreLabel: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    top: 0,
    left: 0,
  },
  centrePercent: { fontSize: 26, fontWeight: '700', color: Colors.textPrimary },
  centreTitle: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 16, gap: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 13, color: Colors.textSecondary },
  legendPct: { fontSize: 13, fontWeight: '600', color: Colors.textPrimary },
});

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { Colors } from '../theme/colors';

interface Props {
  message: string;
  onRetry: () => void;
}

export default function ErrorState({ message, onRetry }: Props) {
  const theme = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={styles.icon}>⚠️</Text>
        <Text style={[styles.title, { color: theme.textPrimary }]}>Something went wrong</Text>
        <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={onRetry} activeOpacity={0.8}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    borderRadius: 20, padding: 32, alignItems: 'center', width: '100%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  icon: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 10, textAlign: 'center' },
  message: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginBottom: 24 },
  retryBtn: {
    backgroundColor: Colors.primary, borderRadius: 14,
    paddingHorizontal: 32, paddingVertical: 14,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

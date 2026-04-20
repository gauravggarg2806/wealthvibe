import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { postTransaction, AssetClass, TransactionType } from '../api/transactions';
import { useTheme } from '../hooks/useTheme';
import { Colors } from '../theme/colors';

const USER_ID = 2;

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;   // triggers list refresh in parent
}

// ---------------------------------------------------------------------------
// Small reusable sub-components
// ---------------------------------------------------------------------------
function Label({ text, theme }: { text: string; theme: ReturnType<typeof useTheme> }) {
  return <Text style={[fStyles.label, { color: theme.textSecondary }]}>{text}</Text>;
}

function Field({
  placeholder, value, onChangeText, keyboardType = 'default', theme,
}: {
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'decimal-pad';
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <TextInput
      style={[fStyles.input, { backgroundColor: theme.bg, borderColor: theme.border, color: theme.textPrimary }]}
      placeholder={placeholder}
      placeholderTextColor={theme.textMuted}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      autoCapitalize="characters"
    />
  );
}

function SegmentedControl<T extends string>({
  options, labels, value, onChange, activeColor, theme,
}: {
  options: T[];
  labels: string[];
  value: T;
  onChange: (v: T) => void;
  activeColor: string;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={[fStyles.segmented, { backgroundColor: theme.bg, borderColor: theme.border }]}>
      {options.map((opt, i) => {
        const active = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[
              fStyles.segment,
              active && { backgroundColor: activeColor },
              i === 0 && { borderTopLeftRadius: 10, borderBottomLeftRadius: 10 },
              i === options.length - 1 && { borderTopRightRadius: 10, borderBottomRightRadius: 10 },
            ]}
            onPress={() => onChange(opt)}
            activeOpacity={0.8}
          >
            <Text style={[fStyles.segmentText, { color: active ? '#fff' : theme.textSecondary }]}>
              {labels[i]}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------
const ASSET_CLASSES: AssetClass[] = ['equity', 'mutual_fund', 'debt'];
const ASSET_CLASS_LABELS = ['Equity', 'Mutual Fund', 'Debt'];
const CLASS_COLORS: Record<AssetClass, string> = {
  equity: Colors.equity,
  mutual_fund: Colors.mutualFund,
  debt: Colors.debt,
};

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export default function NewTransactionModal({ visible, onClose, onSuccess }: Props) {
  const theme = useTheme();

  const [ticker, setTicker] = useState('');
  const [assetName, setAssetName] = useState('');
  const [assetClass, setAssetClass] = useState<AssetClass>('equity');
  const [txType, setTxType] = useState<TransactionType>('buy');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(todayISO());
  const [targetAlloc, setTargetAlloc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function reset() {
    setTicker(''); setAssetName(''); setAssetClass('equity');
    setTxType('buy'); setQuantity(''); setPrice('');
    setDate(todayISO()); setTargetAlloc(''); setErrors({});
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!ticker.trim())              e.ticker = 'Ticker is required';
    if (!assetName.trim())           e.assetName = 'Asset name is required';
    if (!quantity || isNaN(Number(quantity)) || Number(quantity) <= 0)
                                      e.quantity = 'Enter a valid quantity > 0';
    if (!price || isNaN(Number(price)) || Number(price) <= 0)
                                      e.price = 'Enter a valid price > 0';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
                                      e.date = 'Use format YYYY-MM-DD';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setSubmitting(true);
    try {
      await postTransaction({
        user_id: USER_ID,
        ticker: ticker.trim().toUpperCase(),
        asset_name: assetName.trim(),
        asset_class: assetClass,
        transaction_type: txType,
        quantity: Number(quantity),
        price: Number(price),
        date,
        target_allocation_percentage: Number(targetAlloc) || 0,
      });
      reset();
      onSuccess();
      onClose();
    } catch (err: any) {
      const detail = err?.response?.data?.detail ?? 'Could not save transaction. Is the backend running?';
      Alert.alert('Error', String(detail));
    } finally {
      setSubmitting(false);
    }
  }

  const activeClassColor = CLASS_COLORS[assetClass];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      {/* Dim backdrop */}
      <Pressable style={fStyles.backdrop} onPress={onClose} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={fStyles.kavWrapper}
      >
        <View style={[fStyles.sheet, { backgroundColor: theme.card }]}>
          {/* Handle */}
          <View style={[fStyles.handle, { backgroundColor: theme.border }]} />

          {/* Header */}
          <View style={fStyles.sheetHeader}>
            <Text style={[fStyles.sheetTitle, { color: theme.textPrimary }]}>New Transaction</Text>
            <TouchableOpacity onPress={onClose} style={fStyles.closeBtn}>
              <Text style={[fStyles.closeX, { color: theme.textMuted }]}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

            {/* Buy / Sell toggle */}
            <Label text="Transaction Type" theme={theme} />
            <SegmentedControl
              options={['buy', 'sell'] as TransactionType[]}
              labels={['Buy', 'Sell']}
              value={txType}
              onChange={setTxType}
              activeColor={txType === 'buy' ? Colors.success : Colors.danger}
              theme={theme}
            />

            {/* Ticker */}
            <Label text="Ticker Symbol *" theme={theme} />
            <Field placeholder="e.g. AAPL" value={ticker} onChangeText={setTicker} theme={theme} />
            {errors.ticker && <Text style={fStyles.error}>{errors.ticker}</Text>}

            {/* Asset Name */}
            <Label text="Asset Name *" theme={theme} />
            <Field placeholder="e.g. Apple Inc." value={assetName} onChangeText={setAssetName} theme={theme} />
            {errors.assetName && <Text style={fStyles.error}>{errors.assetName}</Text>}

            {/* Asset Class */}
            <Label text="Asset Class" theme={theme} />
            <SegmentedControl
              options={ASSET_CLASSES}
              labels={ASSET_CLASS_LABELS}
              value={assetClass}
              onChange={setAssetClass}
              activeColor={activeClassColor}
              theme={theme}
            />

            {/* Quantity & Price side by side */}
            <View style={fStyles.twoCol}>
              <View style={{ flex: 1 }}>
                <Label text="Quantity *" theme={theme} />
                <Field placeholder="10" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" theme={theme} />
                {errors.quantity && <Text style={fStyles.error}>{errors.quantity}</Text>}
              </View>
              <View style={{ width: 12 }} />
              <View style={{ flex: 1 }}>
                <Label text="Price *" theme={theme} />
                <Field placeholder="150.00" value={price} onChangeText={setPrice} keyboardType="decimal-pad" theme={theme} />
                {errors.price && <Text style={fStyles.error}>{errors.price}</Text>}
              </View>
            </View>

            {/* Date */}
            <Label text="Date (YYYY-MM-DD) *" theme={theme} />
            <Field placeholder="2024-01-15" value={date} onChangeText={setDate} theme={theme} />
            {errors.date && <Text style={fStyles.error}>{errors.date}</Text>}

            {/* Target Allocation — optional */}
            <Label text="Target Allocation % (optional)" theme={theme} />
            <Field placeholder="30" value={targetAlloc} onChangeText={setTargetAlloc} keyboardType="decimal-pad" theme={theme} />

            {/* Total preview */}
            {quantity && price && !isNaN(Number(quantity)) && !isNaN(Number(price)) && (
              <View style={[fStyles.totalPreview, { backgroundColor: activeClassColor + '15', borderColor: activeClassColor + '40' }]}>
                <Text style={[fStyles.totalLabel, { color: theme.textSecondary }]}>Total Value</Text>
                <Text style={[fStyles.totalValue, { color: activeClassColor }]}>
                  ₹{(Number(quantity) * Number(price)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </Text>
              </View>
            )}

            {/* Submit */}
            <TouchableOpacity
              style={[
                fStyles.submitBtn,
                { backgroundColor: txType === 'buy' ? Colors.success : Colors.danger },
                submitting && { opacity: 0.7 },
              ]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.8}
            >
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={fStyles.submitText}>{txType === 'buy' ? '+ Record Buy' : '− Record Sell'}</Text>
              }
            </TouchableOpacity>

            <View style={{ height: 20 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const fStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  kavWrapper: { justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 0,
    maxHeight: '90%',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 24,
  },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '800' },
  closeBtn: { padding: 6 },
  closeX: { fontSize: 18 },

  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15,
  },
  error: { color: Colors.danger, fontSize: 11, marginTop: 4 },

  segmented: { flexDirection: 'row', borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  segment: { flex: 1, paddingVertical: 11, alignItems: 'center' },
  segmentText: { fontSize: 13, fontWeight: '600' },

  twoCol: { flexDirection: 'row' },

  totalPreview: {
    borderRadius: 12, borderWidth: 1,
    padding: 14, marginTop: 16,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  totalLabel: { fontSize: 13 },
  totalValue: { fontSize: 20, fontWeight: '800' },

  submitBtn: {
    borderRadius: 14, paddingVertical: 16, alignItems: 'center',
    marginTop: 20,
  },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

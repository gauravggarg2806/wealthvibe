import { useColorScheme } from 'react-native';
import { Colors } from '../theme/colors';

export function useTheme() {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return {
    isDark,
    bg: isDark ? Colors.dark.background : Colors.background,
    card: isDark ? Colors.dark.card : Colors.card,
    border: isDark ? Colors.dark.border : Colors.border,
    textPrimary: isDark ? Colors.dark.textPrimary : Colors.textPrimary,
    textSecondary: isDark ? Colors.dark.textSecondary : Colors.textSecondary,
    textMuted: isDark ? Colors.dark.textMuted : Colors.textMuted,
  };
}

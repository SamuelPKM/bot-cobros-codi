import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { palette, spacing } from './theme';

interface ScreenProps {
  children: ReactNode;
  /** Jalar hacia abajo para actualizar. */
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function Screen({ children, onRefresh, refreshing = false }: ScreenProps) {
  return (
    <ScrollView
      style={{ backgroundColor: palette.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={palette.subtle} /> : undefined
      }>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl * 2 },
});

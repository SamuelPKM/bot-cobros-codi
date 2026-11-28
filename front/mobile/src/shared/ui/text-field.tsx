import { useState } from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { fonts, palette, radius } from './theme';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextField({ label, error, hint, onFocus, onBlur, ...input }: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={palette.subtle}
        style={[
          styles.input,
          { borderColor: error ? palette.dangerInput : focused ? palette.primary : palette.borderInput },
        ]}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        {...input}
      />
      {error ? (
        <Text style={[styles.help, { color: palette.danger }]}>{error}</Text>
      ) : hint ? (
        <Text style={[styles.help, { color: palette.muted }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontFamily: fonts.medium, fontSize: 14, color: palette.textStrong },
  input: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.regular,
    fontSize: 16,
    minHeight: 48,
    color: palette.text,
    backgroundColor: palette.surface,
  },
  help: { fontFamily: fonts.regular, fontSize: 14 },
});

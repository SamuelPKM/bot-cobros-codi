import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { messageFor } from '@/shared/api/error-message';
import { Button } from '@/shared/ui/button';
import { Notice } from '@/shared/ui/notice';
import { TextField } from '@/shared/ui/text-field';
import { fonts, palette, radius, spacing } from '@/shared/ui/theme';
import { formatMoney } from '@/shared/format/format';
import { kindLabel } from '../policies/charge-view.policy';
import {
  parseNewChargeForm,
  tipPreview,
  type NewChargeField,
  type NewChargeInput,
  type NewChargeValues,
  type TipOption,
} from '../policies/new-charge-form.policy';
import type { ChargeMethod } from '../types/charge.types';

const METHODS: ChargeMethod[] = ['push', 'qr', 'link'];

const TIP_OPTIONS: { value: TipOption; label: string }[] = [
  { value: 'none', label: 'Sin propina' },
  { value: '10', label: '10%' },
  { value: '15', label: '15%' },
  { value: '20', label: '20%' },
  { value: 'custom', label: 'Otra' },
];

export function NewChargeForm({ onSubmit }: { onSubmit: (input: NewChargeInput) => Promise<void> }) {
  const [values, setValues] = useState<NewChargeValues>({ method: 'push', phone: '', amount: '',
    concept: '',
    tipOption: 'none',
    tip: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<NewChargeField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // El estado tarda un render; el ref corta el segundo toque al instante.
  const sending = useRef(false);

  const preview = tipPreview(values);

  const set = (key: keyof NewChargeValues) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function submit() {
    if (sending.current) return;
    const parsed = parseNewChargeForm(values);
    setFormError(null);
    if (!parsed.ok) {
      setFieldErrors(parsed.fieldErrors);
      return;
    }
    setFieldErrors({});
    sending.current = true;
    setBusy(true);
    try {
      await onSubmit(parsed.data);
    } catch (error) {
      setFormError(messageFor(error));
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <View style={styles.form}>
      {formError ? <Notice message={formError} /> : null}

      <View accessibilityRole="radiogroup" accessibilityLabel="Cómo cobrar" style={styles.methods}>
        {METHODS.map((method) => {
          const selected = values.method === method;
          return (
            <Pressable
              key={method}
              accessibilityRole="radio"
              accessibilityLabel={kindLabel(method)}
              accessibilityState={{ checked: selected }}
              onPress={() => set('method')(method)}
              style={[styles.method, selected && styles.methodActive]}>
              <Text style={[styles.methodText, { color: selected ? palette.text : palette.muted }]}>
                {kindLabel(method)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {values.method === 'push' ? (
        <TextField
          label="Celular del cliente"
          value={values.phone}
          onChangeText={set('phone')}
          error={fieldErrors.phone}
          hint="10 dígitos, con CoDi activo en su banco"
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
        />
      ) : null}
      <TextField
        label="Monto"
        value={values.amount}
        onChangeText={set('amount')}
        error={fieldErrors.amount}
        placeholder="0.00"
        keyboardType="decimal-pad"
      />
      <View accessibilityRole="radiogroup" accessibilityLabel="Propina" style={styles.methods}>
        {TIP_OPTIONS.map(({ value, label }) => {
          const selected = values.tipOption === value;
          return (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityLabel={label}
              accessibilityState={{ checked: selected }}
              onPress={() => setValues((current) => ({ ...current, tipOption: value }))}
              style={[styles.method, selected && styles.methodActive]}>
              <Text style={[styles.methodText, { color: selected ? palette.text : palette.muted }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      {values.tipOption === 'custom' ? (
        <TextField
          label="Propina (pesos)"
          value={values.tip}
          onChangeText={set('tip')}
          error={fieldErrors.tip}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />
      ) : fieldErrors.tip ? (
        <Notice message={fieldErrors.tip} />
      ) : null}
      {preview ? (
        <View accessibilityLiveRegion="polite" style={styles.total}>
          <Text style={styles.totalText}>{`Total a cobrar: ${formatMoney(preview.total)}`}</Text>
          {preview.tip > 0 ? (
            <Text style={styles.totalDetail}>{`Cobro ${formatMoney(preview.subtotal)} + propina ${formatMoney(preview.tip)}`}</Text>
          ) : null}
        </View>
      ) : null}
      <TextField
        label="Concepto (opcional)"
        value={values.concept}
        onChangeText={set('concept')}
        error={fieldErrors.concept}
        maxLength={40}
        returnKeyType="done"
      />
      <Button label="Cobrar" onPress={submit} busy={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
  methods: {
    flexDirection: 'row',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: palette.neutralSurface,
  },
  method: {
    flex: 1,
    minHeight: 40,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  methodActive: {
    backgroundColor: palette.surface,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  total: { gap: 2 },
  totalText: { fontFamily: fonts.semibold, fontSize: 18, color: palette.text, fontVariant: ['tabular-nums'] },
  totalDetail: { fontFamily: fonts.regular, fontSize: 14, color: palette.muted, fontVariant: ['tabular-nums'] },
  methodText: { fontFamily: fonts.medium, fontSize: 14, textAlign: 'center' },
});

import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { messageFor } from '@/shared/api/error-message';
import { Button } from '@/shared/ui/button';
import { Notice } from '@/shared/ui/notice';
import { TextField } from '@/shared/ui/text-field';
import { spacing } from '@/shared/ui/theme';
import { parseLoginForm, type LoginFieldErrors, type LoginInput } from '../policies/login-form.policy';

interface LoginFormProps {
  onSubmit: (input: LoginInput) => Promise<void>;
  /** P. ej. "Tu sesión terminó. Entra de nuevo." */
  notice?: string;
}

export function LoginForm({ onSubmit, notice }: LoginFormProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<LoginFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    const parsed = parseLoginForm({ username, password });
    setFormError(null);
    if (!parsed.ok) {
      setFieldErrors(parsed.fieldErrors);
      return;
    }
    setFieldErrors({});
    setBusy(true);
    try {
      await onSubmit(parsed.data);
    } catch (error) {
      setFormError(messageFor(error));
      setBusy(false);
    }
  }

  return (
    <View style={styles.form}>
      {notice && !formError ? <Notice message={notice} tone="info" /> : null}
      {formError ? <Notice message={formError} /> : null}
      <TextField
        label="Usuario"
        value={username}
        onChangeText={setUsername}
        error={fieldErrors.username}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        returnKeyType="next"
      />
      <TextField
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        error={fieldErrors.password}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      <Button label="Entrar" onPress={submit} busy={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md },
});

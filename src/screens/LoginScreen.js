import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { fetchCustomers } from '../services/timelogApi';

export default function LoginScreen({ onConnect }) {
  const [siteName, setSiteName] = useState('luis_demo');
  const [pat, setPat] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleConnect() {
    if (!siteName.trim() || !pat.trim()) {
      setError('Please enter both site name and PAT.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const customers = await fetchCustomers(pat.trim(), siteName.trim());
      onConnect({ pat: pat.trim(), siteName: siteName.trim(), customers: customers || [] });
    } catch (e) {
      if (e.message === 'AUTH_FAILED') {
        setError('Invalid or expired token. Please check your PAT.');
      } else {
        setError(e.message || 'Could not connect. Check your site name and PAT.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <View style={styles.logoRow}>
            <View style={styles.logoDot} />
            <Text style={styles.logoText}>TimeLog</Text>
          </View>
          <Text style={styles.title}>Time Registration</Text>
          <Text style={styles.subtitle}>Connect your TimeLog account to get started</Text>

          <Text style={styles.label}>Site Name</Text>
          <TextInput
            style={styles.input}
            value={siteName}
            onChangeText={setSiteName}
            placeholder="e.g. luis_demo"
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          <Text style={styles.label}>Personal Access Token (PAT)</Text>
          <TextInput
            style={[styles.input, styles.patInput]}
            value={pat}
            onChangeText={setPat}
            placeholder="Paste your PAT here"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={false}
            multiline
            editable={!loading}
          />

          <Text style={styles.hint}>
            Your token is used only during this session and never stored.
          </Text>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleConnect}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Connect</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#f3f4f6' },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 28,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  logoDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#2563eb', marginRight: 8 },
  logoText: { fontSize: 20, fontWeight: '700', color: '#2563eb' },
  title: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 6 },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    marginBottom: 16,
    backgroundColor: '#fafafa',
  },
  patInput: { minHeight: 60, textAlignVertical: 'top' },
  hint: { fontSize: 12, color: '#9ca3af', marginBottom: 16 },
  errorText: { color: '#ef4444', fontSize: 13, marginBottom: 12, fontWeight: '500' },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

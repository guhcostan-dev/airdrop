import React from 'react';
import { Button, ScrollView, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { restartApp, useAirdrop, withAirdrop } from 'react-native-airdrop';
import { RELEASE_LABEL } from './src/release';

function Row({ label, value, testID }: { label: string; value: string; testID?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} testID={testID}>
        {value}
      </Text>
    </View>
  );
}

function App() {
  const { state, status, sync, refresh } = useAirdrop();

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>react-native-airdrop</Text>
          <Text style={styles.release} testID="release-label">
            {`release: ${RELEASE_LABEL}`}
          </Text>

          <Row label="Status" value={status ?? '—'} testID="sync-status" />
          <Row label="Running update" value={state?.currentUpdateId ?? 'embedded'} testID="current-update" />
          <Row label="Pending update" value={state?.pendingUpdateId ?? '—'} testID="pending-update" />
          <Row label="Runtime version" value={state?.runtimeVersion ?? '—'} />
          <Row label="Channel" value={state?.channel ?? '—'} />
          <Row label="Platform" value={state?.platform ?? '—'} />
          <Row label="OTA enabled" value={state ? String(state.enabled) : '—'} />

          <View style={styles.buttons}>
            <Button title="Check for update" onPress={() => sync()} testID="check-button" />
            <Button title="Restart to apply" onPress={restartApp} testID="restart-button" />
            <Button title="Refresh" onPress={refresh} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  release: { fontSize: 20, fontWeight: '600', color: '#2563eb', marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  label: { color: '#555' },
  value: { fontFamily: 'Courier', flexShrink: 1, textAlign: 'right' },
  buttons: { marginTop: 24, gap: 12 },
});

// Checks on start and when returning to the foreground; downloaded updates
// apply on the next cold start (or via the "Restart to apply" button).
export default withAirdrop(App, { checkFrequency: 'onAppResume' });

import { useState } from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import LoginScreen from './src/screens/LoginScreen';
import TimeRegistrationScreen from './src/screens/TimeRegistrationScreen';

export default function App() {
  const [session, setSession] = useState(null);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" backgroundColor="#f3f4f6" />
        {session ? (
          <TimeRegistrationScreen
            pat={session.pat}
            siteName={session.siteName}
            customers={session.customers}
            onDisconnect={() => setSession(null)}
          />
        ) : (
          <LoginScreen onConnect={setSession} />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f3f4f6' },
});

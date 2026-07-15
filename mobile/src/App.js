import { useEffect } from 'react';
import { Platform, StyleSheet } from 'react-native';
import 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ErrorBoundary from './components/ErrorBoundary';
import AppNavigator from './navigation/AppNavigator';

export default function App() {
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.body.style.overflow = 'auto';
    }
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <NavigationContainer>
            <AppNavigator />
          </NavigationContainer>
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});

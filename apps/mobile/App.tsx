import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Main application entry point
 *
 * This is a minimal setup for the Expo app. Navigation and screens
 * will be added in subsequent subtasks.
 */
export default function App(): JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Email AI</Text>
      <Text style={styles.subtitle}>AI-powered email client</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
});

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

export default function Banner({ message, type, onDismiss }) {
  const opacity = new Animated.Value(1);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => onDismiss && onDismiss());
    }, 3500);
    return () => clearTimeout(timer);
  }, [message]);

  if (!message) return null;

  return (
    <Animated.View style={[styles.banner, type === 'success' ? styles.success : styles.error, { opacity }]}>
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  success: { backgroundColor: '#d1fae5', borderLeftWidth: 4, borderLeftColor: '#10b981' },
  error: { backgroundColor: '#fee2e2', borderLeftWidth: 4, borderLeftColor: '#ef4444' },
  text: { fontSize: 14, color: '#1f2937', fontWeight: '500' },
});

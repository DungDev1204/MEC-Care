import type { ExpoConfig, ConfigContext } from 'expo/config';
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config, name: 'Clienté', slug: 'client-studio', scheme: 'clientstudio',
  web: { ...config.web, ...(process.env.EXPO_PUBLIC_REVIEW_MODE === 'true' ? { output: 'static' as const } : {}) },
  ios: { supportsTablet: false, bundleIdentifier: 'vn.clientstudio.care' },
  android: { ...config.android, package: 'vn.clientstudio.care', adaptiveIcon: { ...config.android?.adaptiveIcon, backgroundColor: '#1B1E1C' } },
  plugins: [
    'expo-router', 'expo-secure-store', 'expo-localization', 'expo-font', '@react-native-community/datetimepicker',
    ['expo-image-picker', { photosPermission: 'Cho phép Clienté chọn ảnh khách hàng và ảnh giao xe.', cameraPermission: false, microphonePermission: false }],
    ['expo-notifications', { defaultChannel: 'care' }],
  ],
  extra: { ...config.extra, ...(process.env.EXPO_PUBLIC_EAS_PROJECT_ID ? { eas: { projectId: process.env.EXPO_PUBLIC_EAS_PROJECT_ID } } : {}) },
});

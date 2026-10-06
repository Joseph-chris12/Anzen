import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.smartdoor.admin',
  appName: 'D-MAX',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;

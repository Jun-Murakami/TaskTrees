import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tasktrees.app',
  appName: 'TaskTrees',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.justtalk.app',
  appName: 'JustTalk',
  webDir: '.next',
  server: {
    url: 'https://justtalk-e3yk.onrender.com',
    cleartext: false,
  },
};

export default config;
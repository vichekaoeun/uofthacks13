import { Platform } from 'react-native';

// For iOS Simulator: localhost works
// For Android Emulator: use 10.0.2.2
// For Physical Device: use your computer's IP address (find with ipconfig/ifconfig)

const getBaseURL = () => {
  if (__DEV__) {
    // ⚠️ IMPORTANT: Update API_HOST in backend/.env instead of this file.
    // This value is used as fallback; at runtime, AuthContext fetches from /config endpoint.
    return 'http://10.119.107.90:3005/api';
    
    // Alternative platform-specific URLs (uncomment if needed):
    // if (Platform.OS === 'android') {
    //   return 'http://10.0.2.2:3005/api';
    // }
    // return 'http://localhost:3005/api';
  }
  // Production URL - replace with your deployed backend URL
  return 'https://your-production-api.com/api';
};

export const API_URL = getBaseURL();

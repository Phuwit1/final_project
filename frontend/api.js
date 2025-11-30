import Constants from 'expo-constants';

const getBackendUrl = () => {
  const debuggerHost = Constants.expoConfig?.hostUri;
  const localhost = debuggerHost?.split(":")[0];

  if (!localhost) {
     return 'http://localhost:3000'; 
  }

  console.log(`Using backend URL: http://${localhost}:8000`);
  return `http://${localhost}:8000`;
}

export const API_URL = getBackendUrl();

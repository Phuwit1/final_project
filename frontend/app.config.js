import 'dotenv/config';

export default {
  expo: {
    name: "japanplanner",
    slug: "japanplanner",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "myapp",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    jsEngine: "hermes",

    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.yourname.appname",
      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "แอปพลิเคชันต้องการเข้าถึงตำแหน่งของคุณเพื่อระบุพิกัดในการใช้งาน (ใส่เหตุผลที่ฟังขึ้นเพื่อให้ Apple อนุมัติ)",
      },
      config: {
        googleMapsApiKey: process.env.IOS_GOOGLE_MAPS_API_KEY,
      },
    },

    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/icon.png",
        backgroundColor: "#ffffff",
      },
      package: "com.anonymous.japanplanner",
      permissions: ["ACCESS_COARSE_LOCATION", "ACCESS_FINE_LOCATION"],
      config: {
        googleMaps: {
          apiKey: process.env.ANDROID_GOOGLE_MAPS_API_KEY,
        },
      },
    },

    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png",
    },

    plugins: [
      "expo-router",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
        },
      ],
      "expo-font",
      [
        "expo-build-properties",
        {
          android: {
            kotlinVersion: "1.9.25",
          },
        },
      ],
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission:
            "Allow TabiGo to use your location.",
          isIosBackgroundLocationEnabled: true,
          isAndroidBackgroundLocationEnabled: true,
          isAndroidForegroundServiceEnabled: true,
        },
      ],
    ],

    experiments: {
      typedRoutes: true,
    },

    extra: {
      router: {
        origin: false,
      },
      eas: {
        projectId: "669844dd-6898-44d5-9b44-9c7b5ae9d703",
      },
    },

    owner: "65070184",
  },
};

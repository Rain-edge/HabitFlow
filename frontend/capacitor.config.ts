import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.habitflow.app",
  appName: "HabitFlow",
  webDir: "dist",
  android: {
    allowMixedContent: false,
  },
  server: {
    androidScheme: "https",
  },
  plugins: {
    // Edge-to-edge safe-area handling (bundled SystemBars plugin, Capacitor 8.3.2+).
    // Injects --safe-area-inset-top/bottom/left/right CSS variables with the real
    // status-bar / cutout insets, so the frontend can reserve space reliably on
    // Android 15/16 (env() is unreliable on WebView < 140).
    SystemBars: {
      insetsHandling: "css",
      style: "DEFAULT",
      hidden: false,
    },
  },
};

export default config;

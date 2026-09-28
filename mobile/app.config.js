// Build-time checks on top of app.json (Expo passes app.json in as `config`).
//
// A release build without EXPO_PUBLIC_API_URL would fall back to the development
// origin (http://<metro host>:8000) and reach nothing, so the build fails instead.
const RELEASE_PROFILES = ['preview', 'production'];

module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE;
  if (RELEASE_PROFILES.includes(profile)) {
    const apiUrl = process.env.EXPO_PUBLIC_API_URL;
    if (!apiUrl) {
      throw new Error(`EXPO_PUBLIC_API_URL must be set for the "${profile}" build (see mobile/.env.example).`);
    }
    if (profile === 'production' && !apiUrl.startsWith('https://')) {
      throw new Error(`EXPO_PUBLIC_API_URL must use https:// for production builds (got ${apiUrl}).`);
    }
  }
  return config;
};

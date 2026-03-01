import { MODEL_OPTIONS } from "../constants/modelOptions";

const USER_SETTINGS_KEY = "aidlc_user_settings";
const APP_SETTINGS_KEY = "aidlc_app_settings";

export const DEFAULT_USER_SETTINGS = {
  displayName: "",
  notifyByEmail: true,
  notifyInApp: true,
  timezone: "UTC",
};

export const DEFAULT_APP_SETTINGS = {
  defaultModel: MODEL_OPTIONS[0]?.value || "openai/gpt-4o-mini",
  projectsPageSize: 10,
  autoRefreshDashboard: true,
  showProjectHints: true,
};

const parseStoredJSON = (value, fallback) => {
  if (!value) return fallback;

  try {
    return { ...fallback, ...JSON.parse(value) };
  } catch {
    return fallback;
  }
};

export const getUserSettings = () => {
  const raw = localStorage.getItem(USER_SETTINGS_KEY);
  return parseStoredJSON(raw, DEFAULT_USER_SETTINGS);
};

export const getAppSettings = () => {
  const raw = localStorage.getItem(APP_SETTINGS_KEY);
  return parseStoredJSON(raw, DEFAULT_APP_SETTINGS);
};

export const saveUserSettings = (payload) => {
  localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(payload));
};

export const saveAppSettings = (payload) => {
  localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(payload));
};

export const clearAllSettings = () => {
  localStorage.removeItem(USER_SETTINGS_KEY);
  localStorage.removeItem(APP_SETTINGS_KEY);
};

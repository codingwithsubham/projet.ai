import { useCallback, useMemo, useState } from "react";
import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_USER_SETTINGS,
  getAppSettings,
  getUserSettings,
  saveAppSettings,
  saveUserSettings,
  clearAllSettings,
} from "../services/settings.storage";

export const useSettings = () => {
  const [userSettings, setUserSettings] = useState(() => getUserSettings());
  const [appSettings, setAppSettings] = useState(() => getAppSettings());
  const [savedUserSettings, setSavedUserSettings] = useState(() => getUserSettings());
  const [savedAppSettings, setSavedAppSettings] = useState(() => getAppSettings());
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const hasUnsavedChanges = useMemo(() => {
    const userDirty = JSON.stringify(userSettings) !== JSON.stringify(savedUserSettings);
    const appDirty = JSON.stringify(appSettings) !== JSON.stringify(savedAppSettings);
    return userDirty || appDirty;
  }, [appSettings, savedAppSettings, savedUserSettings, userSettings]);

  const handleUserSettingChange = useCallback((e) => {
    const { name, value, checked, type } = e.target;
    setUserSettings((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  }, []);

  const handleAppSettingChange = useCallback((e) => {
    const { name, value, checked, type } = e.target;
    setAppSettings((prev) => ({
      ...prev,
      [name]:
        type === "checkbox"
          ? checked
          : name === "projectsPageSize"
            ? Number(value)
            : value,
    }));
  }, []);

  const saveSettings = useCallback(async () => {
    setIsSaving(true);

    try {
      saveUserSettings(userSettings);
      saveAppSettings(appSettings);
      setSavedUserSettings(userSettings);
      setSavedAppSettings(appSettings);
      setLastSavedAt(new Date().toISOString());
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error?.message || "Failed to save settings" };
    } finally {
      setIsSaving(false);
    }
  }, [appSettings, userSettings]);

  const resetToDefaults = useCallback(() => {
    setUserSettings(DEFAULT_USER_SETTINGS);
    setAppSettings(DEFAULT_APP_SETTINGS);
  }, []);

  const clearSavedSettings = useCallback(() => {
    clearAllSettings();
    setUserSettings(DEFAULT_USER_SETTINGS);
    setAppSettings(DEFAULT_APP_SETTINGS);
    setSavedUserSettings(DEFAULT_USER_SETTINGS);
    setSavedAppSettings(DEFAULT_APP_SETTINGS);
    setLastSavedAt(null);
  }, []);

  return {
    userSettings,
    appSettings,
    isSaving,
    hasUnsavedChanges,
    lastSavedAt,
    handleUserSettingChange,
    handleAppSettingChange,
    saveSettings,
    resetToDefaults,
    clearSavedSettings,
  };
};

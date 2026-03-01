import React, { useState } from "react";
import { MODEL_OPTIONS } from "../../constants/modelOptions";
import { useSettings } from "../../hooks/useSettings";

const TIMEZONE_OPTIONS = ["UTC", "Asia/Kolkata", "America/New_York", "Europe/London"];

const Settings = () => {
  const {
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
  } = useSettings();

  const [saveMessage, setSaveMessage] = useState("");

  const onSave = async () => {
    const result = await saveSettings();
    setSaveMessage(result.ok ? "Settings saved successfully" : result.error || "Failed to save settings");
  };

  return (
    <section className="settings-page">
      <div className="settings-header">
        <div>
          <h1 className="settings-title">Settings</h1>
          <p className="settings-subtitle">Manage your profile and app preferences</p>
        </div>

        <div className="settings-actions">
          <button type="button" className="settings-btn settings-btn--secondary" onClick={resetToDefaults}>
            Reset To Defaults
          </button>
          <button type="button" className="settings-btn" onClick={onSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>

      <div className="settings-status-row">
        <span className={`settings-badge ${hasUnsavedChanges ? "" : "settings-badge--ok"}`}>
          {hasUnsavedChanges ? "Unsaved changes" : "All changes saved"}
        </span>
        <span className="settings-last-saved">
          {lastSavedAt ? `Last saved: ${new Date(lastSavedAt).toLocaleString()}` : "No save history yet"}
        </span>
      </div>

      {saveMessage ? <p className="settings-message">{saveMessage}</p> : null}

      <div className="settings-grid">
        <article className="settings-card">
          <h2 className="settings-card__title">User Settings</h2>

          <label htmlFor="displayName">Display Name</label>
          <input
            id="displayName"
            name="displayName"
            value={userSettings.displayName}
            onChange={handleUserSettingChange}
            placeholder="Enter display name"
          />

          <label htmlFor="timezone">Timezone</label>
          <select
            id="timezone"
            name="timezone"
            value={userSettings.timezone}
            onChange={handleUserSettingChange}
          >
            {TIMEZONE_OPTIONS.map((timezone) => (
              <option key={timezone} value={timezone}>
                {timezone}
              </option>
            ))}
          </select>

          <label className="settings-check-row">
            <input
              name="notifyByEmail"
              type="checkbox"
              checked={userSettings.notifyByEmail}
              onChange={handleUserSettingChange}
            />
            <span>Email Notifications</span>
          </label>

          <label className="settings-check-row">
            <input
              name="notifyInApp"
              type="checkbox"
              checked={userSettings.notifyInApp}
              onChange={handleUserSettingChange}
            />
            <span>In-App Notifications</span>
          </label>
        </article>

        <article className="settings-card">
          <h2 className="settings-card__title">App Settings</h2>

          <label htmlFor="defaultModel">Default Model</label>
          <select
            id="defaultModel"
            name="defaultModel"
            value={appSettings.defaultModel}
            onChange={handleAppSettingChange}
          >
            {MODEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <label htmlFor="projectsPageSize">Projects Page Size</label>
          <select
            id="projectsPageSize"
            name="projectsPageSize"
            value={appSettings.projectsPageSize}
            onChange={handleAppSettingChange}
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>

          <label className="settings-check-row">
            <input
              name="autoRefreshDashboard"
              type="checkbox"
              checked={appSettings.autoRefreshDashboard}
              onChange={handleAppSettingChange}
            />
            <span>Auto Refresh Dashboard</span>
          </label>

          <label className="settings-check-row">
            <input
              name="showProjectHints"
              type="checkbox"
              checked={appSettings.showProjectHints}
              onChange={handleAppSettingChange}
            />
            <span>Show Project Hints</span>
          </label>

          <div className="settings-clear-row">
            <button
              type="button"
              className="settings-btn settings-btn--danger"
              onClick={clearSavedSettings}
            >
              Clear Saved Settings
            </button>
          </div>
        </article>
      </div>
    </section>
  );
};

export default Settings;
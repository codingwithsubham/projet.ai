import React from "react";
import { useKnowledgebase } from "../../hooks/useKnowledgebase";
import { REPO_TAG_OPTIONS } from "../../constants/repoTags";

const KnowledgebasePanel = ({ projectId }) => {
  const {
    docs,
    loading,
    uploading,
    analyzingDocId,
    error,
    docLink,
    setDocLink,
    uploadFiles,
    analyzeDoc,
    onSubmitDocLink,
    uiMessage,
    clearUiMessage,
    analyzePromptDoc,
    analyzePromptNow,
    analyzePromptLater,
    repoLinkInput,
    setRepoLinkInput,
    savedRepoLink,
    repoLoading,
    saveRepoLink,
    analyzeRepo,
    isRepoEditing,
    startEditRepo,
    cancelEditRepo,
    patTokenInput,
    setPatTokenInput,
    savedPatToken,
    patLoading,
    isPatEditing,
    startEditPat,
    savePatToken,
    syncStatus,
    // Multi-repository
    repositories,
    repoFormData,
    handleRepoFormChange,
    editingRepoId,
    repoActionLoading,
    analyzingRepoId,
    repoSyncStatuses,
    startEditRepository,
    cancelEditRepository,
    saveOrUpdateRepository,
    deleteRepositoryItem,
    resetRepoForm,
  } = useKnowledgebase(projectId);

  const onDrop = (e) => {
    e.preventDefault();
    uploadFiles(e.dataTransfer.files);
  };

  // Helper to get sync status for a specific repository
  const getRepoSyncStatus = (repoId) => repoSyncStatuses[repoId] || null;

  return (
    <div className="kb-layout">
      <aside className="kb-left">
        <div className="kb-left__header">
          <h3>Documents</h3>
          <span>{docs.length}</span>
        </div>

        {loading ? <p className="kb-muted">Loading...</p> : null}
        {error ? <p className="projects-error">{error}</p> : null}

        <div className="kb-doc-list">
          {docs.map((doc) => (
            <article key={doc._id} className="kb-doc-item">
              <a href={doc.fileurl} target="_blank" rel="noreferrer" className="kb-doc-link">
                {doc.fileName}
              </a>

              <div className="kb-doc-actions">
                {doc.isAnalysized ? (
                  <span className="kb-badge">Analyzed</span>
                ) : (
                  <button
                    type="button"
                    className="projects-btn projects-btn--tiny"
                    disabled={analyzingDocId === doc._id}
                    onClick={() => analyzeDoc(doc._id)}
                  >
                    {analyzingDocId === doc._id ? "Analyzing..." : "Analyze"}
                  </button>
                )}
              </div>
            </article>
          ))}
          {!loading && docs.length === 0 ? (
            <p className="kb-muted">No documents uploaded yet.</p>
          ) : null}
        </div>
      </aside>

      <section className="kb-right">
        {uiMessage ? (
          <div className={`kb-message kb-message--${uiMessage.type}`}>
            <span>{uiMessage.text}</span>
            <button type="button" className="kb-message__close" onClick={clearUiMessage}>
              ✕
            </button>
          </div>
        ) : null}

        {/* PAT Token Section - Moved up since it's common for all repos */}
        <div className="kb-repo-box">
          <label htmlFor="patToken">GitHub PAT Token (Common for all repositories)</label>
          <div className="kb-link-row">
            <input
              id="patToken"
              type="password"
              value={patTokenInput}
              onChange={(e) => setPatTokenInput(e.target.value)}
              placeholder="ghp_xxx..."
              disabled={Boolean(savedPatToken) && !isPatEditing}
            />

            {!savedPatToken || isPatEditing ? (
              <button type="button" className="projects-btn" onClick={savePatToken} disabled={patLoading}>
                {patLoading ? "Saving..." : savedPatToken ? "Update PAT" : "Save PAT"}
              </button>
            ) : (
              <button type="button" className="projects-btn projects-btn--secondary" onClick={startEditPat}>
                Edit PAT
              </button>
            )}
          </div>
        </div>

        {/* Multi-Repository Section */}
        <div className="kb-repo-box kb-multi-repo">
          <div className="kb-multi-repo__header">
            <h4>Project Repositories</h4>
            <span className="kb-muted">({repositories.length} repositories)</span>
          </div>

          {/* Repository Form */}
          <div className="kb-multi-repo__form">
            <div className="kb-multi-repo__form-row">
              <input
                type="text"
                name="identifier"
                value={repoFormData.identifier}
                onChange={handleRepoFormChange}
                placeholder="Identifier (e.g., main-api)"
                className="kb-multi-repo__input"
              />
              <select
                name="tag"
                value={repoFormData.tag}
                onChange={handleRepoFormChange}
                className="kb-multi-repo__select"
              >
                {REPO_TAG_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="kb-multi-repo__form-row">
              <input
                type="text"
                name="repolink"
                value={repoFormData.repolink}
                onChange={handleRepoFormChange}
                placeholder="https://github.com/org/repo"
                className="kb-multi-repo__input kb-multi-repo__input--wide"
              />
              <button
                type="button"
                className="projects-btn"
                onClick={saveOrUpdateRepository}
                disabled={repoActionLoading}
              >
                {repoActionLoading ? "Saving..." : editingRepoId ? "Update" : "Add Repository"}
              </button>
              {editingRepoId && (
                <button
                  type="button"
                  className="projects-btn projects-btn--secondary"
                  onClick={cancelEditRepository}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {/* Repository List */}
          <div className="kb-multi-repo__list">
            {repositories.length === 0 ? (
              <p className="kb-muted">No repositories added yet. Add your first repository above.</p>
            ) : (
              repositories.map((repo) => {
                const repoSyncStat = getRepoSyncStatus(repo._id);
                const isAnalyzing = analyzingRepoId === repo._id;
                const isSyncing = repoSyncStat && (repoSyncStat.status === "pending" || repoSyncStat.status === "in_progress");

                return (
                  <div key={repo._id} className="kb-multi-repo__item">
                    <div className="kb-multi-repo__item-info">
                      <div className="kb-multi-repo__item-header">
                        <span className="kb-multi-repo__identifier">{repo.identifier}</span>
                        <span className={`kb-multi-repo__tag kb-multi-repo__tag--${repo.tag}`}>
                          {repo.tag}
                        </span>
                      </div>
                      <a
                        href={repo.repolink}
                        target="_blank"
                        rel="noreferrer"
                        className="kb-multi-repo__link"
                      >
                        {repo.repolink}
                      </a>

                      {/* Sync Progress */}
                      {isSyncing && (
                        <div className="kb-sync-progress kb-sync-progress--inline">
                          <div className="kb-sync-progress__bar">
                            <div
                              className="kb-sync-progress__fill"
                              style={{ width: `${repoSyncStat.progress?.percentage || 0}%` }}
                            />
                          </div>
                          <span className="kb-sync-progress__step">
                            {repoSyncStat.progress?.currentStep || "Syncing..."} ({repoSyncStat.progress?.percentage || 0}%)
                          </span>
                        </div>
                      )}

                      {/* Last Sync Status */}
                      {repoSyncStat && repoSyncStat.status === "completed" && repoSyncStat.stats && (
                        <div className="kb-sync-status kb-sync-status--success kb-sync-status--inline">
                          Synced: {repoSyncStat.stats.totalChunks || 0} chunks from {repoSyncStat.stats.totalFiles || 0} files
                        </div>
                      )}
                    </div>

                    <div className="kb-multi-repo__item-actions">
                      <button
                        type="button"
                        className="projects-btn projects-btn--tiny"
                        onClick={() => analyzeRepo(repo._id)}
                        disabled={isAnalyzing || isSyncing}
                      >
                        {isAnalyzing || isSyncing ? "Syncing..." : "Analyze"}
                      </button>
                      <button
                        type="button"
                        className="projects-btn projects-btn--tiny projects-btn--secondary"
                        onClick={() => startEditRepository(repo)}
                        disabled={repoActionLoading}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="projects-btn projects-btn--tiny projects-btn--danger"
                        onClick={() => deleteRepositoryItem(repo._id)}
                        disabled={repoActionLoading}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Legacy Single Repository (for backward compatibility) */}
        {savedRepoLink && repositories.length === 0 && (
          <div className="kb-repo-box kb-legacy-repo">
            <label htmlFor="repoLink">Legacy Repository Link</label>
            <p className="kb-muted kb-legacy-note">
              This is a legacy single repository. Consider migrating to the multi-repository system above.
            </p>
            <div className="kb-link-row">
              <input
                id="repoLink"
                type="text"
                value={repoLinkInput}
                onChange={(e) => setRepoLinkInput(e.target.value)}
                placeholder="https://github.com/org/repo"
                disabled={Boolean(savedRepoLink) && !isRepoEditing}
              />
              {!savedRepoLink || isRepoEditing ? (
                <>
                  <button
                    type="button"
                    className="projects-btn"
                    onClick={saveRepoLink}
                    disabled={repoLoading}
                  >
                    {repoLoading ? "Saving..." : savedRepoLink ? "Update Repo" : "Save Repo"}
                  </button>
                  {isRepoEditing && (
                    <button
                      type="button"
                      className="projects-btn projects-btn--secondary"
                      onClick={cancelEditRepo}
                    >
                      Cancel
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="projects-btn projects-btn--secondary"
                    onClick={() => analyzeRepo()}
                    disabled={repoLoading}
                  >
                    {repoLoading ? "Syncing..." : "Analyze Repo"}
                  </button>
                  <button
                    type="button"
                    className="projects-btn projects-btn--outline"
                    onClick={startEditRepo}
                    disabled={repoLoading}
                  >
                    Edit
                  </button>
                </>
              )}
            </div>

            {/* Sync Progress Indicator */}
            {syncStatus && (syncStatus.status === "pending" || syncStatus.status === "in_progress") && (
              <div className="kb-sync-progress">
                <div className="kb-sync-progress__bar">
                  <div
                    className="kb-sync-progress__fill"
                    style={{ width: `${syncStatus.progress?.percentage || 0}%` }}
                  />
                </div>
                <div className="kb-sync-progress__info">
                  <span className="kb-sync-progress__step">
                    {syncStatus.progress?.currentStep || "Starting..."}
                  </span>
                  <span className="kb-sync-progress__percent">
                    {syncStatus.progress?.percentage || 0}%
                  </span>
                </div>
              </div>
            )}

            {/* Last Sync Status */}
            {syncStatus && syncStatus.status === "completed" && syncStatus.stats && (
              <div className="kb-sync-status kb-sync-status--success">
                Last sync: {syncStatus.stats.totalChunks || 0} chunks from {syncStatus.stats.totalFiles || 0} files
              </div>
            )}

            {syncStatus && syncStatus.status === "failed" && (
              <div className="kb-sync-status kb-sync-status--error">
                Last sync failed: {syncStatus.error?.message || "Unknown error"}
              </div>
            )}
          </div>
        )}

        <div
          className="kb-dropzone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
        >
          <p>Drag and drop files here</p>
          <p className="kb-muted">or</p>
          <label className="projects-btn kb-upload-btn">
            {uploading ? "Uploading..." : "Choose Files"}
            <input type="file" multiple hidden onChange={(e) => uploadFiles(e.target.files)} />
          </label>
        </div>

        {analyzePromptDoc ? (
          <div className="kb-analyze-prompt-backdrop">
            <div className="kb-analyze-prompt">
              <p>
                <strong>{analyzePromptDoc.fileName}</strong> uploaded. Analyze now?
              </p>
              <div className="kb-analyze-prompt__actions">
                <button type="button" className="projects-btn" onClick={analyzePromptNow}>
                  Analyze Now
                </button>
                <button type="button" className="projects-btn projects-btn--secondary" onClick={analyzePromptLater}>
                  Later
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <div className="kb-link-box">
          <label htmlFor="docLink">Document link</label>
          <div className="kb-link-row">
            <input
              id="docLink"
              type="url"
              value={docLink}
              onChange={(e) => setDocLink(e.target.value)}
              placeholder="https://example.com/doc"
            />
            <button type="button" className="projects-btn projects-btn--secondary" onClick={onSubmitDocLink}>
              Fetch
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default KnowledgebasePanel;
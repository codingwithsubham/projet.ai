import React, { useMemo, useState, useEffect } from "react";

const ESTIMATED_DURATION_MS = 60 * 1000;

const clampProgress = (value) => Math.max(1, Math.min(100, value));

const getIsInProgressMessage = (content) =>
  String(content || "").toLowerCase().includes("implementation is in progress");

const ImplementationProgressCard = ({
  content,
  onRefresh,
  refreshing = false,
  refreshButtonClassName = "projects-btn projects-btn--secondary projects-btn--tiny",
}) => {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      setElapsedMs((prev) => {
        if (prev >= ESTIMATED_DURATION_MS) {
          window.clearInterval(timer);
          return ESTIMATED_DURATION_MS;
        }

        const next = Date.now() - startedAt;
        return Math.min(next, ESTIMATED_DURATION_MS);
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const progress = useMemo(() => {
    const ratio = elapsedMs / ESTIMATED_DURATION_MS;
    return clampProgress(Math.round(ratio * 100));
  }, [elapsedMs]);

  const canRefresh = progress >= 100;

  return (
    <div className="impl-progress" role="status" aria-live="polite">
      <p className="impl-progress__text">{content}</p>
      <div className="impl-progress__bar-wrap" aria-hidden="true">
        <div className="impl-progress__bar" style={{ width: `${progress}%` }} />
      </div>
      <div className="impl-progress__meta">
        <span className="impl-progress__percent">{progress}%</span>
        {canRefresh ? (
          <button
            type="button"
            className={refreshButtonClassName}
            onClick={onRefresh}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh Chat"}
          </button>
        ) : null}
      </div>
    </div>
  );
};

export { getIsInProgressMessage };
export default ImplementationProgressCard;

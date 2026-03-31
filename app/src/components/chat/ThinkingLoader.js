import React, { useState, useEffect } from "react";

const THINKING_PHASES = [
  { icon: "🔍", text: "Analyzing your request..." },
  { icon: "🧠", text: "Thinking deeply..." },
  { icon: "📚", text: "Searching knowledge base..." },
  { icon: "🔗", text: "Connecting to data sources..." },
  { icon: "🗂️", text: "Retrieving relevant context..." },
  { icon: "🤖", text: "Invoking your Agent..." },
  { icon: "🧩", text: "Assembling tool pipeline..." },
  { icon: "⚡", text: "Performing actions..." },
  { icon: "🔄", text: "Processing intermediate results..." },
  { icon: "📊", text: "Evaluating data patterns..." },
  { icon: "✍️", text: "Drafting initial response..." },
  { icon: "🔬", text: "Validating accuracy..." },
  { icon: "🛠️", text: "Applying refinements..." },
  { icon: "📝", text: "Structuring final output..." },
  { icon: "✅", text: "Running quality checks..." },
  { icon: "🚀", text: "Generating response..." },
];

const ThinkingLoader = () => {
  const [phaseIndex, setPhaseIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPhaseIndex((prev) => (prev + 1) % THINKING_PHASES.length);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  const phase = THINKING_PHASES[phaseIndex];

  return (
    <div className="thinking-loader">
      <div className="thinking-loader__icon-ring">
        <span className="thinking-loader__icon">{phase.icon}</span>
        <svg className="thinking-loader__spinner" viewBox="0 0 36 36">
          <circle
            className="thinking-loader__track"
            cx="18" cy="18" r="16"
            fill="none" strokeWidth="2"
          />
          <circle
            className="thinking-loader__arc"
            cx="18" cy="18" r="16"
            fill="none" strokeWidth="2.5"
            strokeDasharray="80 100"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <div className="thinking-loader__body">
        <span className="thinking-loader__text" key={phaseIndex}>
          {phase.text}
        </span>
        <div className="thinking-loader__shimmer">
          <div className="thinking-loader__shimmer-line" />
          <div className="thinking-loader__shimmer-line thinking-loader__shimmer-line--short" />
        </div>
      </div>
    </div>
  );
};

export default ThinkingLoader;

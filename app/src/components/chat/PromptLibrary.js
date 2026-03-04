import React from "react";
import { PROMPTS } from "./prompts";

const PromptLibrary = ({ onSelect }) => {
  return (
    <div className="prompt-library">
      {PROMPTS.map(({ id, prompt }) => (
        <div key={id} title={prompt} className="prompt-item" onClick={() => onSelect(prompt)}>
          <p>{prompt.split(" ").slice(0, 10).join(" ")}...</p>
        </div>
      ))}
    </div>
  );
};

export default PromptLibrary;

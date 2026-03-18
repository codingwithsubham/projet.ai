import React from "react";

const DocumentForm = ({ formData, setFormData, formErrors, isLoading, onSubmit, projects = [] }) => {
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const errors = {};
    if (!formData.name?.trim()) errors.name = "Document name is required";
    if (!formData.prompt?.trim()) errors.prompt = "Topic/Prompt is required";
    if (!formData.projectId) errors.projectId = "Project is required";

    if (Object.keys(errors).length > 0) {
      // surface errors via setFormData pattern — pass back up
      console.error("Form errors:", errors);
      return;
    }

    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="presentation-form">
      {/* Document Name */}
      <div className="form-group">
        <label htmlFor="name">
          Document Name <span className="required">*</span>
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Enter document name"
          disabled={isLoading}
          className={formErrors.name ? "error" : ""}
        />
        {formErrors.name && <span className="error-text">{formErrors.name}</span>}
      </div>

      {/* Topic/Prompt */}
      <div className="form-group">
        <label htmlFor="prompt">
          Topic / Prompt <span className="required">*</span>
        </label>
        <textarea
          id="prompt"
          name="prompt"
          value={formData.prompt}
          onChange={handleChange}
          placeholder="Describe what document you want to generate..."
          rows="4"
          disabled={isLoading}
          className={formErrors.prompt ? "error" : ""}
        />
        <small>The AI will use this topic along with your project knowledge base to generate a structured document</small>
        {formErrors.prompt && <span className="error-text">{formErrors.prompt}</span>}
      </div>

      {/* Project Selection (Mandatory) */}
      <div className="form-group">
        <label htmlFor="projectId">
          Project <span className="required">*</span>
        </label>
        <select
          id="projectId"
          name="projectId"
          value={formData.projectId}
          onChange={handleChange}
          disabled={isLoading}
          className={formErrors.projectId ? "error" : ""}
        >
          <option value="">-- Select Project --</option>
          {projects.map((project) => (
            <option key={project._id} value={project._id}>
              {project.name}
            </option>
          ))}
        </select>
        <small>Select a project to use its knowledge base as context</small>
        {formErrors.projectId && <span className="error-text">{formErrors.projectId}</span>}
      </div>

      {/* Description (Optional) */}
      <div className="form-group">
        <label htmlFor="description">Description (Optional)</label>
        <textarea
          id="description"
          name="description"
          value={formData.description || ""}
          onChange={handleChange}
          placeholder="Add any additional notes..."
          rows="2"
          disabled={isLoading}
        />
      </div>

      {/* Submit */}
      <div className="form-actions">
        <button type="submit" disabled={isLoading} className="btn btn-primary">
          {isLoading ? "Generating..." : "Generate Document"}
        </button>
      </div>
    </form>
  );
};

export default DocumentForm;

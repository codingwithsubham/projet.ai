import React from "react";

const PresentationForm = ({
  formData,
  setFormData,
  formErrors,
  isLoading,
  onSubmit,
  projects = [],
}) => {
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validation
    const errors = {};

    if (!formData.name?.trim()) {
      errors.name = "Presentation name is required";
    }

    if (!formData.prompt?.trim()) {
      errors.prompt = "Topic/Prompt is required";
    }

    if (!formData.numberOfPages || formData.numberOfPages < 1 || formData.numberOfPages > 5) {
      errors.numberOfPages = "Number of pages must be between 1 and 5";
    }

    if (!formData.projectId) {
      errors.projectId = "Project is required";
    }

    if (Object.keys(errors).length > 0) {
      console.error("Form errors:", errors);
      return;
    }

    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="presentation-form">
      {/* Presentation Name */}
      <div className="form-group">
        <label htmlFor="name">
          Presentation Name <span className="required">*</span>
        </label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Enter presentation name"
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
          placeholder="Enter your presentation topic or prompt..."
          rows="4"
          disabled={isLoading}
          className={formErrors.prompt ? "error" : ""}
        />
        <small>
          The AI will use this topic along with your project knowledge base to generate content
        </small>
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

      {/* Number of Pages - Select Box 1-5 */}
      <div className="form-group">
        <label htmlFor="numberOfPages">
          Number of Content Pages <span className="required">*</span>
        </label>
        <select
          id="numberOfPages"
          name="numberOfPages"
          value={formData.numberOfPages}
          onChange={handleChange}
          disabled={isLoading}
          className={formErrors.numberOfPages ? "error" : ""}
        >
          <option value={1}>1 Page</option>
          <option value={2}>2 Pages</option>
          <option value={3}>3 Pages</option>
          <option value={4}>4 Pages</option>
          <option value={5}>5 Pages</option>
        </select>
        <small>Cover and Conclusion slides are added automatically</small>
        {formErrors.numberOfPages && (
          <span className="error-text">{formErrors.numberOfPages}</span>
        )}
      </div>

      {/* Description (Optional) */}
      <div className="form-group">
        <label htmlFor="description">Description (Optional)</label>
        <textarea
          id="description"
          name="description"
          value={formData.description || ""}
          onChange={handleChange}
          placeholder="Add any additional notes or description..."
          rows="2"
          disabled={isLoading}
        />
      </div>

      {/* Submit Button */}
      <div className="form-actions">
        <button type="submit" disabled={isLoading} className="btn btn-primary">
          {isLoading ? "Generating..." : "Generate Presentation"}
        </button>
      </div>
    </form>
  );
};

export default PresentationForm;

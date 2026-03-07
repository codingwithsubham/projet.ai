import React from "react";
import { USER_ROLES } from "../../constants/userRoles";
import { useUsers } from "../../hooks/useUsers";

const Users = () => {
  const {
    users,
    projects,
    projectNameById,
    usersLoading,
    usersError,
    actionLoading,
    modal,
    formData,
    formErrors,
    refreshUsers,
    openAddModal,
    openEditModal,
    closeModal,
    handleFormChange,
    toggleProject,
    submitUser,
    removeUser,
  } = useUsers();

  return (
    <section className="users-page">
      <div className="users-header">
        <div>
          <h1 className="users-title">Users</h1>
          <p className="users-subtitle">Manage users, roles, and project assignments</p>
        </div>

        <div className="users-actions">
          <button type="button" className="projects-btn projects-btn--secondary" onClick={refreshUsers}>
            Refresh
          </button>
          <button type="button" className="projects-btn" onClick={openAddModal}>
            Add User
          </button>
        </div>
      </div>

      {usersError ? <p className="projects-error">{usersError}</p> : null}

      <div className="projects-table-wrap">
        <table className="projects-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Username</th>
              <th>Email</th>
              <th>Role</th>
              <th>Projects</th>
              <th style={{ width: 160 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {usersLoading ? (
              <tr>
                <td colSpan={6} className="projects-empty">Loading users...</td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={6} className="projects-empty">No users found.</td>
              </tr>
            ) : (
              users.map((user) => {
                const projectIds = Array.isArray(user.projects) ? user.projects.map((id) => String(id)) : [];
                const assignedNames = projectIds
                  .map((id) => projectNameById[id])
                  .filter(Boolean)
                  .slice(0, 2);

                return (
                  <tr key={user.id}>
                    <td>{user.name}</td>
                    <td>{user.username}</td>
                    <td>{user.email}</td>
                    <td>{user.role}</td>
                    <td>
                      <span className="users-projects-chip">
                        {projectIds.length === 0
                          ? "Unassigned"
                          : assignedNames.length
                            ? `${assignedNames.join(", ")}${projectIds.length > 2 ? "..." : ""}`
                            : `${projectIds.length} assigned`}
                      </span>
                    </td>
                    <td>
                      <div className="projects-row-actions">
                        <button
                          type="button"
                          className="projects-btn projects-btn--tiny"
                          onClick={() => openEditModal(user.id)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="projects-btn projects-btn--tiny projects-btn--danger"
                          onClick={() => removeUser(user.id)}
                          disabled={actionLoading}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {modal.open && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-wrapper users-modal-wrapper">
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>{modal.mode === "edit" ? "Edit User" : "Add User"}</h3>
                <button type="button" className="modal-close" onClick={closeModal}>
                  X
                </button>
              </div>

              <form className="project-form" onSubmit={submitUser}>
                <label htmlFor="name">Name</label>
                <input id="name" name="name" value={formData.name} onChange={handleFormChange} />
                {formErrors.name && <p className="form-error">{formErrors.name}</p>}

                <label htmlFor="username">Username</label>
                <input id="username" name="username" value={formData.username} onChange={handleFormChange} />
                {formErrors.username && <p className="form-error">{formErrors.username}</p>}

                <label htmlFor="email">Email</label>
                <input id="email" name="email" type="email" value={formData.email} onChange={handleFormChange} />
                {formErrors.email && <p className="form-error">{formErrors.email}</p>}

                <label htmlFor="password">Password {modal.mode === "edit" ? "(optional)" : ""}</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  value={formData.password}
                  onChange={handleFormChange}
                />
                {formErrors.password && <p className="form-error">{formErrors.password}</p>}

                <label htmlFor="role">Role</label>
                <select id="role" name="role" value={formData.role} onChange={handleFormChange}>
                  <option value="">Select role</option>
                  {USER_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
                {formErrors.role && <p className="form-error">{formErrors.role}</p>}

                <div className="users-project-select">
                  <p className="users-project-select__title">Assign Projects</p>
                  {projects.length === 0 ? (
                    <p className="users-project-select__empty">No projects available.</p>
                  ) : (
                    <div className="users-project-select__grid">
                      {projects.map((project) => {
                        const id = String(project._id);
                        return (
                          <label key={id} className="users-project-select__item">
                            <input
                              type="checkbox"
                              checked={formData.projects.includes(id)}
                              onChange={() => toggleProject(id)}
                            />
                            <span>{project.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {formErrors.form && <p className="form-error">{formErrors.form}</p>}

                <div className="modal-footer">
                  <button type="button" className="projects-btn projects-btn--secondary" onClick={closeModal}>
                    Cancel
                  </button>
                  <button type="submit" className="projects-btn" disabled={actionLoading}>
                    {actionLoading ? "Saving..." : modal.mode === "edit" ? "Update User" : "Create User"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default Users;

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../css/Dashboard.css";
import { Save, Edit, Trash2, Eye, Music } from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();
  const [currentUserData, setCurrentUserData] = useState(null);
  const [users, setUsers] = useState([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  // const [showCreateModal, setShowCreateModal] = useState(false);
  const [alert, setAlert] = useState({ message: "", type: "" });
  const [selectedUser, setSelectedUser] = useState(null);
  const [modalContent, setModalContent] = useState(null);

  // Form states
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    role: "",
    collegeName: "",
    _id: "",
  });

  // const [createForm, setCreateForm] = useState({
  //   name: "",
  //   email: "",
  //   password: "",
  //   role: "",
  //   collegeName: "",
  // });

  // Role hierarchy definition
  const roleHierarchy = {
    rgpv: ["college", "director", "hod", "teacher", "student"],
    college: ["director", "hod", "teacher", "student"],
    director: ["hod", "teacher", "student"],
    hod: ["teacher", "student"],
    teacher: ["student"],
    student: [],
  };

  useEffect(() => {
    fetchCurrentUserData();
  }, []);

  useEffect(() => {
    if (currentUserData) {
      if (currentUserData.role !== "student") {
        fetchUsers();
      }
    }
  }, [currentUserData]);
  //   The second useEffect runs every time currentUserData changes.

  // If currentUserData.role !== 'student', it calls fetchUsers().

  // to avoid could create a loop or delay.
  //-------------------------------------

  const fetchCurrentUserData = async () => {
    const token = localStorage.getItem("token");
    const id = localStorage.getItem("Id");
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE}/api/users/users/${id}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      console.log(response, "Response");
      if (response.status !== 200) {
        // !response.ok
        throw new Error("Failed to fetch current user data");
      }

      const userData = response.data;
      setCurrentUserData(userData);
      return userData;
    } catch (error) {
      console.error("Error fetching user data:", error);
      throw error;
    }
  };

  // Fetch users based on current user's role
  const fetchUsers = async () => {
    const token = localStorage.getItem("token");
    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE}/api/users/users`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status !== 200) {
        throw new Error("Failed to fetch users");
      }

      const fetchedUsers = response.data;

      // Filter the users based on the current user's role and college
      const filteredUsers = filterUsersByPermission(fetchedUsers);
      setUsers(filteredUsers); //displaying the users
    } catch (error) {
      console.error("Error fetching users:", error);
      throw error;
    }
  };

  // Filter users based on role hierarchy and college
  const filterUsersByPermission = (usersList) => {
    if (!currentUserData) return [];

    const currentRole = currentUserData.role;
    const currentCollege = currentUserData.collegeName;

    // If RGPV admin, can see all users
    if (currentRole === "rgpv") {
      return usersList;
    }

    // If college, can see all users from the same college
    if (currentRole === "college" && currentCollege) {
      return usersList.filter(
        (user) =>
          user.collegeName === currentCollege ||
          user._id === currentUserData._id
      );
    }
    // Can view users:
    // Belonging to the same college, or
    // Themselves.

    // If director, can see users from the same college with lower roles
    if (currentRole === "director" && currentCollege) {
      return usersList.filter(
        (user) =>
          user.collegeName === currentCollege &&
          (roleHierarchy[currentRole].includes(user.role) ||
            user._id === currentUserData._id)
      );
    }

    // For other roles, can only see users with lower roles in hierarchy from same college
    return usersList.filter(
      (user) =>
        (roleHierarchy[currentRole].includes(user.role) ||
          user._id === currentUserData._id) &&
        user.collegeName === currentCollege
    );
  };

  // Check if current user can manage permissions for another user
  const canManagePermissions = (user) => {
    if (!currentUserData) return false;

    // Don't allow users to manage their own permissions
    if (user._id === currentUserData._id) return false;

    // RGPV admin can manage all permissions
    if (currentUserData.role === "rgpv") {
      return true;
    }

    // College can manage all permissions for users in their college
    if (currentUserData.role === "college") {
      return currentUserData.collegeName === user.collegeName;
    }

    // Director can manage permissions for users in their college with lower roles
    if (currentUserData.role === "director") {
      return (
        currentUserData.collegeName === user.collegeName &&
        roleHierarchy[currentUserData.role].includes(user.role)
      );
    }

    // HOD can manage permissions for t
    //
    // teachers and students
    if (currentUserData.role === "hod") {
      return (
        currentUserData.collegeName === user.collegeName &&
        roleHierarchy[currentUserData.role].includes(user.role)
      );
    }

    // Teachers can manage permissions for students only
    if (currentUserData.role === "teacher") {
      return (
        currentUserData.collegeName === user.collegeName &&
        roleHierarchy[currentUserData.role].includes(user.role)
      );
    }

    return false;
  };

  // Check if current user can edit another user
  const canEditUser = (user) => {
    // First check hierarchy-based permissions
    const hasHierarchyPermission = canManagePermissions(user);

    // RGPV and director roles have full access without needing specific permissions
    if (
      currentUserData &&
      (currentUserData.role === "rgpv" || currentUserData.role === "director")
    ) {
      return hasHierarchyPermission;
    }

    // For other roles, check if they have 'update' permission in their permissions array
    const hasUpdatePermission =
      currentUserData &&
      currentUserData.permissions &&
      currentUserData.permissions.includes("update");

    // Return true only if both conditions are met
    return hasHierarchyPermission && hasUpdatePermission;
  };



  // Check if current user can delete another user
  const canDeleteUser = (user) => {
    // First check hierarchy-based permissions
    const hasHierarchyPermission = canManagePermissions(user);

    // RGPV and director roles have full access without needing specific permissions
    if (
      currentUserData &&
      (currentUserData.role === "rgpv" || currentUserData.role === "director")
    ) {
      return hasHierarchyPermission;
    }

    // For other roles, check if they have 'delete' permission in their permissions array
    const hasDeletePermission =
      currentUserData &&
      currentUserData.permissions &&
      currentUserData.permissions.includes("delete");

    // Return true only if both conditions are met
    return hasHierarchyPermission && hasDeletePermission;
  };

  const canViewUser = (user) => {
    // RGPV and director roles can view all users they can see
    if (
      currentUserData &&
      (currentUserData.role === "rgpv" || currentUserData.role === "director")
    ) {
      return true;
    }

    // For other roles, check if they have 'read' permission in their permissions array
    const hasReadPermission =
      currentUserData &&
      currentUserData.permissions &&
      currentUserData.permissions.includes("read");

    // If it's the current user viewing their own profile, always allow
    if (user._id === currentUserData._id) {
      return true;
    }

    // Otherwise require read permission
    return hasReadPermission;
  };

  // const updatePermissions = async (userId, users, showAlertMessage, fetchUsers) - suggested by google gemini.
  // Update permissions for a user

  const updatePermissions = async (userId) => {
    const token = localStorage.getItem("token");
    const userRow = users.find((user) => user._id === userId);

    if (!userRow) {
      console.error("Could not find user with ID:", userId);
      showAlertMessage("Error: User not found", "danger");
      return;
    }

    // Find checkboxes for this user
    const checkboxElements = document.querySelectorAll(
      `tr[data-user-id="${userId}"] .permission-checkbox`
    );


    const permissions = [];
    checkboxElements.forEach((checkbox) => {
      // if (checkbox.classList.contains("perm-create") && checkbox.checked)
      //   permissions.push("create");
      if (checkbox.classList.contains("perm-read") && checkbox.checked)
        permissions.push("read");
      if (checkbox.classList.contains("perm-update") && checkbox.checked)
        permissions.push("update");
      if (checkbox.classList.contains("perm-delete") && checkbox.checked)
        permissions.push("delete");
      if (checkbox.classList.contains("perm-remix") && checkbox.checked)
        permissions.push("remix");
       if (checkbox.classList.contains("perm-spinner") && checkbox.checked)
        permissions.push("spinner");
    });

    try {
      const response = await axios.put(
        `${
          import.meta.env.VITE_API_BASE
        }/api/users/users/${userId}/permissions`,
        { permissions },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          // body: JSON.stringify({ permissions }) - it converts the object into json - formatted string.
        }
      );

      if (response.status !== 200) {
        const errorData = response.data;
        throw new Error(errorData.message || "Failed to update permissions");
      }

      response.data;
      showAlertMessage("Permissions updated successfully", "success");

      // Refresh the user list to show updated permissions
      await fetchUsers();
    } catch (error) {
      console.error("Error updating permissions:", error);
      showAlertMessage(
        `Failed to update permissions: ${error.message}`,
        "danger"
      );
    }
  };

  // View user details
  const viewUser = async (userId) => {
    const token = localStorage.getItem("token");

    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE}/api/users/users/${userId}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status !== 200) {
        throw new Error("Failed to fetch user details");
      }

      const user = response.data;
      setSelectedUser(user);
      setModalContent(
        <>
          <p>
            <strong>Name:</strong> {user.name}
          </p>
          <p>
            <strong>Email:</strong> {user.email}
          </p>
          <p>
            <strong>Role:</strong> {user.role}
          </p>
          <p>
            <strong>College:</strong> {user.collegeName || "N/A"}
          </p>
          <p>
            <strong>Permissions:</strong>{" "}
            {user.permissions?.join(", ") || "None"}
          </p>
        </>
      );

      setShowUserModal(true);
    } catch (error) {
      console.error("Error fetching user details:", error);
      showAlertMessage("Failed to fetch user details", "danger");
    }
  };

  // Open edit user modal
  const openEditModal = async (userId) => {
    const token = localStorage.getItem("token");

    try {
      const response = await axios.get(
        `${import.meta.env.VITE_API_BASE}/api/users/users/${userId}`,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status !== 200) {
        throw new Error("Failed to fetch user details for editing");
      }

      const user = response.data;

      // Set form data
      setEditForm({
        name: user.name,
        email: user.email,
        role: user.role,
        collegeName: user.collegeName || "",
        _id: user._id,
      });

      setSelectedUser(user);
      setShowEditModal(true);
    } catch (error) {
      console.error("Error opening edit modal:", error);
      showAlertMessage("Failed to open edit form", "danger");
    }
  };

  // Save edited user
  const saveUser = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem("token");
    const { _id, name, email, role, collegeName } = editForm;

    try {
      const response = await axios.put(
        `${import.meta.env.VITE_API_BASE}/api/users/users/${_id}`,
        {
          name: name.trim().toLowerCase(),
          email: email.trim().toLowerCase(),
          role,
          collegeName: collegeName.trim().toLowerCase(),
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status !== 200) {
        const data = response.data;
        showAlertMessage(
          `Error: ${data.message || "Failed to update user"}`,
          "danger"
        );
        return;
      }

      response.data;
      showAlertMessage("User updated successfully", "success");
      setShowEditModal(false);
      fetchUsers(); // Reload user list
    } catch (error) {
      console.error("Error updating user:", error);
      showAlertMessage("Failed to update user", "danger");
    }
  };

  // Open create user modal
  // const openCreateModal = () => {
  //   // Reset form
  //   setCreateForm({
  //     name: "",
  //     email: "",
  //     password: "",
  //     role: roleHierarchy[currentUserData.role]?.[0] || "",
  //     collegeName:
  //       currentUserData.role !== "rgpv" && currentUserData.collegeName
  //         ? currentUserData.collegeName
  //         : "",
  //   });

  //   setShowCreateModal(true);
  // };

  // Create new user
  // const createUser = async (e) => {
  //   e.preventDefault();
  //   const token = localStorage.getItem("token");
  //   const { name, email, password, role, collegeName } = createForm;

  //   // Name Validation
  //   if (name.trim().length < 3) {
  //     showAlertMessage("Name must be at least 3 characters long.", "danger");
  //     return;
  //   }

  //   // Email Validation
  //   const emailRegex = /^[a-z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  //   if (!emailRegex.test(email)) {
  //     showAlertMessage("Email is not valid, Try again!", "danger");
  //     return;
  //   }

  //   // Password Validation
  //   const passwordRegex =
  //     /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?~\\/-]).{8,}$/;
  //   if (!passwordRegex.test(password)) {
  //     showAlertMessage(
  //       "Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one number, and one special character.",
  //       "danger"
  //     );
  //     return;
  //   }

  //   if (!name || !email || !password || !role) {
  //     showAlertMessage("Please fill all required fields!", "danger");
  //     return;
  //   }

  //   try {
  //     const response = await axios.post(
  //       `${import.meta.env.VITE_API_BASE}/api/auth/signup`,
  //       {
  //         name: name.trim().toLowerCase(),
  //         email: email.trim().toLowerCase(),
  //         password,
  //         role,
  //         collegeName: collegeName.trim().toLowerCase(),
  //       },
  //       {
  //         headers: {
  //           "Content-Type": "application/json",
  //           Authorization: `Bearer ${token}`,
  //         },
  //       }
  //     );

  //     const data = response.data;

  //     if (response.status === 200) {
  //       showAlertMessage("User created successfully", "success");
  //       setShowCreateModal(false);
  //       fetchUsers(); // Reload user list
  //     } else {
  //       showAlertMessage(data.message || "Failed to create user", "danger");
  //     }
  //   } catch (error) {
  //     console.error("Error creating user:", error);
  //     showAlertMessage("Failed to create user", "danger");
  //   }
  // };

  // Delete user
  const deleteUser = async (userId) => {
    if (window.confirm("Are you sure you want to delete this user?")) {
      const token = localStorage.getItem("token");

      try {
        const response = await axios.delete(
          `${import.meta.env.VITE_API_BASE}/api/users/users/${userId}`,
          {
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.status !== 200) {
          const errorData = response.data;
          throw new Error(errorData.message || "Failed to delete user");
        }

        response.data;
        showAlertMessage("User deleted successfully", "success");

        // Refresh the user list without reloading the page
        await fetchUsers();
      } catch (error) {
        console.error("Error deleting user:", error);
        showAlertMessage(`Failed to delete user: ${error.message}`, "danger");
      }
    }
  };

  

  // Logout function
  const logout = async () => {
    try {
      const token = localStorage.getItem("token");

      await axios.post(`${import.meta.env.VITE_API_BASE}/api/auth/logout`, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      // Clear localStorage and redirect regardless of response
      localStorage.removeItem("token");
      localStorage.removeItem("Id");
      navigate("/login");
    } catch (error) {
      console.error("Error during logout:", error);
      localStorage.removeItem("token");
      localStorage.removeItem("Id");
      navigate("/login");
    }
  };

  // Utility functions
  const capitalizeFirstLetter = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
  };

  const showAlertMessage = (message, type) => {
    setAlert({ message, type });

    // Remove alert after 5 seconds
    setTimeout(() => {
      setAlert({ message: "", type: "" });
    }, 5000);
  };

  const goToUploadPage = (id) => {
    navigate(`/dashboard/${id}`);
  };

const goToSpinnerPage = (id) => {
    navigate(`/dashboard/spinner/${id}`);
  };

  // Handle input changes
  const handleEditFormChange = (e) => {
    const { name, value } = e.target;
    setEditForm((prevState) => ({
      ...prevState,
      [name]: value,
    }));
  };

  // const handleCreateFormChange = (e) => {
  //   const { name, value } = e.target;
  //   setCreateForm((prevState) => ({
  //     ...prevState,
  //     [name]: value,
  //   }));
  // };

  // If no user data yet, show loading
  if (!currentUserData) {
    return <div>Loading...</div>;
  }
console.log(currentUserData, "Currentuserdata")

  return (
    <>
      {/* <div className='parent'> */}
      <div className="child">
        <h1 id="dashboard-heading">
          {currentUserData.role.toUpperCase()} DASHBOARD
        </h1>

        <div className="user-profile">
          <div className="user-profile-details" id="dashboardInfo">
            <p className="user-info">
              <strong>Name:</strong> {currentUserData.name}
            </p>
            <p className="user-info">
              <strong>Email:</strong> {currentUserData.email}
            </p>
            <p className="user-info">
              <strong>Role:</strong> {currentUserData.role.toUpperCase()}
            </p>
            {currentUserData.collegeName && (
              <p className="user-info">
                <strong>College:</strong> {currentUserData.collegeName}
              </p>
            )}
          </div>
          <button id="logoutBtn" className="danger-btn" onClick={logout}>
            Logout
          </button>
        </div>

        {currentUserData.role !== "student" && (
          <div id="userManagementSection">
            <h2>Users Management</h2>

            <table className="dashboard-table" id="userTable">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>College</th>
                  {/* <th>Create</th> */}
                  <th>Read</th>
                  <th>Update</th>
                  <th>Delete</th>
                  <th>Remix</th>
                  <th>Spinner</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  // Check permissions
                  const canEdit = canEditUser(user);
                  const canDelete = canDeleteUser(user);
                  const canView = canViewUser(user);
                  const canEditPerms = canManagePermissions(user);
               

                  // Determine if the permissions checkboxes should be disabled
                  const disablePermissions =
                    currentUserData.role === "hod" ||
                    currentUserData.role === "teacher" ||
                    currentUserData.role === "college" ||
                    currentUserData.role === "student" ||
                    !canEditPerms;
                  // "The disablePermissions should be set to true if the current user's role is either 'hod', 'teacher', 'college', or 'student', OR if the canEditPerms variable is false. Otherwise, disablePermissions will be false."

                  return (
                    <tr key={user._id} data-user-id={user._id}>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>{user.role}</td>
                      <td>{user.collegeName || ""}</td>
                      {/* <td>
                        <div className="checkbox-container">
                          <input
                            type="checkbox"
                            className={`permission-checkbox perm-create ${
                              disablePermissions ? "checkbox-disabled" : ""
                            }`}
                            defaultChecked={user.permissions?.includes(
                              "create"
                            )}
                            disabled={disablePermissions}
                          />
                        </div>
                      </td> */}
                      <td>
                        <div className="checkbox-container">
                          <input
                            type="checkbox"
                            className={`permission-checkbox perm-read $ {disablePermissions ? 'checkbox-disabled' : ''}`}
                            defaultChecked={user.permissions?.includes("read")}
                            disabled={disablePermissions}
                          />
                        </div>
                      </td>
                      <td>
                        <div className="checkbox-container">
                          <input
                            type="checkbox"
                            className={`permission-checkbox perm-read $ {disablePermissions ? 'checkbox-disabled' : ''}`}
                            defaultChecked={user.permissions?.includes(
                              "update"
                            )}
                            disabled={disablePermissions}
                          />
                        </div>
                      </td>
                      <td>
                        <div className="checkbox-container">
                          <input
                            type="checkbox"
                            className={`permission-checkbox perm-read $ {disablePermissions ? 'checkbox-disabled' : ''}`}
                            defaultChecked={user.permissions?.includes(
                              "delete"
                            )}
                            disabled={disablePermissions}
                          />
                        </div>
                      </td>
                      <td>
                        <div className="checkbox-container">
                          <input
                            type="checkbox"
                            className={`permission-checkbox perm-remix $ {disablePermissions ? 'checkbox-disabled' : ''}`}
                            defaultChecked={user.permissions?.includes(
                              "remix"
                            )}
                            disabled={disablePermissions}
                          />
                        </div>
                      </td>

                       <td>
                        <div className="checkbox-container">
                          <input
                            type="checkbox"
                            className={`permission-checkbox perm-spinner $ {disablePermissions ? 'checkbox-disabled' : ''}`}
                            defaultChecked={user.permissions?.includes(
                              "spinner"
                            )}
                            disabled={disablePermissions}
                          />
                        </div>
                      </td>

                      <td className="action-button-container">
                        {canEditPerms && !disablePermissions && (
                          <button
                            className="action-btn"
                            onClick={() => updatePermissions(user._id)}
                            title="Save Permissions"
                          >
                            <Save size={16} />
                          </button>
                        )}
                        {canEdit && (
                          <button
                            className="action-btn"
                            onClick={() => openEditModal(user._id)}
                            title="Edit"
                          >
                            <Edit size={16} />
                          </button>
                        )}
                        {canDelete && (
                          <button
                            className="action-btn danger-del-btn"
                            onClick={() => deleteUser(user._id)}
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                        {canView && (
                          <button
                            className="action-btn"
                            onClick={() => viewUser(user._id)}
                            title="View"
                          >
                            <Eye size={16} />
                          </button>
                        )}
                      
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="buttons-container">
              {/* <button
                id="createUserBtn"
                className="success-btn"
                onClick={openCreateModal}
              >
                Create New User
              </button> */}
            {/* </div>

            <div className="buttons-container"> */}

            {currentUserData && currentUserData?.permissions?.includes("remix") || ["rgpv", "director"]?.includes(currentUserData.role) ?
            (
              <button
                id="createUserBtn"
                className="success-btn"
                
                onClick={() => {

                  goToUploadPage(currentUserData._id);
                }}
              >
                Upload Remix Songs
              </button>
            ): <></>
            }

{/* ------------------------------------------------------------- */}
                {currentUserData && currentUserData?.permissions?.includes("spinner") || ["rgpv", "director"]?.includes(currentUserData.role) ?
            (
              <button
                id="createUserBtn"
                className="success-btn"
                
                onClick={() => {

                  goToSpinnerPage(currentUserData._id);
                }}
              >
               Spinner Game
              </button>
            ): <></>
            }

{/* ----------------------------------------------------------------- */}
            </div>
          </div>

          // -----------------------------------------------
          
          // --------------------------------------------------
        )}

        {/* View User Modal */}
        {showUserModal && (
          <>
            <div id="userModal" style={{ display: "block" }}>
              <h3 className="modal-title">User Details</h3>
              <div id="modalContent" className="modal-content">
                {modalContent}
              </div>
              <div className="modal-actions">
                <button onClick={() => setShowUserModal(false)}>Close</button>
              </div>
            </div>
            <div
              className="modal-overlay"
              id="modalOverlay"
              style={{ display: "block" }}
              onClick={() => setShowUserModal(false)}
            ></div>
          </>
        )}

        {/* Edit User Modal */}
        {showEditModal && (
          <>
            <div id="editUserModal" style={{ display: "block" }}>
              <h3 className="modal-title">Edit User</h3>
              <form id="editUserForm" onSubmit={saveUser}>
                <label htmlFor="editName">Name:</label>
                <input
                  type="text"
                  id="editName"
                  name="name"
                  value={editForm.name}
                  onChange={handleEditFormChange}
                  required
                />

                <label htmlFor="editEmail">Email:</label>
                <input
                  type="email"
                  id="editEmail"
                  name="email"
                  value={editForm.email}
                  onChange={handleEditFormChange}
                  required
                />

                <label htmlFor="editRole">Role:</label>
                <select
                  id="editRole"
                  name="role"
                  value={editForm.role}
                  onChange={handleEditFormChange}
                >
                  <option value={selectedUser?.role}>
                    {capitalizeFirstLetter(selectedUser?.role || "")}
                  </option>
                  {roleHierarchy[currentUserData.role]?.map(
                    (role) =>
                      role !== selectedUser?.role && (
                        <option key={role} value={role}>
                          {capitalizeFirstLetter(role)}
                        </option>
                      )
                  )}
                </select>

                <label htmlFor="editCollege">College:</label>
                <input
                  type="text"
                  id="editCollege"
                  name="collegeName"
                  value={editForm.collegeName}
                  onChange={handleEditFormChange}
                  disabled={true}
                />

                <input
                  type="hidden"
                  id="editUserId"
                  name="_id"
                  value={editForm._id}
                />

                <div className="modal-actions">
                  <button type="submit">Save</button>
                  <button type="button" onClick={() => setShowEditModal(false)}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
            <div
              className="modal-overlay"
              id="modalOverlay"
              style={{ display: "block" }}
              onClick={() => setShowEditModal(false)}
            ></div>
          </>
        )}

        {/* Create User Modal
        {showCreateModal && (
          <>
            <div id="createUserModal" style={{ display: "block" }}>
              <h3 className="modal-title">Create New User</h3>

              <form id="createUserForm" onSubmit={createUser}>
                <label htmlFor="createName">Name:</label>
                <input
                  type="text"
                  id="createName"
                  name="name"
                  value={createForm.name}
                  onChange={handleCreateFormChange}
                  required
                />

                <label htmlFor="createEmail">Email:</label>
                <input
                  type="email"
                  id="createEmail"
                  name="email"
                  value={createForm.email}
                  onChange={handleCreateFormChange}
                  required
                />

                <label htmlFor="createPassword">Password:</label>
                <input
                  type="password"
                  id="createPassword"
                  name="password"
                  value={createForm.password}
                  onChange={handleCreateFormChange}
                  required
                />

                <label htmlFor="createRole">Role:</label>
                <select
                  id="createRole"
                  name="role"
                  value={createForm.role}
                  onChange={handleCreateFormChange}
                >
                  {roleHierarchy[currentUserData.role]?.map((role) => (
                    <option key={role} value={role}>
                      {capitalizeFirstLetter(role)}
                    </option>
                  ))}
                </select>

                <label htmlFor="createCollege">College:</label>
                <input
                  type="text"
                  id="createCollege"
                  name="collegeName"
                  value={createForm.collegeName}
                  onChange={handleCreateFormChange}
                  disabled={
                    currentUserData.role !== "rgpv" &&
                    currentUserData.collegeName
                  }
                />

                <div className="modal-actions">
                  <button type="submit">Create</button>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
            <div
              className="modal-overlay"
              id="modalOverlay"
              style={{ display: "block" }}
              onClick={() => setShowCreateModal(false)}
            ></div>
          </>
        )} */}

        {/* Alert container */}
        {alert.message && (
          <div id="alertContainer">
            <div className={`alert alert-${alert.type}`}>{alert.message}</div>
          </div>
        )}
      </div>
      {/* </div> */}
    </>
  );
};

export default Dashboard;

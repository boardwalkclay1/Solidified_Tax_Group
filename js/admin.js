let adminToken = null;

/* ---------------------------------------------------------
   ADMIN LOGIN
--------------------------------------------------------- */
async function adminLogin() {
  const email = document.getElementById("adminEmail").value.trim();
  const password = document.getElementById("adminPassword").value.trim();

  if (!email || !password) {
    alert("Enter email and password.");
    return;
  }

  const res = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();

  if (!data.success) {
    alert(data.error || "Login failed.");
    return;
  }

  adminToken = data.token;

  document.getElementById("adminLoginCard").style.display = "none";
  document.getElementById("adminDashboard").style.display = "block";

  document.getElementById("adminRole").textContent = `Role: ${data.role}`;

  loadClients();
  loadTemplates();
}

/* ---------------------------------------------------------
   LOAD CLIENTS
--------------------------------------------------------- */
async function loadClients() {
  const res = await fetch("/api/clients", {
    headers: { Authorization: "Bearer " + adminToken }
  });

  const clients = await res.json();
  const container = document.getElementById("clientsList");

  if (!clients.length) {
    container.textContent = "No clients yet.";
    return;
  }

  container.innerHTML = clients
    .map(
      c => `
      <div class="client-item">
        <strong>${c.name}</strong><br>
        ${c.email} • ${c.phone}<br>
        Year: ${c.year} • Status: ${c.status}
      </div>
    `
    )
    .join("");
}

/* ---------------------------------------------------------
   LOAD TEMPLATES
--------------------------------------------------------- */
async function loadTemplates() {
  const res = await fetch("/api/templates", {
    headers: { Authorization: "Bearer " + adminToken }
  });

  const templates = await res.json();
  const container = document.getElementById("templatesList");

  if (!templates.length) {
    container.textContent = "No templates uploaded.";
    return;
  }

  container.innerHTML = templates
    .map(
      t => `
      <div class="template-item">
        <strong>${t.name}</strong><br>
        Uploaded: ${new Date(t.createdAt).toLocaleDateString()}
      </div>
    `
    )
    .join("");
}

/* ---------------------------------------------------------
   UPLOAD TEMPLATE
--------------------------------------------------------- */
async function uploadTemplate() {
  const fileInput = document.getElementById("templateFile");

  if (!fileInput.files.length) {
    alert("Choose a file first.");
    return;
  }

  const file = fileInput.files[0];
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/templates/upload", {
    method: "POST",
    headers: { Authorization: "Bearer " + adminToken },
    body: formData
  });

  const data = await res.json();

  if (!data.success) {
    alert(data.error || "Upload failed.");
    return;
  }

  alert("Template uploaded.");
  loadTemplates();
}

/* ---------------------------------------------------------
   ADD NEW ADMIN (SUPERADMIN ONLY)
--------------------------------------------------------- */
async function addAdmin() {
  const email = document.getElementById("newAdminEmail").value.trim();
  const password = document.getElementById("newAdminPassword").value.trim();

  if (!email || !password) {
    alert("Enter email and temporary password.");
    return;
  }

  const res = await fetch("/api/admin/add-admin", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + adminToken
    },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();

  if (!data.success) {
    alert(data.error || "Failed to add admin.");
    return;
  }

  alert("Admin added successfully.");
}

/* ---------------------------------------------------------
   EVENT LISTENERS
--------------------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  const loginBtn = document.getElementById("adminLoginBtn");
  if (loginBtn) loginBtn.addEventListener("click", adminLogin);

  const uploadTemplateBtn = document.getElementById("uploadTemplateBtn");
  if (uploadTemplateBtn) uploadTemplateBtn.addEventListener("click", uploadTemplate);

  const addAdminBtn = document.getElementById("addAdminBtn");
  if (addAdminBtn) addAdminBtn.addEventListener("click", addAdmin);
});

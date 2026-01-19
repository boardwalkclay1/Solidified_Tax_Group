/* ============================================================
   SOLIDIFIED TAX GROUP — MAIN APPLICATION ENGINE
   Powers: index, client, dashboard, documents, upload, intake,
           admin, superadmin, theme, routing, stats, storage
============================================================ */


/* ------------------------------------------------------------
   CONSTANTS
------------------------------------------------------------ */
const SUPERADMIN_EMAIL = "boardwalkclay1@gmail.com";


/* ------------------------------------------------------------
   BOOTSTRAP
------------------------------------------------------------ */
document.addEventListener("DOMContentLoaded", () => {
  applySavedTheme();
  autoSuperAdminRedirect();
  initPageLogic();
});


/* ------------------------------------------------------------
   PAGE ROUTER
   Detects which page you're on and activates correct logic
------------------------------------------------------------ */
function initPageLogic() {

  // INDEX PAGE
  if (document.querySelector(".hero-actions")) {
    bindIndexButtons();
  }

  // CLIENT LOGIN PAGE
  if (document.getElementById("clientLoginForm")) {
    document.getElementById("clientLoginForm")
      .addEventListener("submit", handleClientLogin);
  }

  // CLIENT DASHBOARD
  if (document.getElementById("clientWelcome")) {
    loadDashboard();
  }

  // CLIENT DOCUMENTS
  if (document.getElementById("docsList")) {
    loadDocuments();
  }

  // CLIENT UPLOAD
  if (document.getElementById("uploadForm")) {
    document.getElementById("uploadForm")
      .addEventListener("submit", handleUpload);
  }

  // CLIENT INTAKE
  if (document.getElementById("intakeForm")) {
    document.getElementById("intakeForm")
      .addEventListener("submit", handleIntakeSubmit);
  }

  // ADMIN LOGIN
  if (document.getElementById("adminLoginForm")) {
    document.getElementById("adminLoginForm")
      .addEventListener("submit", handleAdminLogin);
  }

  // ADMIN DASHBOARD
  if (document.getElementById("adminContent")) {
    loadAdminData();
  }
}


/* ------------------------------------------------------------
   INDEX PAGE BUTTONS
------------------------------------------------------------ */
function bindIndexButtons() {
  const portalBtn = document.getElementById("enterPortalBtn");
  const intakeBtn = document.getElementById("intakeBtn");

  if (portalBtn) portalBtn.onclick = () => goTo("client.html");
  if (intakeBtn) intakeBtn.onclick = () => goTo("client-intake.html");
}


/* ------------------------------------------------------------
   UNIVERSAL HELPERS
------------------------------------------------------------ */
function goTo(page) {
  window.location.href = page;
}

function getClientEmail() {
  return localStorage.getItem("clientEmail") || null;
}

function saveUserEmail(email) {
  localStorage.setItem("user_email", email);
}


/* ------------------------------------------------------------
   SUPERADMIN AUTO-REDIRECT
------------------------------------------------------------ */
function autoSuperAdminRedirect() {
  const saved = localStorage.getItem("user_email");
  if (saved === SUPERADMIN_EMAIL) {
    window.location.href = "admin.html";
  }
}


/* ------------------------------------------------------------
   CLIENT LOGIN
------------------------------------------------------------ */
async function handleClientLogin(e) {
  e.preventDefault();
  const msg = document.getElementById("loginMsg");

  const email = e.target.email.value.trim();
  const phone = e.target.phone.value.trim();
  const password = e.target.password.value.trim();

  msg.textContent = "Signing in...";

  try {
    const res = await fetch("/api/client/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, phone, password })
    });

    const data = await res.json();

    if (!data.success) {
      msg.textContent = data.error || "Login failed.";
      msg.style.color = "red";
      return;
    }

    localStorage.setItem("clientEmail", email);
    msg.textContent = "Login successful.";
    msg.style.color = "green";

    const service = localStorage.getItem("selectedService");

    if (service === "document-upload") goTo("client-upload.html");
    else if (service === "sign-documents") goTo("client-sign.html");
    else if (service === "refund-status") goTo("client-status.html");
    else goTo("client-dashboard.html");

  } catch (err) {
    msg.textContent = "Server error.";
    msg.style.color = "red";
  }
}


/* ------------------------------------------------------------
   CLIENT DASHBOARD
------------------------------------------------------------ */
async function loadDashboard() {
  const email = getClientEmail();
  const welcome = document.getElementById("clientWelcome");

  if (!email) {
    welcome.textContent = "Not logged in.";
    return;
  }

  welcome.textContent = `Logged in as ${email}`;

  try {
    const res = await fetch(`/api/client/stats?email=${email}`);
    const data = await res.json();

    document.getElementById("statDocs").textContent = data.docs || 0;
    document.getElementById("statSigned").textContent = data.signed || 0;
    document.getElementById("statMessages").textContent = data.messages || 0;

  } catch (err) {
    document.getElementById("statDocs").textContent = "0";
    document.getElementById("statSigned").textContent = "0";
    document.getElementById("statMessages").textContent = "0";
  }
}


/* ------------------------------------------------------------
   CLIENT DOCUMENTS
------------------------------------------------------------ */
async function loadDocuments() {
  const email = getClientEmail();
  const container = document.getElementById("docsList");

  if (!email) {
    container.textContent = "Not logged in.";
    return;
  }

  try {
    const res = await fetch(`/api/client/documents?email=${email}`);
    const docs = await res.json();

    if (!docs.length) {
      container.textContent = "No documents yet.";
      return;
    }

    container.innerHTML = docs.map(d => `
      <div class="doc-card">
        <h4>${d.originalName}</h4>
        <p>Uploaded: ${new Date(d.uploadedAt).toLocaleDateString()}</p>
        <button class="btn secondary" onclick="window.location.href='/uploads/${d.filename}'">Download</button>
      </div>
    `).join("");

  } catch (err) {
    container.textContent = "Error loading documents.";
  }
}


/* ------------------------------------------------------------
   CLIENT UPLOAD
------------------------------------------------------------ */
async function handleUpload(e) {
  e.preventDefault();
  const msg = document.getElementById("uploadMsg");

  const email = getClientEmail();
  const formData = new FormData(e.target);
  formData.append("clientEmail", email);

  msg.textContent = "Uploading...";

  try {
    const res = await fetch("/api/client/upload", {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    if (!data.success) {
      msg.textContent = "Upload failed.";
      msg.style.color = "red";
      return;
    }

    msg.textContent = "Upload successful.";
    msg.style.color = "green";

    setTimeout(() => goTo("client-documents.html"), 800);

  } catch (err) {
    msg.textContent = "Server error.";
    msg.style.color = "red";
  }
}


/* ------------------------------------------------------------
   CLIENT INTAKE SUBMISSION
------------------------------------------------------------ */
async function handleIntakeSubmit(e) {
  e.preventDefault();
  const msg = document.getElementById("intakeMsg");

  const email = getClientEmail();
  const formData = new FormData(e.target);
  formData.append("clientEmail", email);

  msg.textContent = "Submitting intake...";

  try {
    const res = await fetch("/api/client/intake", {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    if (!data.success) {
      msg.textContent = "Failed to submit intake.";
      msg.style.color = "red";
      return;
    }

    msg.textContent = "Intake submitted.";
    msg.style.color = "green";

    setTimeout(() => goTo("client-documents.html"), 1000);

  } catch (err) {
    msg.textContent = "Server error.";
    msg.style.color = "red";
  }
}


/* ------------------------------------------------------------
   ADMIN LOGIN
------------------------------------------------------------ */
async function handleAdminLogin(e) {
  e.preventDefault();
  const msg = document.getElementById("adminMsg");

  const username = e.target.username.value.trim();
  const password = e.target.password.value.trim();

  msg.textContent = "Signing in...";

  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (!data.success) {
      msg.textContent = data.error || "Login failed.";
      msg.style.color = "red";
      return;
    }

    localStorage.setItem("adminToken", data.token);
    msg.textContent = "Logged in.";
    msg.style.color = "green";

    loadAdminData();

  } catch (err) {
    msg.textContent = "Server error.";
    msg.style.color = "red";
  }
}


/* ------------------------------------------------------------
   ADMIN DASHBOARD
------------------------------------------------------------ */
async function loadAdminData() {
  const token = localStorage.getItem("adminToken");
  const container = document.getElementById("adminContent");

  if (!token) {
    container.textContent = "Login required.";
    return;
  }

  container.textContent = "Loading...";

  try {
    const res = await fetch("/api/admin/clients-with-docs", {
      headers: { "Authorization": `Bearer ${token}` }
    });

    const clients = await res.json();

    container.innerHTML = clients.map(c => `
      <div class="card" style="margin-bottom:16px;">
        <h3>${c.email}</h3>
        <p>Name: ${c.name || "N/A"}</p>
        <h4>Documents</h4>
        ${
          c.documents.length
            ? c.documents.map(d => `
                <div class="service-item">
                  <h4>${d.originalName}</h4>
                  <p>${new Date(d.uploadedAt).toLocaleDateString()}</p>
                  <button class="btn secondary" onclick="window.location.href='/uploads/${d.filename}'">Download</button>
                </div>
              `).join("")
            : "<p>No documents.</p>"
        }
      </div>
    `).join("");

  } catch (err) {
    container.textContent = "Error loading admin data.";
  }
}


/* ------------------------------------------------------------
   THEME TOGGLE
------------------------------------------------------------ */
function applySavedTheme() {
  const saved = localStorage.getItem("theme");
  if (saved === "dark") {
    document.documentElement.classList.add("dark");
  }

  const toggle = document.getElementById("themeToggle");
  if (!toggle) return;

  toggle.addEventListener("click", () => {
    document.documentElement.classList.toggle("dark");
    localStorage.setItem(
      "theme",
      document.documentElement.classList.contains("dark") ? "dark" : "light"
    );
  });
}

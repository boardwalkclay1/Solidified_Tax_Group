let adminToken = null;

async function adminLogin() {
  const email = document.getElementById("adminEmail").value;
  const password = document.getElementById("adminPassword").value;

  const res = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (!data.success) {
    alert(data.error || "Login failed");
    return;
  }
  adminToken = data.token;
  document.getElementById("adminLoginCard").style.display = "none";
  document.getElementById("adminDashboard").style.display = "block";
  document.getElementById("adminRole").textContent = `Role: ${data.role}`;
  loadClients();
  loadTemplates();
  populateScanClientSelect();
}

async function loadClients() {
  const res = await fetch("/api/clients", {
    headers: { Authorization: "Bearer " + adminToken }
  });
  const clients = await res.json();
  const container = document.getElementById("clientsList");
  container.innerHTML = clients.map(c => `
    <div class="client-item">
      <strong>${c.name}</strong><br/>
      ${c.email} • ${c.phone}<br/>
      Year: ${c.year} • Status: ${c.status}
    </div>
  `).join("");
}

async function loadTemplates() {
  const res = await fetch("/api/templates", {
    headers: { Authorization: "Bearer " + adminToken }
  });
  const templates = await res.json();
  const container = document.getElementById("templatesList");
  if (!templates.length) {
    container.textContent = "No templates yet.";
    return;
  }
  container.innerHTML = templates.map(t => `
    <div class="template-item">
      <strong>${t.name}</strong><br/>
      ${t.description || ""}
    </div>
  `).join("");
}

async function uploadTemplate() {
  const fileInput = document.getElementById("templateFile");
  if (!fileInput.files.length) return alert("Choose a file.");
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
    alert(data.error || "Upload failed");
    return;
  }
  alert("Template uploaded.");
  loadTemplates();
}

async function populateScanClientSelect() {
  const res = await fetch("/api/clients", {
    headers: { Authorization: "Bearer " + adminToken }
  });
  const clients = await res.json();
  const sel = document.getElementById("scanClientSelect");
  sel.innerHTML = clients.map(c => `<option value="${c.id}">${c.name}</option>`).join("");
}

async function uploadScan() {
  const clientId = document.getElementById("scanClientSelect").value;
  const fileInput = document.getElementById("scanFileInput");
  const type = document.getElementById("scanType").value;

  if (!clientId) return alert("Select a client.");
  if (!fileInput.files.length) return alert("Scan a document first.");

  const file = fileInput.files[0];
  const formData = new FormData();
  formData.append("file", file);
  formData.append("type", type);
  formData.append("year", new Date().getFullYear());

  const res = await fetch(`/api/clients/${clientId}/upload`, {
    method: "POST",
    body: formData
  });
  const data = await res.json();
  if (!data.success) return alert("Upload failed.");
  alert("Scan uploaded to client.");
}

async function sendForSignature() {
  const clientEmail = document.getElementById("signClientEmail").value;
  const docId = document.getElementById("signDocId").value;
  if (!clientEmail || !docId) return alert("Enter client email and document ID.");

  const res = await fetch(`/api/admin/documents/${docId}/send-for-signature`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + adminToken
    },
    body: JSON.stringify({ clientEmail })
  });
  const data = await res.json();
  if (!data.success) {
    alert(data.error || "Failed to send.");
    return;
  }
  alert("Email sent to client.");
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("adminLoginBtn");
  if (btn) btn.addEventListener("click", adminLogin);
  const uploadTemplateBtn = document.getElementById("uploadTemplateBtn");
  if (uploadTemplateBtn) uploadTemplateBtn.addEventListener("click", uploadTemplate);
  const uploadScanBtn = document.getElementById("uploadScanBtn");
  if (uploadScanBtn) uploadScanBtn.addEventListener("click", uploadScan);
  const sendForSignatureBtn = document.getElementById("sendForSignatureBtn");
  if (sendForSignatureBtn) sendForSignatureBtn.addEventListener("click", sendForSignature);
});

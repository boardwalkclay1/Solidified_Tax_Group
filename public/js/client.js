let clientToken = null;
let clientId = null;

async function clientLogin() {
  const email = document.getElementById("clientEmail").value;
  const phone = document.getElementById("clientPhone").value;
  const password = document.getElementById("clientPassword").value;

  const res = await fetch("/api/client/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, phone, password })
  });
  const data = await res.json();
  if (!data.success) {
    alert(data.error || "Login failed");
    return;
  }
  clientToken = data.token;
  clientId = data.clientId;
  document.getElementById("clientLoginCard").style.display = "none";
  document.getElementById("clientPortalCard").style.display = "block";
  loadClientInfo();
  loadClientDocs();
  loadUploadHelper();
}

async function loadClientInfo() {
  const res = await fetch(`/api/clients/${clientId}`);
  const client = await res.json();
  document.getElementById("clientInfo").innerHTML = `
    <p><strong>${client.name}</strong><br/>
    Year: ${client.year} • Status: ${client.status}</p>
  `;
}

async function loadClientDocs() {
  const res = await fetch(`/api/clients/${clientId}/documents`);
  const docs = await res.json();
  const container = document.getElementById("clientDocs");
  if (!docs.length) {
    container.textContent = "No documents yet.";
    return;
  }
  container.innerHTML = docs.map(d => `
    <div class="doc-item">
      <strong>${d.originalName}</strong><br/>
      Type: ${d.type} • Year: ${d.year}
      ${d.signedFile ? `<br/><span class="badge">Signed</span>` : ""}
    </div>
  `).join("");
}

async function loadUploadHelper() {
  const res = await fetch("/api/helpers");
  const helpers = await res.json();
  const el = document.getElementById("uploadHelper");
  const idHelper = helpers.find(h => h.target === "upload-id");
  if (idHelper) el.textContent = idHelper.text;
}

async function clientUpload() {
  if (!clientId) return alert("You must be logged in.");
  const type = document.getElementById("clientUploadType").value;
  const fileInput = document.getElementById("clientUploadFile");
  if (!fileInput.files.length) return alert("Choose a file.");

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
  if (!data.success) {
    alert(data.error || "Upload failed");
    return;
  }
  alert("File uploaded.");
  loadClientDocs();
}

document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("clientLoginBtn");
  if (btn) btn.addEventListener("click", clientLogin);
  const uploadBtn = document.getElementById("clientUploadBtn");
  if (uploadBtn) uploadBtn.addEventListener("click", clientUpload);
});

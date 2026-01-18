const express = require("express");
const fileUpload = require("express-fileupload");
const fs = require("fs-extra");
const path = require("path");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const app = express();
const PORT = process.env.PORT || 4000;

const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(__dirname, "uploads");

fs.ensureDirSync(DATA_DIR);
fs.ensureDirSync(UPLOAD_DIR);

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(fileUpload());
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(UPLOAD_DIR));

// helpers
async function readJson(file) {
  const full = path.join(DATA_DIR, file);
  if (!(await fs.pathExists(full))) return null;
  const raw = await fs.readFile(full, "utf8");
  return JSON.parse(raw || "null");
}
async function writeJson(file, data) {
  const full = path.join(DATA_DIR, file);
  await fs.writeFile(full, JSON.stringify(data, null, 2), "utf8");
}

// in-memory sessions
const sessions = {
  admins: {},   // token -> { email, role }
  clients: {}   // token -> { id, email }
};

// email transport (configure real SMTP in env)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.example.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || "user@example.com",
    pass: process.env.SMTP_PASS || "password"
  }
});

// ---------- PUBLIC DATA ----------
app.get("/api/services", async (req, res) => {
  res.json((await readJson("services.json")) || []);
});

app.get("/api/helpers", async (req, res) => {
  res.json((await readJson("helpers.json")) || []);
});

// ---------- ADMIN AUTH ----------
app.post("/api/admin/login", async (req, res) => {
  const { email, password } = req.body;
  const data = (await readJson("admin.json")) || { admins: [] };
  const admin = data.admins.find(a => a.email === email);
  if (!admin) return res.status(404).json({ error: "Admin not found" });

  const ok = await bcrypt.compare(password, admin.passwordHash || "");
  if (!ok) return res.status(401).json({ error: "Invalid password" });

  const token = crypto.randomBytes(32).toString("hex");
  sessions.admins[token] = { email: admin.email, role: admin.role };
  res.json({ success: true, token, role: admin.role });
});

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token || !sessions.admins[token]) {
    return res.status(401).json({ error: "Admin auth required" });
  }
  req.admin = sessions.admins[token];
  next();
}

// ---------- CLIENT AUTH ----------
app.post("/api/client/login", async (req, res) => {
  const { email, phone, password } = req.body;
  const clients = (await readJson("clients.json")) || [];
  const client = clients.find(c => c.email === email);
  if (!client) return res.status(404).json({ error: "Client not found" });
  if (!client.authorized) return res.status(403).json({ error: "Access disabled" });
  if (client.phone !== phone) return res.status(401).json({ error: "Phone mismatch" });

  const ok = await bcrypt.compare(password, client.passwordHash || "");
  if (!ok) return res.status(401).json({ error: "Invalid password" });

  const token = crypto.randomBytes(32).toString("hex");
  sessions.clients[token] = { id: client.id, email: client.email };
  res.json({ success: true, token, clientId: client.id });
});

function requireClient(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token || !sessions.clients[token]) {
    return res.status(401).json({ error: "Client auth required" });
  }
  req.client = sessions.clients[token];
  next();
}

// ---------- ADMIN: CLIENT MANAGEMENT ----------
app.get("/api/clients", requireAdmin, async (req, res) => {
  res.json((await readJson("clients.json")) || []);
});

app.get("/api/clients/:id", async (req, res) => {
  const id = Number(req.params.id);
  const clients = (await readJson("clients.json")) || [];
  const client = clients.find(c => c.id === id);
  if (!client) return res.status(404).json({ error: "Client not found" });
  res.json(client);
});

// create or update client
app.post("/api/admin/clients/save", requireAdmin, async (req, res) => {
  const {
    id,
    name,
    email,
    phone,
    password,
    ssn,
    driverLicense,
    status,
    year,
    services,
    authorized
  } = req.body;

  const clients = (await readJson("clients.json")) || [];
  let client;

  if (id) {
    const idx = clients.findIndex(c => c.id === id);
    if (idx === -1) return res.status(404).json({ error: "Client not found" });
    client = clients[idx];

    if (name) client.name = name;
    if (email) client.email = email;
    if (phone) client.phone = phone;
    if (typeof authorized === "boolean") client.authorized = authorized;
    if (status) client.status = status;
    if (year) client.year = year;
    if (services) client.services = services;

    if (password) client.passwordHash = await bcrypt.hash(password, 10);
    if (ssn) client.ssnHash = await bcrypt.hash(ssn, 10);
    if (driverLicense) client.driverLicenseHash = await bcrypt.hash(driverLicense, 10);

    clients[idx] = client;
  } else {
    const newId = clients.length ? Math.max(...clients.map(c => c.id)) + 1 : 1;
    client = {
      id: newId,
      name,
      email,
      phone,
      passwordHash: password ? await bcrypt.hash(password, 10) : "",
      ssnHash: ssn ? await bcrypt.hash(ssn, 10) : "",
      driverLicenseHash: driverLicense ? await bcrypt.hash(driverLicense, 10) : "",
      status: status || "New",
      year: year || new Date().getFullYear(),
      services: services || [],
      authorized: typeof authorized === "boolean" ? authorized : true
    };
    clients.push(client);
  }

  await writeJson("clients.json", clients);
  res.json({ success: true, client });
});

// ---------- ADMIN: TEMPLATES ----------
app.get("/api/templates", requireAdmin, async (req, res) => {
  res.json((await readJson("templates.json")) || []);
});

app.post("/api/templates/upload", requireAdmin, async (req, res) => {
  if (!req.files || !req.files.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  const file = req.files.file;
  const templates = (await readJson("templates.json")) || [];
  const newId = templates.length ? Math.max(...templates.map(t => t.id)) + 1 : 1;

  const templateDir = path.join(UPLOAD_DIR, "templates", String(newId));
  await fs.ensureDir(templateDir);

  const safeName = Date.now() + "_" + file.name.replace(/\s+/g, "_");
  const savePath = path.join(templateDir, safeName);
  await file.mv(savePath);

  const relPath = path.join("templates", String(newId), safeName);
  const now = new Date().toISOString();

  const newTemplate = {
    id: newId,
    name: file.name,
    description: "",
    filename: relPath,
    originalName: file.name,
    createdAt: now,
    updatedAt: now
  };

  templates.push(newTemplate);
  await writeJson("templates.json", templates);

  res.json({ success: true, template: newTemplate });
});

app.post("/api/templates/:id/edit", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { name, description } = req.body;
  const templates = (await readJson("templates.json")) || [];
  const idx = templates.findIndex(t => t.id === id);
  if (idx === -1) return res.status(404).json({ error: "Template not found" });

  if (name) templates[idx].name = name;
  if (description) templates[idx].description = description;
  templates[idx].updatedAt = new Date().toISOString();

  await writeJson("templates.json", templates);
  res.json({ success: true, template: templates[idx] });
});

// ---------- CLIENT DOCUMENTS ----------
app.get("/api/clients/:id/documents", async (req, res) => {
  const id = Number(req.params.id);
  const docs = (await readJson("documents.json")) || [];
  res.json(docs.filter(d => d.clientId === id));
});

// upload arbitrary doc to client (scan or file)
app.post("/api/clients/:id/upload", async (req, res) => {
  const id = Number(req.params.id);
  const { type, year } = req.body;
  if (!req.files || !req.files.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  const file = req.files.file;
  const safeYear = year || new Date().getFullYear();
  const clientDir = path.join(UPLOAD_DIR, "clients", String(id), String(safeYear));
  await fs.ensureDir(clientDir);

  const safeName = Date.now() + "_" + file.name.replace(/\s+/g, "_");
  const savePath = path.join(clientDir, safeName);
  await file.mv(savePath);

  const docs = (await readJson("documents.json")) || [];
  const newId = docs.length ? Math.max(...docs.map(d => d.id)) + 1 : 1;
  const relPath = path.join("clients", String(id), String(safeYear), safeName);

  const newDoc = {
    id: newId,
    clientId: id,
    templateId: null,
    year: Number(safeYear),
    type: type || "Other",
    filename: relPath,
    originalName: file.name,
    uploadedAt: new Date().toISOString()
  };

  docs.push(newDoc);
  await writeJson("documents.json", docs);

  res.json({ success: true, document: newDoc });
});

// create client document from template
app.post("/api/admin/templates/:templateId/assign-to-client", requireAdmin, async (req, res) => {
  const templateId = Number(req.params.templateId);
  const { clientId, year, type } = req.body;

  const templates = (await readJson("templates.json")) || [];
  const template = templates.find(t => t.id === templateId);
  if (!template) return res.status(404).json({ error: "Template not found" });

  const docs = (await readJson("documents.json")) || [];
  const newId = docs.length ? Math.max(...docs.map(d => d.id)) + 1 : 1;

  const newDoc = {
    id: newId,
    clientId: Number(clientId),
    templateId: templateId,
    year: Number(year || new Date().getFullYear()),
    type: type || template.name,
    filename: template.filename,
    originalName: template.originalName,
    uploadedAt: new Date().toISOString()
  };

  docs.push(newDoc);
  await writeJson("documents.json", docs);

  res.json({ success: true, document: newDoc });
});

// ---------- DOCUMENT LIST + SEND FOR SIGNATURE ----------
app.get("/api/documents", async (req, res) => {
  res.json((await readJson("documents.json")) || []);
});

app.post("/api/admin/documents/:id/send-for-signature", requireAdmin, async (req, res) => {
  const docId = Number(req.params.id);
  const { clientEmail } = req.body;

  const docs = (await readJson("documents.json")) || [];
  const doc = docs.find(d => d.id === docId);
  if (!doc) return res.status(404).json({ error: "Document not found" });

  const clients = (await readJson("clients.json")) || [];
  const client = clients.find(c => c.email === clientEmail);
  if (!client) return res.status(404).json({ error: "Client not found" });

  const signUrl = `${req.protocol}://${req.get("host")}/client-sign.html?docId=${doc.id}`;

  const mailOptions = {
    from: "no-reply@solidifiedtaxgroup.com",
    to: clientEmail,
    subject: "Document Ready for Signature",
    html: `
      <p>You have a document to sign from Solidified Tax Group.</p>
      <p><a href="${signUrl}">Click here to sign digitally</a></p>
      <p>Or download, print, sign, and upload it back through your client portal.</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send email" });
  }
});

// ---------- DIGITAL SIGNATURE SAVE ----------
app.post("/api/documents/:id/sign", async (req, res) => {
  const docId = Number(req.params.id);
  const { signatureDataUrl } = req.body;

  const docs = (await readJson("documents.json")) || [];
  const idx = docs.findIndex(d => d.id === docId);
  if (idx === -1) return res.status(404).json({ error: "Document not found" });

  const doc = docs[idx];

  const base64 = signatureDataUrl.split(",")[1];
  const buffer = Buffer.from(base64, "base64");

  const signDir = path.join(UPLOAD_DIR, "signed", String(doc.clientId));
  await fs.ensureDir(signDir);

  const signFileName = `signed_${doc.id}_${Date.now()}.png`;
  const signPath = path.join(signDir, signFileName);
  await fs.writeFile(signPath, buffer);

  doc.signedFile = path.join("signed", String(doc.clientId), signFileName);
  doc.signedAt = new Date().toISOString();
  docs[idx] = doc;
  await writeJson("documents.json", docs);

  res.json({ success: true, document: doc });
});

// ---------- CONTACT FORM ----------
app.post("/api/contact", async (req, res) => {
  const { name, email, message } = req.body;
  const mailOptions = {
    from: email,
    to: process.env.CONTACT_EMAIL || "info@solidifiedtaxgroup.com",
    subject: `Contact form from ${name}`,
    text: message
  };
  try {
    await transporter.sendMail(mailOptions);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// ---------- START SERVER ----------
app.listen(PORT, () => {
  console.log(`Solidified Tax Group running on http://localhost:${PORT}`);
});

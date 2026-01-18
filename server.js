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

async function readJson(file) {
  const full = path.join(DATA_DIR, file);
  if (!(await fs.pathExists(full))) return null;
  return JSON.parse(await fs.readFile(full, "utf8"));
}

async function writeJson(file, data) {
  const full = path.join(DATA_DIR, file);
  await fs.writeFile(full, JSON.stringify(data, null, 2));
}

const sessions = {
  admins: {},
  clients: {}
};

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.example.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || "user@example.com",
    pass: process.env.SMTP_PASS || "password"
  }
});

/* ---------------- PUBLIC DATA ---------------- */

app.get("/api/services", async (req, res) => {
  res.json((await readJson("services.json")) || []);
});

/* ---------------- ADMIN AUTH ---------------- */

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

/* ---------------- ADD ADMIN (SUPERADMIN ONLY) ---------------- */

app.post("/api/admin/add-admin", requireAdmin, async (req, res) => {
  if (req.admin.role !== "superadmin") {
    return res.status(403).json({ error: "Only superadmin can add admins" });
  }

  const { email, password } = req.body;

  const data = (await readJson("admin.json")) || { admins: [] };

  if (data.admins.find(a => a.email === email)) {
    return res.status(400).json({ error: "Admin already exists" });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  data.admins.push({
    email,
    passwordHash,
    role: "admin"
  });

  await writeJson("admin.json", data);

  res.json({ success: true });
});

/* ---------------- CLIENT AUTH ---------------- */

app.post("/api/client/login", async (req, res) => {
  const { email, phone, password } = req.body;

  const clients = (await readJson("clients.json")) || [];
  const client = clients.find(c => c.email === email);

  if (!client) return res.status(404).json({ error: "Client not found" });
  if (client.phone !== phone) return res.status(401).json({ error: "Phone mismatch" });

  const ok = await bcrypt.compare(password, client.passwordHash || "");
  if (!ok) return res.status(401).json({ error: "Invalid password" });

  const token = crypto.randomBytes(32).toString("hex");
  sessions.clients[token] = { id: client.id, email: client.email };

  res.json({ success: true, token, clientId: client.id });
});

/* ---------------- CLIENT DATA ---------------- */

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

/* ---------------- TEMPLATES ---------------- */

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

  const dir = path.join(UPLOAD_DIR, "templates", String(newId));
  await fs.ensureDir(dir);

  const safeName = Date.now() + "_" + file.name.replace(/\s+/g, "_");
  const savePath = path.join(dir, safeName);
  await file.mv(savePath);

  const relPath = path.join("templates", String(newId), safeName);

  const newTemplate = {
    id: newId,
    name: file.name,
    filename: relPath,
    createdAt: new Date().toISOString()
  };

  templates.push(newTemplate);
  await writeJson("templates.json", templates);

  res.json({ success: true });
});

/* ---------------- DOCUMENTS ---------------- */

app.get("/api/clients/:id/documents", async (req, res) => {
  const id = Number(req.params.id);
  const docs = (await readJson("documents.json")) || [];
  res.json(docs.filter(d => d.clientId === id));
});

/* Single document fetch for client-sign.html */
app.get("/api/documents/:id", async (req, res) => {
  const docId = Number(req.params.id);
  const docs = (await readJson("documents.json")) || [];
  const doc = docs.find(d => d.id === docId);
  if (!doc) return res.status(404).json({ error: "Document not found" });
  res.json(doc);
});

app.post("/api/clients/:id/upload", async (req, res) => {
  const id = Number(req.params.id);

  if (!req.files || !req.files.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const file = req.files.file;
  const docs = (await readJson("documents.json")) || [];
  const newId = docs.length ? Math.max(...docs.map(d => d.id)) + 1 : 1;

  const dir = path.join(UPLOAD_DIR, "clients", String(id));
  await fs.ensureDir(dir);

  const safeName = Date.now() + "_" + file.name.replace(/\s+/g, "_");
  const savePath = path.join(dir, safeName);
  await file.mv(savePath);

  const relPath = path.join("clients", String(id), safeName);

  const newDoc = {
    id: newId,
    clientId: id,
    filename: relPath,
    originalName: file.name,
    uploadedAt: new Date().toISOString()
  };

  docs.push(newDoc);
  await writeJson("documents.json", docs);

  res.json({ success: true });
});

/* ---------------- DIGITAL SIGNATURE ---------------- */

app.post("/api/documents/:id/sign", async (req, res) => {
  const docId = Number(req.params.id);
  const { signatureDataUrl } = req.body;

  const docs = (await readJson("documents.json")) || [];
  const idx = docs.findIndex(d => d.id === docId);

  if (idx === -1) return res.status(404).json({ error: "Document not found" });

  const base64 = signatureDataUrl.split(",")[1];
  const buffer = Buffer.from(base64, "base64");

  const signDir = path.join(UPLOAD_DIR, "signed", String(docs[idx].clientId));
  await fs.ensureDir(signDir);

  const signName = `signed_${docId}_${Date.now()}.png`;
  const signPath = path.join(signDir, signName);

  await fs.writeFile(signPath, buffer);

  docs[idx].signedFile = path.join("signed", String(docs[idx].clientId), signName);
  docs[idx].signedAt = new Date().toISOString();

  await writeJson("documents.json", docs);

  res.json({ success: true });
});

/* ---------------- SERVICES MANAGEMENT (HYBRID OPTION 3) ---------------- */

app.post("/api/services/add", requireAdmin, async (req, res) => {
  if (req.admin.role !== "superadmin") {
    return res.status(403).json({ error: "Only superadmin can modify services" });
  }

  const { name, description } = req.body;
  if (!name || !description) {
    return res.status(400).json({ error: "Name and description are required." });
  }

  const services = (await readJson("services.json")) || [];
  const newId = services.length ? Math.max(...services.map(s => s.id)) + 1 : 1;

  const newService = { id: newId, name, description };
  services.push(newService);
  await writeJson("services.json", services);

  res.json({ success: true, service: newService });
});

app.put("/api/services/:id", requireAdmin, async (req, res) => {
  if (req.admin.role !== "superadmin") {
    return res.status(403).json({ error: "Only superadmin can modify services" });
  }

  const id = Number(req.params.id);
  const { name, description } = req.body;

  const services = (await readJson("services.json")) || [];
  const idx = services.findIndex(s => s.id === id);
  if (idx === -1) return res.status(404).json({ error: "Service not found" });

  if (name) services[idx].name = name;
  if (description) services[idx].description = description;

  await writeJson("services.json", services);
  res.json({ success: true, service: services[idx] });
});

app.delete("/api/services/:id", requireAdmin, async (req, res) => {
  if (req.admin.role !== "superadmin") {
    return res.status(403).json({ error: "Only superadmin can modify services" });
  }

  const id = Number(req.params.id);
  const services = (await readJson("services.json")) || [];
  const idx = services.findIndex(s => s.id === id);
  if (idx === -1) return res.status(404).json({ error: "Service not found" });

  services.splice(idx, 1);
  await writeJson("services.json", services);

  res.json({ success: true });
});

/* ---------------- CONTACT FORM ---------------- */

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
    res.status(500).json({ error: "Failed to send message" });
  }
});

/* ---------------- START SERVER ---------------- */

app.listen(PORT, () => {
  console.log(`Solidified Tax Group running on http://localhost:${PORT}`);
});

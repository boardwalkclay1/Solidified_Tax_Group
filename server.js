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

// simple in-memory sessions
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

// --- PUBLIC DATA ---
app.get("/api/services", async (req, res) => {
  res.json((await readJson("services.json")) || []);
});
app.get("/api/helpers", async (req, res) => {
  res.json((await readJson("helpers.json")) || []);
});

// --- ADMIN AUTH ---
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

// --- CLIENT AUTH ---
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

// --- CLIENT DATA (admin + client views will build on this later) ---
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

// --- START SERVER ---
app.listen(PORT, () => {
  console.log(`Solidified Tax Group running on http://localhost:${PORT}`);
});
// create or update client (admin only)
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

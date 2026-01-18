/* ---------------------------------------------------------
   Solidified Tax Group — App Logic
   Auto-superadmin + first-time admin creation
--------------------------------------------------------- */

const SUPERADMIN_EMAIL = "boardwalkclay1@gmail.com"; // your email

document.addEventListener("DOMContentLoaded", () => {
  setupThemeToggle();
  autoAdminCheck();
});

/* ---------------------------------------------------------
   AUTO ADMIN CHECK
   If your email is stored, unlock admin instantly
--------------------------------------------------------- */
function autoAdminCheck() {
  const savedEmail = localStorage.getItem("user_email");

  if (savedEmail === SUPERADMIN_EMAIL) {
    window.location.href = "admin.html";
  }
}

/* ---------------------------------------------------------
   SAVE USER EMAIL (used for auto-admin)
--------------------------------------------------------- */
function saveUserEmail(email) {
  localStorage.setItem("user_email", email);
}

/* ---------------------------------------------------------
   FIRST-TIME ADMIN CREATION
   Called when she logs in with no admin.json existing
--------------------------------------------------------- */
async function firstTimeAdminSetup(email, password) {
  const res = await fetch("/api/admin/add-admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();

  if (!data.success) {
    alert(data.error || "Failed to create admin.");
    return false;
  }

  return true;
}

/* ---------------------------------------------------------
   PUBLIC LOGIN HANDLER
   This is for the login page (not admin login)
--------------------------------------------------------- */
async function publicLogin() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  if (!email || !password) {
    alert("Enter email and password.");
    return;
  }

  // Save email for auto-admin
  saveUserEmail(email);

  // If it's your email → instant admin access
  if (email === SUPERADMIN_EMAIL) {
    window.location.href = "admin.html";
    return;
  }

  // Otherwise → try normal admin login
  const res = await fetch("/api/admin/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();

  // If admin.json is empty → first-time setup
  if (data.error === "Admin not found") {
    const ok = await firstTimeAdminSetup(email, password);
    if (ok) {
      alert("Admin account created. Logging in...");
      window.location.href = "admin.html";
    }
    return;
  }

  if (!data.success) {
    alert(data.error || "Login failed.");
    return;
  }

  // Normal admin login
  window.location.href = "admin.html";
}

/* ---------------------------------------------------------
   THEME TOGGLE
--------------------------------------------------------- */
function setupThemeToggle() {
  const toggle = document.getElementById("themeToggle");
  if (!toggle) return;

  toggle.addEventListener("click", () => {
    document.documentElement.classList.toggle("dark");
    localStorage.setItem(
      "theme",
      document.documentElement.classList.contains("dark") ? "dark" : "light"
    );
  });

  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark") {
    document.documentElement.classList.add("dark");
  }
}

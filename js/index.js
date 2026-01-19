/* ============================================================
   TYPEWRITER LOADING SCREEN
   ============================================================ */

const loaderText = document.getElementById("loaderText");
const loader = document.getElementById("loader");
const loadingMessage = "Solidified Tax Group...";
let index = 0;

function typeWriter() {
  if (index < loadingMessage.length) {
    loaderText.textContent += loadingMessage.charAt(index);
    index++;
    setTimeout(typeWriter, 80);
  } else {
    setTimeout(() => {
      loader.style.opacity = "0";
      setTimeout(() => loader.remove(), 400);
    }, 400);
  }
}

window.addEventListener("load", typeWriter);


/* ============================================================
   ADMIN HOTSPOT (TOP‑RIGHT, 4 TAPS)
   ============================================================ */

let adminTaps = 0;
let adminTimer = null;

document.getElementById("adminHotspot").addEventListener("click", () => {
  adminTaps++;

  if (adminTimer) clearTimeout(adminTimer);
  adminTimer = setTimeout(() => adminTaps = 0, 800);

  if (adminTaps === 4) {
    window.location.href = "admin.html";
  }
});


/* ============================================================
   SERVICE SELECTION STORAGE
   ============================================================ */

document.querySelectorAll(".service-item[data-service]").forEach(item => {
  item.addEventListener("click", () => {
    const service = item.getAttribute("data-service");
    localStorage.setItem("selectedService", service);
  });
});


/* ============================================================
   FALLING PAPER EFFECT
   ============================================================ */

function spawnPaper(x, y) {
  const paper = document.createElement("div");
  paper.className = "falling-paper";
  paper.style.left = x + "px";
  paper.style.top = y + "px";
  document.body.appendChild(paper);

  setTimeout(() => paper.remove(), 1200);
}

document.addEventListener("mousemove", e => {
  if (Math.random() < 0.05) {
    spawnPaper(e.clientX, e.clientY);
  }
});

document.addEventListener("click", e => {
  spawnPaper(e.clientX, e.clientY);
});

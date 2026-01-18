document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("contactSubmit");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const name = document.getElementById("contactName").value;
    const email = document.getElementById("contactEmail").value;
    const message = document.getElementById("contactMessage").value;
    const res = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, message })
    });
    const data = await res.json();
    const status = document.getElementById("contactStatus");
    if (!data.success) {
      status.textContent = data.error || "Failed to send message.";
      return;
    }
    status.textContent = "Message sent. Thank you.";
  });
});

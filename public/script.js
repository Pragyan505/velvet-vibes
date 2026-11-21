// FRONT END: send the form to the back end with fetch()
const form = document.getElementById("lead-form");
const msg = document.getElementById("form-msg");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const button = form.querySelector("button");
  const data = Object.fromEntries(new FormData(form));
  msg.className = "";
  msg.textContent = "";
  button.disabled = true;

  try {
    const res = await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);
    msg.className = "ok";
    msg.textContent = result.message;
    form.reset();
  } catch (err) {
    msg.className = "error";
    msg.textContent = err.message || "Something went wrong. Try again.";
  } finally {
    button.disabled = false;
  }
});

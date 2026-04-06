const weddingDate = new Date("2026-10-24T00:00:00-04:00");

const countdownParts = {
  days: document.getElementById("days"),
  hours: document.getElementById("hours"),
  minutes: document.getElementById("minutes"),
  seconds: document.getElementById("seconds"),
};

function updateCountdown() {
  const now = new Date();
  const diff = Math.max(weddingDate.getTime() - now.getTime(), 0);

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  countdownParts.days.textContent = String(days).padStart(3, "0");
  countdownParts.hours.textContent = String(hours).padStart(2, "0");
  countdownParts.minutes.textContent = String(minutes).padStart(2, "0");
  countdownParts.seconds.textContent = String(seconds).padStart(2, "0");
}

updateCountdown();
window.setInterval(updateCountdown, 1000);

const menuToggle = document.getElementById("menuToggle");
const siteNav = document.getElementById("siteNav");

function closeMenu() {
  menuToggle.setAttribute("aria-expanded", "false");
  siteNav.dataset.open = "false";
}

menuToggle.addEventListener("click", () => {
  const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
  menuToggle.setAttribute("aria-expanded", String(!isOpen));
  siteNav.dataset.open = String(!isOpen);
});

siteNav.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", closeMenu);
});

document.addEventListener("click", (event) => {
  if (!siteNav.contains(event.target) && !menuToggle.contains(event.target)) {
    closeMenu();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMenu();
  }
});

document.getElementById("calendarButton").addEventListener("click", () => {
  const calendarUrl =
    "https://calendar.google.com/calendar/render?action=TEMPLATE" +
    "&text=" + encodeURIComponent("Veronica & Lucas Wedding") +
    "&dates=20261024/20261025" +
    "&details=" + encodeURIComponent(
      "Save the date for Veronica and Lucas. Details will be updated at veronicaandlucas.com."
    );

  window.open(calendarUrl, "_blank", "noopener");
});

// Global variable: initially show 10 applicable weekdays; add 5 more on demand.
let daysToShow = 10;

// Returns the next day (set to midnight)
function getNextDay(date) {
  const next = new Date(date);
  next.setDate(date.getDate() + 1);
  next.setHours(0, 0, 0, 0);
  return next;
}

// Create the copy icon using an image element with src "./copy.svg"
function createCopyIcon() {
  const img = document.createElement("img");
  img.classList.add("copy-icon");
  img.src = "./copy.svg";
  img.alt = "";
  img.title = "Click to copy";
  return img;
}

// Display a temporary notification within the card.
function showCopyNotification(card) {
  const notif = document.createElement("div");
  notif.classList.add("copy-notification");
  notif.innerText = "Copied!";
  card.appendChild(notif);
  // Force reflow to trigger CSS transition.
  window.getComputedStyle(notif).opacity;
  notif.style.opacity = 1;
  setTimeout(() => {
    notif.style.opacity = 0;
    setTimeout(() => {
      card.removeChild(notif);
    }, 300);
  }, 1000);
}

// Update the schedule: always show the next N applicable weekdays.
function update(names) {
  if (names.length <= 1) return;

  const output = document.getElementById("out");
  output.innerHTML = "";

  let current = new Date();
  current.setHours(0, 0, 0, 0);
  let displayed = 0;

  // Loop until we've shown the desired number of applicable days.
  while (displayed < daysToShow) {
    // Check if current is a weekday (Monday=1 to Friday=5)
    if (current.getDay() >= 1 && current.getDay() <= 5) {
      // Calculate epoch (adjusted by timezone offset)
      const epoch = current.getTime() / 1000 - current.getTimezoneOffset() * 60;
      // Compute hash for each name
      const compares = names.map((name) =>
        CryptoJS.SHA512(name + epoch.toString()).toString(CryptoJS.enc.Hex)
      );
      // Order names based on hash
      const ordered = names.slice().sort((a, b) =>
        compares[names.indexOf(a)].localeCompare(compares[names.indexOf(b)])
      );

      // Create card for the day.
      const dayCard = document.createElement("div");
      dayCard.classList.add("day");
      if (displayed === 0) {
        dayCard.classList.add("today");
      }
      dayCard.innerHTML = `<h3>${current.toLocaleDateString(undefined, {
        weekday: "long",
        month: "short",
        day: "numeric",
      })}</h3>`;

      // Create and add the copy icon.
      const copyIcon = createCopyIcon();
      dayCard.appendChild(copyIcon);

      // Attach click event to copy icon.
      copyIcon.addEventListener("click", (e) => {
        e.stopPropagation();
        // Copy text: exclude any notification text.
        const textToCopy = dayCard.innerText.replace("Copied!", "").trim();
        navigator.clipboard.writeText(textToCopy)
          .then(() => {
            copyIcon.style.opacity = "0.6"; // subtle visual reaction
            showCopyNotification(dayCard);
            setTimeout(() => {
              copyIcon.style.opacity = "1";
            }, 500);
          })
          .catch((err) => {
            console.error("Error copying to clipboard: ", err);
          });
      });

      // Create container for the ordered names.
      const listContainer = document.createElement("div");
      ordered.forEach((n, index) => {
        const item = document.createElement("div");
        item.innerText = `${index + 1}. ${n}`;
        listContainer.appendChild(item);
      });
      dayCard.appendChild(listContainer);
      output.appendChild(dayCard);

      displayed++;
    }
    // Move to the next day regardless.
    current = getNextDay(current);
  }
}

// Toggle the display of the names textarea and heading.
const toggleBtn = document.getElementById("toggleNames");
toggleBtn.addEventListener("click", () => {
  const container = document.getElementById("nameContainer");
  const heading = document.getElementById("namesHeading");
  if (container.style.display === "none") {
    container.style.display = "block";
    heading.style.display = "block";
    toggleBtn.innerText = "Hide names";
  } else {
    container.style.display = "none";
    heading.style.display = "none";
    toggleBtn.innerText = "Edit names";
  }
});

// Load names from hash if present, and collapse the names area by default.
const h = window.location.hash;
if (h.startsWith("#")) {
  const namesText = atob(h.substr(1)).split(",").join("\n");
  document.getElementById("names").value = namesText;
  update(document.getElementById("names").value.split("\n"));
  document.getElementById("nameContainer").style.display = "none";
  document.getElementById("namesHeading").style.display = "none";
  toggleBtn.innerText = "Edit names";
}

// Update on textarea changes.
document.getElementById("names").addEventListener("input", () => {
  const names = document.getElementById("names").value.split("\n");
  window.location.hash = "#" + btoa(names.join(","));
  update(names);
});

// "Show More Days" button: add 5 applicable weekdays.
document.getElementById("showMore").addEventListener("click", () => {
  daysToShow += 5;
  const names = document.getElementById("names").value.split("\n");
  update(names);
});

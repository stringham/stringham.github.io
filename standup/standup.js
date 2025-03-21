// Global variable to track how many days to show (initially 10)
let daysToShow = 10;

function getNextDay(input) {
    const next = new Date(input);
    next.setDate(input.getDate() + 1);
    next.setHours(0, 0, 0, 0);
    return next;
}

function update(names) {
    if (names.length <= 1) {
        return;
    }

    const output = document.getElementById("out");
    output.innerHTML = "";

    let current = new Date();
    current.setHours(0, 0, 0, 0);

    // Loop through daysToShow days
    for (let i = 0; i < daysToShow; i++) {
        // Only consider weekdays (Monday to Friday)
        if (current.getDay() >= 1 && current.getDay() <= 5) {
            // Calculate epoch time adjusted by timezone offset
            const epoch = current.getTime() / 1000 - current.getTimezoneOffset() * 60;
            // Compute hash for each name
            const compares = names.map((name) => {
                return CryptoJS.SHA512(name + epoch.toString()).toString(CryptoJS.enc.Hex);
            });
            // Order names based on their hash
            const ordered = names.sort((a, b) => {
                return compares[names.indexOf(a)].localeCompare(compares[names.indexOf(b)]);
            });

            // Create day container
            const day = document.createElement("div");
            day.classList.add("day");
            if (i === 0) {
                day.classList.add("today");
            }
            day.innerHTML = `<h3>${current.toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric"
            })}</h3>`;
            output.appendChild(day);

            // Create a container for the ordered names
            const listContainer = document.createElement("div");
            day.appendChild(listContainer);
            ordered.forEach((n, index) => {
                const item = document.createElement("div");
                item.innerText = `${index + 1}. ${n}`;
                listContainer.appendChild(item);
            });

            // Add click/tap event to copy the day's content to the clipboard
            day.addEventListener("click", () => {
                const textToCopy = day.innerText;
                navigator.clipboard.writeText(textToCopy)
                    .then(() => {
                        // Optional: Provide a visual feedback (e.g., change color briefly)
                        day.style.backgroundColor = "#d4edda";
                        setTimeout(() => {
                            // Revert to original style based on day type
                            day.style.backgroundColor = day.classList.contains("today") ? "#e9f2ff" : "#fff";
                        }, 500);
                    })
                    .catch((err) => {
                        console.error("Error copying to clipboard: ", err);
                    });
            });
        }

        current = getNextDay(current);
    }
}

// Load names from hash if present
const h = window.location.hash;
if (h.startsWith("#")) {
    const namesText = atob(h.substr(1)).split(",").join("\n");
    document.getElementById("names").value = namesText;
    update(document.getElementById("names").value.split("\n"));
}

// Update on input changes
document.getElementById("names").addEventListener("input", () => {
    const names = document.getElementById("names").value.split("\n");
    window.location.hash = '#' + btoa(names.join(','));
    update(names);
});

// Event listener for the "Show More Days" button
document.getElementById("showMore").addEventListener("click", () => {
    daysToShow += 5;
    const names = document.getElementById("names").value.split("\n");
    update(names);
});

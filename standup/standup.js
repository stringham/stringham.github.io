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
    for (let i = 0; i < 10; i++) {
        if (current.getDay() >= 1 && current.getDay() <= 5) {
            const epoch =
                current.getTime() / 1000 - current.getTimezoneOffset() * 60;
            const compares = names.map((name) => {
                return CryptoJS.SHA512(name + epoch.toString()).toString(
                    CryptoJS.enc.Hex
                );
            });
            const ordered = names.sort((a, b) => {
                return compares[names.indexOf(a)].localeCompare(
                    compares[names.indexOf(b)]
                );
            });

            const day = document.createElement("div");
            day.classList.add("day");
            if (i === 0) {
                day.classList.add("today");
            }
            day.innerHTML = `<h3>${current.toLocaleDateString(undefined, {
                weekday: "long",
                month: "short",
                day: "numeric",
            })}</h3>`;
            output.appendChild(day);

            const ol = document.createElement("ol");
            day.appendChild(ol);
            for (const n of ordered) {
                const current = document.createElement("li");
                current.innerText = n;
                ol.appendChild(current);
            }
        }

        current = getNextDay(current);
    }
}

const h = window.location.hash;
if (h.startsWith("#")) {
    document.getElementById("names").value = atob(h.substr(1))
        .split(",")
        .join("\n");
    update(document.getElementById("names").value.split("\n"));
}

document.getElementById("names").addEventListener("input", () => {
    const names = document.getElementById("names").value.split("\n");
    window.location.hash = '#' + btoa(names.join(','));
    update(names);
});

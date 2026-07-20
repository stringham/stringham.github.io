const simplex = new SimplexNoise();
let noiseOffsetX = Math.random() * 10000;
let noiseOffsetY = Math.random() * 10000;

function generateNewPattern() {
    noiseOffsetX = Math.random() * 10000;
    noiseOffsetY = Math.random() * 10000;
    generateQR();
}

// Triggered by the UI for the standard display canvas
function generateQR() {
    const canvas = document.getElementById("qrCanvas");
    renderQR(canvas, null);
}

// Triggered by the Download button to render a massive off-screen version
function downloadQR() {
    const tempCanvas = document.createElement("canvas");
    // Pass 2000 to force the export size
    renderQR(tempCanvas, 2000);

    const link = document.createElement("a");
    link.download = "custom-qr-code.png";
    link.href = tempCanvas.toDataURL("image/png");
    link.click();
}

// Centralized drawing logic so it can scale to any canvas size dynamically
function renderQR(canvas, targetSize) {
    const text =
        document.getElementById("qrText").value || "https://q.doodledisc.com/i";
    const shape = document.getElementById("shapeSelect").value;

    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();

    const moduleCount = qr.getModuleCount();
    const margin = 2;

    let cellSize;
    if (targetSize) {
        // If a target size (e.g., 2000) is provided, dynamically scale the cell size
        cellSize = targetSize / (moduleCount + margin * 2);
        canvas.width = targetSize;
        canvas.height = targetSize;
    } else {
        // Standard default viewing size
        cellSize = 12;
        const canvasSize = (moduleCount + margin * 2) * cellSize;
        canvas.width = canvasSize;
        canvas.height = canvasSize;
    }

    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#15183b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const palette = [
        "#4aa8b4",
        "#6bb487",
        "#448faf",
        "#92609b",
        "#bb698c",
        "#f7e082",
    ];

    function isEyeArea(r, c) {
        return (
            (r < 7 && c < 7) ||
            (r < 7 && c >= moduleCount - 7) ||
            (r >= moduleCount - 7 && c < 7)
        );
    }

    const sliderVal = document.getElementById("clusterSlider").value;
    const scale = 2.0 - (sliderVal / 100) * 1.95;

    for (let row = 0; row < moduleCount; row++) {
        for (let col = 0; col < moduleCount; col++) {
            if (isEyeArea(row, col)) continue;

            if (qr.isDark(row, col)) {
                const noiseVal = simplex.noise2D(
                    col * scale + noiseOffsetX,
                    row * scale + noiseOffsetY,
                );
                const normalizedNoise = (noiseVal + 1) / 2;
                let colorIndex = Math.floor(normalizedNoise * palette.length);

                if (colorIndex >= palette.length)
                    colorIndex = palette.length - 1;
                if (colorIndex < 0) colorIndex = 0;

                ctx.fillStyle = palette[colorIndex];

                const cx = (col + margin) * cellSize + cellSize / 2;
                const cy = (row + margin) * cellSize + cellSize / 2;

                ctx.beginPath();

                if (shape === "circle") {
                    ctx.arc(cx, cy, cellSize * 0.38, 0, Math.PI * 2);
                } else {
                    // Reduced from 0.85 to 0.72 to match the less bulky reference
                    const rectSize = cellSize * 0.72;
                    const radius = cellSize * 0.22;
                    ctx.roundRect(
                        cx - rectSize / 2,
                        cy - rectSize / 2,
                        rectSize,
                        rectSize,
                        radius,
                    );
                }

                ctx.fill();
            }
        }
    }

    function drawEye(startRow, startCol, gradientColors, rotate) {
        const cx = (startCol + 3.5 + margin) * cellSize;
        const cy = (startRow + 3.5 + margin) * cellSize;

        const grad = ctx.createLinearGradient(
            cx + (rotate ? -3.5 : 3.5) * cellSize,
            cy - 3.5 * cellSize,
            cx - (rotate ? -3.5 : 3.5) * cellSize,
            cy + 3.5 * cellSize,
        );
        grad.addColorStop(0, gradientColors[0]);
        grad.addColorStop(0.5, gradientColors[1]);
        grad.addColorStop(1, gradientColors[2]);

        ctx.strokeStyle = grad;
        ctx.lineWidth = cellSize * 0.9;
        ctx.beginPath();
        ctx.arc(cx, cy, cellSize * 2.9, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, cellSize * 1.4, 0, Math.PI * 2);
        ctx.fill();
    }

    drawEye(0, 0, ["#50c5cc", "#7383c2", "#a265aa"], true);
    drawEye(0, moduleCount - 7, ["#a664aa", "#e6848c", "#fde48b"]);
    drawEye(moduleCount - 7, 0, ["#fde48b", "#e6848c", "#a664aa"]);
}

window.onload = generateQR;

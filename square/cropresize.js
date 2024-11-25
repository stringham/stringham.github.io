class Cropper {
    constructor(file, border, timestamp, parent) {
        // Create a container for the cropper
        this.container = document.createElement('div');
        this.container.style.position = 'relative';
        this.container.style.display = 'inline-block';
        this.container.style.margin = '10px';
        parent.appendChild(this.container);

        // Create the canvas
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);

        // Create and style the rotation button
        this.rotationButton = document.createElement('button');
        this.rotationButton.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 2V8M21 8H15M21 8L18.3597 5.63067C16.9787 4.25209 15.187 3.35964 13.2547 3.08779C11.3223 2.81593 9.35394 3.17941 7.64612 4.12343C5.93831 5.06746 4.58358 6.54091 3.78606 8.32177C2.98854 10.1026 2.79143 12.0944 3.22442 13.997C3.65742 15.8996 4.69707 17.61 6.18673 18.8704C7.67638 20.1308 9.53534 20.873 11.4835 20.9851C13.4317 21.0972 15.3635 20.5732 16.988 19.492C18.6124 18.4108 19.8414 16.831 20.4899 14.9907" stroke="#001A72" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>`;
        this.rotationButton.style.position = 'absolute';
        this.rotationButton.style.top = '10px';
        this.rotationButton.style.right = '10px';
        this.rotationButton.style.zIndex = '10';
        this.rotationButton.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        this.rotationButton.style.border = 'none';
        this.rotationButton.style.borderRadius = '50%';
        this.rotationButton.style.width = '30px';
        this.rotationButton.style.height = '30px';
        this.rotationButton.style.cursor = 'pointer';
        this.rotationButton.style.display = 'flex';
        this.rotationButton.style.alignItems = 'center';
        this.rotationButton.style.justifyContent = 'center';
        this.rotationButton.style.fontSize = '18px';
        this.rotationButton.style.boxShadow = '0px 2px 5px rgba(0, 0, 0, 0.2)';

        // Append the button to the container
        this.container.appendChild(this.rotationButton);

        // Attach click event listener
        this.rotationButton.addEventListener('click', () => this.modifyRotation());

        // Existing initialization logic
        this.url = URL.createObjectURL(file);
        this.size = 300;
        this.name = file.name.split('.')[0];
        this.canvas.width = this.size;
        this.canvas.height = this.size;

        this.img = new Image();
        this.position = { x: 0, y: 0 };
        this.offset = { x: 0, y: 0 };
        this.imgSize = 0;
        this.maxImgSize = 0;
        this.border = border;
        this.timestamp = timestamp;
        this.time = '';
        this.exifOrientation = 1;
        this.shouldRotate = getComputedStyle(document.body)['imageOrientation'] !== 'from-image';

        this.img.onload = async () => {
            this.width = this.img.naturalWidth;
            this.height = this.img.naturalHeight;
            this.imgSize = Math.min(this.width, this.height);
            this.maxImgSize = this.imgSize;
            try {
                this.time = await getTime(this.img, this.name);
                this.exifOrientation = await getExifOrientation(this.img);
            } finally {
                this.render();
            }
        };

        this.img.src = this.url;

        // Mouse and wheel event listeners
        this.canvas.addEventListener('mousedown', this.mousedown.bind(this));
        document.addEventListener('mousemove', this.mousemove.bind(this));
        document.addEventListener('mouseup', this.mouseup.bind(this));
        this.canvas.addEventListener('wheel', this.mousewheel.bind(this));
        this.canvas.addEventListener('dblclick', this.editTimestamp.bind(this));
    }

    modifyRotation() {
        const orientations = [1, 6, 3, 8];
        const index = orientations.indexOf(this.exifOrientation);
        this.exifOrientation = orientations[(index + 1) % 4];
        // this.exifOrientation = [1,3,6,8](this.exifOrientation % 8) + 1;
        this.shouldRotate = true;
        this.render();
    }

    rotate(ctx, canvas) {
        if (this.shouldRotate && this.exifOrientation != 1) {
            ctx.translate(canvas.height / 2, canvas.height / 2);
            if (this.exifOrientation == 6 || this.exifOrientation == 7) {
                ctx.rotate(Math.PI / 2);
            } else if (this.exifOrientation == 8 || this.exifOrientation == 5) {
                ctx.rotate(-Math.PI / 2);
            } else if (this.exifOrientation == 3 || this.exifOrientation == 4) {
                ctx.rotate(Math.PI);
            }
            if (this.exifOrientation in { 4: true, 5: true, 7: true, 2: true }) {
                ctx.scale(-1, 1);
            }
            ctx.translate(-canvas.height / 2, -canvas.height / 2);
        }
    }

    getBlob(useFourBySix) {
        const maxSize = 1200; // 4x4 inch at 300dpi
        const canvas = document.createElement('canvas');
        const border = this.border * this.imgSize / this.size;
        const finalSize = Math.min(maxSize, this.imgSize + 2 * border);
        const finalBorder = finalSize * this.border / this.size;
        const finalImageSize = finalSize - finalBorder * 2;
        const scale = finalBorder / this.border;
        canvas.width = useFourBySix ? finalSize * 3 / 2 : finalSize;
        canvas.height = finalSize;
        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        let x = Math.round(this.position.x + this.offset.x);
        let y = Math.round(this.position.y + this.offset.y);
        x = Math.min(this.width - this.imgSize, Math.max(0, x));
        y = Math.min(this.height - this.imgSize, Math.max(0, y));
        this.rotate(ctx, canvas);
        ctx.drawImage(this.img, x, y, this.imgSize, this.imgSize, finalBorder, finalBorder, finalImageSize, finalImageSize);
        ctx.restore();
        if (this.timestamp) {
            this.drawTimestamp(ctx, finalSize, scale);
        }
        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                resolve({ name: this.name, blob });
            }, 'image/jpeg', 1);
        });
    }

    setBorder(border) {
        this.border = border;
        this.render();
    }

    setTimestamp(timestamp) {
        this.timestamp = timestamp;
        this.render();
    }

    mousewheel(e) {
        e.preventDefault();
        const oldImgSize = this.imgSize;
        this.imgSize += e.deltaY;
        this.imgSize = Math.min(this.maxImgSize, this.imgSize);
        this.imgSize = Math.max(400, this.imgSize);

        this.position.x += (oldImgSize - this.imgSize) / 2;
        this.position.y += (oldImgSize - this.imgSize) / 2;
        this.render();
    }

    render() {
        this.ctx.save();
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.size, this.size);
        this.ctx.imageSmoothingEnabled = false;
        let x = Math.round(this.position.x + this.offset.x);
        let y = Math.round(this.position.y + this.offset.y);
        x = Math.min(this.width - this.imgSize, Math.max(0, x));
        y = Math.min(this.height - this.imgSize, Math.max(0, y));
        this.rotate(this.ctx, this.canvas);
        this.ctx.drawImage(this.img, x, y, this.imgSize, this.imgSize, this.border, this.border, this.size - this.border * 2, this.size - this.border * 2);
        this.ctx.restore();
        if (this.timestamp) {
            this.drawTimestamp(this.ctx, this.size, 1);
        }
    }

    drawTimestamp(ctx, size, scale) {
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.round(12 * scale)}px 'Source Sans Pro'`;

        const metrics = ctx.measureText(this.time);
        const textWidth = metrics.width;
        const padding = 5 * scale;

        // Calculate the position for the bottom-right corner
        const x = size - this.border * scale - textWidth - padding;
        const y = size - this.border * scale - padding;

        ctx.fillText(this.time, x, y);
        ctx.restore();
    }

    mousedown(e) {
        this.dragging = true;
        this.anchor = { x: e.clientX, y: e.clientY };
    }

    mousemove(e) {
        if (this.dragging) {
            const scale = this.imgSize / (this.size - 2 * this.border);
            this.offset = {
                x: scale * (this.anchor.x - e.clientX),
                y: scale * (this.anchor.y - e.clientY)
            };
            if(this.shouldRotate) {
                if(this.exifOrientation == 6) {
                    this.offset = {
                        x: scale * (this.anchor.y - e.clientY),
                        y: scale * (e.clientX - this.anchor.x)
                    };
                } else if(this.exifOrientation == 8) {
                    this.offset = {
                        x: scale * (e.clientY - this.anchor.y),
                        y: scale * (this.anchor.x - e.clientX)
                    };
                } else if(this.exifOrientation == 3) {
                    this.offset = {
                        x: scale * (e.clientX - this.anchor.x),
                        y: scale * (e.clientY - this.anchor.y)
                    };
                }
            }
            this.render();
        }
    }

    mouseup(e) {
        if (this.dragging) {
            this.dragging = false;
            this.position.x += this.offset.x;
            this.position.y += this.offset.y;
            this.position.x = Math.min(this.width - this.imgSize, Math.max(0, this.position.x));
            this.position.y = Math.min(this.height - this.imgSize, Math.max(0, this.position.y));
            this.offset = { x: 0, y: 0 };
            this.render();
        }
    }

    handleDoubleTap(e) {
        // Handle double-tap to edit the timestamp
        const now = new Date().getTime();
        if (now - this.lastTap < 300) {
            this.editTimestamp(e);
        }
        this.lastTap = now;
    }

    editTimestamp(e) {
        // Create and show an input field for editing the timestamp
        const input = document.createElement('input');
        input.type = 'text';
        input.value = this.time;
        input.style.position = 'absolute';
        input.style.top = `${e.clientY + window.scrollY}px`;
        input.style.left = `${e.clientX + window.scrollX}px`;
        document.body.appendChild(input);
        input.select();

        input.addEventListener('blur', () => {
            if (input.value === '') {
                this.time = this.originalTime; // Revert to original time if cleared
            } else {
                this.time = input.value;
            }
            document.body.removeChild(input);
            this.render(); // Re-render the cropper to update the timestamp
        });

        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                input.blur();
            }
        });

        input.focus();
    }
}


class Manager {
    constructor() {
        this.container = document.createElement('div');
        document.body.appendChild(this.container);

        this.cropperContainer = document.createElement('div');
        this.container.appendChild(this.cropperContainer);

        this.croppers = [];
        this.useFourBySix = true;
    }

    addFile(file) {
        this.croppers.push(new Cropper(file, size.value, timestamp.checked, this.cropperContainer));
    }

    async save() {
        const blobs = await Promise.all(this.croppers.map(cropper => cropper.getBlob(this.useFourBySix)));
        const zip = new JSZip();

        blobs.forEach(({ name, blob }) => {
            zip.file(`${name}.jpg`, blob);
        });

        const zipBlob = await zip.generateAsync({ type: "blob" });
        saveAs(zipBlob, "photos.zip"); // Assuming saveAs is a global function provided by FileSaver.js
    }
}

const getExifOrientation = async (img) => {
    return new Promise(resolve => {
        EXIF.getData(img, function () {
            resolve(EXIF.getTag(this, 'Orientation') || 1);
        });
    });
};

const getTime = async (img, name) => {
    const getFromName = (name) => {
        const match = name.match(/[^\d](20[0-2]\d)([0-1]\d)([0-3]\d)/);
        if (match) {
            const [, year, month, day] = match;
            return `${month.replace(/^0+/, '')}/${day.replace(/^0+/, '')}/${year}`;
        }
        return '';
    };

    const timeFromName = getFromName(name);
    if (timeFromName) {
        return timeFromName;
    }

    return new Promise(resolve => {
        EXIF.getData(img, function () {
            try {
                const created = EXIF.getTag(this, 'DateTimeOriginal');
                if (!created) {
                    resolve('');
                } else {
                    const [year, month, day] = created.split(' ')[0].split(':');
                    resolve(`${month.replace(/^0+/, '')}/${day.replace(/^0+/, '')}/${year}`);
                }
            } catch (e) {
                resolve('');
            }
        });
    });
};




var manager;
var size;
var timestamp;
var fourBySix;

document.addEventListener("DOMContentLoaded", function(event) {
	var select = document.getElementById('select');
	size = document.getElementById('bordersize');
	timestamp = document.getElementById('timestamp');
	fourBySix = document.getElementById('four-by-six');

	manager = new Manager();

	size.addEventListener('change', function(e) {
		manager.croppers.forEach(function(c) {
			c.setBorder(size.value);
		})
	})

	timestamp.addEventListener('change', () => {
		manager.croppers.forEach(c => c.setTimestamp(timestamp.checked))
	});

    fourBySix.addEventListener('change', () => {
		manager.useFourBySix = fourBySix.checked;
	});

	select.addEventListener('change', function(e){
		for(var i=0; i<select.files.length; i++) {
			manager.addFile(select.files[i]);
		}
	})
});
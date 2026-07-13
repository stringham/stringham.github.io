"use strict";

window.Cropper = class Cropper {
    constructor(file, settings, parent, onDelete, onSelect) {
        this.onDelete = onDelete;
        this.onSelect = onSelect;
        this.fileName = file.name;
        this.settings = { ...settings };

        this.container = document.createElement('div');
        this.container.className = 'cropper-card';
        parent.appendChild(this.container);

        const header = document.createElement('div');
        header.className = 'card-header';
        header.innerHTML = `<span class="filename" title="${this.fileName}">${this.fileName}</span>`;
        this.container.appendChild(header);

        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.container.appendChild(this.canvas);

        const footer = document.createElement('div');
        footer.className = 'card-footer';
        this.container.appendChild(footer);

        this.rotationButton = document.createElement('button');
        this.rotationButton.className = 'tool-btn';
        this.rotationButton.title = "Rotate Image";
        this.rotationButton.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M21 2V8M21 8H15M21 8L18.3597 5.63067C16.9787 4.25209 15.187 3.35964 13.2547 3.08779C11.3223 2.81593 9.35394 3.17941 7.64612 4.12343C5.93831 5.06746 4.58358 6.54091 3.78606 8.32177C2.98854 10.1026 2.79143 12.0944 3.22442 13.997C3.65742 15.8996 4.69707 17.61 6.18673 18.8704C7.67638 20.1308 9.53534 20.873 11.4835 20.9851C13.4317 21.0972 15.3635 20.5732 16.988 19.492C18.6124 18.4108 19.8414 16.831 20.4899 14.9907" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg> Rotate`;
        footer.appendChild(this.rotationButton);

        this.rotationButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.modifyRotation();
        });

        this.deleteButton = document.createElement('button');
        this.deleteButton.className = 'tool-btn delete';
        this.deleteButton.title = "Remove Image";
        this.deleteButton.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
        </svg> Remove`;
        footer.appendChild(this.deleteButton);

        this.deleteButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.destroy();
        });

        this.url = URL.createObjectURL(file);
        this.size = 300;
        this.dpr = window.devicePixelRatio || 1;
        this.name = file.name.split('.')[0];

        this.canvas.width = this.size * this.dpr;
        this.canvas.height = this.size * this.dpr;
        this.canvas.style.width = `${this.size}px`;
        this.canvas.style.height = `${this.size}px`;
        this.ctx.scale(this.dpr, this.dpr);

        this.img = new Image();
        this.position = { x: 0, y: 0 };
        this.offset = { x: 0, y: 0 };
        this.imgSize = 0;
        this.maxImgSize = 0;

        this.time = '';
        this.originalTime = '';
        this.exifOrientation = 1;
        this.shouldRotate = getComputedStyle(document.body)['imageOrientation'] !== 'from-image';

        this.isSelected = false;
        this.isHovered = false;

        this.img.onload = async () => {
            this.width = this.img.naturalWidth;
            this.height = this.img.naturalHeight;
            this.imgSize = Math.min(this.width, this.height);
            this.maxImgSize = this.imgSize;
            try {
                this.time = await window.Utils.getTime(this.img, this.name);
                this.originalTime = this.time;
            } finally {
                this.load();
                this.render();
            }
        };

        this.img.src = this.url;
        this.attachListeners();
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.render();
    }

    attachListeners() {
        this.canvas.addEventListener('mousedown', this.mousedown.bind(this));
        document.addEventListener('mousemove', this.mousemove.bind(this));
        document.addEventListener('mouseup', this.mouseup.bind(this));
        this.canvas.addEventListener('wheel', this.mousewheel.bind(this));

        this.canvas.addEventListener('touchstart', this.touchstart.bind(this), { passive: false });
        document.addEventListener('touchmove', this.touchmove.bind(this), { passive: false });
        document.addEventListener('touchend', this.touchend.bind(this));

        this.container.addEventListener('click', (e) => {
            if (e.target.tagName === 'INPUT') return;
            e.stopPropagation();
            this.select();
        });

        this.container.addEventListener('mouseenter', () => {
            this.isHovered = true;
            this.render();
        });
        this.container.addEventListener('mouseleave', () => {
            this.isHovered = false;
            this.render();
        });

        this.canvas.addEventListener('dblclick', this.editTimestamp.bind(this));
    }

    select() {
        if(this.isSelected) return;
        this.onSelect(this);
        this.isSelected = true;
        this.container.classList.add('selected');
        this.render();
    }

    deselect() {
        if(!this.isSelected) return;
        this.isSelected = false;
        this.container.classList.remove('selected');
        this.render();
    }

    destroy() {
        this.container.remove();
        if (this.url) {
            URL.revokeObjectURL(this.url);
        }
        if (this.onDelete) this.onDelete(this);
    }

    getId() {
        return [this.fileName, this.width, this.height].join(',');
    }

    save() {
        localStorage.setItem(this.getId(), JSON.stringify({
            position: this.position,
            imgSize: this.imgSize,
            time: this.time
        }));
    }

    load() {
        const data = JSON.parse(localStorage.getItem(this.getId()));
        if (data) {
            this.position = data.position;
            this.imgSize = data.imgSize;
            this.time = data.time;
            this.render();
        }
    }

    modifyRotation() {
        const orientations = [1, 6, 3, 8];
        const index = orientations.indexOf(this.exifOrientation);
        this.exifOrientation = orientations[(index + 1) % 4];
        this.shouldRotate = true;
        this.render();
    }

    rotate(ctx, canvasWidth, canvasHeight) {
        if (this.shouldRotate && this.exifOrientation != 1) {
            ctx.translate(canvasWidth / 2, canvasHeight / 2);
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
            ctx.translate(-canvasWidth / 2, -canvasHeight / 2);
        }
    }

    nudge(dx, dy) {
        const border = this.settings.border;
        const scale = (this.size - 2 * border) / this.imgSize;
        this.position.x += dx / scale;
        this.position.y += dy / scale;
        this.clamp();
        this.render();
        this.save();
    }

    clamp() {
        this.position.x = Math.min(this.width - this.imgSize, Math.max(0, this.position.x));
        this.position.y = Math.min(this.height - this.imgSize, Math.max(0, this.position.y));
    }

    getBlob(useFourBySix) {
        const maxSize = 1200;
        const canvas = document.createElement('canvas');
        const borderVal = parseInt(this.settings.border) || 20;

        const border = borderVal * this.imgSize / this.size;
        const finalSize = Math.min(maxSize, this.imgSize + 2 * border);
        const finalBorder = finalSize * borderVal / this.size;
        const finalImageSize = finalSize - finalBorder * 2;
        const scale = finalBorder / borderVal;

        canvas.width = useFourBySix ? finalSize * 3 / 2 : finalSize;
        canvas.height = finalSize;

        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if(useFourBySix) {
            ctx.save();
            ctx.beginPath();
            const relativeOffset = finalSize * 0.002;
            const relativeLineWidth = Math.max(1, finalSize * 0.001);
            const dashSize = finalSize * 0.015;
            const gapSize = finalSize * 0.01;
            const cutX = finalSize + relativeOffset;

            ctx.strokeStyle = "#999999";
            ctx.lineWidth = relativeLineWidth;
            ctx.setLineDash([dashSize, gapSize]);
            ctx.moveTo(cutX, 0);
            ctx.lineTo(cutX, canvas.height);
            ctx.stroke();
            ctx.restore();
        }

        let x = Math.round(this.position.x + this.offset.x);
        let y = Math.round(this.position.y + this.offset.y);
        x = Math.min(this.width - this.imgSize, Math.max(0, x));
        y = Math.min(this.height - this.imgSize, Math.max(0, y));

        if (this.settings.useBrightness) {
            ctx.filter = 'brightness(1.15)';
        }

        ctx.save();
        const cx = finalBorder + finalImageSize / 2;
        const cy = finalBorder + finalImageSize / 2;

        if (this.shouldRotate && this.exifOrientation != 1) {
            ctx.translate(cx, cy);
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
            ctx.translate(-cx, -cy);
        }

        ctx.drawImage(this.img, x, y, this.imgSize, this.imgSize, finalBorder, finalBorder, finalImageSize, finalImageSize);
        ctx.restore();

        ctx.filter = 'none';
        ctx.restore();

        if (this.settings.timestamp) {
            this.drawTimestamp(ctx, finalSize, scale);
        }
        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                resolve({ name: this.name, blob });
            }, 'image/jpeg', 1.0);
        });
    }

    setTimestamp(timestamp) {
        this.settings.timestamp = timestamp;
        this.render();
    }

    mousewheel(e) {
        e.preventDefault();
        const oldImgSize = this.imgSize;
        const zoomFactor = 0.1;

        if (e.deltaY < 0) {
            this.imgSize = this.imgSize * (1 - zoomFactor);
        } else {
            this.imgSize = this.imgSize * (1 + zoomFactor);
        }

        this.imgSize = Math.min(this.maxImgSize, this.imgSize);
        this.imgSize = Math.max(100, this.imgSize);

        const diff = oldImgSize - this.imgSize;
        this.position.x += diff / 2;
        this.position.y += diff / 2;

        this.clamp();
        this.render();
        this.save();
    }

    render() {
        if (!this.width) return;
        const border = parseInt(this.settings.border) || 20;

        this.ctx.save();
        this.ctx.clearRect(0, 0, this.size, this.size);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.size, this.size);

        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'medium';

        let x = Math.round(this.position.x + this.offset.x);
        let y = Math.round(this.position.y + this.offset.y);
        x = Math.min(this.width - this.imgSize, Math.max(0, x));
        y = Math.min(this.height - this.imgSize, Math.max(0, y));

        if (this.settings.useBrightness) {
            this.ctx.filter = 'brightness(1.15)';
        }

        this.rotate(this.ctx, this.size, this.size);
        this.ctx.drawImage(this.img, x, y, this.imgSize, this.imgSize, border, border, this.size - border * 2, this.size - border * 2);
        this.ctx.filter = 'none';
        this.ctx.restore();

        if (this.isSelected || this.isHovered || this.dragging) {
            this.drawGrid(border);
        }

        if (this.settings.timestamp) {
            this.drawTimestamp(this.ctx, this.size, 1);
        }
    }

    drawGrid(border) {
        const ctx = this.ctx;
        const s = this.size - 2 * border;

        ctx.save();
        ctx.beginPath();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 3]);

        ctx.moveTo(border + s / 3, border);
        ctx.lineTo(border + s / 3, border + s);
        ctx.moveTo(border + 2 * s / 3, border);
        ctx.lineTo(border + 2 * s / 3, border + s);

        ctx.moveTo(border, border + s / 3);
        ctx.lineTo(border + s, border + s / 3);
        ctx.moveTo(border, border + 2 * s / 3);
        ctx.lineTo(border + s, border + 2 * s / 3);

        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 2;
        ctx.stroke();
        ctx.restore();
    }

    drawTimestamp(ctx, size, scale) {
        const border = parseInt(this.settings.border) || 20;

        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 4;
        ctx.fillStyle = '#ffffff';
        ctx.font = `${Math.round(14 * scale)}px 'Source Sans Pro', sans-serif`;

        const metrics = ctx.measureText(this.time);
        const textWidth = metrics.width;
        const padding = 8 * scale;

        const x = size - border * scale - textWidth - padding;
        const y = size - border * scale - padding;

        ctx.fillText(this.time, x, y);
        ctx.restore();
    }

    mousedown(e) {
        e.preventDefault();
        e.stopPropagation();
        this.select();
        this.dragging = true;
        this.anchor = { x: e.clientX, y: e.clientY };
    }

    mousemove(e) {
        if (this.dragging) {
            this.handleDragMove(e.clientX, e.clientY);
        }
    }

    mouseup(e) {
        if (this.dragging) {
            this.dragging = false;
            this.commitDrag();
        }
    }

    touchstart(e) {
        if(e.touches.length === 1) {
            e.preventDefault();
            e.stopPropagation();
            this.select();
            this.dragging = true;
            this.anchor = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
    }

    touchmove(e) {
        if (this.dragging && e.touches.length === 1) {
            e.preventDefault();
            this.handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    }

    touchend(e) {
        if (this.dragging) {
            this.dragging = false;
            this.commitDrag();
        }
    }

    handleDragMove(clientX, clientY) {
        const border = this.settings.border;
        const scale = this.imgSize / (this.size - 2 * border);
        this.offset = {
            x: scale * (this.anchor.x - clientX),
            y: scale * (this.anchor.y - clientY)
        };

        if(this.shouldRotate) {
             if(this.exifOrientation == 6) {
                this.offset = {
                    x: scale * (this.anchor.y - clientY),
                    y: scale * (clientX - this.anchor.x)
                };
            } else if(this.exifOrientation == 8) {
                this.offset = {
                    x: scale * (clientY - this.anchor.y),
                    y: scale * (this.anchor.x - clientX)
                };
            } else if(this.exifOrientation == 3) {
                this.offset = {
                    x: scale * (clientX - this.anchor.x),
                    y: scale * (clientY - this.anchor.y)
                };
            }
        }
        this.render();
    }

    commitDrag() {
        this.position.x += this.offset.x;
        this.position.y += this.offset.y;
        this.clamp();
        this.offset = { x: 0, y: 0 };
        this.save();
        this.render();
    }

    editTimestamp(e) {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = this.time;
        input.style.position = 'absolute';
        input.style.zIndex = '1000';
        input.style.top = `${e.clientY + window.scrollY}px`;
        input.style.left = `${e.clientX + window.scrollX}px`;
        input.style.padding = '5px';
        input.style.border = '1px solid #001A72';

        document.body.appendChild(input);
        input.select();

        const close = () => {
             if (input.value === '') this.time = this.originalTime || '';
             else this.time = input.value;

            if(document.body.contains(input)) document.body.removeChild(input);
            this.render();
            this.save();
        }

        input.addEventListener('blur', close);
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') input.blur();
        });
        input.focus();
    }
}

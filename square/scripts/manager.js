"use strict";

class Manager {
    constructor() {
        this.cropperContainer = document.getElementById('cropper-grid');
        this.croppers = [];
        this.selectedCropper = null;

        this.ui = {
            border: document.getElementById('bordersize'),
            timestamp: document.getElementById('timestamp'),
            fourBySix: document.getElementById('four-by-six'),
            brighten: document.getElementById('brighten'),
            select: document.getElementById('select'),
            count: document.getElementById('photo-count'),
            saveBtn: document.getElementById('save')
        };

        this.settings = {
            border: parseInt(this.ui.border.value) || 20,
            timestamp: this.ui.timestamp.checked,
            useBrightness: this.ui.brighten.checked,
            useFourBySix: this.ui.fourBySix.checked
        };

        this.setupDragDrop();
        this.setupKeyboard();
        this.setupGlobalClick();
        this.setupListeners();
    }

    setupListeners() {
        this.ui.border.addEventListener('change', () => this.updateSetting('border', parseInt(this.ui.border.value) || 0));
        this.ui.timestamp.addEventListener('change', () => this.updateSetting('timestamp', this.ui.timestamp.checked));
        this.ui.brighten.addEventListener('change', () => this.updateSetting('useBrightness', this.ui.brighten.checked));
        this.ui.fourBySix.addEventListener('change', () => this.updateSetting('useFourBySix', this.ui.fourBySix.checked));

        this.ui.select.addEventListener('change', (e) => {
            for(let i=0; i < this.ui.select.files.length; i++) {
                const file = this.ui.select.files[i];
                if (file.type.startsWith('image/')) {
                    this.addFile(file);
                }
            }
            this.ui.select.value = '';
        });

        this.ui.saveBtn.addEventListener('click', () => this.save());
    }

    updateSetting(key, value) {
        this.settings[key] = value;
        this.croppers.forEach(c => c.updateSettings({ [key]: value }));
    }

    updateCount() {
        const count = this.croppers.length;
        if(this.ui.count) {
            this.ui.count.innerText = `${count} Photo${count !== 1 ? 's' : ''}`;
        }
    }

    addFile(file) {
        const onDelete = (cropperInstance) => {
            const index = this.croppers.indexOf(cropperInstance);
            if (index > -1) this.croppers.splice(index, 1);
            if (this.selectedCropper === cropperInstance) this.selectedCropper = null;
            this.updateCount();
        };

        const onSelect = (cropperInstance) => {
            if (this.selectedCropper && this.selectedCropper !== cropperInstance) {
                this.selectedCropper.deselect();
            }
            this.selectedCropper = cropperInstance;
        };

        const cropper = new window.Cropper(file, this.settings, this.cropperContainer, onDelete, onSelect);
        this.croppers.push(cropper);
        this.updateCount();
    }

    setupGlobalClick() {
        document.addEventListener('click', (e) => {
            if (this.selectedCropper && !e.target.closest('.cropper-card')) {
                this.selectedCropper.deselect();
                this.selectedCropper = null;
            }
        });
    }

    setupDragDrop() {
        const body = document.body;

        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            body.addEventListener(eventName, preventDefaults, false);
        });

        function preventDefaults(e) {
            e.preventDefault();
            e.stopPropagation();
        }

        body.addEventListener('dragenter', () => body.classList.add('drag-active'));
        body.addEventListener('dragleave', (e) => {
            if (e.clientX === 0 && e.clientY === 0) {
                 body.classList.remove('drag-active');
            }
        });

        body.addEventListener('drop', (e) => {
            body.classList.remove('drag-active');
            const files = e.dataTransfer.files;
            for(let i = 0; i < files.length; i++) {
                if(files[i].type.startsWith('image/')) {
                    this.addFile(files[i]);
                }
            }
        });
    }

    setupKeyboard() {
        document.addEventListener('keydown', (e) => {
            if (!this.selectedCropper) return;
            if (e.target.tagName === 'INPUT') return;

            const shift = e.shiftKey ? 10 : 1;

            switch(e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    this.selectedCropper.nudge(-shift, 0);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this.selectedCropper.nudge(shift, 0);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.selectedCropper.nudge(0, -shift);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.selectedCropper.nudge(0, shift);
                    break;
                case 'Delete':
                case 'Backspace':
                    this.selectedCropper.destroy();
                    break;
            }
        });
    }

    async save() {
        if (this.croppers.length === 0) {
            alert("No images to save!");
            return;
        }

        const originalText = this.ui.saveBtn.innerText;
        this.ui.saveBtn.innerText = "Zipping...";
        this.ui.saveBtn.disabled = true;

        try {
            const blobs = await Promise.all(this.croppers.map(cropper => cropper.getBlob(this.settings.useFourBySix)));
            const zip = new JSZip();

            blobs.forEach(({ name, blob }) => {
                zip.file(`${name}.jpg`, blob);
            });

            const zipBlob = await zip.generateAsync({ type: "blob" });
            saveAs(zipBlob, "photos.zip");
        } catch (e) {
            console.error(e);
            alert("Error saving zip");
        } finally {
            this.ui.saveBtn.innerText = originalText;
            this.ui.saveBtn.disabled = false;
        }
    }
}

document.addEventListener("DOMContentLoaded", function() {
    new Manager();
});

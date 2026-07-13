"use strict";

window.Utils = {
    getExifOrientation: async (img) => {
        return new Promise(resolve => {
            EXIF.getData(img, function () {
                resolve(EXIF.getTag(this, 'Orientation') || 1);
            });
        });
    },

    getTime: async (img, name) => {
        const getFromName = (name) => {
            const match = name.match(/[^\d](20[0-2]\d)([0-1]\d)([0-3]\d)/);
            if (match) {
                const [, year, month, day] = match;
                return `${parseInt(month, 10)}/${parseInt(day, 10)}/${year}`;
            }
            return '';
        };

        const exifTime = await new Promise(resolve => {
            EXIF.getData(img, function () {
                try {
                    const created = EXIF.getTag(this, 'DateTimeOriginal');
                    if (!created) {
                        resolve('');
                    } else {
                        const datePart = created.split(' ')[0];
                        const [year, month, day] = datePart.split(':');
                        resolve(`${parseInt(month, 10)}/${parseInt(day, 10)}/${year}`);
                    }
                } catch (e) {
                    resolve('');
                }
            });
        });

        if (exifTime) {
            return exifTime;
        }

        return getFromName(name);
    }
};

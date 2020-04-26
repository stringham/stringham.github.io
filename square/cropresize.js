function Cropper(file, border, timestamp, parent) {
	this.canvas = document.createElement('canvas');
	this.ctx = this.canvas.getContext('2d');
	parent.appendChild(this.canvas);
	this.url = URL.createObjectURL(file);
	this.size = 300;
	this.name = file.name.split('.')[0];
	this.canvas.width = this.size;
	this.canvas.height = this.size;

	this.img = new Image();

	this.position = {x:0,y:0};
	this.offset = {x:0,y:0};
	this.imgSize;
	this.maxImgSize;

	this.border = border;
	this.timestamp = timestamp;
	this.time = '';
	this.exifOrientation = 1;

	this.img.onload = async function(){
		this.width = this.img.naturalWidth;
		this.height = this.img.naturalHeight;
		this.imgSize = Math.min(this.width,this.height);
		this.maxImgSize = this.imgSize;
		try {
			this.time = await getTime(this.img, this.name);
			this.exifOrientation = await getExifOrientation(this.img);
		} finally {
			this.render();
		}
	}.bind(this)

	this.img.src = this.url;

	this.canvas.addEventListener('mousedown', this.mousedown.bind(this));
	document.addEventListener('mousemove', this.mousemove.bind(this));
	document.addEventListener('mouseup', this.mouseup.bind(this));
	this.canvas.addEventListener('mousewheel', this.mousewheel.bind(this));
}

Cropper.prototype.rotate = function(ctx, canvas) {
	if(this.exifOrientation != 1) {
		ctx.translate(canvas.width/2, canvas.height/2);
		if(this.exifOrientation == 6 || this.exifOrientation == 7) {
			ctx.rotate(Math.PI/2);
		} else if(this.exifOrientation == 8 || this.exifOrientation == 5) {
			ctx.rotate(-Math.PI/2);
		} else if(this.exifOrientation == 3 || this.exifOrientation == 4) {
			ctx.rotate(Math.PI);
		}
		if(this.exifOrientation in {4:true,5:true,7:true,2:true,}) {
			ctx.scale(-1,1);
		}
		ctx.translate(-canvas.width/2, -canvas.height/2);
	}
}

Cropper.prototype.getBlob = function(){
	var canvas = document.createElement('canvas');
	var border = this.border * this.imgSize/this.size;
	canvas.width = this.imgSize + 2*border;
	canvas.height = this.imgSize + 2*border;
	var ctx = canvas.getContext('2d');
	ctx.save();
	ctx.imageSmoothingEnabled = false;
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0,0,canvas.width,canvas.height);
	var x = Math.round(this.position.x + this.offset.x);
	var y = Math.round(this.position.y + this.offset.y);
	x = Math.min(this.width - this.imgSize, Math.max(0,x));
	y = Math.min(this.height - this.imgSize, Math.max(0,y));
	this.rotate(ctx, canvas);
	ctx.drawImage(this.img, x, y, this.imgSize, this.imgSize, border, border, this.imgSize, this.imgSize);
	ctx.restore();
	if(this.timestamp) {
		this.drawTimestamp(ctx, this.imgSize + 2*border, this.imgSize/this.size);
	}
	return new Promise(function(resolve, reject) {
		canvas.toBlob(function(blob) {
			resolve({name:this.name, blob:blob});
		}.bind(this), 'image/jpeg', 1);
	}.bind(this));
}

Cropper.prototype.setBorder = function(border) {
	this.border = border;
	this.render();
}

Cropper.prototype.setTimestamp = function(timestamp) {
	this.timestamp = timestamp;
	this.render();
}

Cropper.prototype.mousewheel = function(e) {
	e.preventDefault();
	var oldImgSize = this.imgSize;
	this.imgSize += e.deltaY;
	this.imgSize = Math.min(this.maxImgSize, this.imgSize);
	this.imgSize = Math.max(400, this.imgSize);

	this.position.x += (oldImgSize - this.imgSize)/2;
	this.position.y += (oldImgSize - this.imgSize)/2;
	this.render();

}

Cropper.prototype.render = function(){
	this.ctx.save()
	this.ctx.fillStyle = '#ffffff';
	this.ctx.fillRect(0,0,this.size,this.size);
	this.ctx.imageSmoothingEnabled = false;
	var x = Math.round(this.position.x + this.offset.x);
	var y = Math.round(this.position.y + this.offset.y);
	x = Math.min(this.width - this.imgSize, Math.max(0,x));
	y = Math.min(this.height - this.imgSize, Math.max(0,y));
	this.rotate(this.ctx, this.canvas);
	this.ctx.drawImage(this.img, x, y, this.imgSize, this.imgSize, this.border, this.border, this.size - this.border*2, this.size - this.border*2);
	this.ctx.restore()
	if(this.timestamp) {
		this.drawTimestamp(this.ctx, this.size, 1);
	}
}

Cropper.prototype.drawTimestamp = function(ctx, size, scale) {
	ctx.save();
	ctx.globalAlpha = 0.5;
	ctx.fillStyle = '#ffffff',
	ctx.font = `${Math.round(12*scale)}px 'Source Sans Pro'`;
	const metrics = ctx.measureText(this.time);
	const padding = 5;
	ctx.fillText(this.time, size - metrics.width - this.border*scale - padding*scale, size - scale*(+this.border + padding));
	ctx.restore();
}

Cropper.prototype.mousedown = function(e) {
	this.dragging = true;
	this.anchor = {x:e.clientX, y:e.clientY};
}
Cropper.prototype.mousemove = function(e) {
	if(this.dragging) {
		var scale = this.imgSize / (this.size - 2*this.border);
		this.offset = {
			x:scale*(this.anchor.x-e.clientX),
			y:scale*(this.anchor.y-e.clientY)
		};
		if(this.exifOrientation == 6 || this.exifOrientation == 5) {
			[this.offset.x, this.offset.y] = [this.offset.y, -this.offset.x];
		} else if(this.exifOrientation == 8 || this.exifOrientation == 7) {
			[this.offset.x, this.offset.y] = [-this.offset.y, this.offset.x];
		} else if(this.exifOrientation == 3 || this.exifOrientation == 4) {
			[this.offset.x, this.offset.y] = [-this.offset.x, -this.offset.y];
		}

		if(this.exifOrientation in {5:true,7:true,}) {
			this.offset.y = -this.offset.y;
		}
		if(this.exifOrientation in {4:true,2:true}) {
			this.offset.x = -this.offset.x;
		}

		this.render();
	}
}
Cropper.prototype.mouseup = function(e) {
	if(this.dragging) {
		this.dragging = false;
		this.position.x += this.offset.x;
		this.position.y += this.offset.y;
		this.position.x = Math.min(this.width - this.imgSize, Math.max(0,this.position.x));
		this.position.y = Math.min(this.height - this.imgSize, Math.max(0,this.position.y));
		this.offset = {x:0,y:0};
		this.render();
	}
}

Manager = function(){
	this.container = document.createElement('div');
	document.body.appendChild(this.container);
	this.cropperContainer = document.createElement('div');
	this.container.appendChild(this.cropperContainer);

	this.croppers = [];
}

Manager.prototype.addFile = function(file) {
	this.croppers.push(new Cropper(file, size.value, timestamp.checked, this.cropperContainer));
}

Manager.prototype.save = function() {
	Promise.all(this.croppers.map(function(c) {
		return c.getBlob();
	})).then(function(blobs){
		var zip = new JSZip();
		for(var i=0; i<blobs.length; i++) {
			zip.file(blobs[i].name+'.jpg', blobs[i].blob);
		}
		zip.generateAsync({
		    type: "blob"
		}).then(function(f) {
			saveAs(f, "photos.zip");
		});
	})
}

async function getExifOrientation(img) {
	return new Promise(resolve => {
		EXIF.getData(img, function() {
			const o = EXIF.getTag(this, 'Orientation');
			if(o) {
				resolve(o);
			} else {
				resolve(1);
			}
		});
	});
}

async function getTime(img, name) {
	function getFromName(name) {
		const match = name.match(/[^\d](20[0-2]\d)([0-1]\d)([0-3]\d)/);
		if(match) {
			const [_,year,month,day] = match;
			return `${month.replace(/^0+/,'')}/${day.replace(/^0+/,'')}/${year}`;

		}
		return '';
	}

	return new Promise(resolve => {
		try {
			if(getFromName(name)) {
				resolve(getFromName(name))
			} else {
				EXIF.getData(img, function() {
					try {
						const created = EXIF.getTag(this, 'DateTimeOriginal');
						if(!created) {
							resolve('');
						}
						const [year, month, day] = created.split(' ')[0].split(':');
						resolve(`${month.replace(/^0+/,'')}/${day.replace(/^0+/,'')}/${year}`);
					} catch(e) {
						resolve('');
					}
				});
			}
		} catch(e) {
			resolve('');
		}
	});
};


var manager;
var size;
var timestamp;

document.addEventListener("DOMContentLoaded", function(event) {
	var select = document.getElementById('select');
	size = document.getElementById('bordersize');
	timestamp = document.getElementById('timestamp');

	manager = new Manager();

	size.addEventListener('change', function(e) {
		manager.croppers.forEach(function(c) {
			c.setBorder(size.value);
		})
	})

	timestamp.addEventListener('change', () => {
		manager.croppers.forEach(c => c.setTimestamp(timestamp.checked))
	});

	select.addEventListener('change', function(e){
		for(var i=0; i<select.files.length; i++) {
			manager.addFile(select.files[i]);
		}
	})
});
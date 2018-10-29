function Cropper(file, border, parent) {
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

	this.img.onload = function(){
		this.width = this.img.naturalWidth;
		this.height = this.img.naturalHeight;
		this.imgSize = Math.min(this.width,this.height);
		this.maxImgSize = this.imgSize;
		this.render();
	}.bind(this)

	this.img.src = this.url;

	this.canvas.addEventListener('mousedown', this.mousedown.bind(this));
	document.addEventListener('mousemove', this.mousemove.bind(this));
	document.addEventListener('mouseup', this.mouseup.bind(this));
	this.canvas.addEventListener('mousewheel', this.mousewheel.bind(this));
}

Cropper.prototype.getBlob = function(){
	var canvas = document.createElement('canvas');
	var border = this.border * this.imgSize/this.size;
	canvas.width = this.imgSize + 2*border;
	canvas.height = this.imgSize + 2*border;
	var ctx = canvas.getContext('2d');
	ctx.imageSmoothingEnabled = false;
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0,0,canvas.width,canvas.height);
	var x = Math.round(this.position.x + this.offset.x);
	var y = Math.round(this.position.y + this.offset.y);
	x = Math.min(this.width - this.imgSize, Math.max(0,x));
	y = Math.min(this.height - this.imgSize, Math.max(0,y));
	ctx.drawImage(this.img, x, y, this.imgSize, this.imgSize, border, border, this.imgSize, this.imgSize);
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
	this.ctx.fillStyle = '#ffffff';
	this.ctx.fillRect(0,0,this.size,this.size);
	this.ctx.imageSmoothingEnabled = false;
	var x = Math.round(this.position.x + this.offset.x);
	var y = Math.round(this.position.y + this.offset.y);
	x = Math.min(this.width - this.imgSize, Math.max(0,x));
	y = Math.min(this.height - this.imgSize, Math.max(0,y));
	this.ctx.drawImage(this.img, x, y, this.imgSize, this.imgSize, this.border, this.border, this.size - this.border*2, this.size - this.border*2);
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
	this.croppers.push(new Cropper(file, size.value, this.cropperContainer));
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


var manager;
var size;

document.addEventListener("DOMContentLoaded", function(event) { 
	var select = document.getElementById('select');
	size = document.getElementById('bordersize');

	manager = new Manager();

	size.addEventListener('change', function(e) {
		manager.croppers.forEach(function(c) {
			c.setBorder(size.value);
		})
	})

	select.addEventListener('change', function(e){
		for(var i=0; i<select.files.length; i++) {
			manager.addFile(select.files[i]);
		}
	})
});
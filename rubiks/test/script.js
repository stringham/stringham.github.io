
function hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

var d3 = {
	minZ:-105.65509926170151,
	angleY:0,
	angleX:0,
	angleZ:0,
	cameraY:1.0471973333333313,
	cameraX:3.9269900000000044,
	cameraZ:0,
	zoom:205.655,
	fl:250,
	cx:0,
	cy:0,
	cz:0
};
var bb = {
	x:0,
	y:0,
	w:300,
	h:300
};
var scr, canvas, ctx, cubes;
var white; 
var bkgColor1 = "rgba(256,256,256,1)";
var bkgColor1 = "rgba(0,0,0,1)";
var bkgColor2 = "rgba(32,32,32,1)"; 
var xAutorotate = 0, yAutorotate = 0, zAutorotate = 0, running = true; 
var minZ = 0;
// ======== vertex constructor ======== 
var Point = function (parent, xyz, project) { 
	this.project = project; 
	this.xo = xyz[0]; 
	this.yo = xyz[1]; 
	this.zo = xyz[2]; 
	this.cube = parent; 
}; 
Point.prototype.projection = function () { 
	// ---- 3D rotation ---- 
	//cubie rotations
	var p = transformPoint(makeRotateAffineX(this.cube.rotateX), {x:this.xo, y:this.yo, z:this.zo});
	//rotateY
	p = transformPoint(makeRotateAffineY(this.cube.rotateY), p);
	//rotateZ
	p = transformPoint(makeRotateAffineZ(this.cube.rotateZ), p);

	//rotateX
	var p = transformPoint(makeRotateAffineX(d3.angleX), p);//{x:this.xo, y:this.yo, z:this.zo});
	//rotateY
	p = transformPoint(makeRotateAffineY(d3.angleY), p);
	//rotateZ
	p = transformPoint(makeRotateAffineZ(d3.angleZ), p);

	//cameraX
	p = transformPoint(makeRotateAffineX(d3.cameraX), p);
	//cameraY
	p = transformPoint(makeRotateAffineY(d3.cameraY), p);
	//cameraZ
	p = transformPoint(makeRotateAffineZ(d3.cameraZ), p);


	var x = d3.cosY * (d3.sinZ * this.yo + d3.cosZ * this.xo) - d3.sinY * this.zo; 
	var y = d3.sinX * (d3.cosY * this.zo + d3.sinY * (d3.sinZ * this.yo + d3.cosZ * this.xo)) + d3.cosX * (d3.cosZ * this.yo - d3.sinZ * this.xo); 
	var z = d3.cosX * (d3.cosY * this.zo + d3.sinY * (d3.sinZ * this.yo + d3.cosZ * this.xo)) - d3.sinX * (d3.cosZ * this.yo - d3.sinZ * this.xo); 
	this.x = p.x; 
	this.y = p.y; 
	this.z = p.z; 
	x = p.x;
	y = p.y;
	z = p.z;
	if (this.project) { 
		// ---- point visible ---- 
		if (z < minZ) minZ = z; 
		this.visible = (d3.zoom + z > 0); 
		// ---- 3D to 2D projection ---- 
		this.X = (bb.w * 0.5) + x * (d3.fl / (z + d3.zoom)); 
		this.Y = (bb.h * 0.5) + y * (d3.fl / (z + d3.zoom)); 
	} 
}; 
// ======= polygon constructor ======== 
var Face = function (cube, index, normalVector, color) { 
	// ---- parent cube ---- 
	this.cube = cube; 
	// ---- coordinates ---- 
	this.p0 = cube.points[index[0]]; 
	this.p1 = cube.points[index[1]]; 
	this.p2 = cube.points[index[2]]; 
	this.p3 = cube.points[index[3]]; 
	// ---- normal vector ---- 
	this.normal = new Point(this.cube, normalVector, false);
	// ---- color ----
	this.color = color;
};
Face.prototype.faceVisible = function () { 
	this.visible = true;
	return true;
	// ---- points visible ---- 
	if (this.p0.visible && this.p1.visible && this.p2.visible && this.p3.visible) { 
		// ---- back face culling ---- 
		if ((this.p1.Y - this.p0.Y) / (this.p1.X - this.p0.X) < (this.p2.Y - this.p0.Y) / (this.p2.X - this.p0.X) ^ this.p0.X < this.p1.X == this.p0.X > this.p2.X) { 
			// ---- face visible ---- 
			this.visible = true; 
			return true; 
		} 
	} 
	// ---- face hidden ---- 
	this.visible = false; 
	this.distance = -99999; 
	return false; 
}; 
Face.prototype.distanceToCamera = function () { 
	// ---- distance to camera ---- 
	var dx = (this.p0.x + this.p1.x + this.p2.x + this.p3.x ) * 0.25; 
	var dy = (this.p0.y + this.p1.y + this.p2.y + this.p3.y ) * 0.25; 
	var dz = (d3.zoom + d3.fl) + (this.p0.z + this.p1.z + this.p2.z + this.p3.z ) * 0.25; 
	this.distance = Math.sqrt(dx * dx + dy * dy + dz * dz); 
}; 
Face.prototype.draw = function () { 
	// ---- shape face ---- 
	ctx.beginPath(); 
	ctx.moveTo(this.p0.X, this.p0.Y); 
	ctx.lineTo(this.p1.X, this.p1.Y); 
	ctx.lineTo(this.p2.X, this.p2.Y); 
	ctx.lineTo(this.p3.X, this.p3.Y); 
	ctx.closePath(); 
	// ---- light ---- 
	// ---- flat (lambert) shading ---- 
	this.normal.projection(); 
	var light = ( 
		white ? 
		this.normal.y + this.normal.z * 0.5 : 
		this.normal.z 
	); 
	var r = g = b = light;
	var rgb = hexToRgb(this.color);
	// ---- fill ---- 
	ctx.fillStyle = "rgba(" + 
						Math.round(rgb.r*light) + "," + 
						Math.round(rgb.g*light) + "," + 
						Math.round(rgb.b*light) + "," + 1 + ")"; 
	ctx.fill(); 
};

Face.prototype.getRenderData = function(){
	
	this.normal.projection(); 
	var light = ( 
		white ? 
		this.normal.y + this.normal.z * 0.5 : 
		this.normal.z 
	); 
	var r = g = b;
	var rgb = hexToRgb(this.color);
	r = Math.round(rgb.r*light).toString(16);
	g = Math.round(rgb.g*light).toString(16);
	b = Math.round(rgb.b*light).toString(16);
	r = r.length == 1 ? '0' + r : r;
	g = g.length == 1 ? '0' + g : g;
	b = b.length == 1 ? '0' + b : b;
	var fillColor = "#" + r + g + b;
	return {
		FillColor:fillColor,
		StrokeColor:null,
		LineWidth:null,
		Actions:[
			{
				Action:'move',
				x:this.p0.X,
				y:this.p0.Y
			},{
				Action:'line',
				x: this.p1.X, 
				y:this.p1.Y
			},{
				Action:'line',
				x: this.p2.X, 
				y:this.p2.Y
			},{
				Action:'line',
				x: this.p3.X, 
				y:this.p3.Y
			},{
				Action:'close'
			}
		]
	}
}
// ======== Cube constructor ======== 
var Cube = function(parent, nx, ny, nz, x, y, z, w) { 
	d3.minZ = -Math.sqrt(w*w*3);
	if (parent) { 
		// ---- translate parent points ---- 
		this.w = parent.w; 
		this.points = []; 
		var i = 0, p; 
		while (p = parent.points[i++]) { 
			this.points.push( 
				new Point( 
					parent, 
					[p.xo + nx , p.yo + ny, p.zo + nz], 
					true 
				) 
			); 
		} 
	} else { 
		// ---- create points ---- 
		this.w = w; 
		this.points = []; 
		var p = [ 
			[x-w, y-w, z-w], 
			[x+w, y-w, z-w], 
			[x+w, y+w, z-w], 
			[x-w, y+w, z-w], 
			[x-w, y-w, z+w], 
			[x+w, y-w, z+w], 
			[x+w, y+w, z+w], 
			[x-w, y+w, z+w] 
		]; 
		for (var i in p) this.points.push( 
			new Point(this, p[i], true) 
		); 
	} 
	var WHITE="#ffffff", YELLOW="#ffff00" , GREEN="#009900" , BLUE="#000099", RED="#cc0000", ORANGE="#ff8000", CLEAR = "#ffffff00";
	var colors = [BLUE,WHITE,YELLOW,RED,ORANGE,GREEN];
	// ---- faces coordinates ---- 
	var f  = [ 
		[0,1,2,3], 
		[0,4,5,1], 
		[3,2,6,7], 
		[0,3,7,4], 
		[1,5,6,2], 
		[5,4,7,6] 
	]; 
	// ---- faces normals ---- 
	var nv = [ 
		[0,0,1], 
		[0,1,0], 
		[0,-1,0], 
		[1,0,0], 
		[-1,0,0], 
		[0,0,-1] 
	]; 
	// ---- cube transparency ---- 
	this.alpha = 1; 
	// ---- push faces ---- 
	this.faces = [];
	for (var i in f) { 
		this.faces.push( 
			new Face(this, f[i], nv[i], colors[i])
		); 
	} 

	this.rotateX = 0;
	this.rotateY = 0;
	this.rotateZ = 0;
}; 
//////////////////////////////////////////////////////////////////////////// 
var reset = function () { 
	// ---- create first cube ---- 
	cubes = [];
	faces = [];
	var w = 54/6;
	for(var i=-1; i<2; i++){
		for(var j=-1; j<2; j++){
			for(var k=-1; k<2; k++){
				if(k!=0 || j != 0 || i != 0)
					cubes.push( 
					new Cube(false,0,0,0,2*i*w, 2*j*w, 2*k*w, w) 
					); 
			}
		}
	}
}; 

var faceNames = ['TOP','LEFT','RIGHT','BACK','BOTTOM','FRONT','BACK'];

Cube.prototype.getPosition = function() {
	var points = [];
	for(var i=0; i<this.points.length; i++){
		//cubie rotations
		var p = transformPoint(makeRotateAffineX(this.rotateX), {x:this.points[i].xo,y:this.points[i].yo,z:this.points[i].zo});
		//rotateY
		p = transformPoint(makeRotateAffineY(this.rotateY), p);
		//rotateZ
		p = transformPoint(makeRotateAffineZ(this.rotateZ), p);
		points.push(p);
	};
	var result = averagePoints(points);
	result.x = Math.round(result.x);
	result.y = Math.round(result.y);
	result.z = Math.round(result.z);
	return result;
};

Cube.prototype.resetRotation = function() {
	var points = [];
	for(var i=0; i<this.points.length; i++){
		//cubie rotations
		var p = transformPoint(makeRotateAffineX(this.rotateX), {x:this.points[i].xo,y:this.points[i].yo,z:this.points[i].zo});
		//rotateY
		p = transformPoint(makeRotateAffineY(this.rotateY), p);
		//rotateZ
		p = transformPoint(makeRotateAffineZ(this.rotateZ), p);
		this.points[i].xo = p.x;
		this.points[i].yo = p.y;
		this.points[i].zo = p.z;
	};
	for(var i=0; i<this.faces.length; i++){
		var normal = this.faces[i].normal;
		var p = transformPoint(makeRotateAffineX(this.rotateX), {x:normal.xo,y:normal.yo,z:normal.zo});
		//rotateY
		p = transformPoint(makeRotateAffineY(this.rotateY), p);
		//rotateZ
		p = transformPoint(makeRotateAffineZ(this.rotateZ), p);
		normal.xo = p.x;
		normal.yo = p.y;
		normal.zo = p.z;	
	}
	this.rotateX = 0;
	this.rotateY = 0;
	this.rotateZ = 0;

};

Cube.prototype.getRenderData = function(){
	var result = [];
	var faces = [];
	var j = 0, p; 
	while ( p = this.points[j++] ) { 
		p.projection(); 
	}
	for(var k=0; k<this.faces.length; k++){
		if(this.faces[k].faceVisible())
			this.faces[k].distanceToCamera();
		faces.push(this.faces[k]);
	}
	faces.sort(function (p0, p1) { 
		return p1.distance - p0.distance; 
	}); 
	// ---- painting faces ---- 
	j = 0; 
	while ( f = faces[j++] ) { 
			if (f.visible) { 
				result.push(f.getRenderData());
			} else break; 
	}

	return result;
}
//////////////////////////////////////////////////////////////////////////// 
var init = function () { 
	canvas  = document.getElementById("canvas");
	ctx = canvas.getContext('2d'); 
	canvas.width = bb.w;
	canvas.height = bb.h;
	reset(); 
	run(); 
	// rotateFace();
} 
//////////////////////////////////////////////////////////////////////////// 
// ======== main loop ======== 
var run = function () { 
	// ---- screen background ---- 
	ctx.fillStyle = bkgColor1; 
	ctx.fillRect(0, Math.floor(bb.h * 0.15)*0, bb.w, bb.h);//Math.ceil(bb.h * 0.7)); 
	d3.cameraX += ((d3.cx - d3.cameraX) * 0.05); 
	d3.cameraY += ((d3.cy - d3.cameraY) * 0.05); 
	d3.cameraZ += ((d3.cz - d3.cameraZ) * 0.05); 
	if (xAutorotate != 0) d3.cx += xAutorotate; 
	if (yAutorotate != 0) d3.cy += yAutorotate; 
	if (zAutorotate != 0) d3.cz += zAutorotate; 
	// ---- pre-calculating trigo ---- 
	d3.cosY = Math.cos(d3.angleY); 
	d3.sinY = Math.sin(d3.angleY); 
	d3.cosX = Math.cos(d3.angleX);
	d3.sinX = Math.sin(d3.angleX);
	d3.cosZ = Math.cos(d3.angleZ);
	d3.sinZ = Math.sin(d3.angleZ);
	// ---- points projection ---- 
	var i = 0, c; 
	var faces = [];
	while ( c = cubes[i++] ) { 
		var j = 0, p; 
		while ( p = c.points[j++] ) { 
			p.projection(); 
		}
		for(var k=0; k<c.faces.length; k++){
			if(c.faces[k].faceVisible())
				c.faces[k].distanceToCamera();
			faces.push(c.faces[k]);
		}
	} 
	// ---- adapt d3.zoom ---- 
	var d = -d3.minZ + 100 - d3.zoom; 
	d3.zoom += d; 
	// ---- faces light ---- 
	var j = 0, f; 
	// while ( f = faces[j++] ) { 
	// 	if ( f.faceVisible() ) { 
	// 		f.distanceToCamera(); 
	// 	} 
	// } 
	// ---- faces depth sorting ---- 
	faces.sort(function (p0, p1) { 
		return p1.distance - p0.distance; 
	}); 
	// ---- painting faces ---- 
	j = 0; 
	while ( f = faces[j++] ) { 
			if (f.visible) { 
				f.draw(); 
			} else break; 
	} 
	// ---- animation loop ---- 
	if (running) setTimeout(run, 16); 
} 

function resize(w){
	canvas.width = w;
	canvas.height = w;
	bb.w = w;
	bb.h = w;
	reset();
}

function rotate90(x, y, z){
	var frames = 50;
	var angleX = d3.angleX;
	var angleY = d3.angleY;
	var angleZ = d3.angleZ;
	var destX = angleX + x * Math.PI/2;
	var destY = angleY + y * Math.PI/2;
	var destZ = angleZ + z * Math.PI/2;
	var frame = 0;

	var rotate = function(){
		d3.angleX = angleX + (destX - angleX)*(frame/frames);
		d3.angleY = angleY + (destY - angleY)*(frame/frames);
		d3.angleZ = angleZ + (destZ - angleZ)*(frame/frames);
		frame++;
		if(frame <= frames)
			setTimeout(function() {rotate();}, 16);
		else{
			var r = Math.random();
			if(r < 1/3)
				rotate90(2*Math.floor(Math.random()*2)-1,0,0);
			else if (r < 2/3)
				rotate90(0,2*Math.floor(Math.random()*2)-1,0);
			else
				rotate90(0,0,2*Math.floor(Math.random()*2)-1);
		}
	}
	rotate();
}
var speed = 8;
var rotating = false;
var queue = [];
function rotateFace(face){
	if(rotating){
		queue.push(face);
		return;
	}
	rotating = true;
	var blocks = getBlocks(face);
	var rotations = [];
	for(var i=0; i<blocks.length; i++){
		rotations.push({
			rotateX: blocks[i].rotateX,
			rotateY: blocks[i].rotateY,
			rotateZ: blocks[i].rotateZ
		});
	}
	var frames = 50, frame = 0;

	var rotate = function(){
		for(var i=0; i<blocks.length; i++){
			if(face == 'TOP' || face == 'BOTTOM')
				blocks[i].rotateX = rotations[i].rotateX + (Math.PI/2)*(frame/frames);
			if (face == 'FRONT' || face == 'BACK')
				blocks[i].rotateY = rotations[i].rotateY + (Math.PI/2)*(frame/frames);
			if (face == 'LEFT' || face == 'RIGHT')
				blocks[i].rotateZ = rotations[i].rotateZ + (Math.PI/2)*(frame/frames);

		}
		frame++;
		if(frame <= frames)
			setTimeout(function() {rotate();}, speed);
		else{
			rotating = false;
			for(var i=0; i<blocks.length; i++){
				blocks[i].resetRotation();
			}
			if(queue.length > 0){
				rotateFace(queue.shift());
			}
		}
	}
	rotate();
}

function getBlocks(face){
	var result = [];
	if(face == 'TOP'){
		for(var i=0; i<cubes.length; i++){
			if(cubes[i].getPosition().x < 0)
				result.push(cubes[i]);
		}
	}
	else if(face == 'BOTTOM'){
		for(var i=0; i<cubes.length; i++){
			if(cubes[i].getPosition().x > 0)
				result.push(cubes[i]);
		}
	}
	else if(face == 'FRONT'){
		for(var i=0; i<cubes.length; i++){
			if(cubes[i].getPosition().y < 0)
				result.push(cubes[i]);
		}
	}
	else if(face == 'BACK'){
		for(var i=0; i<cubes.length; i++){
			if(cubes[i].getPosition().y > 0)
				result.push(cubes[i]);
		}
	}
	else if(face == 'LEFT'){
		for(var i=0; i<cubes.length; i++){
			if(cubes[i].getPosition().z < 0)
				result.push(cubes[i]);
		}
	}
	else if(face == 'RIGHT'){
		for(var i=0; i<cubes.length; i++){
			if(cubes[i].getPosition().z > 0)
				result.push(cubes[i]);
		}
	}
	return result;
}


window.addEventListener('load', function () { 
	init(); 
}, false);
/**********************************
 * Main Loop
 **********************************/
var run = function () { 
	cube.tick();
	cube.render();
	// ---- animation loop ---- 
	setTimeout(run, 16); 
} 
var reset = function () { 
	cube = new RubiksCube('canvas', 300);
}; 
var init = function () { 
	reset(); 
	run(); 
} 

/**********************************
 * Utility Functions
 **********************************/
function hexToRgb(hex) {
	if(hex.length == 7){
	    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	    return result ? {
	        r: parseInt(result[1], 16),
	        g: parseInt(result[2], 16),
	        b: parseInt(result[3], 16),
	        a: 1
	    } : null;
	}
	else if(hex.length == 9){
	    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	    return result ? {
	        r: parseInt(result[1], 16),
	        g: parseInt(result[2], 16),
	        b: parseInt(result[3], 16),
	        a: parseInt(result[4], 16)/256
	    } : null;
	}
}

function makeRotationAffine(x,y,z){
	return multiplyAffine(multiplyAffine(makeRotateAffineX(x),makeRotateAffineY(y)),makeRotateAffineZ(z));
}

/**********************************
 * Variables
 **********************************/
var cube;
var xAutorotate = 0, yAutorotate = 0, zAutorotate = 0; 
var faceNames = ['L', 'U', 'D', 'B', 'F', 'R'];

/************************************************************
 * MMMM    MMMM   OOOOOOOO   DDDDDDDD   EEEEEEEE  LL
 * MM MM  MM MM   OO    OO   DD    DD   EE        LL
 * MM  MMMM  MM   OO    OO   DD    DD   EEEEE     LL
 * MM   MM   MM   OO    OO   DD    DD   EE        LL
 * MM   MM   MM   OOOOOOOO   DDDDDDDD   EEEEEEEE  LLLLLLL
 ************************************************************/

/**********************************
 *  3D Translation Stuff
 *********************************/

// This represents an affine 4x4 matrix, stored as a 3x4 matrix with the last
// row implied as [0, 0, 0, 1].  This is to avoid generally unneeded work,
// skipping part of the homogeneous coordinates calculations and the
// homogeneous divide.  Unlike points, we use a constructor function instead
// of object literals to ensure map sharing.  The matrix looks like:
//  e0  e1  e2  e3
//  e4  e5  e6  e7
//  e8  e9  e10 e11
//  0   0   0   1
function AffineMatrix(e0, e1, e2, e3, e4, e5, e6, e7, e8, e9, e10, e11) {
	this.e0  = e0;
	this.e1  = e1;
	this.e2  = e2;
	this.e3  = e3;
	this.e4  = e4;
	this.e5  = e5;
	this.e6  = e6;
	this.e7  = e7;
	this.e8  = e8;
	this.e9  = e9;
	this.e10 = e10;
	this.e11 = e11;
};

// Matrix multiplication of AffineMatrix |a| x |b|.  This is unrolled,
// and includes the calculations with the implied last row.
function multiplyAffine(a, b) {
	// Avoid repeated property lookups by accessing into the local frame.
	var a0 = a.e0, a1 = a.e1, a2 = a.e2, a3 = a.e3, a4 = a.e4, a5 = a.e5;
	var a6 = a.e6, a7 = a.e7, a8 = a.e8, a9 = a.e9, a10 = a.e10, a11 = a.e11;
	var b0 = b.e0, b1 = b.e1, b2 = b.e2, b3 = b.e3, b4 = b.e4, b5 = b.e5;
	var b6 = b.e6, b7 = b.e7, b8 = b.e8, b9 = b.e9, b10 = b.e10, b11 = b.e11;
	return new AffineMatrix(
		a0 * b0 + a1 * b4 + a2 * b8,
		a0 * b1 + a1 * b5 + a2 * b9,
		a0 * b2 + a1 * b6 + a2 * b10,
		a0 * b3 + a1 * b7 + a2 * b11 + a3,
		a4 * b0 + a5 * b4 + a6 * b8,
		a4 * b1 + a5 * b5 + a6 * b9,
		a4 * b2 + a5 * b6 + a6 * b10,
		a4 * b3 + a5 * b7 + a6 * b11 + a7,
		a8 * b0 + a9 * b4 + a10 * b8,
		a8 * b1 + a9 * b5 + a10 * b9,
		a8 * b2 + a9 * b6 + a10 * b10,
		a8 * b3 + a9 * b7 + a10 * b11 + a11
	);
}
function makeIdentityAffine() {
	return new AffineMatrix(
		1, 0, 0, 0,
		0, 1, 0, 0,
		0, 0, 1, 0
	);
}
// http://en.wikipedia.org/wiki/Rotation_matrix
function makeRotateAffineX(theta) {
	var s = Math.sin(theta);
	var c = Math.cos(theta);
	return new AffineMatrix(
		1, 0,  0, 0,
		0, c, -s, 0,
		0, s,  c, 0
	);
}
function makeRotateAffineY(theta) {
	var s = Math.sin(theta);
	var c = Math.cos(theta);
	return new AffineMatrix(
		 c, 0, s, 0,
		 0, 1, 0, 0,
		-s, 0, c, 0
	);
}
function makeRotateAffineZ(theta) {
	var s = Math.sin(theta);
	var c = Math.cos(theta);
	return new AffineMatrix(
		c, -s, 0, 0,
		s,  c, 0, 0,
		0,  0, 1, 0
	);
}
// Transform the point |p| by the AffineMatrix |t|.
function transformPoint(t, p) {
	return {
		x: t.e0 * p.x + t.e1 * p.y + t.e2  * p.z + t.e3,
		y: t.e4 * p.x + t.e5 * p.y + t.e6  * p.z + t.e7,
		z: t.e8 * p.x + t.e9 * p.y + t.e10 * p.z + t.e11
	};
}

// Average a list of points, returning a new "centroid" point.
function averagePoints(ps) {
	var avg = {x: 0, y: 0, z: 0};
	for (var i = 0, il = ps.length; i < il; ++i) {
		var p = ps[i];
		avg.x += p.x;
		avg.y += p.y;
		avg.z += p.z;
	}

	// TODO(deanm): 1 divide and 3 multiplies cheaper than 3 divides?
	var f = 1 / il;

	avg.x *= f;
	avg.y *= f;
	avg.z *= f;

	return avg;
}

function averageUnRotatedPoints(ps) {
	var avg = {x: 0, y: 0, z: 0};
	for (var i = 0, il = ps.length; i < il; ++i) {
		var p = ps[i];
		avg.x += p.xo;
		avg.y += p.yo;
		avg.z += p.zo;
	}

	var f = 1 / il;

	avg.x *= f;
	avg.y *= f;
	avg.z *= f;

	return avg;
}

/**********************************
 * 3D Point
 **********************************/
 var Point = function (parent, xyz, project, rubiks) { 
	this.project = project; 
	this.rubiks = rubiks;
	this.xo = xyz[0]; 
	this.yo = xyz[1]; 
	this.zo = xyz[2]; 
	this.cube = parent; 
};
Point.prototype.projection = function () { 
	var p = transformPoint(this.cube.rotationAffine, {x:this.xo, y:this.yo, z:this.zo});
	p = transformPoint(this.rubiks.cameraAffine, p);
	this.x = p.x; 
	this.y = p.y; 
	this.z = p.z; 
	var x = p.x;
	var y = p.y;
	var z = p.z;
	if (this.project) { 
		// ---- point visible ---- 
		this.visible = (350 + z > 0); 
		// ---- 3D to 2D projection ---- 
		this.X = ((75/2) + x * (250 / (z + 350)))*(this.rubiks.width / 75);
		this.Y = ((75/2) + y * (250 / (z + 350)))*(this.rubiks.width / 75);
	} 
}; 
/**********************************
 * Face Object
 **********************************/
var Face = function (cube, index, normalVector, color, rubiks) { 
	// ---- Rubiks Cube ----
	this.rubiks = rubiks;
	// ---- parent cube ---- 
	this.cube = cube; 
	// ---- coordinates ---- 
	this.p0 = cube.points[index[0]];
	this.p1 = cube.points[index[1]];
	this.p2 = cube.points[index[2]];
	this.p3 = cube.points[index[3]];
	// ---- normal vector ---- 
	this.normal = new Point(this.cube, normalVector, false, rubiks);
	// ---- color ----
	this.color = color;
};
Face.prototype.distanceToCamera = function () { 
	// ---- distance to camera ---- 
	var dx = (this.p0.x + this.p1.x + this.p2.x + this.p3.x ) * 0.25; 
	var dy = (this.p0.y + this.p1.y + this.p2.y + this.p3.y ) * 0.25; 
	var dz = (350 + 250) + (this.p0.z + this.p1.z + this.p2.z + this.p3.z ) * 0.25; 
	this.distance = Math.sqrt(dx * dx + dy * dy + dz * dz); 
}; 
Face.prototype.draw = function () { 
	var ctx = this.rubiks.ctx;
	// ---- shape face ---- 
	ctx.beginPath(); 
	ctx.moveTo(this.p0.X, this.p0.Y); 
	ctx.lineTo(this.p1.X, this.p1.Y); 
	ctx.lineTo(this.p2.X, this.p2.Y); 
	ctx.lineTo(this.p3.X, this.p3.Y); 
	ctx.closePath(); 
	// ---- light ---- 
	this.normal.projection(); 
	var light = ( 
		false ? 
		this.normal.y + this.normal.z * 0.5 : 
		this.normal.z 
	); 
	var r = g = b = light;
	light += (1-light)*.8;
	var rgb = hexToRgb(this.color);
	// ---- fill ---- 
	ctx.fillStyle = "rgba(" + 
						Math.round(rgb.r*light) + "," + 
						Math.round(rgb.g*light) + "," + 
						Math.round(rgb.b*light) + "," + rgb.a + ")"; 
	ctx.fill(); 
};
Face.prototype.getRenderData = function(){
	
	this.normal.projection(); 
	var light = ( 
		false ? 
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
/**********************************
 * Cube Object
 **********************************/
var Cube = function(x, y, z, w, rubiks, colors) { 
	this.rubiks = rubiks;
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
		new Point(this, p[i], true, rubiks) 
	); 
	
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
			new Face(this, f[i], nv[i], colors[i], rubiks)
		); 
	} 
	this.rotationAffine = makeIdentityAffine();
	this.rotateX = 0;
	this.rotateY = 0;
	this.rotateZ = 0;
}; 
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
Cube.prototype.setRotationAffine = function(){
	if(this.rotateX != 0 || this.rotateY != 0 || this.rotateZ != 0)
		this.rotationAffine = makeRotationAffine(this.rotateX, this.rotateY, this.rotateZ);
}
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
	this.rotationAffine = makeIdentityAffine();
};
Cube.prototype.getRenderData = function(){
	var result = [];
	var faces = [];
	var j = 0, p; 
	while ( p = this.points[j++] ) { 
		p.projection(); 
	}
	for(var k=0; k<this.faces.length; k++){
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
function RubiksCube(canvas, width){
	this.canvas = document.getElementById(canvas);
	this.width = width;
	this.canvas.width = width;
	this.canvas.height = width;
	this.ctx = this.canvas.getContext('2d');
	this.blocks = [];
	this.points = [];
	this.faces = [];
	this.queue = [];
	this.moveHistory = [];
	this.rotating = false;
	this.rotating2 = false;
	this.cameraY = 1.0471973333333313;
	this.cameraX = 3.9269900000000044;
	this.cameraZ = 0;
	this.cx = 0.6;
	this.cy = 0.6;
	this.cz = 0;
	var w = 54/6;
	for(var i=-1; i<2; i++){
		for(var j=-1; j<2; j++){
			for(var k=-1; k<2; k++){
				if(k!=0 || j != 0 || i != 0){
					var WHITE="#ffffff", YELLOW="#ffff00" , GREEN="#009900" , BLUE="#000099", RED="#cc0000", ORANGE="#ff8000", CLEAR = "#000000";
					var colors = [BLUE,WHITE,YELLOW,RED,ORANGE,GREEN];
					var colors = [CLEAR,CLEAR,CLEAR,CLEAR,CLEAR,CLEAR];
					if(j == 1)       colors[2] = YELLOW;
					else if(j == -1) colors[1] = WHITE;
					if(i == 1)       colors[4] = ORANGE;
					else if(i == -1) colors[3] = RED;
					if(k == 1)       colors[5] = GREEN;
					else if(k == -1) colors[0] = BLUE;
					var block = new Cube(2.20*i*w, 2.20*j*w, 2.20*k*w, w, this, colors);
					this.blocks.push(block);
					for(var f = 0; f < block.faces.length; f++)
						this.faces.push(block.faces[f]);
					for(var f = 0; f < block.points.length; f++)
						this.points.push(block.points[f]);
				}
			}
		}
	}
}

RubiksCube.prototype.tick = function() {
	this.cameraX += ((this.cx - this.cameraX) * 0.05); 
	this.cameraY += ((this.cy - this.cameraY) * 0.05); 
	this.cameraZ += ((this.cz - this.cameraZ) * 0.05); 
	if (xAutorotate != 0) this.cx += xAutorotate; 
	if (yAutorotate != 0) this.cy += yAutorotate; 
	if (zAutorotate != 0) this.cz += zAutorotate; 
	
};

RubiksCube.prototype.render = function(){
	this.cameraAffine = makeRotationAffine(cube.cameraX,cube.cameraY,cube.cameraZ);

	for(var i=0; i<this.blocks.length; i++){
		this.blocks[i].setRotationAffine();
	}

	for(var i=0; i<this.points.length; i++){
		this.points[i].projection();
	}
	for(var i=0; i<this.faces.length; i++){
		this.faces[i].distanceToCamera();
	}

	this.faces.sort(function (p0, p1) { 
		return p1.distance - p0.distance; 
	}); 

	this.ctx.fillStyle = "rgba(0,0,0,1)"; 
	this.ctx.fillRect(0, 0, this.width, this.width);
	for(var i=0; i<this.faces.length; i++){
		this.faces[i].draw();
	}
};

RubiksCube.prototype.opposites = {
	'F':'B',
	'B':'F',
	'T':'D',
	'D':'T',
	'R':'L',
	'L':'R'
};

RubiksCube.prototype.rotateFace = function(face, d){
	if(this.rotating)
		return;
	this.rotating = face;
	var blocks = this.getBlocks(face);
	var rotations = [];
	goog.array.forEach(blocks, function(block){
		rotations.push({
			rotateY: block.rotateY,
			rotateX: block.rotateX,
			rotateZ: block.rotateZ
		});
	})
	var frames = 30, frame = 0;
	var me = this;

	var rotate = function(){
		goog.array.forEach(blocks, function(block, i){
			if (face == 'F' || face == 'B' || face == 'Z')
				block.rotateX = rotations[i].rotateX + d*(Math.PI/2)*(frame/frames);
			if(face == 'U' || face == 'D' || face == 'Y')
				block.rotateY = rotations[i].rotateY + d*(Math.PI/2)*(frame/frames);
			if (face == 'L' || face == 'R' || face == 'X')
				block.rotateZ = rotations[i].rotateZ + d*(Math.PI/2)*(frame/frames);
		});
		frame++;
		if(frame <= frames)
			setTimeout(function() {rotate();}, 10);
		else{
			me.rotating = false;
			for(var i=0; i<blocks.length; i++){
				blocks[i].resetRotation();
			}
			me.makeNextMove();
		}
	}
	rotate();
}

RubiksCube.prototype.getBlocks = function(face) {
	var result = [];
	if(face == 'B'){
		goog.array.forEach(this.blocks, function(block){
			if(block.getPosition().x < 0)
				result.push(block);
		});
	}
	else if(face == 'F'){
		goog.array.forEach(this.blocks, function(block){
			if(block.getPosition().x > 0)
				result.push(block);
		});
	}
	else if(face == 'U'){
		goog.array.forEach(this.blocks, function(block){
			if(block.getPosition().y < 0)
				result.push(block);
		});
	}
	else if(face == 'D'){
		goog.array.forEach(this.blocks, function(block){
			if(block.getPosition().y > 0)
				result.push(block);
		});
	}
	else if(face == 'L'){
		goog.array.forEach(this.blocks, function(block){
			if(block.getPosition().z < 0)
				result.push(block);
		});
	}
	else if(face == 'R'){
		goog.array.forEach(this.blocks, function(block){
			if(block.getPosition().z > 0)
				result.push(block);
		});
	} else if(face == 'X' || face == 'Y' || face == 'Z'){
		result = this.blocks;
	}
	return result;
};
RubiksCube.prototype.makeMoves = function(moves) {
	moves = moves.split(/\s/);
	for(var i=0; i<moves.length; i++){
		this.makeMove(moves[i]);
	}
}

RubiksCube.prototype.makeMove = function(move) {
	if(this.rotating){
		this.queue.push(move);
		return;
	}
	this.moveHistory.push(move);
	var spin = 1;
	if(move[move.length-1] == '2'){
		spin++;
		move = move.substr(0,move.length-1);
	}
	switch(move.toLowerCase()){
		case "f":
			this.rotateFace('F', -spin);
			break;
		case "f'":
			this.rotateFace('F', spin);
			break;
		case "r":
			this.rotateFace('R', -spin);
			break;
		case "r'":
			this.rotateFace('R', spin);
			break;
		case "u":
			this.rotateFace('U', spin);
			break;
		case "u'":
			this.rotateFace('U', -spin);
			break;
		case "d":
			this.rotateFace('D', -spin);
			break;
		case "d'":
			this.rotateFace('D', spin);
			break;
		case "b":
			this.rotateFace('B', spin);
			break;
		case "b'":
			this.rotateFace('B', -spin);
			break;
		case "l":
			this.rotateFace('L', spin);
			break;
		case "l'":
			this.rotateFace('L', -spin);
			break;
		case "x":
			this.rotateFace('X', spin);
			break;
		case "x'":
			this.rotateFace('X', -spin);
			break;
		case "y":
			this.rotateFace('Y', spin);
			break;
		case "y'":
			this.rotateFace('Y', -spin);
			break;
		case "z":
			this.rotateFace('Z', -spin);
			break;
		case "z'":
			this.rotateFace('Z', spin);
			break;
	}
};

RubiksCube.prototype.makeNextMove = function() {
	if(this.queue.length > 0)
		this.makeMove(this.queue.shift());
};

RubiksCube.prototype.getFaceColor = function(face){
	
	function getOutside(c){
		var index = -1;
		var max = 0;
		for(var i=0; i<c.faces.length; i++){
			p = averageUnRotatedPoints([c.faces[i].p0,c.faces[i].p1, c.faces[i].p2, c.faces[i].p3]);
			if(Math.abs(p.x) > max){
				index = i;
				max = Math.abs(p.x);
			}
			if(Math.abs(p.y) > max){
				index = i;
				max = Math.abs(p.y);
			}
			if(Math.abs(p.z) > max){
				index = i;
				max = Math.abs(p.z);
			}
		}
		return c.faces[index].color;
	}

	switch(face){
		case 'D':
			return getOutside(goog.array.find(this.blocks, function(block){
				var p = block.getPosition();
				return (p.x == 0 && p.y > 0 && p.z == 0);
			}));
		case 'U':
			return getOutside(goog.array.find(this.blocks, function(block){
				var p = block.getPosition();
				return (p.x == 0 && p.y < 0 && p.z == 0);
			}));
		case 'L':
			return getOutside(goog.array.find(this.blocks, function(block){
				var p = block.getPosition();
				return (p.x == 0 && p.y == 0 && p.z < 0);
			}));
		case 'R':
			return getOutside(goog.array.find(this.blocks, function(block){
				var p = block.getPosition();
				return (p.x == 0 && p.y == 0 && p.z > 0);
			}));
		case 'F':
			return getOutside(goog.array.find(this.blocks, function(block){
				var p = block.getPosition();
				return (p.x > 0 && p.y == 0 && p.z == 0);
			}));
		case 'B':
			return getOutside(goog.array.find(this.blocks, function(block){
				var p = block.getPosition();
				return (p.x < 0 && p.y == 0 && p.z == 0);
			}));
	}
}
// var faceNames = ['L', 'U', 'D', 'B', 'F', 'R'];
RubiksCube.prototype.getCubie = function(position){
	var cubes = this.getBlocks(position[0]);
	switch(position){
		//Edge piece
		case "UF":
		case "DF":
			return goog.array.find(cubes, function(c){
				var p = c.getPosition();
				return p.z == 0 && p.x > 0;
			});
		case "UB":
		case "DB":
			return goog.array.find(cubes, function(c){
				var p = c.getPosition();
				return p.z == 0 && p.x < 0;
			});
		case "UR":
		case "DR":
			return goog.array.find(cubes, function(c){
				var p = c.getPosition();
				return p.z > 0 && p.x == 0;
			});
		case "UL":
		case "DL":
			return goog.array.find(cubes, function(c){
				var p = c.getPosition();
				return p.z < 0 && p.x == 0;
			});
		case "FR":
		case "BR":
			return goog.array.find(cubes, function(c){
				var p = c.getPosition();
				return p.z > 0 && p.y == 0;
			});
		case "FL":
		case "BL":
			return goog.array.find(cubes, function(c){
				var p = c.getPosition();
				return p.z < 0 && p.y == 0;
			});
		//Corner Cubie
		case "UFR":
		case "DRF":
			return goog.array.find(cubes, function(c){
					var p = c.getPosition();
					return p.z > 0 && p.x > 0;
				});
		case "URB":
		case "DBR":
			return goog.array.find(cubes, function(c){
					var p = c.getPosition();
					return p.z > 0 && p.x < 0;
				});
		case "UBL":
		case "DLB":
			return goog.array.find(cubes, function(c){
					var p = c.getPosition();
					return p.z < 0 && p.x < 0;
				});
		case "ULF":
		case "DFL":
			return goog.array.find(cubes, function(c){
					var p = c.getPosition();
					return p.z < 0 && p.x > 0;
				});
	}
}

RubiksCube.prototype.getState = function(){
	var me = this;
	var result = "";
	var cubicles = ["UF", "UR", "UB", "UL", "DF", "DR", "DB", "DL", "FR", "FL", "BR", "BL", "UFR", "URB", "UBL", "ULF", "DRF", "DFL", "DLB", "DBR"]
	var colorToFace = {};
	var faceToDirection = {
		'F':'x',
		'B':'x',
		'U':'y',
		'D':'y',
		'R':'z',
		'L':'z'
	};
	var getFaceColor = function(c, direction){
		//direction is a string 'x', 'y', or 'z'
		var result=null;
		var max = 0;
		goog.array.forEach(c.faces, function(f){
			p = averageUnRotatedPoints([f.p0,f.p1, f.p2, f.p3]);
			if(Math.abs(p[direction]) > max){
				max = Math.abs(p[direction]);
				result = f.color;
			}
		});
		return result;
	}
	for(var i=0; i<faceNames.length; i++){
		colorToFace[this.getFaceColor(faceNames[i])] = faceNames[i];
	}
	
	goog.array.forEach(cubicles, function(cubicle){
		var c = me.getCubie(cubicle);
		var cubieName = "";
		goog.array.forEach(cubicle.split(''), function(face){
			var color = getFaceColor(c, faceToDirection[face]);
			cubieName += colorToFace[color];
		});
		result += cubieName + " ";
	})
	
	return result.trim();
}

window.addEventListener('load', function () { 
	init(); 
	scramble(5);
	setTimeout(solve, 4000);
}, false);


var scramble = function(m){
	var moves = 'u d f b l r'.split(' ');

	for(var i=0; i<m; i++) {
		var r = Math.random();
		cube.makeMove(moves[Math.floor(Math.random()*moves.length)] + (r > 1/2 ? "'" : ""));//r > 1/3 ? "2" : ""));
	}
};
var solve = function(){
	var solver = new RubiksCubeSolver();
	var state = cube.getState();
	var solution = solver.solve(state);
	cube.makeMoves(solution);
	return solution.split(' ').length;
};
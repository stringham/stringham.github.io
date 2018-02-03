var drawCurve = function(ctx,x,y,w,h,s,e) {
	var reverse = false;
	if(s > e) {
		reverse = true;
		var temp = s;
		s = e;
		e = temp;
	}
	var xr = w/2;
	var yr = h/2;
	var k = 0.5522847498;
	var pointAt = function(t) {
		//Tangent to an ellipse: (x(t),y(t))t = (w(cosα - tsinα),h(sinα + tcosα))
		//Note that if t=0, (x,y) = (w(cosα),h(sinα)), the point on the circle.
		//And if t=k, (x,y) = (w(cosα - ksinα),h(sinα + kcosα)), which is the control point we want.
		return {
			t:t,
			x:x+xr + Math.cos(t)*xr,
			y:y+yr + Math.sin(t)*yr,
			xt:function(k) {return x+xr + xr*(Math.cos(t) - k*Math.sin(t));}, //In direction of positive t
			yt:function(k) {return y+yr + yr*(Math.sin(t) + k*Math.cos(t));},
			xt2:function(k) {return x+xr + xr*(Math.cos(t) - (-k*Math.sin(t)));}, //In direction of negative t
			yt2:function(k) {return y+yr + yr*(Math.sin(t) + -k*Math.cos(t));}
		};
	}
	var points = [];
	//Now draw the actual ellipse/pie slice
	for(var t = s; t < e; t += Math.PI*0.5)
		points.push(pointAt(t));
	points.push(pointAt(e));

	ctx.moveTo(x+xr + Math.cos(reverse?e:s)*xr, y+yr + Math.sin(reverse?e:s)*yr);

	if(reverse) points.reverse();

	for(var i = 0; i < points.length-1; i++) {
		var kval = k * (points[i+1].t-points[i].t)/(Math.PI/2);
		ctx.bezierCurveTo(points[i].xt(kval), points[i].yt(kval), points[i+1].xt2(kval), points[i+1].yt2(kval), points[i+1].x, points[i+1].y);
	}
	return points[points.length-1];
}

function Logo(canvas, size){
	this.canvas = canvas;
	this.ctx = canvas.getContext('2d');
	this.duration = 750;

	this.size = size || 100;
	this.offset = this.size*3/100+3;
	this.canvas.setAttribute('width',2*this.offset+this.size);
	this.canvas.setAttribute('height',2*this.offset+this.size);
	this.letterWidth = .182*this.size;
	this.leftLetter = .14*this.size;
	this.bottomLetter = .772*this.size;
	this.color = '#085dad';
}

Logo.prototype.drawCircle = function(p){
	var ctx = this.ctx;
	var size = this.size;
	var offset = this.offset;

	ctx.beginPath();
	ctx.strokeStyle = this.color;
	ctx.lineWidth = this.size*3/100;
	var lastPoint = drawCurve(ctx,0,0,size,size,3*Math.PI/2,3*Math.PI/2+p*2*Math.PI,true);
	ctx.stroke();
	if(p < 1){
		ctx.fillStyle = this.color;
		ctx.beginPath();
		ctx.arc(lastPoint.x,lastPoint.y,this.size*3/100+2,0,2*Math.PI);
		ctx.fill();
	}
}

function part(start, durration, current){
	if(current <= start)
		return 0;
	return Math.min((current-start)/durration,1);
}

Logo.prototype.drawR = function(p){
	var ctx = this.ctx;
	var lw = this.letterWidth;
	ctx.save();
	ctx.fillStyle = '#60dcfb';
	ctx.lineWidth = 0;
	ctx.translate(this.leftLetter,this.bottomLetter);
	var h = part(0,.5,p)*lw*2;
	var extra = part(.5,.125,p)*lw;
	ctx.beginPath()
	ctx.moveTo(lw,0);
	ctx.lineTo(0,0);
	ctx.lineTo(0,-h-extra);
	if(p > .625) ctx.lineTo(lw*part(.625,.125,p), -h-extra);
	if(p > .75){
		ctx.lineTo(lw+lw*part(.75,.25,p),-h-extra);
		ctx.lineTo(lw+lw*part(.75,.25,p),-h);
	}
	ctx.lineTo(lw,-h);
	ctx.closePath();
	ctx.fill();
	ctx.restore();
}

Logo.prototype.drawS = function(p){
	var ctx = this.ctx;
	var lw = this.letterWidth;
	ctx.save();
	ctx.fillStyle = this.color;
	ctx.beginPath();
	ctx.translate(this.leftLetter,this.bottomLetter);
	ctx.moveTo(lw*4, -2*lw);
	ctx.lineTo(lw*4, -3*lw);
	ctx.lineTo(lw*4-lw*part(0,.2,p),-3*lw);
	if(p>.2) ctx.lineTo(lw*3-lw*part(.2,.1,p),-3*lw);
	if(p>.3) ctx.lineTo(lw*2,-3*lw+lw*part(.3,.1,p));
	if(p>.4) ctx.lineTo(lw*2,-2*lw+lw*part(.4,.2,p));
	if(p>.8){
		ctx.lineTo(lw*2-lw*part(.8,.2,p),-lw);
		ctx.lineTo(lw*2-lw*part(.8,.2,p),0);
	}
	if(p>.7) ctx.lineTo(lw*3-lw*part(.7,.1,p),-lw+lw);
	if(p>.6) ctx.lineTo(lw*3,-lw+lw*part(.6,.1,p));
	if(p>.4) ctx.lineTo(lw*3,-2*lw+lw*part(.4,.2,p));
	ctx.lineTo(lw*4-lw*part(0,.2,p),-2*lw);
	ctx.closePath();
	ctx.fill();
	ctx.restore();
}

Logo.prototype.easingFns = {
	bounce:function(p){
		p=1-p;
		for(var a = 0, b = 1, result; 1; a += b, b /= 2) {
			if (p >= (7 - 4 * a) / 11) {
				return 1-(-Math.pow((11 - 6 * a - 11 * p) / 4, 2) + Math.pow(b, 2))
			}
		}
	},
	linear:function(p){
		return p;
	}
}

Logo.prototype.animate = function(duration,synchronous){
	if(this.isAnimating){
		return;
	}
	var interpolate = function(p){
		return this.easingFns.linear(p);
	}.bind(this);
	var me = this;
	var ctx = this.ctx;
	var frame = 0;
	this.isAnimating = true;
	duration = duration || this.duration;
	var startTime = Date.now();
	function next(){
		frame++;
		var time = Date.now() - startTime;
		ctx.clearRect(0,0,me.size+2*me.offset,me.size+2*me.offset);
		ctx.save();
		ctx.translate(me.offset,me.offset);
		var p = interpolate(Math.min(1,time/duration));
		me.drawCircle(p);
		if(!synchronous){
			me.drawR(p);
			me.drawS(p);
		} else{
			me.drawR(Math.min(1,2*p));
			if(p > .5){
				me.drawS(2*(p-.5));
			}
		}
		ctx.restore();
		if(p < 1){
			requestAnimationFrame(next);
		} else {
			me.isAnimating = false;
		}
	}
	next();
}

Logo.prototype.drawFrame = function(p){
	this.ctx.clearRect(0,0,this.size+2*this.offset,this.size+2*this.offset);
	this.ctx.save();
	this.ctx.translate(this.offset,this.offset);
	this.drawCircle(p);
	this.drawR(p);
	this.drawS(p);
	this.ctx.restore();
};

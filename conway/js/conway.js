// Code goes here
var c, ctx, stop = true, aliveOption = 'fourth';
document.addEventListener("DOMContentLoaded", function() {
  c = document.getElementById('canvas');
  ctx = c.getContext('2d');

  c.onclick = function(){
    stop = !stop;
    setTimeout(doLife, 30);
  }

  var images = [];
  for(var i=1; i<90; i++){
    images.push('img/'+i+'.jpg');
  }
  shuffle(images);
  images.unshift('img/0.jpg');
  var container = document.getElementById('options');
  images.forEach(function(src, i){
    if(i >= 30) return;
    var img = new Image();
    if(i == 0){
      img.onload = function(){
        ctx.drawImage(img,0,0);
      }
    }
    img.src = src;
    img.crossOrigin = "Anonymous";
    var div = document.createElement('div');
    div.className = 'choice'
    container.appendChild(div);
    div.appendChild(img);
    div.onclick = function(){
      stop = true;
      ctx.drawImage(img, 0, 0, 320, 320);
    }
  });

  var customImg = new Image();
  customImg.crossOrigin = "Anonymous";
  customImg.onload = function(){
    stop = true;

    var size = Math.min(this.width, this.height);
    ctx.drawImage(customImg, (this.width-size)/2, (this.height-size)/2, size, size, 0, 0, 320, 320);
    customImg.src = '';
    setTimeout(function() {
      stop = false;
      doLife();
    }, 500);
  }

  customImg.onerror = function(){
    if(window.location.href != this.src)
      alert('Could not load image. Please try another one.');
  }

  var custom = document.getElementById('custom');
  var button = document.getElementById('custom-button');
  button.onclick = function(e){
    customImg.src = custom.value;
  }

  updateOptions();

  function addOptionClickHandler(o){
    o.onclick = function(){
      aliveOption = o.id;
      updateOptions();
    }
  }
  var options = document.getElementsByClassName('alive-option');
  for(var i=0; i<options.length; i++){
    addOptionClickHandler(options[i]);
  }
});

function updateOptions(){
  var options = document.getElementsByClassName('alive-option');
  for(var i=0; i<options.length; i++){
    var o = options[i];
    if(aliveOption == o.id){
      o.className = 'alive-option selected'
    } else {
      o.className = 'alive-option'
    }
  }
}

function shuffle(o){
    for(var j, x, i = o.length; i; j = Math.floor(Math.random() * i), x = o[--i], o[i] = o[j], o[j] = x);
    return o;
};

function randomColor() {
  return 'rgba(' + Math.floor(Math.random() * 256) + ',' + Math.floor(Math.random() * 256) + ',' + Math.floor(Math.random() * 256) + ',1)';
}

function fillRandom() {
  for (var i = 0; i < 320; i++) {
    for (var j = 0; j < 320; j++) {
      ctx.fillStyle = randomColor();
      ctx.fillRect(i, j, 1, 1);
    }
  }
}

function doLife() {
  if(stop) return;
  var imageData = ctx.getImageData(0, 0, 320, 320);
  // console.log(imageData);
  var canvas = document.createElement('canvas');
  var newData = canvas.getContext('2d').createImageData(320, 320);
  for (var x = 0; x < imageData.width; x++) {
    for (var y = 0; y < imageData.height; y++) {
      var alive = isAlive(x, y, imageData);
      var aliveNeighbors = numAliveNeighbors(x, y, imageData);
      if (alive && (aliveNeighbors < 2 || aliveNeighbors > 3)) {
        color = manCell(x, y, false, imageData);
      } else if (!alive && aliveNeighbors == 3) {
        color = manCell(x, y, true, imageData);
      } else {
        color = getColor(x, y, imageData);
      }
      // console.log(color);
      setColor(x, y, newData, color);
    }
  }
  ctx.putImageData(newData, 0, 0);
  if(!stop)
    requestAnimationFrame(doLife);
}

var isAliveFns = {};

isAliveFns['red'] = function(x,y,imageData){
  //red
  return imageData.data[y * imageData.width * 4 + x * 4 + 0]  > 200;
};

isAliveFns['green'] = function(x,y,imageData){
  //blue
  return imageData.data[y * imageData.width * 4 + x * 4 + 1]  > 200;
};

isAliveFns['blue'] = function(x,y,imageData){
  //green
  return imageData.data[y * imageData.width * 4 + x * 4 + 2]  > 200;
};

isAliveFns['half'] = function(x,y,imageData){
  //half
  var px = y * imageData.width * 4 + x * 4;
  return (imageData.data[px] + imageData.data[px+1] + imageData.data[px+2]) % 2 == 0;
};

isAliveFns['third'] = function(x,y,imageData){
  //third
  var px = y * imageData.width * 4 + x * 4;
  return (imageData.data[px] + imageData.data[px+1] + imageData.data[px+2]) % 3 == 0;
};

isAliveFns['fourth'] = function(x,y,imageData){
  //fourth
  var px = y * imageData.width * 4 + x * 4;
  return (imageData.data[px] + imageData.data[px+1] + imageData.data[px+2]) % 4 == 0;
};

function isAlive(x, y, imageData) {
  var fn = aliveOption || 'red';
  return isAliveFns[fn](x,y,imageData);
}

function numAliveNeighbors(x, y, imageData) {
  var numAlive = 0;
  for (var i = -1; i <= 1; i++) {
    for (var j = -1; j <= 1; j++) {
      if (j === 0 && i === 0) continue;
      var newX = x + i;
      var newY = y + j;
      if (newX >= 0 && newY >= 0 && newX < imageData.width && newY < imageData.height && isAlive(newX, newY, imageData)) {
        numAlive++;
      }
    }
  }
  return numAlive;
}

function getColor(x, y, imageData) {
  return [
    imageData.data[y * imageData.width * 4 + x * 4],
    imageData.data[y * imageData.width * 4 + x * 4 + 1],
    imageData.data[y * imageData.width * 4 + x * 4 + 2],
    imageData.data[y * imageData.width * 4 + x * 4 + 3]
  ];
}

function setColor(x, y, imageData, color) {
  imageData.data[y * imageData.width * 4 + x * 4] = color[0];
  imageData.data[y * imageData.width * 4 + x * 4 + 1] = color[1];
  imageData.data[y * imageData.width * 4 + x * 4 + 2] = color[2];
  imageData.data[y * imageData.width * 4 + x * 4 + 3] = color[3];
}

function manCell(x, y, alive, imageData) {
  var colors = [];
  for (var i = -1; i <= 1; i++) {
    for (var j = -1; j <= 1; j++) {
      if (j === 0 && i === 0) continue;
      var newX = x + i;
      var newY = y + j;
      if (newX >= 0 && newY >= 0 && newX < imageData.width && newY < imageData.height) {
        var aliveCheck = isAlive(newX, newY, imageData);
        if (alive && aliveCheck || !alive && !aliveCheck) {
          colors.push(getColor(newX, newY, imageData));
        }
      }
    }
  }
  if (colors.length > 0) {
    return colors[Math.floor(Math.random() * colors.length) *0];
  }
  // console.log('huh...',x,y,alive, isAlive(x,y,imageData));
  return getColor(x, y, imageData);
  // return invert(getColor(x, y, imageData));
  // return [Math.floor(Math.random()*256),Math.floor(Math.random()*256),Math.floor(Math.random()*256),Math.floor(Math.random()*256)];
}

function invert(color) {
  return [255 - color[0], 255 - color[1], 255 - color[2], 255];
}
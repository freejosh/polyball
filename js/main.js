/*global
Raphael
*/
/*jshint
smarttabs: true,
trailing: true,
eqeqeq: true,
immed: true,
devel: true,
browser: true,
unused: true,
undef: true
*/

var ongoingTouches = [];

function handleStart(evt) {
	evt.preventDefault();
	
	var touches = evt.changedTouches;
	var touch;
	for (var i = 0; i < touches.length; i++) {
		touch = touches[i];
		ongoingTouches.push(touch);
		touch.circle = r.circle(touch.pageX, touch.pageY, 10);
	}
}

function ongoingTouchIndexById(idToFind) {
	for (var i = 0; i < ongoingTouches.length; i++) {
		var id = ongoingTouches[i].identifier;
		if (id === idToFind) return i;
	}
	return -1;
}

function handleMove(evt) {
	evt.preventDefault();
	var touches = evt.changedTouches;
	var touch;
	var oldTouch;

	for (var i = 0; i < touches.length; i++) {
		touch = touches[i];
		var idx = ongoingTouchIndexById(touch.identifier);
		oldTouch = ongoingTouches[idx];
		
		touch.circle = oldTouch.circle;
		touch.circle.attr({
			cx: touch.pageX,
			cy: touch.pageY
		});
		
		ongoingTouches.splice(idx, 1, touch);
	}
}

function handleEnd(evt) {
	evt.preventDefault();
	var touches = evt.changedTouches;
	var touch;

	for (var i = 0; i < touches.length; i++) {
		touch = touches[i];
		var idx = ongoingTouchIndexById(touch.identifier);
		ongoingTouches[idx].circle.remove();
		
		ongoingTouches.splice(idx, 1);
	}
}

function handleCancel(evt) {
	evt.preventDefault();
	var touches = evt.changedTouches;

	for (var i = 0; i < touches.length; i++) {
		ongoingTouches.splice(i, 1);
	}
}

var r;

Raphael(function() {
	r = Raphael(0, 0, '100%', '100%');

	var el = r.canvas;

	el.addEventListener("touchstart", handleStart, false);
	el.addEventListener("touchend", handleEnd, false);
	el.addEventListener("touchcancel", handleCancel, false);
	el.addEventListener("touchmove", handleMove, false);
});
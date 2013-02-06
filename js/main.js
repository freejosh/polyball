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

var touchesById = {};
var sortedTouches = [];
var touchCenter = { x: null, y: null };

/**
 * Determine whether one point should be before or after another when ordering clockwise.
 *
 * @param {Object} a Point a.
 * @param {Integer} a.x X coordinate of a.
 * @param {Integer} a.y Y coordinate of a.
 * @param {Object} b Point b.
 * @param {Integer} b.x X coordinate of b.
 * @param {Integer} b.y Y coordinate of b.
 *
 * @return {Boolean} False if a should come before b, true otherwise.
 *
 * @see http://stackoverflow.com/questions/6989100/sort-points-in-clockwise-order
 */
function compareTouches(a, b) {
	var ax = a.pageX;
	var ay = a.pageY;
	var bx = b.pageX;
	var by = b.pageY;
	var cx = touchCenter.x;
	var cy = touchCenter.y;

	if (ax >= 0 && bx < 0) return true;
	if (ax === 0 && bx === 0) return ay > by;

	// compute the cross product of vectors (center -> a) x (center -> b)
	var det = (ax - cx) * (by - cy) - (bx - cx) * (ay - cy);
	if (det < 0) return true;
	if (det > 0) return false;

	// points a and b are on the same line from the center
	// check which point is closer to the center
	var d1 = (ax - cx) * (ax - cx) + (ay - cy) * (ay - cy);
	var d2 = (bx - cx) * (bx - cx) + (by - cy) * (by - cy);
	return d1 > d2;
}

function recenterTouches() {
	var avgX = 0;
	var avgY = 0;
	var numTouches = sortedTouches.length;
	var touch;

	if (numTouches === 0) {
		touchCenter.x = null;
		touchCenter.y = null;
		return;
	}

	if (numTouches === 1) {
		touch = sortedTouches[0];
		touchCenter.x = touch.pageX;
		touchCenter.y = touch.pageY;
		return;
	}

	for (var i = 0; i < numTouches; i++) {
		touch = sortedTouches[i];
		avgX += touch.pageX;
		avgY += touch.pageY;
	}

	avgX /= numTouches;
	avgY /= numTouches;

	touchCenter.x = avgX;
	touchCenter.y = avgY;
}

function addTouch(touch, recenter) {
	touchesById[touch.identifier] = touch;
	
	var i;
	for (i = 0; i < sortedTouches.length; i++) {
		if (compareTouches(touch, sortedTouches[i])) break;
	}

	sortedTouches.splice(i, 0, touch);
	if (recenter !== false) recenterTouches();
}

function removeTouch(id, recenter) {
	for (var i = 0; i < sortedTouches.length; i++) {
		if (sortedTouches[i].identifier === id) {
			sortedTouches.splice(i, 1);
			break;
		}
	}

	var touch = touchesById[id];
	delete touchesById[id];
	if (recenter !== false) recenterTouches();
	return touch;
}

function moveTouch(touch) {
	removeTouch(touch.identifier, false);
	addTouch(touch, false);
	recenterTouches();
}

function handleStart(evt) {
	evt.preventDefault();
	
	var touches = evt.changedTouches;
	for (var i = 0; i < touches.length; i++) {
		var touch = touches[i];
		touch.circle = r.circle(touch.pageX, touch.pageY, 10);
		addTouch(touch);
	}
}

function handleMove(evt) {
	evt.preventDefault();
	var touches = evt.changedTouches;
	var touch;
	var oldTouch;

	for (var i = 0; i < touches.length; i++) {
		touch = touches[i];
		oldTouch = touchesById[touch.identifier];
		
		touch.circle = oldTouch.circle;
		touch.circle.attr({
			cx: touch.pageX,
			cy: touch.pageY
		});
		
		moveTouch(touch);
	}
}

function handleEnd(evt) {
	evt.preventDefault();
	var touches = evt.changedTouches;

	for (var i = 0; i < touches.length; i++) {
		removeTouch(touches[i].identifier).circle.remove();
	}
}

function handleCancel(evt) {
	evt.preventDefault();
	var touches = evt.changedTouches;

	for (var i = 0; i < touches.length; i++) {
		delete touchesById[touches[i].identifier];
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
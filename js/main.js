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
var touchCenter = { pageX: null, pageY: null };
var userPoly = null;

function refreshUserPoly() {
	var numTouches = sortedTouches.length;

	if (numTouches <= 2) {
		if (userPoly !== null) {
			userPoly.remove();
			userPoly = null;
		}
		return;
	}

	if (userPoly === null) {
		userPoly = r.path();
		userPoly.attr({
			stroke: 'black',
			'stroke-opacity': 0.1,
			'stroke-dasharray': '-',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
			'stroke-width': 5
		});
	}

	var pathString = '';
	var touch;
	var x;
	var y;
	for (var i = 0; i < numTouches; i++) {
		touch = sortedTouches[i];
		x = touch.pageX;
		y = touch.pageY;

		if (i === 0) {
			pathString += 'M';
		} else {
			pathString += 'L';
		}

		pathString += x + ',' + y;
	}
	pathString += 'Z';

	userPoly.attr('path', pathString);

	console.log('');
	for (i = 0; i < sortedTouches.length; i++) {
		console.log(sortedTouches[i].identifier);
	}
}

/**
 * Determine whether one point should be before or after another when ordering clockwise.
 *
 * @param {Object} a Point a.
 * @param {Integer} a.pageX X coordinate of a.
 * @param {Integer} a.pageY Y coordinate of a.
 * @param {Object} b Point b.
 * @param {Integer} b.pageX X coordinate of b.
 * @param {Integer} b.pageY Y coordinate of b.
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
	var cx = touchCenter.pageX;
	var cy = touchCenter.pageY;

	// center of points will be center of coordinates
	ax = ax - cx;
	ay = ay - cy;
	bx = bx - cx;
	by = by - cy;

	if (ax >= 0 && bx < 0) return true;
	if (ax === 0 && bx === 0) return ay > by;

	// compute the cross product of vectors (center -> a) x (center -> b)
	var det = ax * by - bx * ay;
	if (det < 0) return true;
	if (det > 0) return false;

	// points a and b are on the same line from the center
	// check which point is closer to the center
	return (ax * ax + ay * ay) > (bx * bx + by * by);
}

function recenterTouches() {
	var avgX = 0;
	var avgY = 0;
	var numTouches = sortedTouches.length;
	var touch;

	if (numTouches === 0) {
		touchCenter.pageX = null;
		touchCenter.pageY = null;
		return;
	}

	if (numTouches === 1) {
		touch = sortedTouches[0];
		touchCenter.pageX = touch.pageX;
		touchCenter.pageY = touch.pageY;
		return;
	}

	for (var i = 0; i < numTouches; i++) {
		touch = sortedTouches[i];
		avgX += touch.pageX;
		avgY += touch.pageY;
	}

	avgX /= numTouches;
	avgY /= numTouches;

	touchCenter.pageX = avgX;
	touchCenter.pageY = avgY;
}

function addTouch(touch, recenter) {
	var circle = r.circle(touch.pageX, touch.pageY, 20);
	circle.attr({
		'stroke-width': 0,
		fill: 'black',
		'fill-opacity': 0.2
	});
	touch.circle = circle;
	touchesById[touch.identifier] = touch;
	sortedTouches.splice(0, 0, touch);
	
	if (recenter !== false) recenterTouches();

	sortedTouches.sort(compareTouches);

	refreshUserPoly();
}

function removeTouch(id, recenter) {
	for (var i = 0; i < sortedTouches.length; i++) {
		if (sortedTouches[i].identifier === id) {
			sortedTouches.splice(i, 1);
			break;
		}
	}
	var touch = touchesById[id];
	touch.circle.remove();
	delete touchesById[id];
	if (recenter !== false) recenterTouches();
	refreshUserPoly();
	
	return touch;
}

function moveTouch(touch) {
	var oldTouch = touchesById[touch.identifier];
		
	touch.circle = oldTouch.circle;
	touch.circle.attr({
		cx: touch.pageX,
		cy: touch.pageY
	});
	removeTouch(touch.identifier, false);
	addTouch(touch);
}

function handleStart(evt) {
	evt.preventDefault();
	
	var touches = evt.changedTouches;
	for (var i = 0; i < touches.length; i++) {
		var touch = touches[i];
		addTouch(touch);
	}
}

function handleMove(evt) {
	evt.preventDefault();
	var touches = evt.changedTouches;
	var touch;

	for (var i = 0; i < touches.length; i++) {
		touch = touches[i];
		moveTouch(touch);
	}
}

function handleEnd(evt) {
	evt.preventDefault();
	var touches = evt.changedTouches;

	for (var i = 0; i < touches.length; i++) {
		removeTouch(touches[i].identifier);
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
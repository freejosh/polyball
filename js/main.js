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

var r;
var userPolySet;
var touchesById = {};
var sortedTouches = [];
var touchCenter = { pageX: null, pageY: null };
var userPoly = null;
var lastTouchEnd = 0;

/**
 * Convert array of points to path string. Each point in array must be an object
 * with coordinate elements of either `x` and `y` or `pageX` and `pageY`.
 *
 * @param {Array} points
 *
 * @return {String} Path string.
 */
function pointsToPath(points) {
	var point;
	var pathString = '';
	for (var i = 0; i < points.length; i++) {
		point = points[i];
		
		if (point.pageX === undefined || point.pageY === undefined) {
			continue;
		}

		if (i === 0) {
			pathString += 'M';
		} else {
			pathString += 'L';
		}

		pathString += point.pageX + ',' + point.pageY;
	}
	pathString += 'Z';

	return pathString;
}

/**
 * Refreshes path, adds, or removes `userPoly` based on touches in
 * `sortedTouches`.
 */
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

	userPoly.attr('path', pointsToPath(sortedTouches));
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

/**
 * Sets `touchCenter` to average coordinates of `sortedTouches`.
 */
function setTouchesCenter() {
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

/**
 * Handles adding a touch.
 *
 * @param {Object} touch
 * @param {Boolean} recenter Calls `setTouchesCenter` if anything but `false`.
 */
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
	
	if (recenter !== false) setTouchesCenter();

	sortedTouches.sort(compareTouches);

	refreshUserPoly();
}

/**
 * Handles removing a touch.
 *
 * @param {Integer} id Touch identifier.
 * @param {Boolean} recenter Calls `setTouchesCenter` if anything but `false`.
 *
 * @return {Object} The removed touch.
 */
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
	if (recenter !== false) setTouchesCenter();
	refreshUserPoly();
	
	return touch;
}

/**
 * Handles moving a touch.
 *
 * @param {Object} touch
 */
function moveTouch(touch) {
	var oldTouch = touchesById[touch.identifier];
	if (oldTouch === undefined) return;
		
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
	var now = Date.now();
	var touchRemoveThreshold = 500;
	var path, center;
	
	if (userPoly && now - lastTouchEnd > touchRemoveThreshold) {
		path = userPoly.attr('path');
		center = {
			pageX: touchCenter.pageX,
			pageY: touchCenter.pageY
		};

		setTimeout(function() {
			if (sortedTouches.length === 0) {
				fillUserPoly(path, center);
			}
		}, touchRemoveThreshold);
	}

	for (var i = 0; i < touches.length; i++) {
		removeTouch(touches[i].identifier);
	}

	lastTouchEnd = now;
}

/**
 * Animate polygon from center to full size.
 *
 * @param {String} path Ending shape.
 * @param {Object} center Center of points.
 * @param {Integer} center.x
 * @param {Integer} center.y
 */
function fillUserPoly(path, center) {
	var poly = r.path('M' + center.pageX + ',' + center.pageY);
	userPolySet.push(poly);
	poly
		.data('filling', true)
		.attr({
			'stroke-width': 0,
			fill: '#f00'
		})
		.animate({ path: path }, 1000, 'linear', solidifyUserPoly);

	// for debug until balls are bouncing to solidify
	poly.touchstart(solidifyUserPoly);
}

/**
 * Stop animation and mark poly as filled.
 *
 * @this {Element} Polygon element.
 */
function solidifyUserPoly() {
	this
		.stop()
		.attr('fill', '#000')
		.data('filling', false);
}

Raphael(function() {
	r = Raphael(0, 0, '100%', '100%');
	userPolySet = r.set();

	var el = r.canvas;

	el.addEventListener('touchstart', handleStart, false);
	el.addEventListener('touchend', handleEnd, false);
	el.addEventListener('touchcancel', handleEnd, false);
	el.addEventListener('touchmove', handleMove, false);

	// Debug buttons
	document.getElementById('randomTouches').addEventListener('click', debugRandomTouches, false);
	document.getElementById('removeTouches').addEventListener('click', debugRemoveTouches, false);
});

// Debug functions

var debugTouchEvent;

function debugRandomTouches() {
	var x, y;
	debugTouchEvent = {
		preventDefault: function(){},
		changedTouches: []
	};
	for (var i = 0; i < Math.floor(Math.random() * 11); i++) {
		x = Math.floor(Math.random() * 701);
		y = Math.floor(Math.random() * 701);

		debugTouchEvent.changedTouches.push({
			identifier: i + 100,
			pageX: x,
			pageY: y
		});
	}

	handleStart(debugTouchEvent);
}

function debugRemoveTouches() {
	handleEnd(debugTouchEvent);
}
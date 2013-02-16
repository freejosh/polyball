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

var r = null;
var userPolySet = null;
var touchesById = {};
var sortedTouches = [];
var touchCenter = { pageX: null, pageY: null };
var userPoly = null;
var lastTouchEnd = 0;
var canvas = null;
var gameBalls = null;

// http://paulirish.com/2011/requestanimationframe-for-smart-animating/
// http://my.opera.com/emoller/blog/2011/12/20/requestanimationframe-for-smart-er-animating
// requestAnimationFrame polyfill by Erik Möller
// fixes from Paul Irish and Tino Zijdel
(function() {
	var lastTime = 0;
	var vendors = ['ms', 'moz', 'webkit', 'o'];
	for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
		window.requestAnimationFrame = window[vendors[x]+'RequestAnimationFrame'];
		window.cancelAnimationFrame = window[vendors[x]+'CancelAnimationFrame'] || window[vendors[x]+'CancelRequestAnimationFrame'];
	}
 
	if (!window.requestAnimationFrame)
		window.requestAnimationFrame = function(callback) {
			var currTime = new Date().getTime();
			var timeToCall = Math.max(0, 16 - (currTime - lastTime));
			var id = window.setTimeout(function() { callback(currTime + timeToCall); },
			  timeToCall);
			lastTime = currTime + timeToCall;
			return id;
		};
 
	if (!window.cancelAnimationFrame)
		window.cancelAnimationFrame = function(id) {
			clearTimeout(id);
		};
}());

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
 * Initializes game board by setting up the boundaries, etc.
 */
function initGameBoard(w, h) {
	if (canvas === null) canvas = document.getElementById('canvas');

	if (r !== null) r.remove();

	r = Raphael(canvas, '100%', '100%');

	var cx = window.innerWidth / 2;
	var cy = window.innerHeight / 2;

	r.rect(cx, cy, 0, 0, 5)
		.toBack()
		.attr({
			fill: '#fff'
		})
		.animate({
			width: w,
			height: h,
			x: cx - w / 2,
			y: cy - h / 2
		}, 1000, 'easeInOut', function() {
			initGameBalls(Math.floor(Math.random() * 11));
		});

	if (userPolySet !== null) userPolySet.clear();
	userPolySet = r.set();
}

function initGameBalls(numBalls) {
	var gameBoard = r.bottom.getBBox();
	var cx, cy;

	if (gameBalls !== null) gameBalls.clear();

	gameBalls = r.set();
	for (var i = 0; i < numBalls; i++) {
		cx = gameBoard.x + Math.floor(Math.random() * gameBoard.width);
		cy = gameBoard.y + Math.floor(Math.random() * gameBoard.height);

		gameBalls.push(
			r.circle(cx, cy, 10)
			.attr({
				fill: '#f00',
				'stroke-width': 0
			})
			.data('m', 1)
			.data('vx', Math.random() * 10 - 5)
			.data('vy', Math.random() * 10 - 5)
			.data('checkedBall', {})
		);
	}
	
	animationLoop();
}

function animationLoop(t) {
	if (t === undefined) t = +Date.now();

	var gameBoard = r.bottom;
	var boardBBox = gameBoard.getBBox();

	gameBalls.forEach(function(ball) {
		// reset which other balls we've checked this one against
		var ball1Checked = {};
		ball1Checked[ball.id] = true;
		ball.data('checkedBall', ball1Checked);

		var b1x = ball.attr('cx');
		var b1y = ball.attr('cy');
		var b1r = ball.attr('r');
		var b1m = ball.data('m');
		var b1vx = ball.data('vx');
		var b1vy = ball.data('vy');

		// check against every other ball for a collision
		gameBalls.forEach(function(ball2) {
			var ball2Checked = ball2.data('checkedBall');
			if (ball1Checked[ball2.id] || ball2Checked[ball.id]) return;

			var b2x = ball2.attr('cx');
			var b2y = ball2.attr('cy');
			var b2r = ball2.attr('r');
			var b2m = ball2.data('m');
			var b2vx = ball2.data('vx');
			var b2vy = ball2.data('vy');

			// see http://compsci.ca/v3/viewtopic.php?t=14897 for circle collision tutorial
			
			var dx = b2x - b1x;
			var dy = b2y - b1y;
			var dvx = b1vx - b2vx;
			var dvy = b1vy - b2vy;

			// distance for collision to occur
			var minDist = b1r + b2r + 1e-9;

			// check that balls are moving toward each other and are minDist apart.
			if (dx * dvx + dy * dvy > 0 && dx * dx + dy * dy <= minDist * minDist) {
				// remove small epsilon from minDist for using it below
				minDist -= 1e-9;

				var nx = (b1x - b2x) / minDist;// x normal
				var ny = (b1y - b2y) / minDist;// y normal

				var a1 = b1vx * nx + b1vy * ny;// ball1 impulse
				var a2 = b2vx * nx + b2vy * ny;// ball2 impulse
				var p = 2 * (a1 - a2) / (b1m + b2m);// result impulse
				
				// new velocities
				b1vx = b1vx - p * nx * b2m;
				b1vy = b1vy - p * ny * b2m;
				
				b2vx = b2vx + p * nx * b1m;
				b2vy = b2vy + p * ny * b1m;

				ball2.data('vx', b2vx);
				ball2.data('vy', b2vy);
			}

			ball1Checked[ball2.id] = true;
			ball2Checked[ball.id] = true;
		});

		// walls
		if (b1x - b1r <= boardBBox.x) {
			// bounce off left
			b1x = boardBBox.x + b1r;
			b1vx *= -1;
		}

		if (b1x + b1r >= boardBBox.x + boardBBox.width) {
			// bounce off right
			b1x = boardBBox.x + boardBBox.width - b1r;
			b1vx *= -1;
		}

		if (b1y - b1r <= boardBBox.y) {
			b1y = boardBBox.y + b1r;
			b1vy *= -1;
		}

		if (b1y + b1r >= boardBBox.y + boardBBox.height) {
			b1y = boardBBox.y + boardBBox.height - b1r;
			b1vy *= -1;
		}

		var x2 = b1x + b1vx;
		var y2 = b1y + b1vy;

		ball
			.data('vx', b1vx)
			.data('vy', b1vy)
			.attr({
				cx: x2,
				cy: y2
			});
	});

	window.requestAnimationFrame(animationLoop);
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

	if (ax >= 0 && bx < 0) return 1;
	if (ax === 0 && bx === 0) return ay > by ? 1 : 0;

	// compute the cross product of vectors (center -> a) x (center -> b)
	var det = ax * by - bx * ay;
	if (det < 0) return 1;
	if (det > 0) return 0;

	// points a and b are on the same line from the center
	// check which point is closer to the center
	return (ax * ax + ay * ay) > (bx * bx + by * by) ? 1 : 0;
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
	var circle = r.circle(touch.pageX, touch.pageY, 50);
	circle.attr({
		'stroke-width': 0,
		fill: 'black',
		'fill-opacity': 0.2
	});
	touch.circle = circle;
	touchesById[touch.identifier] = touch;
	sortedTouches.splice(0, 0, touch);
	
	if (recenter !== false) {
		setTouchesCenter();
	sortedTouches.sort(compareTouches);
	refreshUserPoly();
}
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
	
	if (recenter !== false) {
		setTouchesCenter();
		sortedTouches.sort(compareTouches);
	refreshUserPoly();
	}
	
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
	initGameBoard(800, 600);

	canvas.addEventListener('touchstart', handleStart, false);
	canvas.addEventListener('touchend', handleEnd, false);
	canvas.addEventListener('touchcancel', handleEnd, false);
	canvas.addEventListener('touchmove', handleMove, false);

	// Debug buttons
	document.getElementById('randomTouches').addEventListener('click', debugRandomTouches, false);
	document.getElementById('removeTouches').addEventListener('click', debugRemoveTouches, false);
});

// Debug functions

var debugTouchEvent = null;

function debugRandomTouches() {
	var x, y;
	var board = r.bottom.getBBox();

	if (debugTouchEvent !== null) {
		debugRemoveTouches();
	}
	debugTouchEvent = {
		preventDefault: function(){},
		changedTouches: []
	};
	for (var i = 0; i < Math.floor(Math.random() * 8) + 3; i++) {
		x = Math.floor(Math.random() * board.width) + board.x;
		y = Math.floor(Math.random() * board.height) + board.y;

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
	debugTouchEvent = null;
}
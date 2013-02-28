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
var fingerRadius = 30;
var gamePaused = true;
var userLevel = 0;
var boardPercent = null;
var boardPercentText = null;

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

function growBBox(bbox, top, right, bottom, left) {
	if (top !== undefined && right === undefined && bottom === undefined && left === undefined) {
		right = top;
		bottom = top;
		left = top;
	} else if (top !== undefined && right !== undefined && bottom === undefined && left === undefined) {
		bottom = top;
		left = right;
	} else if (top !== undefined && right !== undefined && bottom !== undefined && left === undefined) {
		left = right;
	}

	bbox.x -= left;
	bbox.y -= top;
	bbox.x2 += right;
	bbox.y2 += bottom;
	bbox.width += right + left;
	bbox.height += top + bottom;

	return bbox;
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

function resetGame() {
	userLevel = 0;
	nextLevel();
}

/**
 * Initializes game board by setting up the boundaries, etc.
 */
function initGameBoard() {
	var w = window.innerWidth - fingerRadius * 4;
	var h = window.innerHeight - fingerRadius * 4;
	var cx = window.innerWidth / 2;
	var cy = window.innerHeight / 2;

	if (userPolySet !== null) {
		userPolySet.forEach(function(poly) {
			poly.remove();
		});
		userPolySet.clear();
	}
	userPolySet = r.set();

	var levelText = r.text(0, fingerRadius, 'Level ' + userLevel).attr({
		fill: '#ffffff',
		'text-anchor': 'start',
		'font-family': 'Helvetica',
		'font-size': fingerRadius * 2
	});

	boardPercent = 0;
	boardPercentText = r.text(levelText.getBBox().width + fingerRadius * 2, fingerRadius, boardPercent + '%').attr({
		fill: '#ffffff',
		'text-anchor': 'start',
		'font-family': 'Helvetica',
		'font-size': fingerRadius * 2
	});

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
			gamePaused = false;
			initGameBalls(userLevel);
		});
}

function nextLevel() {
	destroyGameBoard(function() {
		userLevel++;
		initGameBoard();
	});
}

function destroyGameBoard(callback) {
	var gameBoard = r.bottom;

	gamePaused = true;
	
	if (gameBalls !== null) {
		gameBalls.clear();
	}

	if (gameBoard === null) {
		if (callback) callback();
		return;
	}

	var cx = gameBoard.attr('x') + gameBoard.attr('width') / 2;
	var cy = gameBoard.attr('y') + gameBoard.attr('height') / 2;

	gameBoard.animate({
		width: 0,
		height: 0,
		x: cx,
		y: cy
	}, 500, 'easeInOut', function() {
		r.clear();
		if (callback) callback();
	});
}

function initGameBalls(numBalls) {
	var gameBoard = r.bottom.getBBox();
	var cx, cy;

	if (gameBalls !== null) gameBalls.clear();

	gameBalls = r.set();
	for (var i = 0; i < numBalls; i++) {
		cx = (gameBoard.x + Math.floor(Math.random() * gameBoard.width)) | 0;
		cy = (gameBoard.y + Math.floor(Math.random() * gameBoard.height)) | 0;

		gameBalls.push(
			r.circle(cx, cy, ((gameBoard.width + gameBoard.height) / 140) | 0 )
			.attr({
				fill: '#f00',
				'stroke-width': 0
			})
			.data('m', 1)
			.data('vx', Math.random() * 10 - 5)
			.data('vy', Math.random() * 10 - 5)
			.data('cx', cx)
			.data('cy', cy)
			.data('checkedBall', {})
		);
	}
	
	animationLoop();
}

function moveBall(ball, x, y, vx, vy) {
	x += vx;
	y += vy;

	ball
		.data('vx', vx)
		.data('vy', vy)
		.data('cx', x)
		.data('cy', y)
		.attr({
			cx: x | 0,
			cy: y | 0
		});
}

function animationLoop(t) {
	if (t === undefined) t = +Date.now();

	var gameBoard = r.bottom;
	var boardBBox = gameBoard.getBBox();

	gameBalls.forEach(function(ball) {
		// reset which other balls we've checked this one against
		var ball1Collided = false;
		var ball1Checked = {};
		ball1Checked[ball.id] = true;
		ball.data('checkedBall', ball1Checked);

		var b1x = ball.data('cx');
		var b1y = ball.data('cy');
		var b1r = ball.attr('r');
		var b1m = ball.data('m');
		var b1vx = ball.data('vx');
		var b1vy = ball.data('vy');

		// check against every other ball for a collision
		gameBalls.forEach(function(ball2) {
			var ball2Checked = ball2.data('checkedBall');
			if (ball1Checked[ball2.id] || ball2Checked[ball.id]) return;

			var b2x = ball2.data('cx');
			var b2y = ball2.data('cy');
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

				// stop after colliding with another ball
				// probably won't need to collide twice in one frame
				ball1Collided = true;
				return false;
			}

			ball1Checked[ball2.id] = true;
			ball2Checked[ball.id] = true;
		});

		// if collided with ball don't need to check polys
		if (ball1Collided) {
			moveBall(ball, b1x, b1y, b1vx, b1vy);
			return;
		}

		// user polys
		userPolySet.forEach(function(poly) {
			var p1, p2, p1x, p1y, p2x, p2y, nx, ny, l, dp, closestLine;
			var path = poly.attr('path');

			// rough check first - bounding box
			if (!Raphael.isPointInsideBBox(growBBox(Raphael.pathBBox(path), b1r), b1x, b1y)) return;

			// if point inside bounding box check which line to bounce off of
			for (var i = 0; i < path.length; i++) {

				p1 = path[i];
				p2 = path[i + 1];

				if (p1[0] === 'Z') continue;

				// get first point if second point should close loop
				if (p2 === undefined || p2[0] === 'Z') p2 = path[0];

				p1x = p1[1];
				p1y = p1[2];
				p2x = p2[1];
				p2y = p2[2];

				if (p1x === p2x && p1y === p2y) continue;
				
				// check that ball is within bounding box of line segment
				if (!Raphael.isPointInsideBBox({
					x: Math.min(p1x, p2x),
					y: Math.min(p1y, p2y),
					x2: Math.max(p1x, p2x),
					y2: Math.max(p1y, p2y)
				}, b1x, b1y)) continue;

				nx = p2y - p1y;
				ny = p2x - p1x;

				l = (nx * nx) + (ny * ny);

				// http://en.wikipedia.org/wiki/Distance_from_a_point_to_a_line
				var distToLine = (b1x - p1x) * (p2y - p1y) - (b1y - p1y) * (p2x - p1x);
				distToLine *= distToLine;
				distToLine /= l;

				if (distToLine < ((b1r + 1e-9) * (b1r + 1e-9)) && (closestLine === undefined || distToLine < closestLine.d)) {
					closestLine = {};
					closestLine.d = distToLine;
					closestLine.p1x = p1x;
					closestLine.p1y = p1y;
					closestLine.p2x = p2x;
					closestLine.p2y = p2y;
				}
			}

			if (closestLine !== undefined) {
				// http://math.stackexchange.com/questions/13261/how-to-get-a-reflection-vector
				nx = closestLine.p2y - closestLine.p1y;
				ny = closestLine.p2x - closestLine.p1x;

				l = Math.sqrt((nx * nx) + (ny * ny));

				nx *= -1;
				nx /= l;
				ny /= l;

				dp = b1vx * nx + b1vy * ny;

				b1vx = b1vx - 2 * dp * nx;
				b1vy = b1vy - 2 * dp * ny;

				if (poly.data('filling')) {
					solidifyUserPoly.call(poly);
				}
				
				// stop looping through user poly set after one collision
				ball1Collided = true;
				return false;
			}
		});

		// if collided with ball don't need to check polys
		if (ball1Collided) {
			moveBall(ball, b1x, b1y, b1vx, b1vy);
			return;
		}

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
			// bounce off top
			b1y = boardBBox.y + b1r;
			b1vy *= -1;
		}

		if (b1y + b1r >= boardBBox.y + boardBBox.height) {
			// bounce off bottom
			b1y = boardBBox.y + boardBBox.height - b1r;
			b1vy *= -1;
		}

		moveBall(ball, b1x, b1y, b1vx, b1vy);
	});

	if (!gamePaused) {
		window.requestAnimationFrame(animationLoop);
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
	
	if (ax === bx && ay === by) return 0;
	if (ax >= 0 && bx < 0) return -1;
	if (ax === 0 && bx === 0) return ay > by ? -1 : 1;

	// compute the cross product of vectors (center -> a) x (center -> b)
	var det = ax * by - bx * ay;
	if (det < 0) return -1;
	if (det > 0) return 1;

	// points a and b are on the same line from the center
	// check which point is closer to the center
	return (ax * ax + ay * ay) > (bx * bx + by * by) ? -1 : 1;
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
	touch.pageX |= 0;
	touch.pageY |= 0;

	var circle = r.circle(touch.pageX, touch.pageY, fingerRadius);
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
	
	touch.pageX |= 0;
	touch.pageY |= 0;
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
}

/**
 * Stop animation and mark poly as filled.
 *
 * @this {Element} Polygon element.
 */
function solidifyUserPoly() {
	var path = this.attr('path');
	
	// round coordinates to pixel
	var p, i, j;
	for (i = 0; i < path.length; i++) {
		p = path[i];
		for (j = 0; j < p.length; j++) {
			if (typeof p[j] === 'number') {
				p[j] = p[j] | 0;
			}
		}
	}

	this
		.stop()
		.attr('path', path)
		.attr('fill', '#000')
		.data('filling', false);

	var gameBoard = r.bottom;
	var boardArea = gameBoard.attr('width') * gameBoard.attr('height');
	var totalArea = 0;

	userPolySet.forEach(function(poly1, i1) {
		var path = poly1.attr('path');
		
		// calculate area of current user poly
		var polyArea = 0;
		var p1, p2;

		for (i = 0; i < path.length; i++) {
			p1 = path[i];
			if (i === path.length - 1) p2 = path[0];
			else p2 = path[i + 1];
			if (p2[0] === 'Z') p2 = path[0];
	
			polyArea += (p2[1] + p1[1]) * (p2[2] - p1[2]);
		}
		
		polyArea /= 2;
		
		// for each other user poly that hasn't been compared subtract intersection area
		userPolySet.forEach(function(poly2, i2) {
			if (i2 <= i1) return;
			
			var intersection;
			var intersectionArea = 0;
			var intersectionPoints;

			intersection = Raphael.pathIntersection(newPath, path);

			if (intersection.length > 0) {
				
				intersectionPath = [];
				
				for (i = 0; i < intersection.length; i++) {
					point = {};
					// TODO: build points array from intersection data.
					// should be array of objects with pageX/pageY
					// and sorted with compareTouches then calc area
					intersectionPoints.push(point);
				}
				
				intersectionArea /= 2;
				polyArea -= intersectionArea;
			}
		});
		
		totalArea += polyArea;
	});

	boardPercent = Math.round(totalArea / boardArea * 10) / 10;

	boardPercentText.attr({
		text: boardPercent + '%'
	});

	if (boardPercent > 70) {
		nextLevel();
		return;
	}
}

Raphael(function() {
	canvas = document.getElementById('canvas');
	r = Raphael(canvas, '100%', '100%');
	resetGame();

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

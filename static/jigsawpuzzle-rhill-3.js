/**
 * jigsawpuzzle-rhill 3.0 (11-Jun-2009) (c) by Raymond Hill
 *
 * jigsawpuzzle-rhill licensed under a Creative Commons
 * Attribution-Noncommercial-Share Alike 2.5 Canada License.
 * Source: http://www.raymondhill.net/puzzle-rhill.php
 *
 * Sorry for the blend name, I didn't want to spend any time figuring
 * some unique, snappy name.
 *
 * I made this puzzle project simply because I was curious if
 * this could be done using the HTML5 <canvas> tag, and yet
 * still have a smooth and fluid in interface. As far as I can tell,
 * It can :)
 * 
 * The key to have responsive graphics interface is to redraw
 * *only* what is necessary. Thus, when moving a piece of puzzle,
 * it is necessary to redraw only the area intersecting the
 * former position, and the area intersecting the new position.
 * Seems trivial enough, but I couldn't find any canvas-based puzzle
 * which actually did that. Using minimal refresh allows huge amount
 * of puzzle piece: I tried 400 pieces, and except for the
 * initialization phase which takes longer to complete, the interface
 * stays smooth.
 *
 * What I learned:
 * - When using drawImage(), canvas to canvas operations are much
 *   faster than image to canvas operations. Thus it is a good idea
 *   to convert an image object into a canvas object if an image
 *   needs to be draw often onto a canvas object (this holds true
 *   for pattern objects.)
 * - The canvas element can handle subpixel positioning. However, there
 *   is a significant performance cost, and it should be avoided if
 *   wherever possible.
 *
 * Still a work in progress, as I wish to experiment further with
 * this little project.
 * 
 * Revisions:
 * 29-May-2009:
 *     - Added button to toggle on/off the showing of edge pieces only
 *     - Added shuffle button
 *     - When moving a piece, all other pieces fade
 *     - num_rows/num_cols respects more original image w/h ratio
 * 31-May-2009:
 *     - JSlint'ed
 *     - Gotten rid of cloneObject() as seen at
 *       http://www.andrewsellick.com/93/javascript-clone-object-function:
 *       The performance cost is way too high. Intelligent copy constructors
 *       are preferred
 * 04-Jun-2009:
 *     - Added rotation, this required rewrite of a good portion  of
 *       the code
 *     - Because of rotation, added code to correctly generate border
 *       shade for floating pieces
 *     - Added preview
 * 09-Jun-2009:
 *     - Pieces snap together rather than to the background (more like a real
 *       jigsaw puzzle.) This required polygons merging algorithm, including
 *       complex polygons -- polygons with holes in them.
 *     - <canvas>.isPointInPath() now replaces W. Randolph Franklin's PNPOLY.
 *     - up arrow (or 's') and down arrow (or 'd') sends a moved piece on top
 *       or behind others.
 */


/**
  Development notes

  Each PuzzlePiece object is decomposed in three type of tiles:

  Source tile descriptor:
    Information on where to find the tile in the source image:
    - Polygon describing the tile. Coords relative to source
      image = polySource

  Transient tile descriptor:
    Information about the extracted tile. Rotation is applied at
    this level:
    - Polygon describing the tile. Coords relative to the bounding box
      of the polygon = polyTransient
    - A copy of the pixels contained in the src polygon, after rotation.

  Display tile descriptor:
    Information about the location of the tile on screen:
    - Polygon describing the tile on screen = polyDisplay

  Each polygon object caches:
    - the bounding box containing the polygon
    - the centroid of the polygon

  If polySource is modified, the transient tile and onscreen tile
  descriptors must be recalculated.

  If polyTransient is modified (ex.: changing the rotation angle),
  the transient tile and onscreen tile descriptors must be recalculated

  If polyDisplay is changed, the display descriptor must be recalculated.
  However, this can be done efficiently when moving the object around, as
  this requires simply applying delta x and delta y to all cached coords.

  By convention, sTile = source tile descriptor,
  tTile = transient tile descriptor, dTile = display tile descriptor,
  or more generally s*, t*, d*
 */


/*global self*/


var mthrnd = self.Math.round;
var mthceil = self.Math.ceil;
var mthrand = self.Math.random;
var mthsqrt = self.Math.sqrt;
var mthmx = self.Math.max;
var mthmn = self.Math.min;
var mthabs = self.Math.abs;
var mthatan = self.Math.atan2;
var debug_on = false;

// helper functions
function stdout(s,clear) {
	var consoleObj = self.document.getElementById('console');
	if ( consoleObj ) {
		if ( clear ) {
			consoleObj.innerHTML = "";
			}
		consoleObj.innerHTML += s + "<br>";
		}
	}
function stderr(s) {
	if ( debug_on ) {
		stdout(s);
		}
	}
// Point object
function Point(a,b,c) {
	// a=x,b=y, c=id
	if (b!==undefined) {
		this.x=a;
		this.y=b;
		this.id=(c!==undefined)?c:0;
		}
	// a=Point or {x:?,y:?,id:?}
	else if (a!==undefined&&a) {
		this.x=a.x;
		this.y=a.y;
		this.id=(a.id!==undefined)?a.id:0;		
		}
	// empty
	else {
		this.x=this.y=this.id=0;
		}
	}
Point.prototype.toString = function() {
	return "{x:"+this.x+",y:"+this.y+",id:"+this.id+"}";
	};
Point.prototype.toHashkey = function() {
	// We could use toString(), but I am concerned with
	// the performance of Polygon.merge(). As for now
	// I have no idea if its really that much of an
	// improvement, but I figure the shorter the string
	// used as a hash key, the better. This also reduce
	// the number of concatenations from 6 to 2. Ultimately,
	// I could cache the hash key..
	// Ah, there is this:
	//  http://www.softwaresecretweapons.com/jspwiki/javascriptstringconcatenation
	return this.x+"_"+this.y;
	};
Point.prototype.clone = function() {
	return new Point(this);
	};
Point.prototype.offset = function(dx,dy) {
	this.x+=dx; this.y+=dy;
	};
Point.prototype.set = function(a) {
	this.x=a.x;
	this.y=a.y;
	this.id=(a.id!==undefined)?a.id:0;
	};
Point.prototype.compare = function(other,strict) {
	return this.x == other.x && this.y == other.y && (!strict || this.id == other.id);
	};

// Segment object
function Segment(a,b) {
	this.ptA = new Point(a);
	this.ptB = new Point(b);
	}
Segment.prototype.toString = function() {
	return "["+this.ptA+","+this.ptB+"]";
	};
Segment.prototype.compare = function(other) {
	return (this.ptA.compare(other.ptA) && this.ptB.compare(other.ptB)) || (this.ptA.compare(other.ptB) && this.ptB.compare(other.ptA));
	};

// Bounding box object
function Bbox(a,b,c,d) {
	// a=x1,b=y1,c=x2,d=y2
	if (d!==undefined) {
		this.tl=new Point({x:a,y:b});
		this.br=new Point({x:c,y:d});
		}
	// a=Point or {x:?,y:?},b=Point or {x:?,y:?}
	else if (b!==undefined) {
		var mn=Math.min;
		var mx=Math.max;
		this.tl=new Point({x:mn(a.x,b.x),y:mn(a.y,b.y)});
		this.br=new Point({x:mx(a.x,b.x),y:mx(a.y,b.y)});
		}
	// a=Bbox or {tl:{x:?,y:?},br:{x:?,y:?}}
	else if (a) {
		this.tl=new Point(a.tl);
		this.br=new Point(a.br);
		}
	// empty
	else {
		this.tl=new Point();
		this.br=new Point();
		}
	}
Bbox.prototype.toString = function() {
	return "{tl:"+this.tl+",br:"+this.br+"}";
	};
Bbox.prototype.clone = function() {
	return new Bbox(this);
	};
Bbox.prototype.getTopleft = function() {
	return new Point(this.tl);
	};	
Bbox.prototype.getBottomright = function() {
	return new Point(this.br);
	};
Bbox.prototype.unionPoint = function(p) {
	var mn=Math.min;
	var mx=Math.max;
	this.tl.x=mn(this.tl.x,p.x);
	this.tl.y=mn(this.tl.y,p.y);
	this.br.x=mx(this.br.x,p.x);
	this.br.y=mx(this.br.y,p.y);
	};
Bbox.prototype.width = function() {
	return this.br.x-this.tl.x;
	};
Bbox.prototype.height = function() {
	return this.br.y-this.tl.y;
	};
Bbox.prototype.offset = function(dx,dy) {
	this.tl.offset(dx,dy);
	this.br.offset(dx,dy);
	};
Bbox.prototype.set = function(a) {
	// array of Points
	var mx = self.Math.max;
	var mn = self.Math.min;
	this.tl.x = this.br.x = a[0].x;
	this.tl.y = this.br.y = a[0].y;
	for ( var i=1; i<a.length; i++ ) {
		var p = a[i];
		this.tl.x = mn(this.tl.x,p.x);
		this.tl.y = mn(this.tl.y,p.y);
		this.br.x = mx(this.br.x,p.x);
		this.br.y = mx(this.br.y,p.y);
		}
	};
Bbox.prototype.pointIn = function(p) {
	return p.x > this.tl.x && p.x < this.br.x && p.y > this.tl.y && p.y < this.br.y;
	};
Bbox.prototype.doesIntersect = function(bb) {
	var mn = self.Math.min;
	var mx = self.Math.max;
	return (mn(bb.br.x,this.br.x)-mx(bb.tl.x,this.tl.x)) > 0 && (mn(bb.br.y,this.br.y)-mx(bb.tl.y,this.tl.y)) > 0;
	};
Bbox.prototype.union = function(other) {
	// this bbox is empty
	if ( this.isEmpty() ) {
		this.tl = new Point(other.tl);
		this.br = new Point(other.br);
		}
	// union only if other bbox is not empty
	else if ( !other.isEmpty() ) {
		var mn = self.Math.min;
		var mx = self.Math.max;
		this.tl.x = mn(this.tl.x,other.tl.x);
		this.tl.y = mn(this.tl.y,other.tl.y);
		this.br.x = mx(this.br.x,other.br.x);
		this.br.y = mx(this.br.y,other.br.y);
		}
	return this;
	};
Bbox.prototype.inflate = function(a) {
	this.tl.x-=a;
	this.tl.y-=a;
	this.br.x+=a;
	this.br.y+=a;
	};
Bbox.prototype.isEmpty = function() {
	return this.width() <= 0 || this.height() <= 0;
	};
Bbox.prototype.toCanvasPath = function(ctx) {
	ctx.rect(this.tl.x,this.tl.y,this.width(),this.height());
	};

// Region object (collection of [todo:non-overlapping] bounding boxes
function Region() {
	this.bboxes=[];
	}
Region.prototype.add = function(tl,br) {
	this.bboxes.push(new Bbox(tl,br));
	};
Region.prototype.fill = function(ctx,fillStyle,clip) {
	ctx.fillStyle = fillStyle;
	for ( var i=0; i<this.bboxes.length; i++ ) {
		var bbox = this.bboxes[i];
		if ( clip === undefined || !clip || bbox.doesIntersect(clip) ) {
			ctx.fillRect(bbox.tl.x,bbox.tl.y,bbox.width(),bbox.height());
			}
		}
	};

// Contour object, a collection of points forming a closed figure
// Clockwise = filled, counterclockwise = hollow
function Contour(a) {
	this.pts = []; // no points
	if (a) {
		var iPt; var nPts;
		if ( a instanceof Contour ) {
			var pts = a.pts;
			nPts = pts.length;
			for ( iPt=0; iPt<nPts; iPt++ ) {
				this.pts.push(pts[iPt].clone());
				}
			if ( a.bbox ) {
				this.bbox = a.bbox.clone();
				}
			this.area = a.area;
			this.hole = a.hole; // may sound funny..
			}
		else if ( a instanceof Array ) {
			nPts = a.length;
			for ( iPt=0; iPt<nPts; iPt++ ) {
				this.pts.push(a[iPt].clone());
				}
			}
		else {
			alert("Contour ctor: Unknown arg 'a'");
			}
		}
	}
Contour.prototype.clone = function() {
	return new Contour(this);
	};
Contour.prototype.addPoint = function(p) {
	this.pts.push(new Point(p));
	delete this.bbox;
	delete this.area;
	delete this.hole;
	};
Contour.prototype.getBbox = function() {
	if (this.bbox===undefined) {
		this.bbox = new Bbox();
		var pts = this.pts;
		var nPts = pts.length;
		// we need at least 3 points for a non-empty bbox
		if ( nPts > 2 ) {
			var bbox = new Bbox(pts[0],pts[1]);
			for ( var iPt=2; iPt<nPts; iPt++ ) {
				bbox.unionPoint(pts[iPt]);
				}
			this.bbox.union(bbox);
			}
		}
	return this.bbox.clone();
	};
Contour.prototype.offset = function(dx,dy) {
	var pts = this.pts;
	var nPts = pts.length;
	for ( var iPt=0; iPt<nPts; iPt++ ) {
		pts[iPt].offset(dx,dy);
		}
	if ( this.bbox ) {
		this.bbox.offset(dx,dy);
		}
	};
Contour.prototype.isHollow = function() {
	// A hole will have a negative surface area as per:
	// http://local.wasp.uwa.edu.au/~pbourke/geometry/polyarea/ by Paul Bourke
	// Since I started this project before I started to care about areas of polygons,
	// and that originally I described my contours with clockwise serie of points, filled
	// contour are currently represented with negative area, while hollow contour are
	// represented with positive area. Something to keep in mind.
	if (this.hole===undefined) {
		this.hole=(this.getArea()>0);
		}
	return this.hole;
	};
Contour.prototype.getArea = function() {
	// http://local.wasp.uwa.edu.au/~pbourke/geometry/polyarea/ by Paul Bourke
	// Quote: "for this technique to work is that the polygon must not be self intersecting"
	// Fine with us, that will never happen (unless there is a bug)
	// Quote: "the holes areas will be of opposite sign to the bounding polygon area"
	// This is great, just by calculating the area, we determine wether the contour
	// is hollow or filled. Moreover, by adding up the areas of all contours describing
	// a polygon, we find whether or not a polygon is mostly hollow or mostly filled,
	// useful to implement display performance enhancement strategies.
	if (this.area===undefined) {
		var area=0;
		var pts=this.pts;
		var nPts=pts.length;
		if (nPts > 2) {
			var j=nPts-1;
			var p1; var p2;
			for (var i=0;i<nPts;j=i++) {
				p1=pts[i];
				p2=pts[j];
				area+=p1.x*p2.y;
				area-=p1.y*p2.x;
				}
			this.area=area/2;
			}
		}
	return this.area;
	};
Contour.prototype.rotate = function(angle,x0,y0) {
	if ( !angle ) {return;}
	// http://www.webreference.com/js/tips/000712.html
	var cosang = self.Math.cos(angle);
	var sinang = self.Math.sin(angle);
	var rnd = self.Math.round;
	var pts = this.pts;
	var nPts = pts.length;
	var pt; var x; var y;
	for (var iPt=0; iPt<nPts; iPt++) {
		pt = pts[iPt];
		x = pt.x-x0;
		y = pt.y-y0;
		// http://www.topcoder.com/tc?module=Static&d1=tutorials&d2=geometry2
		pt.x = rnd(x*cosang-y*sinang)+x0;
		pt.y = rnd(x*sinang+y*cosang)+y0;
		}
	delete this.bbox; // no longer valid
	};

// Polygon object, a collection of Contour objects
function Polygon(a) {
	this.contours = []; // no contour
	if (a) {
		if (a instanceof Polygon) {
			var contours = a.contours;
			var nContours = contours.length;
			for ( var iContour=0; iContour<nContours; iContour++ ) {
				this.contours.push(new Contour(contours[iContour]));
				}
			if ( this.bbox ) {
				this.bbox = a.bbox.clone();
				}
			this.area = a.area;
			if ( this.centroid ) {
				this.centroid = a.centroid.clone();
				}
			this.mostlyHollow = a.mostlyHollow;
			}
		else if ( a instanceof Array ) {
			this.contours.push(new Contour(a));
			}
		else {
			alert("Polygon ctor: Unknown arg 'a'");
			}
		}
	}
Polygon.prototype.clone = function() {
	return new Polygon(this);
	};
Polygon.prototype.getBbox = function() {
	if (!this.bbox) {
		this.bbox = new Bbox();
		var contours = this.contours;
		var nContours = contours.length;
		for ( var iContour=0; iContour<nContours; iContour++ ) {
			this.bbox.union(contours[iContour].getBbox());
			}
		}
	return this.bbox.clone();
	};
Polygon.prototype.getArea = function() {
	// We addup the area of all our contours.
	// Contours representing holes will have a negative area.
	if (!this.area) {
		var area=0;
		var contours=this.contours;
		var nContours=contours.length;
		for (var iContour=0; iContour<nContours; iContour++) {
			area+=contours[iContour].getArea();
			}
		this.area=area;
		}
	return this.area;
	};
Polygon.prototype.getCentroid = function() {
	if (!this.centroid) {
		var contours=this.contours;
		var nContours=contours.length;
		var pts; var nPts;
		var x=0;
		var y=0;
		var f; var iPt; var jPt;
		var p1; var p2;
		for (var iContour=0; iContour<nContours; iContour++) {
			pts = contours[iContour].pts;
			nPts = pts.length;
			// http://local.wasp.uwa.edu.au/~pbourke/geometry/polyarea/ by Paul Bourke
			jPt=nPts-1;
			for (iPt=0; iPt<nPts; jPt=iPt++) {
				p1=pts[iPt];
				p2=pts[jPt];
				f=p1.x*p2.y-p2.x*p1.y;
				x+=(p1.x+p2.x)*f;
				y+=(p1.y+p2.y)*f;
				}
			}
		f=this.getArea()*6;
		// centroid relative to self bbox
		var origin=this.getBbox().getTopleft();
		this.centroid=new Point({x:mthrnd(x/f-origin.x),y:mthrnd(y/f-origin.y)});
		}
	return this.centroid.clone();
	};
Polygon.prototype.pointIn = function(p) {
	alert("Polygon.prototype.pointIn: No longer supported");
	};
Polygon.prototype.offset = function(dx,dy) {
	var contours = this.contours;
	var nContours = contours.length;
	for ( var iContour=0; iContour<nContours; iContour++ ) {
		contours[iContour].offset(dx,dy);
		}
	if ( this.bbox ) {
		this.bbox.offset(dx,dy);		
		}
	if ( this.centroid ) {
		this.centroid.offset(dx,dy);		
		}
	};
Polygon.prototype.moveto = function(x,y) {
	// position is centroid
	var centroid = this.getCentroid();
	var tl=this.getBbox().getTopLeft();
	this.offset(x-tl.x-centroid.x,y-tl.y-centroid.y);
	};
Polygon.prototype.rotate = function(angle,x0,y0) {
	if (!angle) {return;}
	// http://www.webreference.com/js/tips/000712.html
	var contours = this.contours;
	var nContours = contours.length;
	for (var iContour=0; iContour<nContours; iContour++) {
		contours[iContour].rotate(angle,x0,y0);
		}
	delete this.bbox; // no longer valid
	delete this.centroid; // no longer valid (since it's relative to self bbox
	};
Polygon.prototype.doesIntersect = function(bbox) {
	return this.getBbox().doesIntersect(bbox);
	};
Polygon.prototype.isMostlyHollow = function() {
	if (this.mostlyHollow===undefined) {
		// we add up all solid and hollow contours and
		// compare the result to determine whether this
		// polygon is mostly solid or hollow
		var areaSolid=0;
		var areaHollow=0;
		var contours=this.contours;
		var nContours=contours.length;
		var area;
		for (var iContour=0; iContour<nContours; iContour++) {
			area = contours[iContour].getArea();
			if (area < 0) {
				areaSolid+=area;
				}
			else {
				areaHollow+=area;
				}
			}
		this.mostlyHollow=(areaHollow>areaSolid);
		}
	return this.mostlyHollow;
	};
Polygon.prototype.getPoints = function() {
	var r=[];
	var contours=this.contours;
	var nContours=contours.length;
	var contour; var pts; var iPt; var nPts;
	for (var iContour=0; iContour<nContours; iContour++) {
		contour=contours[iContour];
		pts=contour.pts;
		nPts=pts.length;
		for (iPt=0; iPt<nPts; iPt++) {
			r.push(new Point(pts[iPt]));
			}
		}
	return r;
	};
Polygon.prototype.merge = function(other) {
	// Simply put, this algorithm XOR each segment of
	// a polygon with each segment of another polygon.
	// This means we delete any segment which appear an
	// even number of time. Whatever segments are left in the
	// collection are connected together to form one or more
	// contour.
	// Of course, this works because we know we are working
	// with polygons which are perfectly adjacent and never
	// overlapping.
	// A nice side-effect of the current algorithm is that
	// we do not need to know expressly which contours are full
	// and which are holes: The contours created will automatically
	// have a clockwise/counterclockwise direction such that they
	// fits exactly the non-zero winding number rule used by the
	// <canvas> element, thus suitable to be used as is for
	// clipping and complex polygon filling.
	// TODO: write an article to illustrate exactly how this work.
	// TODO: handle special cases here (ex. empty polygon, etc)

	// A Javascript object can be used as an associative array, but
	// they are not real associative array, as there is no way
	// to query the number of entries in the object. For this
	// reason, we maintain an element counter ourself.
	var segments={};
	var contours=this.contours;
	var nContours=contours.length;
	var pts; var nPts;
	var iPtA; var iPtB;
	var idA; var idB;
	for (var iContour=0; iContour<nContours; iContour++) {
		pts = contours[iContour].pts;
		nPts = pts.length;
		iPtA = nPts-1;
		for ( iPtB=0; iPtB<nPts; iPtA=iPtB++ ) {
			idA = pts[iPtA].toHashkey();
			idB = pts[iPtB].toHashkey();
			if (!segments[idA]) {
				segments[idA]={n:1,pts:{}};
				}
			else {
				segments[idA].n++;
				}
			segments[idA].pts[idB] = new Segment(pts[iPtA],pts[iPtB]);
			}
		}
	// enumerate segments in other's contours, eliminate duplicate
	contours = other.contours;
	nContours = contours.length;
	for ( iContour=0; iContour<nContours; iContour++ ) {
		pts = contours[iContour].pts;
		nPts = pts.length;
		iPtA=nPts-1;
		for (iPtB=0; iPtB<nPts; iPtA=iPtB++) {
			idA = pts[iPtA].toHashkey();
			idB = pts[iPtB].toHashkey();
			// duplicate (we eliminate same segment in reverse direction)
			if (segments[idB] && segments[idB].pts[idA]) {
				delete segments[idB].pts[idA];
				if (!--segments[idB].n) {
					delete segments[idB];
					}
				}
			// not a duplicate
			else {
				if (!segments[idA]) {
					segments[idA]={n:1,pts:{}};
					}
				else {
					segments[idA].n++;
					}
				segments[idA].pts[idB] = new Segment(pts[iPtA],pts[iPtB]);
				}
			}
		}
	// recreate and store new contours by jumping from one point to the next,
	// using the second point of the segment as hash key for next segment
	this.contours=[]; // regenerate new contours
	var contour; var segment;
	for (idA in segments) { // we need this to get a starting point for a new contour
		contour = new Contour();
		this.contours.push(contour);
		for (idB in segments[idA].pts) {break;}
		segment = segments[idA].pts[idB];
		while (segment) {
			contour.addPoint(segment.ptA);
			// remove from collection since it has now been used
			delete segments[idA].pts[idB];
			if (!--segments[idA].n) {
				delete segments[idA];
				}
			idA = segment.ptB.toHashkey();
			if (segments[idA]) {
				for (idB in segments[idA].pts) {break;} // any end point will do
				segment = segments[idA].pts[idB];
				}
			else {
				segment = null;
				}
			}
		}
	// invalidate cached values
	delete this.bbox;
	delete this.area;
	delete this.centroid;
	delete this.mostlyHollow;
	};
Polygon.prototype.toCanvasPath = function(ctx) {
	var contours=this.contours;
	var nContours=contours.length;
	var pts; var nPts; var iPt; var pt;
	for (var iContour=0; iContour<nContours; iContour++) {
		pts=contours[iContour].pts;
		nPts=pts.length;
		if (nPts > 1) {
			pt=pts[0];
			ctx.moveTo(pt.x,pt.y);
			for (iPt=1; iPt<nPts; iPt++) {
				pt=pts[iPt];
				ctx.lineTo(pt.x,pt.y);
				}
			ctx.closePath();
			}
		}
	};
Bbox.prototype.toPolygon = function() {
	return new Polygon([new Point(this.tl),new Point(this.br.x,this.tl.y),new Point(this.br),new Point(this.tl.x,this.br.y)]);
	};



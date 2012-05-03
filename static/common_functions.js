//------------------------ Tile Loading Count methods -----------------------------------
/* Have to add the following calls to the layer constructor in the scripts that need to know when to concatenate,
   and they need to implement a method called concatenateTiles() .
   
	.on("load", tileLoaded)
	.on("added_tile", tileAdded)
	.on("aborted_tile", tileAborted)
   */

var tiles_added = 0;
var tiles_loaded = 0;

function tileAdded (e) {
	tiles_added++;
}

function tileAborted (e) {
	tiles_added--;
}

function checkTileCount () {
	if (tiles_added == tiles_loaded) concatenateTiles ();
}

function tileLoaded () {
	tiles_loaded++;
  	checkTileCount ();
}

//------------------------ Feature combination methods ----------------------------------

// Nice to have this as a common function with an eye to improving it
/* To union segments into one tile, you add the tile offset of the "source tile" and substract the tile offset of the "destination tile". 
You can delete the segment from the source til to avoid mutiple svgs on top of each other. (It shouldn't matter to the polymaps tile cache because it works on the tile level only.) */
function combineSegments (dest_tile, source_tile, offsets_dest) {
	
	if (source_tile.getAttribute("d") == "") return; //Nothing to add to the dest_tile.

	//dest_tile.setAttribute("d", dest_tile.getAttribute("d") + translateCoordinates (source_tile.getAttribute("d"), offsets_dest, findTileOffset (source_tile.parentNode)));
	
	offsets_source = findTileOffset (source_tile.parentNode);
	
	var translatedPath = translateCoordinates (source_tile.getAttribute("d"), offsets_dest, offsets_source);
	dest_tile.setAttribute("d", createUnion (dest_tile.getAttribute("d"), translatedPath, offsets_dest, offsets_source));
}

//Finds the offset from the origin of each tile
function findTileOffset (tile) {
	var offsetText = tile.getAttribute("transform");
	offsetText = offsetText.substring (10, offsetText.length -1); //translate(904.5,344.5)
	//console.log (offsetText);
	var offsets = offsetText.split(",");
	offsets = [parseFloat (offsets[0]), parseFloat(offsets[1])];
	return offsets;
}

//Translates the local coordinates from the source tile to make them fit in the local system of the dest tile
function translateCoordinates (path, offset_dest, offset_source) {
	
	var paintingInstructions = Raphael.parsePathString(path);
	var result = "";
	
	for (var i = 0; i < paintingInstructions.length; i++) {
		if (paintingInstructions[i][0] != "Z") {
			result += paintingInstructions[i][0] + (paintingInstructions[i][1] + offset_source[0] - offset_dest[0]) + "," + (paintingInstructions[i][2] + offset_source[1] - offset_dest[1]);
		} else {
			result += "Z"; //Add the Z to close the drawing instructions, see W3C rules
		}
	}

	return result;
}

/* Takes in two paths translated to the same reference system, and creates a proper union of them. Note that we make a lot of specific implementation details here, since we know that
   the paths come from tiles in a google mercator projection*/
function createUnion (pathA, pathB, offsetsA, offsetsB) {
	
	if (pathA == "") return pathB; //We add the new elements
	
	//Find out the relative positions of the tiles
	var orientation = boundaryLineOrientation (offsetsA, offsetsB);
	
	var pathA = Raphael.parsePathString(pathA);
	var pathB = Raphael.parsePathString(pathB);
	
	//Section the path into subpaths
	var subPathsA = createSubPaths (pathA);
	var subPathsB = createSubPaths (pathB);
	
	//Decide which paths have boundary points
	var axisIndex;
	if (orientation == 'a' || orientation == 'b') axisIndex = 2;
	else axisIndex = 1;

	var boundarySubPaths = new Array ();
	var noBoundarySubPaths = new Array (); //No probable boundary crossings
	var boundary;
	for (var i = 0; i < subPathsA.length; i++) {
		boundary = false;
		for (var j = 0; j < subPathsA[i].length -1; j++) {
			if (checkForBoundaryPoint (subPathsA[i], j, axisIndex, orientation)) {
				boundary = true; //TODO: Devise something else to do for boundaries
				break;
			}
		}
		if (!boundary) noBoundarySubPaths.push (subPathsA[i]);
		else boundarySubPaths.push (subPathsA[i]);
	}

	for (var i = 0; i < subPathsB.length; i++) {
		boundary = false;
		for (var j = 0; j < subPathsB[i].length -1; j++) {
			if (checkForBoundaryPoint (subPathsB[i], j, axisIndex, orientation)) {
				boundary = true; //TODO: Devise something else to do for boundaries
				break;
			}
		}
		if (!boundary) noBoundarySubPaths.push (subPathsB[i]);
		else boundarySubPaths.push (subPathsB[i]);
	}

	//Every non-boundary subpath goes straight into the unioned path
	var unionedPath = "";
	for (var i = 0; i < noBoundarySubPaths.length; i++) {
		for (var j = 0; j < noBoundarySubPaths[i].length; j++) {
			unionedPath = addPathPoint (unionedPath, noBoundarySubPaths[i][j]);
		}
	}
	
	// ---- Work on the boundary elements
	if (boundarySubPaths.length > 0) {
		// Convert to Polygon elements
		for (var i = 0; i < boundarySubPaths.length; i++) {
			boundarySubPaths[i] = convertToPoly (boundarySubPaths[i]);
		}
	
		//Create the union with external code
		for (var i = 1; i < boundarySubPaths.length; i++) {
			boundarySubPaths[0].merge (boundarySubPaths[i]);
		}
		//Convert back to paths
		unionedPath += convertToPath (boundarySubPaths[0]);
	}
	
	//Deliver the finished path
	return unionedPath;
}

function convertToPoly (path) {
	
	//Create points
	var points = new Array ();
	for (var i = 0; i < path.length; i++) {		
		if (!(path[i][0] == "Z")) {
			points.push (new Point (path[i][1], path[i][2]));
		}
	} 
	
	//Create Contour
	var contour = new Contour (points);
	//Create poly
	return new Polygon (points);
}

function convertToPath (polygon) {
	
	var path = "";
	var contour;
	
	//For each contour; equivalent to a closed path?
	for (var i = 0; i < (polygon.contours.length); i++) {
		contour = polygon.contours[i];
		//For each point; equivalent to a brush movement instruction
		if (contour.pts.length == 0) continue;
		//Start instruction
		path += "M" + contour.pts[0].x + "," + contour.pts[0].y;
		//Movement instructions
		for (var j = 0; j < (contour.pts.length - 1); j++) {
			path += "L" + contour.pts[j].x + "," + contour.pts[j].y;
		}
		//End instruction
		path += "Z";
	}
	
	return path;
}

function createSubPaths (path) {
	
	var subPaths = new Array ();
	var currentSubPath = new Array ();
	
	for (var i = 0; i < path.length; i++) {
	
		currentSubPath.push (path[i]);
		
		if (path[i][0] == "Z") {
			subPaths.push (currentSubPath);
			currentSubPath = new Array ();
		}
	}
	return subPaths;
}

//Axis is 1 or 2, aka. the index of the point
function checkForBoundaryPoint (pointArray, pointIndex, axis, orientation) {
	/*
	if (pointIndex == 0) { //Check if we're at the start
		if (pointArray[pointArray.length -2][axis] == pointArray[pointIndex][axis]
		    || pointArray[pointIndex][axis] == pointArray[pointIndex+1][axis])
			return true;
	} else if (pointArray.length -2 == pointIndex) { //Check if we're on the end
		if (pointArray[0][axis] == pointArray[pointIndex][axis]
		    || pointArray[pointIndex][axis] == pointArray[pointIndex-1][axis])
			return true;
	} else if (pointArray[pointIndex][axis] == pointArray[pointIndex+1][axis]
	    || pointArray[pointIndex][axis] == pointArray[pointIndex-1][axis]) { //general case
		return true;
	}
	
	return false;
	
	*/
	
	if ((Math.round (pointArray[pointIndex][axis]) % 256 ) == 0 ) { 
		//Modulo 256 0 0 means it's an edge, mudolo 2 = 0 means it's on the left edge
		if (orientation == "l" && (Math.round (pointArray[pointIndex][axis]) % 2) == 0) return true;
		if (orientation == "r" && (Math.round (pointArray[pointIndex][axis]) % 2) != 0) return true;
		if (orientation == "a" && (Math.round (pointArray[pointIndex][axis]) % 2) == 0) return true;
		if (orientation == "b" && (Math.round (pointArray[pointIndex][axis]) % 2) != 0) return true;
	}
	else return false;
}

function boundaryLineOrientation (offsetsA, offsetsB){
	//TODO: Need be sure of what is up and what is down
	if (offsetsA[0] < offsetsB[0]) { //A is to the left of B
		return 'l';
	}
	else if (offsetsA[0] > offsetsB[0]) { // A is to the right of B
		return 'r';
	}
	else if (offsetsA[1] < offsetsB[1]) { //A is above B
		return 'a';
	}
	else { //A is below B
		return 'b'
	}
	
}

function addPathPoint (path, newPoint) {
	if (newPoint[0] != "Z")
		return path + newPoint[0] + newPoint[1] + "," + newPoint[2];
	else return path + "Z";
}

//TODO: Only for debug purposes
function switchXY (pathArray) {
	
	var temp;
	
	for (var i = 0; i < pathArray.length; i++) {
		temp = pathArray[i][1];
		pathArray[i][1] = pathArray[i][2];
		pathArray[i][2] = temp;
	}
	
	return pathArray;
}

//------------------------ Misc helper methods ----------------------------------

//Method to allow us to check if an array contains an object in stupid Javascript
function oc(a) {
	var o = {};
	for (var i = 0; i < a.length; i++)
	{
		o[a[i]]='';
	}
	return o;
}

//------------------------ Tile addressing methods ----------------------------------

//Helper to check if a tile is already visited since the "in visitedTiles methoed doesn't work b/c it's fetched aa a new object everytime)
//Returns true if it's in the list or null
function checkForVisits (tile, visitedTiles) {
	
	if (!tile) return true;
	
	for (var i = 0; i < visitedTiles.length; i++) {
		if (tile.getAttribute ("tile_row") == visitedTiles[i].getAttribute ("tile_row") 
		    && tile.getAttribute ("tile_column") == visitedTiles[i].getAttribute ("tile_column"))
			return true;
	}
	
	return false;
}

//Returns a tile when given a relative pointer text like "0,1"
function findTile (current_tile, tilepointer_text) {
	var components = tilepointer_text.split(',');
	var target_x = parseInt (current_tile.getAttribute ("tile_column")) + parseInt (components[0]);
	var target_y = parseInt (current_tile.getAttribute ("tile_row")) - parseInt (components[1]); //Switcharoo b/c of opposite coordinate system!
	
	//Find the tile with that address
	
	var tiles = layer_container.lastChild.children;
	
	//console.log ("Looking for tile pointed to");
	
	for (var i = 0; i < tiles.length; i++) {
		if (tiles[i].getAttribute ("tile_row") == target_y && tiles[i].getAttribute ("tile_column") == target_x) {
			//console.log ("Found tile being pointed to");
			return tiles[i];
		}
	}
	
	//If we're here then the aforementioned tile hasn't been loaded. TODO: Here is where you might force the loading
	
	return null;
}


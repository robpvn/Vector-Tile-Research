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
	
	var pathA = Raphael.parsePathString(pathA);
	var pathB = Raphael.parsePathString(pathB);
	
	var edgesA = new Array ();
	var edgesB = new Array ();
	var edgeIndicesA = new Array (); //These two should be pushed to in the same order as edges
	var edgeIndicesB = new Array ();
	
	//Find out the relative positions of the tiles
	var orientation = boundaryLineOrientation (offsetsA, offsetsB);
	
	//Identify all coord pairs that lie along the boundary line (These pairs create lines along the boundary)
	
	if (orientation == 'a' || orientation == 'b')	{ //Moving along the x-axis
		
		for (var i = 0; i < (pathA.length - 1); i++) {
			if (pathA[i][1] == pathA[i+1][1]) { //Probable (but not guaranteed) border
				edgesA.push (pathA[i]);
				edgeIndicesA.push (i);
				edgesA.push (pathA[i+1]);
				edgeIndicesA.push (i+1);
			}
		}
		
		for (var i = 0; i < (pathB.length - 1); i++) {
			if (pathB[i][1] == pathB[i+1][1]) { //Probable (but not guaranteed) border
				edgesB.push (pathB[i]);
				edgeIndicesB.push (i);
				edgesB.push (pathB[i+1]);
				edgeIndicesB.push (i+1);
			}
		}
		
	} else { //moving along the y-axis TODO: Double check these too
		
		for (var i = 0; i < (pathA.length -1); i++) {
			if (pathA[i][2] == pathA[i+1][2]) { //Probable (but not guaranteed) border
				edgesA.push (pathA[i]);
				edgeIndicesA.push (i);
				edgesA.push (pathA[i+1]);
				edgeIndicesA.push (i+1);
			}
		}
		
		for (var i = 0; i < (pathB.length - 1); i++) {
			if (pathB[i][2] == pathB[i+1][2]) { //Probable (but not guaranteed) border
				edgesB.push (pathB[i]);
				edgeIndicesB.push (i);
				edgesB.push (pathB[i+1]);
				edgeIndicesB.push (i+1);
			}
		}
	}
	
	//Start following a path and adding points, when you hit a known boundary point find a matching one from the other path and jump in at that point in the path.
	var pathPos = 0;
	var pathFollowed = pathA;
	var pathFollowedEdges = edgesA;
	var pathFollowedEdgesIndicies = edgeIndicesA;
	var pathReserve = pathB;
	var pathReserveEdges = edgesB;
	var pathReserveEdgesIndicies = edgeIndicesB;
	var keepBuilding = true;
	var unionedPath = "";
	var temp1, temp2, temp3;
	var forward = true; //Forward from A's perspective
	
	while (keepBuilding) {
		
		unionedPath = addPathPoint (unionedPath, pathFollowed[pathPos]);
		
		//Check for boundaries
		if (pathFollowed[pathPos] in oc(pathFollowedEdges)) {
			//We've hit a boundary, need to change paths - First find the corresponding point on the other edge
			
			if (orientation == 'a' || orientation == 'b')	{ //Moving along the x-axis
				for (var i = 0; i < pathReserveEdges.length; i++) {
					if (pathReserveEdges[i][2] <= pathFollowed[pathPos] + 0.1 || pathReserveEdges[i][2] >= pathFollowed[pathPos] - 0.1 ) {
						//We have a match on the other side, switch paths
						temp1 = pathFollowed;
						temp2 = pathFollowedEdges;
						temp3 = pathFollowedEdgesIndicies;
						
						pathFollowed = pathReserve;
						pathFollowedEdges = pathReserveEdges;
						pathFollowedEdgesIndicies = pathReserveEdgesIndicies;
						
						pathReserve = temp1;
						pathReserveEdges = temp2;
						pathReserveEdgesIndicies = temp3;
						
						pathPos = pathFollowedEdgesIndicies[i];
						
						//Make sure you're going in the right direction
						if (pathFollowed[pathPos][1] == pathFollowed[pathPos + 1][1]) forward = false;
					}
				}
			} else {
				for (var i = 0; i < pathReserveEdges.length; i++) {
					if (pathReserveEdges[i][1] <= pathFollowed[pathPos] + 0.1 || pathReserveEdges[i][1] >= pathFollowed[pathPos] - 0.1 ) {
						//We have a match on the other side, switch paths
						temp1 = pathFollowed;
						temp2 = pathFollowedEdges;
						temp3 = pathFollowedEdgesIndicies;
						
						pathFollowed = pathReserve;
						pathFollowedEdges = pathReserveEdges;
						pathFollowedEdgesIndicies = pathReserveEdgesIndicies;
						
						pathReserve = temp1;
						pathReserveEdges = temp2;
						pathReserveEdgesIndicies = temp3;
						
						pathPos = pathFollowedEdgesIndicies[i];
						
						//Make sure you're going in the right direction
						if (pathFollowed[pathPos][2] == pathFollowed[pathPos + 1][2]) forward = false;
					}
				}
			}
			
		}
		
		//When you reach the end of the first path eveything should be traversed (But on the second path we start from the top to make sure we get them all)
		if (pathFollowed == pathA && pathFollowed[pathPos][0] == "Z") keepBuilding = false;
		
		if (forward) pathPos += 1; //Move on, also after a switch bc/ we don't need to add the switch point again
		else pathPos -= 1;
		
		
	}
	
	//Deliver the finished path
	return unionedPath;
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
		return path + newPoint[0] + newPoint[1] + newPoint[2];
	else return path + "Z";
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


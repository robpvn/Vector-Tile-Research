// Nice to have this as a common function with an eye to improving it
/* To union segments into one tile, you add the tile offset of the "source tile" and substract the tile offset of the "destination tile". 
You can delete the segment from the source til to avoid mutiple svgs on top of each other. (It shouldn't matter to the polymaps tile cache because it works on the tile level only.) */
function CombineSegments (dest_tile, source_tile, offsets_dest) {
	dest_tile.setAttribute("d", dest_tile.getAttribute("d") + TranslateCoordinates (source_tile.getAttribute("d"), offsets_dest, FindTileOffset (source_tile.parentNode)));
}

//Finds the offset from the origin of each tile
function FindTileOffset (tile) {
	var offsetText = tile.getAttribute("transform");
	offsetText = offsetText.substring (10, offsetText.length -1); //translate(904.5,344.5)
	//console.log (offsetText);
	var offsets = offsetText.split(",");
	offsets = [parseFloat (offsets[0]), parseFloat(offsets[1])];
	return offsets;
}

//Translates the local coordinates from the source tile to make them fit in the local system of the dest tile
function TranslateCoordinates (path, offset_dest, offset_source) {
	
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

//Method to allow us to check if an array contains an object in stupid Javascript
function oc(a) {
	var o = {};
	for (var i = 0; i < a.length; i++)
	{
		o[a[i]]='';
	}
	return o;
}


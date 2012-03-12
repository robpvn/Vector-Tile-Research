function FindTileOffset (tile)
{
	var offsetText = tile.getAttribute("transform");
	offsetText = offsetText.substring (10, offsetText.length -1); //translate(904.5,344.5)
	//console.log (offsetText);
	var offsets = offsetText.split(",");
	offsets = [parseFloat (offsets[0]), parseFloat(offsets[1])];
	return offsets;
}

function TranslateCoordinates (path, offset_dest, offset_source)
{
	//var test = "M1000,1000L2000,2000L2000,1000L1000,2000L1000,1000Z";
	
	var paintingInstructions = Raphael.parsePathString(path);
	var result = "";
	
	for (var i = 0; i < paintingInstructions.length; i++)
	{
		if (paintingInstructions[i][0] != "Z") {
			result += paintingInstructions[i][0] + (paintingInstructions[i][1] + offset_source[0] - offset_dest[0]) + "," + (paintingInstructions[i][2] + offset_source[1] - offset_dest[1]);
			//result += paintingInstructions[i][0] + (paintingInstructions[i][1]  + offset_dest[0]) + "," + (paintingInstructions[i][2] + offset_dest[1]);
		} else {
			result += "Z";
		}
	}

	return result;
}

//Stupid method to allow us to check if an array contains an object in stupid Javascript
function oc(a)
{
  var o = {};
  for(var i=0;i<a.length;i++)
  {
    o[a[i]]='';
  }
  return o;
}

var po = org.polymaps;

var loaded_tiles = 0;
var load_target = 0;

var map = po.map()
    .container(document.getElementById("map").appendChild(po.svg("svg")))
    .center({lat: 50, lon: 10})
    .zoomRange([2, 7])
    .zoom(5)
    .add(po.interact());


var geoJson_layer = (po.geoJson()
    .url("http://127.0.0.1:8080/vector_test/{Z}/{X}/{Y}.geojson") //REMEMBER That cross-domain shit is out to kill you at any given time.
    .on("load", po.stylist()
    	//.attr("fill", "lightblue")
    	//.attr("stroke", "lightblue")
    	//.attr("fill", function(d) { return color(d.properties.UN).color; })
    	.title(function(d) { return d.properties.NAME + ": " + d.properties.UN + " UN"; })
    )
    
    .on("load", load)
    .on("move", loadedMap)
);
	
map.add(geoJson_layer);



map.add(po.compass()
    .pan("none"));
    



var layer_container = document.getElementById("org.polymaps.1").parentNode;  

  function load(e) {
  for (var i = 0; i < e.features.length; i++) {
    var feature = e.features[i].data, d = feature.properties.UN;
    //console.log (feature.properties.NAME + " NR: " + d);
    e.features[i].element.setAttribute("class", "country"); //Could probably be done better
    e.features[i].element.setAttribute("fill", "blue");
     e.features[i].element.setAttribute("UN_code", d);
  }
  
  loaded_tiles++;
  if (loaded_tiles == load_target) {
  	console.log("load target reached");
  	loaded_tiles = 0;
  	ConcatenateTiles ();
  	
  }
  
} 

  function loadedMap(e) {

  console.log("Added " + e.added);
  console.log("Removed " + e.removed);
  
  if (e.added != 0) {
  	load_target = e.added - e.removed;
  	loaded_tiles = 0;
  }
  
}
//TODO: Make a more robust load-finished detection
//TODO: Look at creating a proper SVG union (might want to put that later in the project)


function ConcatenateTiles () {

	/*var clippingrect = document.getElementById ("org.polymaps.1");
	clippingrect.firstChild.setAttribute ("width", 2048);
	clippingrect.firstChild.setAttribute ("height", 2048);*/

	//var layer_container = document.getElementById("org.polymaps.1").parentNode;
	var tiles = layer_container.lastChild.children;
	var tile;
	var segment;
	var offsets;
	var id;
	//console.log ("Found tiles");
	
	var completedFeatures = new Array();
	var tileSegments;
	
	for (var i = 0; i < tiles.length; i++) {
	
	
	
	//console.log ("tile");
	tile = tiles[i];
	
	//Preprare the tile for larger features
	
	tile.removeAttribute ("clip-path");
	
	offsets = FindTileOffset (tile);
		for (var j = 0; j < tile.children.length; j++) {
			segment = tile.children[j]
			//console.log ("fragments");
			//console.log (segment.getAttributeNS(null,"UN_code"));
			
			//Getting the unique ID
			id = segment.getAttribute("UN_code");
			
			if (id in oc(completedFeatures)) continue;

			tileSegments = [segment];
			
			for (var k = i+1; k < tiles.length; k++) {
				for (var l = 0; l < tiles[k].children.length; l++) {
					if (tiles[k].children[l].getAttribute("UN_code") == id) {
						tileSegments.push (tiles[k].children[l]);
					}
				}
			}
			
			for (var m = 1; m <tileSegments.length; m++) {
				segment.setAttribute("d", segment.getAttribute("d") + TranslateCoordinates (tileSegments[m].getAttribute("d"), offsets, FindTileOffset (tileSegments[m].parentNode)));
				tileSegments[m].parentNode.removeChild (tileSegments[m]);
			}
			
			segment.setAttribute("fill", "lightblue");
			completedFeatures.push (id);
			//TEMP
			//segment.setAttribute("d", segment.getAttribute("d") + TranslateCoordinates ("M100,100L200,200L200,100L100,200L100,100Z", offsets));
			
			
			// To union segments into one tile, you add the tile offset of the "source tile" and substract the tile offset of the "destination tile". You can delete the segment from the source til to avoid mutiple svgs on top of each other. (It shouldn't matter to the polymaps tile cache because it works on the tile level only.)
		}
	}
}

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


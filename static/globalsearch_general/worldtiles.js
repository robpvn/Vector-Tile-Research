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
	.url("http://127.0.0.1:8080/vector_test/{Z}/{X}/{Y}.geojson") //Remember to use the ip adress rather than localhost to avoid XDomain trouble
	.on("load", po.stylist()
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

//TODO: Make a more robust load-finished detection
function loadedMap(e) {

	console.log("Added " + e.added);
	console.log("Removed " + e.removed);
  
	if (e.added != 0) {
		load_target = e.added - e.removed;
		loaded_tiles = 0;
	} 
}



function ConcatenateTiles () {

	var tiles = layer_container.lastChild.children;
	var tile;
	var segment;
	var offsets;
	var id;
	
	var completedFeatures = new Array();
	var tileSegments;
	
	for (var i = 0; i < tiles.length; i++) {
	
	//console.log ("tile");
	tile = tiles[i];
	
	//Preprare the tile for larger features	
	tile.removeAttribute ("clip-path");
	
	offsets_dest = FindTileOffset (tile);
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
				CombineSegments (segment, tileSegments[m], offsets_dest);
				tileSegments[m].parentNode.removeChild (tileSegments[m]);
			}
			
			segment.setAttribute("fill", "lightblue");
			completedFeatures.push (id);
		}
	}
}


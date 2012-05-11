var po = org.polymaps;

var map = po.map()
	.container(document.getElementById("map").appendChild(po.svg("svg")))
	.center({lat: 63.43, lon: 10.39})
	.zoomRange([10, 20])
	.zoom(17)
	.add(po.interact());

//Setup for timing
setUpTester([63.429, 10.377, 63.4372, 10.407], [17, 20], map, "Global Search, Special data set, General Algorithm");

var geoJson_layer = (po.geoJson()
	.url("http://127.0.0.1:8080/trondheim_centre_buildings/{Z}/{X}/{Y}.geojson") //Remember to use the ip adress rather than localhost to avoid XDomain trouble
	.on("load", po.stylist()
		.title(function(d) { return "Name: " + d.properties.name + " ID: " + d.properties.osm_id; })
	)

	.on("load", load)
	.on("load", tileLoaded)
	.on("added_tile", tileAdded)
	.on("aborted_tile", tileAborted)
);
	
map.add(geoJson_layer);

map.add(po.compass()
	.pan("none"));

var layer_container = document.getElementById("org.polymaps.1").parentNode;  

function load(e) {
	for (var i = 0; i < e.features.length; i++) {
		var feature = e.features[i].data, d = feature.properties.osm_id;
		e.features[i].element.setAttribute("class", "building");
		e.features[i].element.setAttribute("fill", "blue");
		e.features[i].element.setAttribute("OSM_id", d);
	}
} 

function concatenateTiles () {

	tileConcatStarted ();
	
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
	
	//Prepare the tile for larger features	
	tile.removeAttribute ("clip-path");
	
	offsets_dest = findTileOffset (tile);
		for (var j = 0; j < tile.children.length; j++) {
			segment = tile.children[j]
			
			//Getting the unique ID
			id = segment.getAttribute("OSM_id");
			
			if (id in oc(completedFeatures)) continue;

			tileSegments = [segment];
			
			for (var k = i+1; k < tiles.length; k++) {
				for (var l = 0; l < tiles[k].children.length; l++) {
					if (tiles[k].children[l].getAttribute("OSM_id") == id) {
						tileSegments.push (tiles[k].children[l]);
					}
				}
			}
			
			for (var m = 1; m <tileSegments.length; m++) {
				combineSegments (segment, tileSegments[m], offsets_dest);
				tileSegments[m].parentNode.removeChild (tileSegments[m]);
			}
			
			segment.setAttribute("fill", "lightblue");
			completedFeatures.push (id);
		}
	}
	
	tileConcatCompleted ();
}


var po = org.polymaps;

var map = po.map()
	.container(document.getElementById("map").appendChild(po.svg("svg")))
	.center({lat: 63.43, lon: 10.39})
	.zoomRange([10, 20])
	.zoom(17)
	.add(po.interact());

//Setup for timing
setUpTester([63.429, 10.377, 63.4372, 10.407], [17, 20], map, "Global Search, Special data set, Special algorithm");

var geoJson_layer = (po.geoJson()
	.url("http://127.0.0.1:8080/trondheim_centre_buildings/{Z}/{X}/{Y}.geojson") //Remember to use this address rather than localhost to avoid cross-domain restrictions.
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
	var visitedTiles;
	
	for (var i = 0; i < tiles.length; i++) {

	tile = tiles[i];
	
	//Prepare the tile for larger features	
	tile.removeAttribute ("clip-path");
	
	offsets_dest = findTileOffset (tile);

		//For each feature segment
		for (var j = 0; j < tile.children.length; j++) {
			segment = tile.children[j]

			//Getting the unique ID
			id = segment.getAttribute("OSM_id");
			
			if (id in oc(completedFeatures)) continue;

			tileSegments = [];
			visitedTiles = [];

			//Look for neighbours
			
			tileSegments = findFeatureNeighbours(id, tile, tileSegments, visitedTiles, tiles);
			
			//Combine segments
			
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

function findFeatureNeighbours(id, tile, tileSegments, visitedTiles, tiles) {
	
	if (checkForVisits (tile, visitedTiles)) {
		return tileSegments;
	}
	
	visitedTiles.push (tile);

	for (var j = 0; j < tile.children.length; j++) {
		
		//If we find a match we add it straightaway
		segment = tile.children[j]
		
		if (segment.getAttribute("OSM_id") == id) { 
		
			tileSegments.push (segment)
			//This segment matches the ID, check for neighbours
			
			//Get the path
			var paintingInstructions = Raphael.parsePathString(segment.getAttribute("d"));
			
			
			//Check for crossings to the north
			for (var i = 0; i < paintingInstructions.length; i++) {
				if (paintingInstructions[i][2] <= 0.1) {
					var nextTile = findTile (tile, "0,1", tiles);
					tileSegments = findFeatureNeighbours(id, nextTile, tileSegments, visitedTiles, tiles);
					break; //We've found a reason to cross the border, no need to contunue searching.
				}
			}
			
			//Check for crossings to the east
			for (var i = 0; i < paintingInstructions.length; i++) {
				if (paintingInstructions[i][1] >= 255.9) {
					var nextTile = findTile (tile, "1,0", tiles);
					tileSegments = findFeatureNeighbours(id, nextTile, tileSegments, visitedTiles, tiles);
					break;
				}
			}
			
			//Check for crossings to the south
			for (var i = 0; i < paintingInstructions.length; i++) {
				if (paintingInstructions[i][2] >= 255.9) {
					var nextTile = findTile (tile, "0,-1", tiles);
					tileSegments = findFeatureNeighbours(id, nextTile, tileSegments, visitedTiles, tiles);
					break;
				}
			}
			
			//Check for crossings to the west
			for (var i = 0; i < paintingInstructions.length; i++) {
				if (paintingInstructions[i][1] <= 0.1) {
					var nextTile = findTile (tile, "-1,0", tiles);
					tileSegments = findFeatureNeighbours(id, nextTile, tileSegments, visitedTiles, tiles);
					break;
				}
			}
			break; //We've found our segment, break out of the search loop
		}	
	}
	return tileSegments;
}


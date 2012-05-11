var po = org.polymaps;

var map = po.map()
	.container(document.getElementById("map").appendChild(po.svg("svg")))
	.center({lat: 63.43, lon: 10.39280891418456})
	.zoomRange([1, 20])
	.zoom(17)
	.add(po.interact());

//Setup for timing
setUpTester([63.429, 10.377, 63.4372, 10.407], [17, 20], map, "Edge Pointers, Special data set");

var geoJson_layer = (po.geoJson()
	.url("http://127.0.0.1:8080/edgepointer_trondheim_centre_buildings/{Z}/{X}/{Y}.geojson") //Remember to use the ip adress rather than localhost to avoid XDomain trouble
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
		if (feature.edgepointer) {
			e.features[i].element.setAttribute("edgepointers", "yes");
			if (feature.edgepointer[0])
				e.features[i].element.setAttribute("edgepointerN", feature.edgepointer[0]);
			if (feature.edgepointer[1])
				e.features[i].element.setAttribute("edgepointerE", feature.edgepointer[1]);
			if (feature.edgepointer[2])
				e.features[i].element.setAttribute("edgepointerS", feature.edgepointer[2]);
			if (feature.edgepointer[3])
				e.features[i].element.setAttribute("edgepointerW", feature.edgepointer[3]);
		}
	}
} 

function concatenateTiles () {
	
	tileConcatStarted ();
	
	var tiles = layer_container.lastChild.children;
	var segment;
	var offsets;
	var id;
	
	var completedFeatures = new Array();
	var tileSegments;
	
	for (var i = 0; i < tiles.length; i++) {
	
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

			//This is where the local magic happens, recursive function
			
			var visitedTiles = new Array();
			tileSegments = followPointers (tile, segment, id, tileSegments, visitedTiles);
			
			for (var m = 1; m <tileSegments.length; m++) {
				combineSegments (segment, tileSegments[m], offsets_dest);
				
				//Instead of removing it like we used to we have keep the pointer attributes,
				// so we remove only the path content
				tileSegments[m].setAttribute ("d", "");
			}
			
			segment.setAttribute("fill", "lightblue");
			completedFeatures.push (id);
		}
	}
	
	tileConcatCompleted ();
}

function followPointers (tile, segment, id, tileSegments, visitedTiles) {
	
	visitedTiles.push (tile);
	
	//Check that the feature is not within a single tile
	if (segment.getAttribute("edgepointers") != "yes") {
		return tileSegments;
	}

	if (segment.getAttribute("edgepointerN") != ",") {
		
		var nextTile = findTile (tile, segment.getAttribute("edgepointerN"));
		
		findSegment (nextTile, id, tileSegments, visitedTiles);
		
	}
	
	if (segment.getAttribute("edgepointerE") != ",") {
		
		var nextTile = findTile (tile, segment.getAttribute("edgepointerE"));
		
		findSegment (nextTile, id, tileSegments, visitedTiles);
		
	}
	
	if (segment.getAttribute("edgepointerS") != ",") {
		
		var nextTile = findTile (tile, segment.getAttribute("edgepointerS"));
		
		findSegment (nextTile, id, tileSegments, visitedTiles);
		
	}
	
	if (segment.getAttribute("edgepointerW") != ",") {
		
		var nextTile = findTile (tile, segment.getAttribute("edgepointerW"));
		
		findSegment (nextTile, id, tileSegments, visitedTiles);
		
	}

	//We've followed it to the end of the trail!
	return tileSegments;
}

//Helper function to find segments in a referenced tile, needs to be local because it refers to the id

function findSegment (nextTile, id, tileSegments, visitedTiles) {
	//IF it's null it wont be in visitedtiles
	if (!checkForVisits (nextTile, visitedTiles)) {
		//Finding the next segment to add

		for (var j = 0; j < nextTile.children.length; j++) {

			if (nextTile.children[j].getAttribute("OSM_id") == id ) {

				tileSegments.push (nextTile.children[j]);
				//Searching for pointers outwards
				followPointers (nextTile, nextTile.children[j], id,  tileSegments, visitedTiles)
			}
		}
		
	}
}


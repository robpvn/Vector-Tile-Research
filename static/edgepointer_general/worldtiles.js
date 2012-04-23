var po = org.polymaps;

var map = po.map()
	.container(document.getElementById("map").appendChild(po.svg("svg")))
	.center({lat: 63.43061067575344, lon: 10.39280891418456})
	.zoomRange([2, 20])
	.zoom(5)
	.add(po.interact());


var geoJson_layer = (po.geoJson()
	.url("http://127.0.0.1:8080/edgepointer_test/{Z}/{X}/{Y}.geojson") //Remember to use the ip adress rather than localhost to avoid XDomain trouble
	.on("load", po.stylist()
		.title(function(d) { return d.properties.NAME + ": " + d.properties.UN + " UN"; })
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
		var feature = e.features[i].data, d = feature.properties.UN;
		e.features[i].element.setAttribute("class", "country");
		e.features[i].element.setAttribute("fill", "blue");
		e.features[i].element.setAttribute("UN_code", d);
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
	
	var tiles = layer_container.lastChild.children;
	var segment;
	var offsets;
	var id;
	
	var completedFeatures = new Array();
	var tileSegments;
	
	for (var i = 0; i < tiles.length; i++) {
	
	tile = tiles[i];
	
	//Preprare the tile for larger features	
	tile.removeAttribute ("clip-path");
	
	offsets_dest = findTileOffset (tile);
		for (var j = 0; j < tile.children.length; j++) {
			segment = tile.children[j]
			
			//Getting the unique ID
			id = segment.getAttribute("UN_code");
			
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

//Helper function to find segments in a referenced tile

function findSegment (nextTile, id, tileSegments, visitedTiles) {
	//If it's null it wont be in visitedtiles
	if (!checkForVisits (nextTile, visitedTiles)) {
		//Finding the next segment to add

		//console.log ("Searching for id match in the referenced tile");
		for (var j = 0; j < nextTile.children.length; j++) {
			
			if (nextTile.children[j].getAttribute("UN_code") == id ) {

				tileSegments.push (nextTile.children[j]);
				//Searching for pointers outwards
				followPointers (nextTile, nextTile.children[j], id,  tileSegments, visitedTiles)
			}
		}
	}
}


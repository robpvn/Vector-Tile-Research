var po = org.polymaps;

var map = po.map()
	.container(document.getElementById("map").appendChild(po.svg("svg")))
	.center({lat: 63.43, lon: 10.39280891418456})
	.zoomRange([14, 18])
	.zoom(16)
	.add(po.interact());


var geoJson_layer_roads = (po.geoJson()
	.url("http://127.0.0.1:8080/edgepointer_trondheim_centre_roads/{Z}/{X}/{Y}.geojson") //Remember to use the ip adress rather than localhost to avoid XDomain trouble
	.on("load", po.stylist()
		.title(function(d) { return "Name: " + d.properties.name + " ID: " + d.properties.osm_id; })
	)

	.on("load", load_roads)
///*
	.on("load", tileLoaded)
	.on("added_tile", tileAdded)
	.on("aborted_tile", tileAborted)
//*/
);

var geoJson_layer_buildings = (po.geoJson()
	.url("http://127.0.0.1:8080/edgepointer_trondheim_centre_buildings/{Z}/{X}/{Y}.geojson") //Remember to use the ip adress rather than localhost to avoid XDomain trouble
	.on("load", po.stylist()
		.title(function(d) { return "Name: " + d.properties.name + " ID: " + d.properties.osm_id; })
	)

	.on("load", load_buildings)
///*
	.on("load", tileLoaded)
	.on("added_tile", tileAdded)
	.on("aborted_tile", tileAborted)
//*/
);


map.add(po.image()
    .url("http://a.tile.openstreetmap.org/{Z}/{X}/{Y}.png") // OSM tiles
);
	
map.add(geoJson_layer_roads);
map.add(geoJson_layer_buildings)

map.add(po.compass()
	.pan("none"));

var layer_container1 = document.getElementById("org.polymaps.1").parentNode;  
var layer_container2 = document.getElementById("org.polymaps.2").parentNode;  

function load_roads(e) {
	for (var i = 0; i < e.features.length; i++) {
		var feature = e.features[i].data, d = feature.properties.osm_id;
		e.features[i].element.setAttribute("class", "road");
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

function load_buildings(e) {
	for (var i = 0; i < e.features.length; i++) {
		var feature = e.features[i].data, d = feature.properties.osm_id;
		e.features[i].element.setAttribute("class", "building");
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
	
	console.log ("Concatenating tiles (in theory)");
	
	var tiles = layer_container1.lastChild.children;
	concatenateLayer (tiles);
	
	tiles = layer_container2.lastChild.children;
	
	concatenateLayer (tiles);
}

function concatenateLayer (tiles) {
	
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
			id = segment.getAttribute("OSM_id");
			
			if (id in oc(completedFeatures)) continue;

			tileSegments = [segment];

			//This is where the local magic happens, recursive function
			
			var visitedTiles = new Array();
			tileSegments = followPointers (tile, segment, id, tileSegments, visitedTiles, tiles);
			
			for (var m = 1; m <tileSegments.length; m++) {
				combineSegments (segment, tileSegments[m], offsets_dest);

				//Instead of removing it like we used to we have keep the pointer attributes,
				// so we remove only the path content
				tileSegments[m].setAttribute ("d", "");
			}
			completedFeatures.push (id);
		}
	}

}

function followPointers (tile, segment, id, tileSegments, visitedTiles, tiles) {
	
	visitedTiles.push (tile);
	
	//Check that the feature is not within a single tile
	if (segment.getAttribute("edgepointers") != "yes") {
		return tileSegments;
	}

	if (segment.getAttribute("edgepointerN") != ",") {

		var nextTile = findTile (tile, segment.getAttribute("edgepointerN"), tiles);
		
		findSegment (nextTile, id, tileSegments, visitedTiles, tiles);
	}
	
	if (segment.getAttribute("edgepointerE") != ",") {

		var nextTile = findTile (tile, segment.getAttribute("edgepointerE"), tiles);
		
		findSegment (nextTile, id, tileSegments, visitedTiles, tiles);
	}
	
	if (segment.getAttribute("edgepointerS") != ",") {

		var nextTile = findTile (tile, segment.getAttribute("edgepointerS"), tiles);
		
		findSegment (nextTile, id, tileSegments, visitedTiles, tiles);
	}
	
	if (segment.getAttribute("edgepointerW") != ",") {

		var nextTile = findTile (tile, segment.getAttribute("edgepointerW"), tiles);
		
		findSegment (nextTile, id, tileSegments, visitedTiles, tiles);
	}
	//We've followed it to the end of the trail!
	return tileSegments;	
}

//Helper function to find segments in a referenced tile

function findSegment (nextTile, id, tileSegments, visitedTiles, tiles) {
	//If it's null it wont be in visitedtiles
	if (!checkForVisits (nextTile, visitedTiles)) {
		//Finding the next segment to add

		for (var j = 0; j < nextTile.children.length; j++) {

			if (nextTile.children[j].getAttribute("OSM_id") == id ) {

				tileSegments.push (nextTile.children[j]);
				//Searching for pointers outwards
				followPointers (nextTile, nextTile.children[j], id,  tileSegments, visitedTiles, tiles)
			}
		}

	}
}


var po = org.polymaps;

var map = po.map()
	.container(document.getElementById("map").appendChild(po.svg("svg")))
	.center({lat: 63.43, lon: 10.39280891418456})
	.zoomRange([1, 20])
	.zoom(16)
	.add(po.interact());

map.add(po.geoJson()
	.url("http://127.0.0.1:8080/trondheim_centre_buildings/{Z}/{X}/{Y}.geojson") //Remember to use this address rather than localhost to avoid cross-domain restrictions.
	.on("load", po.stylist()
		.title(function(d) { return d.properties.name; })
	)
	.on("load", load)
)

map.add(po.compass()
	.pan("none"));
    
function load(e) {
	for (var i = 0; i < e.features.length; i++) {
		var feature = e.features[i].data;
		e.features[i].element.setAttribute("class", "building");
	} 
}


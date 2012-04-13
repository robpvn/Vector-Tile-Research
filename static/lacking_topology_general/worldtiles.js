var po = org.polymaps;

var map = po.map()
    .container(document.getElementById("map").appendChild(po.svg("svg")))
    .center({lat: 50, lon: 10})
    .zoomRange([2, 7])
    .zoom(5)
    .add(po.interact());


map.add(po.geoJson()
    .url("http://127.0.0.1:8080/vector_test/{Z}/{X}/{Y}.geojson") //REMEMBER That cross-domain shit is out to kill you at any given time.
    .on("load", po.stylist()
    	//.attr("fill", "lightblue")
    	//.attr("stroke", "lightblue")
    	//.attr("fill", function(d) { return color(d.properties.UN).color; })
    	.title(function(d) { return d.properties.NAME + ": " + d.properties.UN + " UN"; })
    )
    
    .on("load", load)
)


map.add(po.compass()
    .pan("none"));
    

  function load(e) {
  for (var i = 0; i < e.features.length; i++) {
    var feature = e.features[i].data, d = feature.properties.UN;
    console.log (feature.properties.NAME + " NR: " + d);
    e.features[i].element.setAttribute("class", "country"); //Could probably be done better
  }
  
  
  
}



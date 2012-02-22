var po = org.polymaps;

// Compute noniles.
var quantile = pv.Scale.quantile()
    .quantiles(9)
    .domain(pv.values(states))
    .range(0, 8);

// Date format.
var format = pv.Format.date("%B %e, %Y");

var map = po.map()
    .container(document.getElementById("map").appendChild(po.svg("svg")))
    .center({lat: 50, lon: 10})
    .zoomRange([2, 7])
    .zoom(3)
    .add(po.interact());

/*map.add(po.image()
    .url(po.url("http://{S}tile.cloudmade.com"
    + "/1a1b06b230af4efdbb989ea99e9841af" // http://cloudmade.com/register
    + "/20760/256/{Z}/{X}/{Y}.png")
    .hosts(["a.", "b.", "c.", ""])));

*/

map.add(po.geoJson()
    .url("http://127.0.0.1:8080/vector_test/{Z}/{X}/{Y}.geojson") //REMEMBER That cross-domain shit is out to kill yoiu at any given time.
    //.on("load", load)
    )

map.add(po.compass()
    .pan("none"));

map.container().setAttribute("class", "Blues");

function load(e) {
  for (var i = 0; i < e.features.length; i++) {
    var feature = e.features[i], d = states[feature.data.id.substring(6)];
    if (d == undefined) {
      feature.element.setAttribute("display", "none");
    } else {
      feature.element.setAttribute("class", "q" + quantile(d) + "-" + 9);
      feature.element.appendChild(po.svg("title").appendChild(
          document.createTextNode(feature.data.properties.name + ": "
          + format(d).replace(/ [ ]+/, " ")))
          .parentNode);
    }
  }
}

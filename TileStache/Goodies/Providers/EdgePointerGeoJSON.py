""" 
MODIFIED: Used the Vector porivder as base for edge pointer provider (RPVN)


Provider that returns vector representation of features in a data source.

This is a provider that does not return an image, but rather queries
a data source for raw features and replies with a vector representation
such as GeoJSON. For example, it's possible to retrieve data for
locations of OpenStreetMap points of interest or street centerlines
contained within a tile's boundary.

Many Polymaps (http://polymaps.org) examples use GeoJSON vector data tiles,
which can be effectively created using this provider.

Vector functionality is provided by OGR (http://www.gdal.org/ogr/).
Thank you, Frank Warmerdam.

Currently two serializations and three encodings are supported for a total
of six possible kinds of output with these tile name extensions:

  GeoJSON (.geojson):
    See http://geojson.org/geojson-spec.html

  Arc GeoServices JSON (.arcjson):
    See http://www.esri.com/library/whitepapers/pdfs/geoservices-rest-spec.pdf
  
  GeoBSON (.geobson) and Arc GeoServices BSON (.arcbson):
    BSON-encoded GeoJSON and Arc JSON, see http://bsonspec.org/#/specification
  
  GeoAMF (.geoamf) and Arc GeoServices AMF (.arcamf):
    AMF0-encoded GeoJSON and Arc JSON, see:
    http://opensource.adobe.com/wiki/download/attachments/1114283/amf0_spec_121207.pdf

Possible future supported formats might include KML and others. Get in touch
via Github to suggest other formats: http://github.com/migurski/TileStache.

Common parameters:

  driver:
    String used to identify an OGR driver. Currently, only "ESRI Shapefile",
    "PostgreSQL", and "GeoJSON" are supported as data source drivers, with
    "postgis" and "shapefile" accepted as synonyms. Not case-sensitive.
    
    OGR's complete list of potential formats can be found here:
    http://www.gdal.org/ogr/ogr_formats.html. Feel free to get in touch via
    Github to suggest new formats: http://github.com/migurski/TileStache.
  
  parameters:
    Dictionary of parameters for each driver.
    
    PostgreSQL:
    "dbname" parameter is required, with name of database.
    "host", "user", and "password" are optional connection parameters.
    One of "table" or "query" is required, with a table name in the first
    case and a complete SQL query in the second.
    
    Shapefile and GeoJSON:
    "file" parameter is required, with filesystem path to data file.
  
  properties:
    Optional list or dictionary of case-sensitive output property names.
    
    If omitted, all fields from the data source will be included in response.
    If a list, treated as a whitelist of field names to include in response.
    If a dictionary, treated as a whitelist and re-mapping of field names.
  
  clipped:
    Default is true.
    Boolean flag for optionally clipping the output geometries to the
    bounds of the enclosing tile, or the string value "padded" for clipping
    to the bounds of the tile plus 5%. This results in incomplete geometries,
    dramatically smaller file sizes, and improves performance and
    compatibility with Polymaps (http://polymaps.org).
  
  projected:
    Default is false.
    Boolean flag for optionally returning geometries in projected rather than
    geographic coordinates. Typically this means EPSG:900913 a.k.a. spherical
    mercator projection. Stylistically a poor fit for GeoJSON, but useful
    when returning Arc GeoServices responses.
  
  spacing:
    Optional number of tile pixels for spacing geometries in responses. Used
    to cut down on the number of returned features by ensuring that only those
    features at least this many pixels apart are returned. Order of features
    in the data source matters: early features beat out later features.
  
  verbose:
    Default is false.
    Boolean flag for optionally expanding output with additional whitespace
    for readability. Results in larger but more readable GeoJSON responses.

Example TileStache provider configuration:

  "vector-postgis-points":
  {
    "provider": {"name": "vector", "driver": "PostgreSQL",
                 "parameters": {"dbname": "geodata", "user": "geodata",
                                "table": "planet_osm_point"}}
  }
  
  "vector-postgis-lines":
  {
    "provider": {"name": "vector", "driver": "postgis",
                 "parameters": {"dbname": "geodata", "user": "geodata",
                                "table": "planet_osm_line"}}
  }
  
  "vector-shapefile-points":
  {
    "provider": {"name": "vector", "driver": "ESRI Shapefile",
                 "parameters": {"file": "oakland-uptown-point.shp"},
                 "properties": ["NAME", "HIGHWAY"]}
  }
  
  "vector-shapefile-lines":
  {
    "provider": {"name": "vector", "driver": "shapefile",
                 "parameters": {"file": "oakland-uptown-line.shp"},
                 "properties": {"NAME": "name", "HIGHWAY": "highway"}}
  }
  
  "vector-postgis-query":
  {
    "provider": {"name": "vector", "driver": "PostgreSQL",
                 "parameters": {"dbname": "geodata", "user": "geodata",
                                "query": "SELECT osm_id, name, highway, way FROM planet_osm_line WHERE SUBSTR(name, 1, 1) = '1'"}}
  }
  
  "vector-sf-streets":
  {
    "provider": {"name": "vector", "driver": "GeoJSON",
                 "parameters": {"file": "stclines.json"},
                 "properties": ["STREETNAME"]}
  }

Caveats:

Your data source must have a valid defined projection, or OGR will not know
how to correctly filter and reproject it. Although response tiles are typically
in web (spherical) mercator projection, the actual vector content of responses
is unprojected back to plain WGS84 latitude and longitude.

If you are using PostGIS and spherical mercator a.k.a. SRID 900913,
you can save yourself a world of trouble by using this definition:
  http://github.com/straup/postgis-tools/raw/master/spatial_ref_900913-8.3.sql
"""

from re import compile
from urlparse import urlparse, urljoin

try:
    from json import JSONEncoder, loads as json_loads
except ImportError:
    from simplejson import JSONEncoder, loads as json_loads

try:
    from osgeo import ogr, osr
except ImportError:
    # At least we'll be able to build the documentation.
    pass

from TileStache.Core import KnownUnknown
from TileStache.Geography import getProjectionByName
from Arc import reserialize_to_arc, pyamf_classes

class VectorResponse:
    """ Wrapper class for Vector response that makes it behave like a PIL.Image object.
    
        TileStache.getTile() expects to be able to save one of these to a buffer.
        
        Constructor arguments:
        - content: Vector data to be serialized, typically a dictionary.
        - verbose: Boolean flag to expand response for better legibility.
    """
    def __init__(self, content, verbose):
        self.content = content
        self.verbose = verbose

    def save(self, out, format):
        """
        """
        #
        # Serialize
        #
        
        #TODO: Debug RPVN
        print "Delivering an edge pointer tile"
        
        if format == 'WKT':
            if 'wkt' in self.content['crs']:
                out.write(self.content['crs']['wkt'])
            else:
                out.write(_sref_4326().ExportToWkt())
            
            return
        
        if format in ('GeoJSON', 'GeoBSON', 'GeoAMF'):
            content = self.content
            
            if 'wkt' in content['crs']:
                content['crs'] = {'type': 'link', 'properties': {'href': '0.wkt', 'type': 'ogcwkt'}}
            else:
                del content['crs']

        elif format in ('ArcJSON', 'ArcBSON', 'ArcAMF'):
            content = reserialize_to_arc(self.content, format == 'ArcAMF')
        
        else:
            raise KnownUnknown('Vector response only saves .geojson, .arcjson, .geobson, .arcbson, .geoamf, .arcamf and .wkt tiles, not "%s"' % format)

        #
        # Encode
        #
        if format in ('GeoJSON', 'ArcJSON'):
            indent = self.verbose and 2 or None
            
            encoded = JSONEncoder(indent=indent).iterencode(content)
            float_pat = compile(r'^-?\d+\.\d+$')
    
            for atom in encoded:
                if float_pat.match(atom):
                    out.write('%.6f' % float(atom))
                else:
                    out.write(atom)
        
        elif format in ('GeoBSON', 'ArcBSON'):
            import bson

            encoded = bson.dumps(content)
            out.write(encoded)
        
        elif format in ('GeoAMF', 'ArcAMF'):
            import pyamf
            
            for class_name in pyamf_classes.items():
                pyamf.register_class(*class_name)

            encoded = pyamf.encode(content, 0).read()
            out.write(encoded)

def _sref_4326():
    """
    """
    sref = osr.SpatialReference()
    proj = getProjectionByName('WGS84')
    sref.ImportFromProj4(proj.srs)
    
    return sref

def _tile_perimeter(coord, projection, padded):
    """ Get a tile's outer edge for a coordinate and a projection.
    
        Returns a list of 17 (x, y) coordinates corresponding to a clockwise
        circumambulation of a tile boundary in a given projection. Projection
        is like those found in TileStache.Geography, used for tile output.
        
        If padded argument is True, pad bbox by 5% on all sides.
    """
    if padded:
        ul = projection.coordinateProj(coord.left(0.05).up(0.05))
        lr = projection.coordinateProj(coord.down(1.05).right(1.05))
    else:
        ul = projection.coordinateProj(coord)
        lr = projection.coordinateProj(coord.right().down())
    
    xmin, ymin, xmax, ymax = ul.x, ul.y, lr.x, lr.y
    xspan, yspan = xmax - xmin, ymax - ymin
    
    perimeter = [
        (xmin, ymin),
        (xmin + 1 * xspan/4, ymin),
        (xmin + 2 * xspan/4, ymin),
        (xmin + 3 * xspan/4, ymin),
        (xmax, ymin),
        (xmax, ymin + 1 * yspan/4),
        (xmax, ymin + 2 * yspan/4),
        (xmax, ymin + 3 * yspan/4),
        (xmax, ymax),
        (xmax - 1 * xspan/4, ymax),
        (xmax - 2 * xspan/4, ymax),
        (xmax - 3 * xspan/4, ymax),
        (xmin, ymax),
        (xmin, ymax - 1 * yspan/4),
        (xmin, ymax - 2 * yspan/4),
        (xmin, ymax - 3 * yspan/4),
        (xmin, ymin)
      ]
    
    return perimeter

def _tile_perimeter_width(coord, projection):
    """ Get the width in projected coordinates of the coordinate tile polygon.
    
        Uses _tile_perimeter().
    """
    perimeter = _tile_perimeter(coord, projection, False)
    return perimeter[8][0] - perimeter[0][0]

def _tile_perimeter_geom(coord, projection, padded):
    """ Get an OGR Geometry object for a coordinate tile polygon.
    
        Uses _tile_perimeter().
    """
    perimeter = _tile_perimeter(coord, projection, padded)
    wkt = 'POLYGON((%s))' % ', '.join(['%.3f %.3f' % xy for xy in perimeter])
    geom = ogr.CreateGeometryFromWkt(wkt)
    
    ref = osr.SpatialReference()
    ref.ImportFromProj4(projection.srs)
    geom.AssignSpatialReference(ref)
    
    return geom

def _feature_properties(feature, layer_definition, whitelist=None):
    """ Returns a dictionary of feature properties for a feature in a layer.
    
        Third argument is an optional list or dictionary of properties to
        whitelist by case-sensitive name - leave it None to include everything.
        A dictionary will cause property names to be re-mapped.
    
        OGR property types:
        OFTInteger (0), OFTIntegerList (1), OFTReal (2), OFTRealList (3),
        OFTString (4), OFTStringList (5), OFTWideString (6), OFTWideStringList (7),
        OFTBinary (8), OFTDate (9), OFTTime (10), OFTDateTime (11).
    """
    properties = {}
    okay_types = ogr.OFTInteger, ogr.OFTReal, ogr.OFTString, ogr.OFTWideString
    
    for index in range(layer_definition.GetFieldCount()):
        field_definition = layer_definition.GetFieldDefn(index)
        field_type = field_definition.GetType()
        
        if field_type not in okay_types:
            try:
                name = [oft for oft in dir(ogr) if oft.startswith('OFT') and getattr(ogr, oft) == field_type][0]
            except IndexError:
                raise KnownUnknown("Found an OGR field type I've never even seen: %d" % field_type)
            else:
                raise KnownUnknown("Found an OGR field type I don't know what to do with: ogr.%s" % name)

        name = field_definition.GetNameRef()
        
        if type(whitelist) in (list, dict) and name not in whitelist:
            continue
        
        property = type(whitelist) is dict and whitelist[name] or name
        properties[property] = feature.GetField(name)
    
    return properties

def _open_layer(driver_name, parameters, dirpath):
    """ Open a layer, return it and its datasource.
    
        Dirpath comes from configuration, and is used to locate files.
    """
    #
    # Set up the driver
    #
    okay_drivers = {'postgis': 'PostgreSQL', 'esri shapefile': 'ESRI Shapefile',
                    'postgresql': 'PostgreSQL', 'shapefile': 'ESRI Shapefile',
                    'geojson': 'GeoJSON'}
    
    if driver_name.lower() not in okay_drivers:
        raise KnownUnknown('Got a driver type Vector doesn\'t understand: "%s". Need one of %s.' % (driver_name, ', '.join(okay_drivers.keys())))

    driver_name = okay_drivers[driver_name.lower()]
    driver = ogr.GetDriverByName(str(driver_name))
    
    #
    # Set up the datasource
    #
    if driver_name == 'PostgreSQL':
        if 'dbname' not in parameters:
            raise KnownUnknown('Need at least a "dbname" parameter for postgis')
    
        conn_parts = []
        
        for part in ('dbname', 'user', 'host', 'password', 'port'):
            if part in parameters:
                conn_parts.append("%s='%s'" % (part, parameters[part]))
        
        source_name = 'PG:' + ' '.join(conn_parts)
        
    elif driver_name in ('ESRI Shapefile', 'GeoJSON'):
        if 'file' not in parameters:
            raise KnownUnknown('Need at least a "file" parameter for a shapefile')
    
        file_href = urljoin(dirpath, parameters['file'])
        scheme, h, file_path, q, p, f = urlparse(file_href)
        
        if scheme not in ('file', ''):
            raise KnownUnknown('Shapefiles need to be local, not %s' % file_href)
        
        source_name = file_path

    datasource = driver.Open(str(source_name))

    if datasource is None:
        raise KnownUnknown('Couldn\'t open datasource %s' % source_name)
    
    #
    # Set up the layer
    #
    if driver_name == 'PostgreSQL':
        if 'query' in parameters:
            layer = datasource.ExecuteSQL(str(parameters['query']))
        elif 'table' in parameters:
            layer = datasource.GetLayerByName(str(parameters['table']))
        else:
            raise KnownUnknown('Need at least a "query" or "table" parameter for postgis')

    else:
        layer = datasource.GetLayer(0)

    if layer.GetSpatialRef() is None: 
        raise KnownUnknown('Couldn\'t get a layer from data source %s' % source_name)

    #
    # Return the layer and the datasource.
    #
    # Technically, the datasource is no longer needed
    # but layer segfaults when it falls out of scope.
    #
    return layer, datasource

def _get_features(coord, properties, projection, layer, clipped, projected, spacing):
    """ Return a list of features in an OGR layer with properties in GeoJSON form.
    
        Optionally clip features to coordinate bounding box, and optionally
        limit returned features to only those separated by number of pixels
        given as spacing.
    """
    #
    # Prepare output spatial reference - always WGS84.
    #
    if projected:
        output_sref = osr.SpatialReference()
        output_sref.ImportFromProj4(projection.srs)
    else:
        output_sref = _sref_4326()
    
    #
    # Load layer information
    #
    definition = layer.GetLayerDefn()
    layer_sref = layer.GetSpatialRef()
    
    #
    # Spatially filter the layer
    #
    bbox = _tile_perimeter_geom(coord, projection, clipped == 'padded')
    bbox.TransformTo(layer_sref)
    layer.SetSpatialFilter(bbox)
    
    features = []
    mask = None
    
    if spacing is not None:
        buffer = spacing * _tile_perimeter_width(coord, projection) / 256.

    for feature in layer:
        geometry = feature.geometry().Clone()
        
        if not geometry.Intersect(bbox):
            continue
        
        if mask and geometry.Intersect(mask):
            continue
        
        if clipped:
            #RPVN: Need to find the relevant neighbours either before we clip or clip a copy and then find, so that we can insert them at the end
            
            nearest_neighbours = _get_nearest_neighbours(geometry, coord, bbox, projection, layer_sref)
            if nearest_neighbours is not None:
                print "Northern neighbour is X: " + str(nearest_neighbours[0][0]) + " and Y: " + str(nearest_neighbours[0][1])
            
            geometry = geometry.Intersection(bbox)
        
        if geometry is None:
            # may indicate a TopologyException
            continue
        
        # mask out subsequent features if spacing is defined
        if mask and buffer:
            mask = geometry.Buffer(buffer, 2).Union(mask)
        elif spacing is not None:
            mask = geometry.Buffer(buffer, 2)
        
        geometry.AssignSpatialReference(layer_sref)
        geometry.TransformTo(output_sref)

        geom = json_loads(geometry.ExportToJson())
        prop = _feature_properties(feature, definition, properties)
        
        if clipped:
            features.append({'type': 'Feature', 'properties': prop, 'geometry': geom, 'edgepointer': nearest_neighbours}) #RPVN: Need to add the edge pointers here
        else:
            features.append({'type': 'Feature', 'properties': prop, 'geometry': geom})
    
    return features
    
def _get_nearest_neighbours(geometry, coord, bbox, projection, layer_sref):
    """
        Returns a list of adresses for the nearest tiles in each direction that contain
        segments of the current feature
        (RPVN)
    """
    
    #Check if the entire feature is contained within the tile, if so return no neighbours
    if bbox.Contains(geometry):
        print "Entire feature within bbox"
        return None
    else:
        print "Feature extends beyond bbox"
    
    # Check the entire envelope of the feature and gauge how many tiles are within it,
    # as well as the relative position of our current tile...
    
    tileextent = bbox.GetEnvelope()
    featureextent = geometry.GetEnvelope()
    """
    print "Tile Envelope:"
    print "Top Left E: " + str(tileextent[0])
    print "Top Left N: " + str(tileextent[3])
    print "Bottom Right E: " + str(tileextent[1])
    print "Bottom Right N: " + str(tileextent[2])
    
    print "Calculated TPW width: " + str(tileextent[3] - tileextent[2])
    print "Reported TPW width: " + str(_tile_perimeter_width(coord, projection))
    
    
    print "Feature Envelope:"
    print "Top Left E: " + str(featureextent[0])
    print "Top Left N: " + str(featureextent[3])
    print "Bottom Right E: " + str(featureextent[1])
    print "Bottom Right N: " + str(featureextent[2])
    """
    #TODO: Need to remember to do checks for 180 degrees! (Going around the edge of the map)
    
    #Find the tile width (or import it?) and the tile centerpoint
    #tile_width = tileextent[3] - tileextent[2]
    #tile_width = _tile_perimeter_width(coord, projection)
    tile_width = 1
    tile_center = coord 
    
    """
    The search algorithm here is kind of like an iterative "equilateral cross with its arms bent at right angles", where
    you go out one column/row (depending on perspective) per main iteration and down/across all the columns/rows in the sub-iterations.
    That way all possible areas are covered and one can hope to hit a match as soon as possible. (In most cases the very first tile to
    be checked will be a match.)
    
    """
    
    #North
    
    north_neighbour_x = None
    north_neighbour_y = None
    continue_col = True
    continue_row = True
    
    col_count = 0
    
    while continue_col:
        
        col_count += 1
        row_count = 0
        continue_row = True
        
        #Make a new tile based on the original centrepoint plus the width added northwards
        search_tile = _tile_perimeter_geom(coord.up(col_count * tile_width), projection, False)
        search_tile.TransformTo(layer_sref)
        print "coord is" + str(coord)
        print "Calculated TPW width: " + str(tileextent[3] - tileextent[2])
        print "Reported TPW width: " + str(tile_width)
        print "changed coord is" + str(coord.up(col_count * tile_width) )
        
        #Check if the envelope edge is within this tile
        if not geometry.Contains(search_tile):
            print "Reached the edge of the cols, col count is " + str(col_count)
            continue_col = False
        
        #Check if the feature is within this tile
        if search_tile.Intersects(geometry): #TODO: Is thir the right function to use?
            print "Found a feature segment, North, Row 0"
            north_neighbour_x = row_count
            north_neighbour_y = col_count
            break
            
        
        while continue_row:
            
            row_count += 1
            
            
            
            #Make a new tile based on the previous centrepoint plus the width added eastwards
            search_tile = _tile_perimeter_geom(coord.up(col_count * tile_width).right(row_count * tile_width), projection, False)
            search_tile.TransformTo(layer_sref)
            
            #Check if the envelope edge is within this tile
            if not geometry.Contains(search_tile):
                print "Reached the edge of the row, row count is " + str(row_count)
                continue_row = False
            
            #Check if the feature is within this tile
            if search_tile.Intersects(geometry):
                print "Found a feature segment, North, Row > 0"
                north_neighbour_x = row_count
                north_neighbour_y = col_count
                continue_col = False
                break
    
    
    #East - Cols and rows switch x and y, y becomes negative
    
    east_neighbour_x = None
    east_neighbour_y = None
    continue_col = True
    continue_row = True
    
    col_count = 0
    
    #"""
    while continue_col:
        
        col_count += 1
        row_count = 0
        continue_row = True
        
        #Make a new tile based on the original centrepoint plus the width added eastwards
        search_tile = _tile_perimeter_geom(coord.right(col_count * tile_width), projection, False)
        search_tile.TransformTo(layer_sref)
        #print "coord is" + str(coord)
        #print "Calculated TPW width: " + str(tileextent[3] - tileextent[2])
        #print "Reported TPW width: " + str(tile_width)
        #print "changed coord is" + str(coord.up(col_count * tile_width) )
        
        #Check if the envelope edge is within this tile
        if not geometry.Contains(search_tile):
            #print "Reached the edge of the cols!"
            continue_col = False
        
        #Check if the feature is within this tile
        if geometry.Intersects(search_tile): #TODO: Is thir the right function to use?
            #print "Found a feature segment"
            east_neighbour_x = col_count
            east_neighbour_y = - row_count
            break
            
        
        while continue_row:
            
            row_count += 1
            
            
            
            #Make a new tile based on the previous centrepoint plus the width added southwards
            search_tile = _tile_perimeter_geom(coord.right(col_count * tile_width).down(row_count * tile_width), projection, False)
            search_tile.TransformTo(layer_sref)
            
            #Check if the envelope edge is within this tile
            if not geometry.Contains(search_tile):
                #print "Reached the edge of the row."
                continue_row = False
            
            #Check if the feature is within this tile
            if search_tile.Intersects(geometry):
                #print "Found a feature segment"
                east_neighbour_x = col_count
                east_neighbour_y = - row_count
                continue_col = False
                break
    
    #South - cols and rows like north, both negative
    
    south_neighbour_x = None
    south_neighbour_y = None
    continue_col = True
    continue_row = True
    
    col_count = 0
    
    while continue_col:
        
        col_count += 1
        row_count = 0
        continue_row = True
        
        #Make a new tile based on the original centrepoint plus the width added southwards
        search_tile = _tile_perimeter_geom(coord.down(col_count * tile_width), projection, False)
        search_tile.TransformTo(layer_sref)
        #print "coord is" + str(coord)
        #print "Calculated TPW width: " + str(tileextent[3] - tileextent[2])
        #print "Reported TPW width: " + str(tile_width)
        #print "changed coord is" + str(coord.up(col_count * tile_width) )
        
        #Check if the envelope edge is within this tile
        if not geometry.Contains(search_tile):
            #print "Reached the edge of the cols!"
            continue_col = False
        
        #Check if the feature is within this tile
        if geometry.Intersects(search_tile): #TODO: Is thir the right function to use?
            #print "Found a feature segment"
            south_neighbour_x = - row_count
            south_neighbour_y = - col_count
            break
            
        
        while continue_row:
            
            row_count += 1
            
            
            
            #Make a new tile based on the previous centrepoint plus the width added westwards
            search_tile = _tile_perimeter_geom(coord.down(col_count * tile_width).left(row_count * tile_width), projection, False)
            search_tile.TransformTo(layer_sref)
            
            #Check if the envelope edge is within this tile
            if not geometry.Contains(search_tile):
                #print "Reached the edge of the row."
                continue_row = False
            
            #Check if the feature is within this tile
            if search_tile.Intersects(geometry):
                #print "Found a feature segment"
                south_neighbour_x = - row_count
                south_neighbour_y = - col_count
                continue_col = False
                break
    
    
    #West cols/rows like east, x is negative
    
    west_neighbour_x = None
    west_neighbour_y = None
    continue_col = True
    continue_row = True
    
    col_count = 0
    
    #"""
    while continue_col:
        
        col_count += 1
        row_count = 0
        continue_row = True
        
        #Make a new tile based on the original centrepoint plus the width added eastwards
        search_tile = _tile_perimeter_geom(coord.left(col_count * tile_width), projection, False)
        search_tile.TransformTo(layer_sref)
        #print "coord is" + str(coord)
       # print "Calculated TPW width: " + str(tileextent[3] - tileextent[2])
       # print "Reported TPW width: " + str(tile_width)
       # print "changed coord is" + str(coord.up(col_count * tile_width) )
        
        #Check if the envelope edge is within this tile
        if not geometry.Contains(search_tile):
            #print "Reached the edge of the cols!"
            continue_col = False
        
        #Check if the feature is within this tile
        if geometry.Intersects(search_tile): #TODO: Is thir the right function to use?
            #print "Found a feature segment"
            west_neighbour_x = - col_count
            west_neighbour_y = row_count
            break
            
        
        while continue_row:
            
            row_count += 1
            
            
            
            #Make a new tile based on the previous centrepoint plus the width added southwards
            search_tile = _tile_perimeter_geom(coord.left(col_count * tile_width).up(row_count * tile_width), projection, False)
            search_tile.TransformTo(layer_sref)
            
            #Check if the envelope edge is within this tile
            if not geometry.Contains(search_tile):
                #print "Reached the edge of the row."
                continue_row = False
            
            #Check if the feature is within this tile
            if search_tile.Intersects(geometry):
                #print "Found a feature segment"
                west_neighbour_x = - col_count
                west_neighbour_y = row_count
                continue_col = False
                break
    
    
    
    return [[north_neighbour_x, north_neighbour_y], [east_neighbour_x, east_neighbour_y], [south_neighbour_x, south_neighbour_y], [west_neighbour_x, west_neighbour_y]]

class Provider:
    """ Vector Provider for OGR datasources.
    
        See module documentation for explanation of constructor arguments.
    """
    
    def __init__(self, layer, driver, parameters, clipped, verbose, projected, spacing, properties):
        self.layer = layer
        self.driver = driver
        self.clipped = clipped
        self.verbose = verbose
        self.projected = projected
        self.spacing = spacing
        self.parameters = parameters
        self.properties = properties

    def renderTile(self, width, height, srs, coord):
        """ Render a single tile, return a VectorResponse instance.
        """
        layer, ds = _open_layer(self.driver, self.parameters, self.layer.config.dirpath)
        features = _get_features(coord, self.properties, self.layer.projection, layer, self.clipped, self.projected, self.spacing)
        response = {'type': 'FeatureCollection', 'features': features}
        
        if self.projected:
            sref = osr.SpatialReference()
            sref.ImportFromProj4(self.layer.projection.srs)
            response['crs'] = {'wkt': sref.ExportToWkt()}
            
            if srs == getProjectionByName('spherical mercator').srs:
                response['crs']['wkid'] = 102113
        else:
            response['crs'] = {'srid': 4326, 'wkid': 4326}

        return VectorResponse(response, self.verbose)
        
    def getTypeByExtension(self, extension):
        """ Get mime-type and format by file extension.
        
            This only accepts "geojson" for the time being.
        """
        if extension.lower() == 'geojson':
            return 'text/json', 'GeoJSON'
    
        elif extension.lower() == 'arcjson':
            return 'text/json', 'ArcJSON'
            
        elif extension.lower() == 'geobson':
            return 'application/x-bson', 'GeoBSON'
            
        elif extension.lower() == 'arcbson':
            return 'application/x-bson', 'ArcBSON'
            
        elif extension.lower() == 'geoamf':
            return 'application/x-amf', 'GeoAMF'
            
        elif extension.lower() == 'arcamf':
            return 'application/x-amf', 'ArcAMF'
            
        elif extension.lower() == 'wkt':
            return 'text/x-wkt', 'WKT'

        raise KnownUnknown('Vector Provider only makes .geojson, .arcjson, .geobson, .arcbson, .geoamf, .arcamf and .wkt tiles, not "%s"' % extension)

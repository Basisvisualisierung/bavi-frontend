# VT Microfrontend
An interactive vector tiles map as webcomponent. It's based on the [vector tiles services of Basisvisualisierung](https://basisvisualisierung.niedersachsen.de) and its [stylings](https://github.com/Basisvisualisierung/vt-styles/tree/basiskarte_ni).

## Usage
### Import
Import the `vt-microfrontend.min.js` in the header section of your web application:
```
<head>
    ...
    <script src="path/to/vt-microfrontend.min.js"></script>
</head>
```
### Components and Properties
#### vt-map
Displays a map.
| Name       | Required | Type       | Default | Reactive | Description |
|------------|----------|------------|---------|----------|-------------|
| lon        | no       | number     | 9.73    | yes      | center position |
| lat        | no       | number     | 52.37   | yes      | center position |
| zoom       | no       | number     | 12      | yes      | zoom level |
| map-style  | no       | string/URL | classic | yes      | classic, color, grayscale, light, night, url to custom style |
| map-click  | no       | string     |         | yes      | callback function name |
| map-height | no       | string     | 100vh   | yes      | height of the map, css value |
| map-width  | no       | string     | 100%    | yes      | width of the map, css value |

#### vt-control
Describes a map control element e.g. a scale or zoom controls. Has to be inside a vt-map.
| Name     | Required | Type   | Default | Reactive | Description |
|----------|----------|--------|---------|----------|-------------|
| type     | yes      | string |         | yes      | navigation, scale, geolocate, fullscreen |
| position | yes      | string |         | yes      | top-left, top-right, bottom-left, bottom-right |

#### vt-marker
Describes a location with marker on the map. Has to be inside a vt-map.
| Name | Required | Type   | Default | Reactive | Description |
|------|----------|--------|---------|----------|-------------|
| lon  | yes      | number |         | yes      | marker position |
| lat  | yes      | number |         | yes      | marker position |

#### vt-popup
Define a popup for a vt-marker. Has to be inside a vt-marker.
| Name  | Required | Type   | Default | Reactive | Description |
|-------|----------|--------|---------|----------|-------------|
| title | no       | string | empty   | yes      | title for the popup |
| text  | no       | string | empty   | yes      | text under the title in the popup |

#### vt-source
Add externel data on top of your map. Has to be inside vt-map.
| Name | Required | Type   | Default | Reactive | Description |
|------|----------|--------|---------|----------|-------------|
| type | yes      | string |         | no       | vector, geojson |
| src  | yes      | url    |         | no       | url to external service/data |

#### vt-layer
Describe a layer of your vt-source. Has to be inside at vt-source.
| Name          | Required | Type   | Default | Reactive | Description |
|---------------|----------|--------|---------|----------|-------------|
| id            | yes      | string |         | yes      | id of layer |
| type          | yes      | string |         | yes      | line, fill, circle |
| minzoom       | no       | number | unset   | yes      | min. zoom level for layer to be visible |
| maxzoom       | no       | number | unset   | yes      | max. zoom level for layer to be visible |
| color         | no       | string | #000000 | yes      | color for layer visualization |
| opacity       | no       | number | 1.0     | yes      | opacity level |
| line-width    | no       | number | 1       | yes      | sets the width if type is line |
| circle-radius | no       | number | 5       | yes      | sets the radius if type is circle |


### Examples
The easiest way to display a map is to declare it without any properties:
```
<!DOCTYPE html>
<html>
<head>
    <title>Example 1</title>
    <script src="./dist/vt-microfrontend.min.js"></script>
</head>
<body>
    <vt-map></vt-map>
</body>
</html>
```
A more complete example:
```
<!DOCTYPE html>
<html>
<head>
    <title>Example 2</title>
    <script src="./dist/vt-microfrontend.min.js"></script>
</head>
<body>
    <vt-map map-style="light">

        <vt-control type="navigation" position="top-left"></vt-control>
        <vt-control type="fullscreen" position="top-right"></vt-control>
        <vt-control type="scale" position="bottom-left"></vt-control>

        <vt-marker lon="9.8" lat="52.0"></vt-marker>
        <vt-marker lon="9.80205" lat="52.40729">
            <vt-popup title="Title of Popup" text="Text of popup"></vt-popup>
        </vt-marker>

        <vt-source type="vector" src="<URL TO WMTS>">
            <vt-layer id="<ID OF LAYER IN WMTS>" type="line" minzoom="14" maxzoom="24" color="red"></vt-layer>
        </vt-source>

    </vt-map>
</body>
</html>
```

## Build
Dependencies: [`browserify`](https://browserify.org) (npm install -g browserify) and [`uglify-js`](https://github.com/mishoo/UglifyJS) (npm install -g uglify-js).

After installing the dependencies, run the following commands inside the project folder to build it:
```
chmod u+x build.sh
./build.sh
```
This will combine the code of `app.js` with all required css and javascript files: `vt-microfrontend.min.js` will be created in the dist folder.


## License

Licensed under the European Union Public License (EUPL). For more information see [LICENSE.txt](LICENSE.txt)

Copyright 2021 Landesamt für Geoinformation und Landesvermessung Niedersachsen

## 3rd Party Licenses

[MapLibre GL JS](https://github.com/maplibre/maplibre-gl-js/blob/main/LICENSE.txt)

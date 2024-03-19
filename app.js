const css = require("maplibre-gl/dist/maplibre-gl.css")
const maplibregl = require("maplibre-gl/dist/maplibre-gl")

/**
 * Displays a vector tiles map
 */
class VTMap extends HTMLElement {

    /** The maplibre map object */
    map
    /** The HTML container for the map */
    container
    /** A binding used for the mapClickFunction */
    mapClickBinding
    /** User definable callback */
    mapClickFunction
    /** Indicates if map is changing zoomlevel */
    isZooming = false
    /** Indicates if map is moving */
    isDraging = false

    /** All available map styles */
    static styles = ["classic", "color", "grayscale", "light", "night"]

    /** All available attributes */
    static get observedAttributes() {
        return [
            "lon",
            "lat",
            "zoom",
            "map-height",
            "map-width",
            "map-style",
            "map-click",
        ]
    }

    /**
     * Initial setup of the map after element is attached to the DOM
     */
    connectedCallback() {
        // Create a function binding to this for map-click-listener
        this.mapClickBinding = this.evalClick.bind(this)

        // Set initial values for needed attributes if not provided by user
        !this.hasAttribute("lon") && this.setAttribute("lon", "9.73")
        !this.hasAttribute("lat") && this.setAttribute("lat", "52.37")
        !this.hasAttribute("zoom") && this.setAttribute("zoom", "12")
        !this.hasAttribute("map-height") && this.setAttribute("map-height", "100vh")
        !this.hasAttribute("map-width") && this.setAttribute("map-width", "100%")
        !this.hasAttribute("map-style") && this.setAttribute("map-style", "classic")

        // Add container and stylesheet
        const shadow = this.attachShadow({ mode: "open" })
        const style = document.createElement("style")
        this.container = document.createElement("div")
        style.innerText = css
        this.container.id = "map-container" + performance.now()
        this.container.style.height = this.getAttribute("map-height")
        this.container.style.width = this.getAttribute("map-width")
        this.container.style.margin = "auto"
        shadow.appendChild(style)
        shadow.appendChild(this.container)

        // Create map and add it to the container
        this.map = new maplibregl.Map({
            container: this.container,
            center: [this.getAttribute("lon"), this.getAttribute("lat")],
            zoom: this.getAttribute("zoom"),
            style: this.getStyle(this.getAttribute("map-style")),
            attributionControl: false
        })
        this.attribution = new maplibregl.AttributionControl({})
        this.map.addControl(this.attribution)

        // Set part attribute to enable css styling from the host
        this.map.getCanvas().setAttribute("part", "mapcanvas")

        // Set listener to provided function
        this.mapClickFunction = this.getAttribute("map-click")
        this.map.on("click", this.mapClickBinding)

        // Register listeners to update values in the HTML component
        this.map.on("zoom", () => {
            this.isZooming = true
            this.setAttribute("zoom", this.map.getZoom().toFixed(2))
            this.isZooming = false
        })
        this.map.on("drag", () => {
            this.isDraging = true
            this.setAttribute("lon", this.map.getCenter().lng.toFixed(2))
            this.setAttribute("lat", this.map.getCenter().lat.toFixed(2))
            this.isDraging = false
        })

        // Display map correctly on load
        this.map.once("render", () => { this.map.resize() })
    }

    /**
     * Changes state of the map if attributes are changed
     * @param {string} attrName Name of the attribute 
     * @param {string} oldVal Old value of the attribute
     * @param {string} newVal New value of the attribute
     */
    attributeChangedCallback(attrName, oldVal, newVal) {
        if (!this.map || !this.container) return
        switch (attrName) {
            case "lon":
            case "lat":
                !this.isDraging && this.map.flyTo({ center: [this.getAttribute("lon"), this.getAttribute("lat")] })
                break
            case "zoom":
                !this.isZooming && this.map.flyTo({ zoom: newVal })
                break
            case "map-height":
                this.container.style.height = newVal
                this.map.resize()
                break
            case "map-width":
                this.container.style.width = newVal
                this.map.resize()
                break
            case "map-style":
                this.map.setStyle(this.getStyle(newVal))
                break
            case "map-click":
                this.mapClickFunction = newVal
                this.map.off("click", this.mapClickBinding)
                this.map.on("click", this.mapClickBinding)
                break
        }
    }

    /**
     * Gets URL for a style 
     * @param {string} style Either one of the defined style names or an URL to an external style
     * @returns Full URL to a style
     */
    getStyle(style) {
        return VTMap.styles.includes(style) ? "https://basisvisualisierung.niedersachsen.de/services/basiskarte/styles/vt-style-" + style + ".json" : style
    }

    /**
     * Calls the user provided callback for a click on the map
     * @param {MapMouseEvent} event Maplibre click event 
     */
    evalClick(event) {
        (this.mapClickFunction in window) && eval(this.mapClickFunction)({ // nosemgrep: javascript.browser.security.eval-detected.eval-detected
            lon: event.lngLat.lng,
            lat: event.lngLat.lat
        }, this.map.queryRenderedFeatures(event.point))
    }
}

/* 
Displays Publid Transportation Stations using the Overpass API
 */
class VTTransport extends HTMLElement {

    /** The map object from the VTMap parent */
    map

    connectedCallback() {
        this.map = this.parentElement.map
        this.addIcons()
        this.getStations()
        // this.addStations()
        this.attribution = this.parentElement.attribution
        // this.map.removeControl(new maplibregl.AttributionControl())

        // add custom attribution to satisfy OSM licence
        this.map.removeControl(this.attribution)
        this.customAttribution = new maplibregl.AttributionControl({
            customAttribution: '<a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap contributors</a>'
        })
        this.map.addControl(this.customAttribution);
    }

    disconnectedCallback() {
        this.map.removeControl(this.customAttribution)
        this.map.addControl(this.attribution)
    }

    getStations() {
        const bounds = this.map.getBounds()
        const bbox = `${bounds._sw.lat},${bounds._sw.lng},${bounds._ne.lat},${bounds._ne.lng}`
        const queryString = `[out:json];node["public_transport"](${bbox});convert item ::=::,::geom=geom(),_osm_type=type();out geom;`

        fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(queryString)}`)
            .then(response => response.json())
            .then(data => {
                // aggregate data for stations with the same name
                const aggregateData = data.elements.reduce((agg, feat) => {

                    // TODO: maybe add 'network' as identifier (e. g., 'network' === 'Großraum-Verkehr Hannover')
                    const oldFeat = agg.find(obj => obj['name'] === feat.tags.name)

                    let updatedFeatues = []

                    if (oldFeat) {
                        oldFeat.lon.push(feat.geometry.coordinates[0])
                        oldFeat.lat.push(feat.geometry.coordinates[1])
                        oldFeat.bus = feat.tags.highway === 'bus_stop' ? true : oldFeat.bus
                        oldFeat.tram = feat.tags.railway === 'tram_stop' ? true : oldFeat.tram

                        updatedFeatues = [...agg]
                    } else {
                        updatedFeatues = agg.concat({
                            name: feat.tags.name,
                            lon: [feat.geometry.coordinates[0]],
                            lat: [feat.geometry.coordinates[1]],
                            bus: feat.tags.highway === 'bus_stop' ? true : false,
                            tram: feat.tags.railway === 'tram_stop' ? true : false
                        })
                    }

                    return updatedFeatues
                }, [])

                // calculate common coordinate as arithmetic mean
                const mergedData = aggregateData.map(feat => {
                    const lon = feat.lon.reduce((sum, cur) => sum + cur, 0) / feat.lon.length
                    const lat = feat.lat.reduce((sum, cur) => sum + cur, 0) / feat.lat.length

                    return {
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [lon, lat]
                        },
                        properties: {
                            name: feat.name,
                            bus: feat.bus,
                            tram: feat.tram
                        }
                    }
                })

                // convert data to proper geoJSON
                const geoJSONData = {
                    type: 'FeatureCollection',
                    features: mergedData
                }

                // Add source to map
                this.map.addSource('public-transport', {
                    type: 'geojson',
                    data: geoJSONData
                })
            })
            .then(() => {
                // Add the public transport data to the map as a new source
                this.addStations()
            })
    }

    addStations() {

        // TODO: Choose which stations to load (bus and/or tram)
        
        // Tram station icon and name
        this.map.addLayer({
            id: 'public-transport-tram',
            type: 'symbol',
            source: 'public-transport',
            filter: [
                'all',
                ['==', 'tram', true],
                ['==', 'bus', false]
            ],
            minzoom: 16,
            layout: {
                'text-size': 14,
                'text-letter-spacing': 0.05,
                'text-field': '{name}',
                'text-font': ['Liberation Sans Regular'],
                'text-variable-anchor': ['bottom', 'top'],
                'text-justify': 'auto',
                'text-allow-overlap': true,
                'text-radial-offset': 1.5,
                'icon-image': 'tram_stop',
                'icon-allow-overlap': true,
            },
            paint: {
                'text-color': '#0e2166',
                'text-halo-color': 'white',
                'text-halo-width': 2,
                'text-halo-blur': 0
            }
        })

        // Bus station icon and name
        this.map.addLayer({
            id: 'public-transport-bus',
            type: 'symbol',
            source: 'public-transport',
            filter: [
                'all',
                ['==', 'tram', false],
                ['==', 'bus', true]
            ],
            minzoom: 16,
            layout: {
                'text-size': 14,
                'text-letter-spacing': 0.05,
                'text-field': '{name}',
                'text-font': ['Liberation Sans Regular'],
                'text-variable-anchor': ['bottom', 'top'],
                'text-justify': 'auto',
                'text-allow-overlap': true,
                'text-radial-offset': 1.5,
                'icon-image': 'bus_stop',
                'icon-allow-overlap': true,
            },
            paint: {
                'text-color': '#0e2166',
                'text-halo-color': 'white',
                'text-halo-width': 2,
                'text-halo-blur': 0
            }
        })

        // Combined tram and bus station icon and name
        this.map.addLayer({
            id: 'public-transport-tram-bus',
            type: 'symbol',
            source: 'public-transport',
            filter: [
                'all',
                ['==', 'tram', true],
                ['==', 'bus', true]
            ],
            minzoom: 16,
            layout: {
                'text-size': 14,
                'text-letter-spacing': 0.05,
                'text-field': '{name}',
                'text-font': ['Liberation Sans Regular'],
                'text-variable-anchor': ['bottom', 'top'],
                'text-justify': 'auto',
                'text-allow-overlap': true,
                'text-radial-offset': 1.5,
                'icon-image': 'tram_bus_stop',
                'icon-allow-overlap': true,
            },
            paint: {
                'text-color': '#0e2166',
                'text-halo-color': 'white',
                'text-halo-width': 2,
                'text-halo-blur': 0
            }
        })
    }

    addIcons() {
        // Load images
        this.map.loadImage(
            'https://dev.basisvisualisierung.niedersachsen.de/services/icons/tram.png',
            (error, image) => {
                if (error) throw error

                this.map.addImage('tram_stop', image)
            }
        )

        this.map.loadImage(
            'https://dev.basisvisualisierung.niedersachsen.de/services/icons/bus.png',
            (error, image) => {
                if (error) throw error

                this.map.addImage('bus_stop', image)
            }
        )

        this.map.loadImage(
            'https://dev.basisvisualisierung.niedersachsen.de/services/icons/tram_bus.png',
            (error, image) => {
                if (error) throw error

                this.map.addImage('tram_bus_stop', image)
            }
        )
    }
}


/**
 * Displays a marker element on a map
 */
class VTMarker extends HTMLElement {

    /** The map object from the VTMap parent */
    map
    /** The maplibre marker object */
    marker

    /** All available attributes */
    static get observedAttributes() {
        return [
            "lon",
            "lat",
            "color"
        ]
    }

    /**
     * Initial setup of the marker after element is attached to the DOM
     */
    connectedCallback() {
        this.map = this.parentElement.map
        !this.hasAttribute("color") && this.setAttribute("color", "#c4153a")
        this.addMarker()
    }

    /**
     * Removes the marker from the map if element is removed from the DOM
     */
    disconnectedCallback() {
        this.marker && this.marker.remove()
    }

    /**
     * Changes the position and color of the marker if attribute is changed
     * @param {string} attrName Name of the attribute 
     * @param {string} oldVal Old value of the attribute
     * @param {string} newVal New value of the attribute
     */
    attributeChangedCallback(attrName, oldVal, newVal) {
        if (this.marker && attrName !== "color") {
            const lon = this.getAttribute("lon")
            const lat = this.getAttribute("lat")
            if (lon && lat) {
                this.marker.setLngLat([lon, lat])
            }
        } else {
            this.addMarker()
        }
    }

    /**
     * Helper method to add marker with attributes
     */
    addMarker() {
        this.marker && this.marker.remove()
        const lon = this.getAttribute("lon")
        const lat = this.getAttribute("lat")
        const color = this.getAttribute("color")
        if (lon && lat && color && this.map) {
            this.marker = new maplibregl.Marker({ color: color }).setLngLat([lon, lat]).addTo(this.map)
        }
    }
}

/**
 * Creates a popup element for a marker
 */
class VTPopup extends HTMLElement {

    /** The marker object from the VTMarker parent */
    marker
    /** The maplibre popup object */
    popup

    /** All available attributes */
    static get observedAttributes() {
        return [
            "title",
            "text",
        ]
    }

    /**
     * Initial setup of the popup after element is attached to the DOM
     */
    connectedCallback() {
        this.marker = this.parentElement.marker
        if (!this.marker) return
        this.popup = new maplibregl.Popup().setHTML("<b>" + this.getAttribute("title") + "</b><br><p>" + this.getAttribute("text") + "</p>")
        this.marker.setPopup(this.popup)
    }

    /**
     * Removes the popup from the marker if element is removed from the DOM
     */
    disconnectedCallback() {
        this.popup && this.popup.remove()
    }

    /**
     * Updates the title and text of the popup if attribute is changed
     * @param {string} attrName Name of the attribute 
     * @param {string} oldVal Old value of the attribute
     * @param {string} newVal New value of the attribute
     */
    attributeChangedCallback(attrName, oldVal, newVal) {
        this.popup && this.popup.setHTML("<b>" + this.getAttribute("title") + "</b><br><p>" + this.getAttribute("text") + "</p>")
    }
}

/**
 * Displays a control element on a map
 */
class VTControl extends HTMLElement {

    /** The map object from the VTMap parent */
    map
    /** The maplibre control object */
    control

    /** All available control positions */
    static positions = ["top-left", "top-right", "bottom-left", "bottom-right"]
    /** All available control types */
    static types = ["fullscreen", "geolocate", "navigation", "scale"]

    /** All available attributes */
    static get observedAttributes() {
        return [
            "type",
            "position",
        ]
    }

    /**
     * Initial setup of the control after element is attached to the DOM
     */
    connectedCallback() {
        this.map = this.parentElement.map
        this.addControl()
    }

    /**
     * Removes the control from the map if element is removed from the DOM
     */
    disconnectedCallback() {
        this.control && this.map && this.map.hasControl(this.control) && this.map.removeControl(this.control)
    }

    /**
     * Updates the type and position of the control if attribute is changed
     * @param {string} attrName Name of the attribute 
     * @param {string} oldVal Old value of the attribute
     * @param {string} newVal New value of the attribute
     */
    attributeChangedCallback(attrName, oldVal, newVal) {
        this.disconnectedCallback()
        this.addControl()
    }

    /**
     * Helper method to add control with attributes
     */
    addControl() {
        const position = this.getAttribute("position")
        const type = this.getAttribute("type")
        if (!this.map || !VTControl.positions.includes(position) || !VTControl.types.includes(type)) return
        switch (type) {
            case "fullscreen":
                this.control = new maplibregl.FullscreenControl()
                break
            case "geolocate":
                this.control = new maplibregl.GeolocateControl()
                break
            case "navigation":
                this.control = new maplibregl.NavigationControl()
                break
            case "scale":
                this.control = new maplibregl.ScaleControl()
                break
        }
        this.map.addControl(this.control, position)
    }
}

/**
 * Adds an additional source to a map 
 */
class VTSource extends HTMLElement {

    /** The map object from the VTMap parent */
    map
    /** The name of the new source */
    sourceName

    /** All available source types */
    static types = ["vector", "geojson", "raster"]

    /** All available attributes */
    static get observedAttributes() {
        return [
            "type",
            "src"
        ]
    }

    /**
     * Adds the source to the map after element is attached to the DOM
     */
    connectedCallback() {
        this.map = this.parentElement.map
        const src = this.getAttribute("src")
        const type = this.getAttribute("type")
        if (!this.map || !VTSource.types.includes(type) || !src) return
        this.sourceName = "source" + performance.now()
        this.layers = []
        let source = {}
        switch (type) {
            case "vector":
            case "raster":
                source = { "type": type, "tiles": [src] }
                break
            case "geojson":
                source = { "type": type, "data": src }
                break
        }
        this.map.once("style.load", () => {
            this.map.addSource(this.sourceName, source)
        })
    }

    /**
     * Removes the source and the associated layers if element is removed from the DOM
     */
    disconnectedCallback() {
        let layers = this.getElementsByTagName("vt-layer")
        for (let i = 0; i < layers.length; i++) {
            this.map.getLayer(layers.item(i).id) && this.map.removeLayer(layers.item(i).id)
        }
        this.map.removeSource(this.sourceName)
    }
}

/**
 * Defines what and how a layer is displayed for a source
 */
class VTLayer extends HTMLElement {

    /** The map object from the VTSource parent */
    map
    /** The name of the source from the VTSource parent */
    sourceName
    /** The layer object */
    layer

    /** All available layer types */
    static types = ["line", "fill", "circle", "raster"]

    /** All available attributes */
    static get observedAttributes() {
        return [
            "id",
            "type",
            "minzoom",
            "maxzoom",
            "color",
            "opacity",
            "line-width",
            "circle-radius",
            "background"
        ]
    }

    /**
     * Adds the layer to the map after element is attached to the DOM
     */
    connectedCallback() {
        this.map = this.parentElement.map
        this.sourceName = this.parentElement.sourceName
        this.addLayer(true)
    }

    /**
     * Removes the layer if element is removed from the DOM
     */
    disconnectedCallback() {
        this.map && this.map.getLayer(this.layer.id) && this.map.removeLayer(this.layer.id)
    }

    /**
     * Updates the attributes of the layer if attribute is changed
     * @param {string} attrName Name of the attribute 
     * @param {string} oldVal Old value of the attribute
     * @param {string} newVal New value of the attribute
     */
    attributeChangedCallback(attrName, oldVal, newVal) {
        if (!this.map || !this.layer) return
        switch (attrName) {
            case "id":
            case "background":
            case "type":
                const original = this.map.getLayer(this.layer.id)
                this.map.removeLayer(original.id)
                this.addLayer(false)
                break
            case "minzoom":
            case "maxzoom":
                this.map.setLayerZoomRange(this.layer.id, parseInt(this.getAttribute("minzoom")), parseInt(this.getAttribute("maxzoom")))
                break
            case "color":
                this.map.setPaintProperty(this.layer.id, this.layer.type + "-color", newVal)
                break
            case "opacity":
                this.map.setPaintProperty(this.layer.id, this.layer.type + "-opacity", parseFloat(newVal))
                break
            case "line-width":
                this.map.setPaintProperty(this.layer.id, "line-width", parseInt(newVal))
                break
            case "circle-radius":
                this.map.setPaintProperty(this.layer.id, "circle-radius", parseInt(newVal))
                break
        }
    }

    /**
     * Helper method to add layer with attributes
     * @param {boolean} initial Indicates if the layer is added for the first time
     */
    addLayer(initial) {
        const id = this.getAttribute("id")
        const type = this.getAttribute("type")
        const background = this.getAttribute("background") ? this.getAttribute("background") : "false"
        const minzoom = this.getAttribute("minzoom")
        const maxzoom = this.getAttribute("maxzoom")
        const color = this.getAttribute("color") ? this.getAttribute("color") : "#000000"
        const opacity = parseFloat(this.getAttribute("opacity")) ? parseFloat(this.getAttribute("opacity")) : 1.0
        const lineWidth = parseInt(this.getAttribute("line-width")) ? parseInt(this.getAttribute("line-width")) : 1
        const circleRadius = parseInt(this.getAttribute("circle-radius")) ? parseInt(this.getAttribute("circle-radius")) : 5
        if (!this.map || !this.sourceName || !id || !VTLayer.types.includes(type)) return
        let layer = {
            "id": id,
            "type": type,
            "source": this.sourceName,
        }
        switch (type) {
            case "line":
                layer["paint"] = {
                    "line-color": color,
                    "line-opacity": opacity,
                    "line-width": lineWidth
                }
                break
            case "fill":
                layer["paint"] = {
                    "fill-color": color,
                    "fill-opacity": opacity
                }
                break
            case "circle":
                layer["paint"] = {
                    "circle-color": color,
                    "circle-radius": circleRadius,
                    "circle-opacity": opacity,
                }
                break
            case "raster":
                layer["paint"] = {
                    "raster-opacity": opacity
                }
        }
        if (this.parentElement.type === "vector") {
            layer["source-layer"] = id
        }
        if (parseInt(minzoom)) {
            layer["minzoom"] = parseInt(minzoom)
        }
        if (parseInt(maxzoom)) {
            layer["maxzoom"] = parseInt(maxzoom)
        }
        const add = () => {
            if (background === "true") {
                this.map.addLayer(layer, this.map.getStyle().layers[0].id)
            } else {
                this.map.addLayer(layer)
            }
            this.layer = this.map.getLayer(layer.id)
        }
        if (initial) {
            this.map.once("style.load", () => { add() })
        } else {
            add()
        }

    }
}

window.customElements.define("vt-map", VTMap)
window.customElements.define("vt-transport", VTTransport)
window.customElements.define("vt-marker", VTMarker)
window.customElements.define("vt-popup", VTPopup)
window.customElements.define("vt-control", VTControl)
window.customElements.define("vt-source", VTSource)
window.customElements.define("vt-layer", VTLayer)

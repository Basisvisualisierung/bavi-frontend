const css = require("maplibre-gl/dist/maplibre-gl.css")
const maplibregl = require("maplibre-gl/dist/maplibre-gl")

class VTMap extends HTMLElement {

    map
    container
    mapClickBinding
    mapClickFunction
    isZooming = false
    isDraging = false

    static styles = ["classic", "color", "grayscale", "light", "night"]

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
        let shadow = this.attachShadow({ mode: "open" })
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
            style: this.getStyle(this.getAttribute("map-style"))
        })

        // Set part attribute to enable css styling from the host
        this.map.getCanvas().setAttribute("part", "mapcanvas")
        
        // Set listener to provided functions
        this.mapClickFunction = this.getAttribute("map-click")
        this.map.on("click", this.mapClickBinding)

        // Register listeners to update values in the html component
        this.map.on("zoom", () => {
            this.isZooming = true
            this.setAttribute("zoom",this.map.getZoom())
            this.isZooming = false
        })
        this.map.on("drag", () => {
            this.isDraging = true
            this.setAttribute("lon",this.map.getCenter().lng)
            this.setAttribute("lat",this.map.getCenter().lat)
            this.isDraging = false
        })

        // Display map correctly on load
        this.map.once("render", () => {
            this.map.resize()            
        })
    }

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

    getStyle(style) {
        return VTMap.styles.includes(style) ? "https://basisvisualisierung.niedersachsen.de/services/basiskarte_ni/styles/vt-style-" + style + ".json" : style
    }

    evalClick(event) {
        (this.mapClickFunction in window) && eval(this.mapClickFunction)({
            lon: event.lngLat.lng,
            lat: event.lngLat.lat
        }, this.map.queryRenderedFeatures(event.point))
    }
}

class VTMarker extends HTMLElement {

    map
    marker

    static get observedAttributes() {
        return [
            "lon",
            "lat",
        ]
    }

    connectedCallback() {
        this.map = this.parentElement.map
        this.addMarker()
    }

    disconnectedCallback() {
        this.marker && this.marker.remove()
    }

    attributeChangedCallback(attrName, oldVal, newVal) {
        if (this.marker) {
            const lon = this.getAttribute("lon")
            const lat = this.getAttribute("lat")
            if (lon && lat) {
                this.marker.setLngLat([lon, lat])
            }
        } else {
            this.addMarker()
        } 
    }

    addMarker() {
        const lon = this.getAttribute("lon")
        const lat = this.getAttribute("lat")
        if(lon && lat && this.map) {
            this.marker = new maplibregl.Marker().setLngLat([lon, lat]).addTo(this.map)
        }
    }
}

class VTPopup extends HTMLElement {

    marker
    popup

    static get observedAttributes() {
        return [
            "title",
            "text",
        ]
    }

    connectedCallback() {
        this.marker = this.parentElement.marker
        if (!this.marker) return
        this.popup = new maplibregl.Popup().setHTML("<b>" + this.getAttribute("title") + "</b><br><p>" + this.getAttribute("text") + "</p>")
        this.marker.setPopup(this.popup)
    }

    disconnectedCallback() {
        this.popup && this.popup.remove()
    }

    attributeChangedCallback(attrName, oldVal, newVal) {
        this.popup && this.popup.setHTML("<b>" + this.getAttribute("title") + "</b><br><p>" + this.getAttribute("text") + "</p>")
    }
}

class VTControl extends HTMLElement {

    map
    control

    static positions = ["top-left", "top-right", "bottom-left", "bottom-right"]
    static types = ["fullscreen", "geolocate", "navigation", "scale"]

    static get observedAttributes() {
        return [
            "type",
            "position",
        ]
    }

    connectedCallback() {
        this.map = this.parentElement.map
        this.addControl()
    }

    disconnectedCallback() {
        this.control && this.map && this.map.hasControl(this.control) && this.map.removeControl(this.control)
    }

    attributeChangedCallback(attrName, oldVal, newVal) {
        this.disconnectedCallback()
        this.addControl()
    }

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

class VTSource extends HTMLElement {

    map
    sourceName
    type

    static types = ["vector", "geojson"]

    static get observedAttributes() {
        return [
            "type",
            "src"
        ]
    }

    connectedCallback() {
        this.map = this.parentElement.map
        const src = this.getAttribute("src")
        this.type = this.getAttribute("type")
        if (!this.map || !VTSource.types.includes(this.type) || !src) return
        this.sourceName = "source" + performance.now()
        this.layers = []
        let source = {}
        switch (this.type) {
            case "vector":
                source = { "type": this.type, "tiles": [src] }
                break
            case "geojson":
                source = { "type": this.type, "data": src }
                break
        }
        this.map.once("style.load", () => {
            this.map.addSource(this.sourceName, source)
        })
    }

    disconnectedCallback() {
        let layers = this.getElementsByTagName("vt-layer")
        for(let i=0; i<layers.length; i++) {
            this.map.getLayer(layers.item(i).id) && this.map.removeLayer(layers.item(i).id)
        }
        this.map.removeSource(this.sourceName)
    }
}

class VTLayer extends HTMLElement {

    map
    sourceName
    layer

    static types = ["line", "fill", "circle"]

    static get observedAttributes() {
        return [
            "id",
            "type",
            "minzoom",
            "maxzoom",
            "color",
            "opacity",
            "line-width",
            "circle-radius"
        ]
    }

    connectedCallback() {
        this.map = this.parentElement.map
        this.sourceName = this.parentElement.sourceName
        this.addLayer(true)   
    }

    disconnectedCallback() {
        this.map && this.map.getLayer(this.layer.id) && this.map.removeLayer(this.layer.id)
    }

    attributeChangedCallback(attrName, oldVal, newVal) {
        if (!this.map || !this.layer) return
        switch(attrName) {
            case "id":
            case "type":
                let original = this.map.getLayer(this.layer.id)
                this.map.removeLayer(original.id)
                this.addLayer(false)
                break
            case "minzoom":
            case "maxzoom":
                this.map.setLayerZoomRange(this.layer.id, parseInt(this.getAttribute("minzoom")), parseInt(this.getAttribute("maxzoom")))
                break
            case "color":
                this.map.setPaintProperty(this.layer.id, this.layer.type + "-color", newVal )
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

    addLayer(initial) {
        const id = this.getAttribute("id")
        const type = this.getAttribute("type")
        const minzoom = this.getAttribute("minzoom")
        const maxzoom = this.getAttribute("maxzoom")
        const color = this.getAttribute("color") ? this.getAttribute("color") : "#000000"
        const opacity = parseFloat(this.getAttribute("opacity")) ? parseFloat(this.getAttribute("opacity")) : 1.0
        const lineWidth = parseInt(this.getAttribute("line-width")) ? parseInt(this.getAttribute("line-width")) : 1
        const circleRadius = parseInt(this.getAttribute("circle-radius")) ? parseInt(this.getAttribute("circle-radius")) : 5
        if (!this.map || !this.sourceName || !id || !VTLayer.types.includes(type)) return
        let layer = {
            "id": id,
            "type": type === "text" ? "symbol": type,
            "source": this.sourceName,
        }
        switch(type) {
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
        }
        if(this.parentElement.type !== "geojson") {
            layer["source-layer"] = id
        }
        if (parseInt(minzoom)) {
            layer["minzoom"] = parseInt(minzoom)
        }
        if (parseInt(maxzoom)) {
            layer["maxzoom"] = parseInt(maxzoom)
        }
        if (initial) {
            this.map.once("style.load", () => {
                this.map.addLayer(layer)
                this.layer = this.map.getLayer(layer.id)
            })
        } else {
            this.map.addLayer(layer)
            this.layer = this.map.getLayer(layer.id)
        }
        
    }
}

window.customElements.define("vt-map", VTMap)
window.customElements.define("vt-marker", VTMarker)
window.customElements.define("vt-popup", VTPopup)
window.customElements.define("vt-control", VTControl)
window.customElements.define("vt-source", VTSource)
window.customElements.define("vt-layer", VTLayer)

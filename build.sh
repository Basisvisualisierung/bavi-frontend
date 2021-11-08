#!/bin/bash

VERSION=0.1

# delete possible leftovers and create dist folder
rm -f ./src/tmp.js
rm -f ./src/tmp.js.bak
rm -f ./src/tmp2.js
mkdir -p dist

# add maplibre css content to temporary file tmp.js
cat ./libs/maplibre/maplibre-gl.css >> ./src/tmp.js

# replace " with \" in tmp.js
if [ "$(uname)" == "Darwin" ]
then
    sed -i '.bak' 's#"#\\"#g' ./src/tmp.js     
else
    sed -i 's#"#\\"#g' ./src/tmp.js
fi

# combine tmp.js with app.js code
echo -e "const css = \"$(cat ./src/tmp.js)\"\n$(cat ./src/app.js)" > ./src/tmp.js

# create dist file vt-microfrontend.min.js from tmp.js and all required libraries
browserify ./src/tmp.js -o ./src/tmp.js
uglifyjs --compress --mangle -- ./src/tmp.js > ./src/tmp2.js

# add version and license to vt-microfrontend.min.js
echo "/*
Version $VERSION
vt-microfrontend is licensed under the European Union Public License (EUPL). Full text of license: https://github.com/Basisvisualisierung/vt-microfrontend/blob/main/LICENSE.txt
vt-microfrontend uses MapLibre GL JS. MapLibre GL JS is licensed under the 3-Clause BSD License. Full text of license: https://github.com/maplibre/maplibre-gl-js/blob/v1.15.2/LICENSE.txt
*/" > ./dist/vt-microfrontend.min.js
cat ./src/tmp2.js >> ./dist/vt-microfrontend.min.js

# delete temp files
rm -f ./src/tmp.js
rm -f ./src/tmp.js.bak
rm -f ./src/tmp2.js
# Solar Heightmap

A test playground for my portfolio site, interactive 3D planetary surfaces built
with Astro, TypeScript and Three.js, using real NASA elevation data.

## Getting started

The source height maps are too large to store on GitHub. To run the project
locally, download them into `data/`:

Moon (NASA Scientific Visualization Studio, LRO LOLA):

```sh
curl -o data/lunar-height-map.tif https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_64.tif
```

Mars (USGS Astrogeology, MGS MOLA / HRSC):

```sh
curl -L -o data/mars-height-map.tif https://planetarymaps.usgs.gov/mosaic/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif
```

The "Material" toggle uses true-colour surface mosaics. The sampler only reads
uncompressed TIFFs, so download and convert them (`sips` ships with macOS):

```sh
mkdir -p data/downloads

# Moon (NASA SVS CGI Moon Kit, LRO LROC WAC colour). LZW-compressed, so re-encode.
curl -o data/downloads/lroc_color_poles_4k.tif https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_4k.tif
sips -s format jpeg -s formatOptions best data/downloads/lroc_color_poles_4k.tif --out data/downloads/lunar-color.jpg
sips -s format tiff data/downloads/lunar-color.jpg --out data/lunar-color-mosaic.tif

# Mars (USGS Astrogeology, Viking MDIM 2.1 colourised mosaic, 1 km).
curl -L -o data/downloads/mars-viking-color-1km.jpg https://astrogeology.usgs.gov/ckan/dataset/7131d503-cdc9-45a5-8f83-5126c0fd397e/resource/5ea881c6-01b3-41fa-a7af-42d2131b54f1/download/mars_viking_mdim21_clrmosaic_1km.jpg
sips -s format tiff data/downloads/mars-viking-color-1km.jpg --out data/mars-color-mosaic.tif
```

Then install, sample the height maps, and run:

```sh
npm install
npm run sample -- --body moon --cols 4096 --rows 2048
npm run sample -- --body mars --cols 4096 --rows 2048
npm run dev
```

`--cols` and `--rows` set the height grid resolution (default 1024x512; the site
ships 4096x2048). The colour texture is written as a JPEG; set its size with
`--color-cols` / `--color-rows` (default 2048x1024) and its quality with
`--color-quality` (0-100, default 90).

The site lives under the `/solar-heightmap` base path, matching the GitHub
Pages repo name. The index links to `/solar-heightmap/lunar-heightmap/` and
`/solar-heightmap/mars-heightmap/`.

Build the site with `npm run build` and preview the production build with
`npm run preview`. Run `npm run typecheck` to check the TypeScript source.

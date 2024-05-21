var AOI = ee.FeatureCollection(table).geometry();

var bounds = AOI.bounds();
var centroid = bounds.centroid(1); // Aggiunge un margine di errore di 1 metro

// Ottieni le coordinate del centroide.
var coords = ee.List(centroid.coordinates());

var lng = ee.Number(coords.get(0));
var lat = ee.Number(coords.get(1));

// Ottieni i limiti dell'AOI per determinare i lati.
var rect = bounds.coordinates().get(0);
var xMin = ee.Number(ee.List(ee.List(rect).get(0)).get(0));
var xMax = ee.Number(ee.List(ee.List(rect).get(2)).get(0));
var yMin = ee.Number(ee.List(ee.List(rect).get(0)).get(1));
var yMax = ee.Number(ee.List(ee.List(rect).get(2)).get(1));

// Crea quattro rettangoli per dividere l'AOI.
var top_left = ee.Geometry.Rectangle([xMin, lat, lng, yMax]);
var top_right = ee.Geometry.Rectangle([lng, lat, xMax, yMax]);
var bottom_left = ee.Geometry.Rectangle([xMin, yMin, lng, lat]);
var bottom_right = ee.Geometry.Rectangle([lng, yMin, xMax, lat]);

// Visualizza i risultati.
//Map.centerObject(bounds, 9);
Map.addLayer(top_left, {color: 'red'}, 'Top Left');
Map.addLayer(top_right, {color: 'blue'}, 'Top Right');
Map.addLayer(bottom_left, {color: 'green'}, 'Bottom Left');
Map.addLayer(bottom_right, {color: 'yellow'}, 'Bottom Right');



//----------------READ DATA----------------------------
//Study area boundary
Map.addLayer(table)
//var AOI = ee.FeatureCollection(table).geometry()
var AOI = top_left
//CHIRPS precipitation dataset -- daily (mm/day)
var CHIRPS_daily = ee.ImageCollection("UCSB-CHG/CHIRPS/DAILY")
           .select('precipitation') //select precipitation
           .map(function(image){return image.clip(AOI)}); //Clips data based on 'aoi';

// sostituisci 'srtm' a 'alos'
// import and plot NASA SRTM Digital Elevation 30m x AOI
var srtm = ee.Image("USGS/SRTMGL1_003").clip(AOI)
// print(srtm)
//Κ-factor
var kfactor = ee.Image("users/ludovicacrocittogeo/k_factor_map_asset_SAHEL").clip(AOI)
//LS-factor --> https://www.youtube.com/watch?v=vhwhPrlxDeg !!!!!!!!!!!!!!
var elevation = srtm.select('elevation');
var slope1 = ee.Terrain.slope(elevation).clip(AOI);
    //Converting Slope from Degrees to %
var slope = slope1.divide(180).multiply(Math.PI).tan().multiply(100);
Map.addLayer(slope, {min: 0, max: 15, palette: ['a52508','ff3818','fbff18','25cdff','2f35ff','0b2dab']}, 'slope in %', 0);

var LS4 = Math.sqrt(500/100); 
var LS3 = ee.Image(slope.multiply(0.53));
var LS2 = ee.Image(slope).multiply(ee.Image(slope).multiply(0.076));
var LS1 = ee.Image(LS3).add(LS2).add(0.76);
var lsfactor = ee.Image(LS1).multiply(LS4).rename("LS");
 
//P-factor based on Log Erosion Barriers (LEBs)
var pfactor_log = ee.Image("users/ludovicacrocittogeo/P_factor_sahel").clip(AOI)
// //P-factor based on check dams positions
// var pfactor_check = ee.Image("users/alexandridisvasileios/rec_new_texnerg_pfactor_wgs84_las").clip(AOI.geometry());

Map.addLayer(srtm, {min:0, max:2000, palette:["green", "yellow", "orange", "brown", "white"]}, 'DEM')
Map.addLayer(kfactor, {min:0, max:1, palette:["green", "yellow", "orange", "brown", "white"]}, 'kfactor');
Map.addLayer(lsfactor, {min:0, max:19, palette:["green", "yellow", "orange", "brown", "white"]}, 'lsfactor');
Map.addLayer(pfactor_log, {min:0, max:0.5, palette:["green", "yellow", "orange", "brown", "white"]}, 'pfactor');
Map.centerObject(AOI, 5);


//----------------FUNCTIONS---------------------------
var L8 = ee.ImageCollection("LANDSAT/LC08/C01/T1_TOA")
 
function mascheraNuvole(image){
  var cloud = ee.Number(2).pow(4).int()
  var qf = image.select('BQA')
  var mask = qf.bitwiseAnd(cloud).eq(0)
  return image.updateMask(mask)
}
// calcola ndvi periodo piogge maggio - settembre
var image = L8.filterDate('2023-05-01','2023-09-30')
              .map(mascheraNuvole)
              .median()
              .clip(AOI)
              
var withNDVI = L8.map(function(img){
  var red = ee.Image(img.select('B4'));
  var nir = ee.Image(img.select('B5'));
  var ndvi = (nir.subtract(red)).divide(nir.add(red)).rename('ndvi');
  return img.addBands(ndvi);
});

// use quality mosaic to get the per pixel maximum NDVI values and corresponding bands
var ndviQual = withNDVI.qualityMosaic('ndvi');

// Map.addLayer(ndviQual.clip(AOI), {min:0, max: 3000, bands: ['B4', 'B3', 'B2']},'greenest')
// A nice NDVI palette.

var palette = [
  'FFFFFF', 'CE7E45', 'DF923D', 'F1B555', 'FCD163', '99B718',
  '74A901', '66A000', '529400', '3E8601', '207401', '056201',
  '004C00', '023B01', '012E01', '011D01', '011301'];
  
  // Select NDVI band from ndviQual

var ndvi = ndviQual.select('ndvi');
var ndvi_img2022 = ndvi.updateMask(
  ndvi.gte(0.7))
  ;

//Visualizations
var visfactor = {min:0,max:150,palette:['yellow','orange','purple']}

//----------------COMPUTE RUSLE MODEL------------------------------

// A = R * K * L * S * C * P; //A, annual soil erosion

// C ------- Vegetation Cover Factor, a=2, b=1,
// The higher the C, the worst the growth
var cf_2022 = ((ndvi_img2022.multiply(-2)).divide(ndvi_img2022.multiply(-1).add(1))).exp();

//Visualization parameters                    
var vismask = {min:0,max:50,palette: ["#000080","#0000D9","#4000FF","#8000FF","#0080FF","#00FFFF",
              "#00FF80","#80FF00","#DAFF00","#FFFF00","#FFF500","#FFDA00",
              "#FFB000","#FFA400","#FF4F00","#FF2500","#FF0A00","#FF00FF",]}

//Retrieve CHIRPS percipitation data
var jan_chirps2022 = CHIRPS_daily.filterDate('2023-01-01','2023-02-01');
var feb_chirps2022 = CHIRPS_daily.filterDate('2023-02-01','2023-03-01');
var mar_chirps2022 = CHIRPS_daily.filterDate('2023-03-01','2023-04-01');
var apr_chirps2022 = CHIRPS_daily.filterDate('2023-04-01','2023-05-01');
var may_chirps2022 = CHIRPS_daily.filterDate('2023-05-01','2023-06-01');
var jun_chirps2022 = CHIRPS_daily.filterDate('2023-06-01','2023-07-01');
var jul_chirps2022 = CHIRPS_daily.filterDate('2023-07-01','2023-08-01');
var aug_chirps2022 = CHIRPS_daily.filterDate('2023-08-01','2023-09-01');
var sep_chirps2022 = CHIRPS_daily.filterDate('2023-09-01','2023-10-01');
var oct_chirps2022 = CHIRPS_daily.filterDate('2023-10-01','2023-11-01');
var nov_chirps2022 = CHIRPS_daily.filterDate('2023-11-01','2023-12-01');
var dec_chirps2022 = CHIRPS_daily.filterDate('2023-12-01','2024-01-01');
     
       
// Calculate annual precipitation (mm) for 2022 year
var annual_precip = (jan_chirps2022.sum()).add(feb_chirps2022.sum()).add(mar_chirps2022.sum()).add(apr_chirps2022.sum()).add(may_chirps2022.sum()).add(jun_chirps2022.sum()).add(jul_chirps2022.sum()).add(aug_chirps2022.sum()).add(sep_chirps2022.sum()).add(oct_chirps2022.sum()).add(nov_chirps2022.sum()).add(dec_chirps2022.sum());

// Calculate R factor based on Flampouris' phd thesis "Study of the effect of rainfall factor R on Rusle's law (in Greek)" (2008) (No. GRI-2008-1712),Aristotle University of Thessaloniki. He used gauge stations and created some stable values 
var flap =  annual_precip.multiply(0.8);                

// Calculate A factor
var A_value_22 = flap.multiply(kfactor).multiply(lsfactor).multiply(cf_2022).multiply(pfactor_log);

//----------------DISPLAY------------------------------
//Display layer

Map.addLayer(A_value_22,visfactor,'RUSLE');

//----------------EXPORT----------------------------------
// export A value for each year (e.g. 2020);
Export.image.toDrive({
  image: A_value_22,
  description: 'RUSLE_sahel2024_top_left',
  scale: 100,
  region: table,
  maxPixels : 1e13
});


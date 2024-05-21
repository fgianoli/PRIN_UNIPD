
Map.addLayer(AOI,{}, 'Area di interesse', 0)

////////////////////////
//// Parte Uno: Definizione degli anni 
////////////////////////

var Rain2019 = Rain.filterDate('2018-01-01','2023-12-31').filterBounds(AOI)


  var Rain_annual=  ee.List.sequence(2018, 2023, 1).map(function(year){
  year = ee.Number(year);
  return Rain2019
  .filter(ee.Filter.calendarRange(year, year.add(0),'year'))
  .sum().set('year', year)
  })
  
print('Rain_annual',Rain_annual)

 Rain_annual = ee.ImageCollection.fromImages(Rain_annual)



var Rain_annual_mean = Rain_annual.mean().clip(AOI)


//print('Rain_annual_mean is ',Rain_annual_mean)

Map.addLayer(Rain_annual_mean,{min:500, max:1500, palette: ['red','green','blue']},'Pioggia media', 0)

////////////////////////
//// Parte Due: Selezione del range di pioggia
////////////////////////

var Rain_annual_meanM = Rain_annual_mean.updateMask(Rain_annual_mean.gte(150).and(Rain_annual_mean.lte(850)))

//Map.addLayer(Rain_annual_meanM,{min:150, max:650, palette: ['red','green','blue']},'Media pioggia intervallo')

//Export masked image

// Export.image.toDrive({
//   image: Rain_annual_meanM , //what I want to export and the band
//   description: 'Rain_1999_2008',  //the name of the output
//   region: AOI, //the bounding box of exportation
//   scale: 5000,  //output pixel size
//   crs: 'EPSG:4326' //really important to define the output CRS
// });




var Rain_annual_meanMB = Rain_annual_meanM.where(Rain_annual_meanM,1).toInt()

Map.addLayer(Rain_annual_meanMB,{min:0, max:1, palette: ['blue']},'Rain2019_P_cumB', 0)



// Simplify geometries

var provafilter = Rain_annual_meanMB.focal_mean(10000, 'circle', 'meters').toInt()
Map.addLayer(provafilter,{min:0, max:1, palette: ['blue']},'provafilter', 0)


// Convert flood raster to polygons
var Rain_annual_meanMB_vec = provafilter.reduceToVectors({
  scale: 5000,
  geometryType:'polygon',
  geometry: AOI,
  eightConnected: false,
  tileScale:2,
  maxPixels : 1e13
});

Map.addLayer(Rain_annual_meanMB_vec,{},'Area vettoriale isoiete di pioggia')


//// Convert flood raster to polygons
// var Rain_annual_meanMB_vec = Rain_annual_meanMB.reduceToVectors({
//   scale: 5000,
//   geometryType:'polygon',
//   geometry: AOI,
//   eightConnected: false,
//   tileScale:2,
//   maxPixels : 1e13
// });


// Map.addLayer(Rain_annual_meanMB_vec,{},'Rain2019_P_cumB v')


Export.table.toDrive({
  collection:Rain_annual_meanMB_vec,
  description:'Isoiete_2018_2023_150_850',
  fileFormat: 'SHP'
});


/// EXPORT Raster image

// Export the image, specifying scale and region.
Export.image.toDrive({
  image: Rain_annual_meanM,
  description: 'isoiete_2014_2019_150_650',
  scale: 5000, ///  m/pixel
  region: AOI,
  maxPixels : 1e13
});

////BASINS

// var basins= ee.FeatureCollection("WWF/HydroSHEDS/v1/Basins/hybas_12")
// Map.addLayer(basins, 'bacini')

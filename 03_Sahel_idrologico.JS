sahel = aoi_sahel_FG;
Map.addLayer(ee.Image(1),{min:0,max:1},"Background",false);
Map.addLayer(sahel,{},'sahel region');
//var monthlySeasonalFlood = monthly.filter(ee.filter.eq())
var seasonalMask = yearlyClassificationsCounts.select('seasonal_count').gt(0).clip(sahel);
Map.addLayer(seasonalMask,{},'seasonalMask');

monthly = monthly.map(function(month){
  var nodata = month.eq(0).select([0],['nodata']).unmask(0);
  month = month.eq(2).unmask(0).addBands(nodata).copyProperties(month);
  return month;
})  

var years = ee.List.sequence(0,35);
//var year1993 = monthly.filter(ee.Filter.eq('year',1993))
//var monthsFilter = ee.Filter.or(ee.Filter.eq('month',1),ee.Filter.eq('month',9),ee.Filter.eq('month',10),ee.Filter.eq('month',11),ee.Filter.eq('month',12))
//var monthlySeasonalFlood = ee.ImageCollection(monthly.filter(ee.Filter.eq('year',1993)).filter(monthsFilter));

var vizPalette = {min:0,max:2,palette:["red","green","blue"]};

//Map.addLayer(monthlySeasonalFlood,{},'1993')

var counter_season_coll = years.map(function(index){
  var year = ee.Number(1984).add(index);
  var monthsFilter = ee.Filter.or(ee.Filter.eq('month',1),ee.Filter.eq('month',9),ee.Filter.eq('month',10),ee.Filter.eq('month',11),ee.Filter.eq('month',12))
  var yearly = yearlyColl.filter(ee.Filter.eq('year',year)).first();
  var seasonalYearlyMask = ee.Image(yearly).select('waterClass').eq(2);
  var nodataYearlyMask = ee.Image(yearly).select('waterClass').neq(0);
  var monthlySeasonalFlood = ee.ImageCollection(monthly.filter(ee.Filter.eq('year',year)).filter(monthsFilter));
  monthlySeasonalFlood = monthlySeasonalFlood.reduce(ee.Reducer.sum());
  var nodataMonthlyaggregated = monthlySeasonalFlood.select(['nodata_sum'],['nodata']);
  monthlySeasonalFlood = monthlySeasonalFlood.select(['water_sum'],['water']).mask(seasonalYearlyMask);
  monthlySeasonalFlood = monthlySeasonalFlood.addBands(nodataMonthlyaggregated);
  return monthlySeasonalFlood.clip(sahel).set('year',year);
});
counter_season_coll = ee.ImageCollection(counter_season_coll);
print('counter_season_coll',counter_season_coll)

//recurrence of counter-season
//function to return the first and last years that seasonal water for those specific months was detected - these are used to compute the recurrence 
function getFirstLastWaterYear(imageCollection){
  var output = imageCollection.map(function(image){
    image = image.mask(image.select(["water"]).gt(0));
    return image;
  });
  var minMax = output.select("year").reduce(ee.Reducer.minMax())
  return {
    "firstWaterYear": minMax.select(["year_min"],["water_year_min"]),
    "lastWaterYear": minMax.select(["year_max"],["water_year_max"])
  };
}

counter_season_coll = counter_season_coll.map(function(image){
  var year = image.get('year');
  image = image.addBands(ee.Image(ee.Number(year)).select([0],["year"]).toInt());
  return image;
}).sort('year');

var firstI = counter_season_coll.filter(ee.Filter.eq('year',1993))//.select('water').unmask()
Map.addLayer(counter_season_coll,{},'counter_season_coll',false)
Map.addLayer(firstI,{},'firstI',false)
Map.addLayer(monthly,{},'monthly',false)
Map.addLayer(yearlyColl,{},'yearly',false)

var firstLastWaterYear = getFirstLastWaterYear(counter_season_coll);
Map.addLayer(firstLastWaterYear.firstWaterYear,{},'firstWaterYear',false)
Map.addLayer(firstLastWaterYear.lastWaterYear,{},'lastWaterYear',false)

firstLastWaterYear = ee.Image.cat(firstLastWaterYear.firstWaterYear, firstLastWaterYear.lastWaterYear)
/*print(firstLastWaterYear)
Export.image.toAsset({
  image: firstLastWaterYear,
  description: "firstLastWaterYear",
  assetId: "projects/JRC/GSW2019/tempLayers/firstLastWaterYearRaw",
  scale:30, 
  region: sahel, 
  maxPixels:10000000000000,  
  pyramidingPolicy: {'.default':'sample'}
});*/

//function to return the annual recurrence
function getAnnualRecurrence(imageCollection,firstLastWaterYear2){
  //add the first and last water years to the yearly classifications and add bands to be able to calculate the recurrence index
  var stats = imageCollection.map(function(image){
    var nodata = image.select(['nodata']).eq(4);//no data mask for counter season, it is nodata only if all 4 months of counter season are no data
    image = image.select(['water','year']).mask(nodata.not());
    image = image.addBands(firstLastWaterYear2.select(["water_year_min","water_year_max"]));
    image = image.addBands(image.expression("b('year')>=b('water_year_min')&&b('year')<=b('water_year_max')&&b('water')>0").select([0],["recurrence_water_year"]));
    image = image.addBands(image.expression("b('year')>=b('water_year_min')&&b('year')<=b('water_year_max')&&b('water')==0").select([0],["recurrence_not_water_year"]));
    return image;
  });
  var recurrence = stats.select(["recurrence_.*"]).reduce(ee.Reducer.sum()); 
  //compute the annual recurrence
  return recurrence.expression("b('recurrence_water_year_sum')/(b('recurrence_water_year_sum')+b('recurrence_not_water_year_sum'))").select([0],["annual_recurrence"]);
}
var annual_recurrence_counter_season = getAnnualRecurrence(counter_season_coll,firstLastWaterYear);
Map.addLayer(annual_recurrence_counter_season,{palette: ["FF7F27","#99D9EA"]},"annual_recurrence_counter_season (1984-2019)",false);

//first 5 years (1984-1989) extents 
var drought_five_years = counter_season_coll.select('water').filter(ee.Filter.lt('year',1989));
var rainest_five_years = counter_season_coll.select('water').filter(ee.Filter.gt('year',2014));
/*print(drought_five_years)
print(rainest_five_years)*/

//MWE for 5 years
var MWE_drought_five_years = drought_five_years.select('water').reduce(ee.Reducer.anyNonZero());
var MWE_rainest_five_years = rainest_five_years.select('water').reduce(ee.Reducer.anyNonZero());
/*Export.image.toAsset({
  image: MWE_drought_five_years,
  scale: 30,
  description: "MWE_drought_five_years",
  assetId: "users/webgisbonifichecosentine/sahel/MWE_drought_five_years_with_september",
  maxPixels: 1e12,
  region: sahel.geometry().bounds(),
  pyramidingPolicy: {'.default':'mode'}
});

Export.image.toAsset({
  image: MWE_rainest_five_years,
  scale: 30,
  description: "MWE_rainest_five_years",
  assetId: "users/webgisbonifichecosentine/sahel/MWE_rainest_five_years_with_september",
  maxPixels: 1e12,
  region: sahel.geometry().bounds(),
  pyramidingPolicy: {'.default':'mode'}
 
}); 
*/

//already computed so assign again
MWE_drought_five_years = MWE_drought_five_years_with_september
MWE_rainest_five_years = MWE_rainest_five_years_with_september
var MWE_counter_season= counter_season_coll.select('water').reduce(ee.Reducer.anyNonZero()).select([0],["water_extent"]);
Map.addLayer(MWE_counter_season.selfMask(),{palette: ["blue"]},"MWE_counter_season ",false);

/**/

Export.image.toDrive({
  image: MWE_drought_five_years, 
  description: 'MWE_drought_five_years',
  folder: 'Sahel_idrogeologico',
  region: sahel.geometry().bounds(),
  crs:"EPSG:4326",
  crsTransform:"[0.00025, 0, -180, 0, -0.00025, 80]",
  maxPixels: 1E11
});

Export.image.toDrive({
  image: MWE_rainest_five_years, 
  description: 'MWE_rainest_five_years',
  folder: 'Sahel_idrogeologico',
  region: sahel.geometry().bounds(),
  crs:"EPSG:4326",
  crsTransform:"[0.00025, 0, -180, 0, -0.00025, 80]",
  maxPixels: 1E11
});
Map.addLayer(MWE_drought_five_years.selfMask(),{palette: ["blue"]},"MWE_drought_five_years (1984-1988)",false);
Map.addLayer(MWE_rainest_five_years.selfMask(),{palette: ["blue"]},"MWE_rainest_five_years (2015-2019)",false);

//Extents for MWE
var extentCalc = function(image){
  return image.multiply(ee.Image.pixelArea().divide(1000000))
              .reduceRegion({
                 reducer: ee.Reducer.sum(),
                 geometry: sahel.geometry().bounds(),
                 scale: 30,
                 maxPixels: 1e12,
                 tileScale: 1})
}
var MWE_counter_season_area = extentCalc(ee.Image(MWE_counter_season).selfMask()).get('water_extent');
print('MWE_counter_season_area',MWE_counter_season_area);

var MWE_drought_five_years_area = extentCalc(ee.Image(MWE_drought_five_years).selfMask()).get('water_any');
var MWE_rainest_five_years_area = extentCalc(ee.Image(MWE_rainest_five_years).selfMask()).get('water_any');
//print(MWE_drought_five_years_area)//16111.907699519968
//print(MWE_rainest_five_years_area)//31195.013594599164
//print('counter_season_coll',counter_season_coll)

var extents5years1 = drought_five_years.map(function(image){
  image = image.gt(0);
  return image.set('extent',ee.Number(extentCalc(image).get('water')));
})//.reduce(ee.Reducer.mean()); //aggregate_mean


var extents5years2 = rainest_five_years.map(function(image){
    image = image.gt(0);
    return image.set('extent',ee.Number(extentCalc(image).get('water')));
})
//print('extents5years2', extents5years2);

//print('mean of extents for 2015-2019', extents5years2);

extents5years1 = ee.ImageCollection(extents5years1).aggregate_mean('extent')
//print('mean of extents for 1984-1989', extents5years1);

extents5years2 = ee.ImageCollection(extents5years2).aggregate_mean('extent')
//print('mean of extents for 2015-2019', extents5years2);

var extents5years1 = ee.Feature(null,{what:'extents5years1',extent: ee.Number(extents5years1)})
var extents5years2 = ee.Feature(null,{what:'extents5years2',extent: ee.Number(extents5years2)})
var extents5years3 = ee.Feature(null,{what:'MWE_drought_five_years_area',extent: ee.Number(MWE_drought_five_years_area)})
var extents5years4 = ee.Feature(null,{what:'MWE_rainest_five_years_area',extent: ee.Number(MWE_rainest_five_years_area)})
var MWE_counter_season_areaF = ee.Feature(null,{what:'MWE_counter_season_area',extent: ee.Number(MWE_counter_season_area)})

var allExtents = ee.FeatureCollection([extents5years1,extents5years2,extents5years3,extents5years4,MWE_counter_season_areaF]);

// Export.table.toAsset({
//   collection: allExtents,
//   assetId: "users/defeliceluca/sahel/extents", 
//   description: "allExtents"
// })

Export.table.toDrive({
  collection: allExtents,
  folder: "Sahel_idrogeologico", 
  description: "allExtents"
});



var set_ndv = function(key, val){
  return ee.List([val, 0]).reduce(ee.Reducer.firstNonNull());
};

//counter_season_coll = counter_season_coll.filter(ee.Filter.eq('year',1984));
//Map.addLayer(counter_season_coll.filter(ee.Filter.eq('year',1993)),{},'t1993')
//time series
var timeseries = ee.FeatureCollection(counter_season_coll.map(function(image){ 
  var year = image.get('year');
  var nodata = image.select(['nodata']).eq(4);//no data mask for counter season, it is nodata only if all 4 months of counter season are no data  
  var nodataInMwe = ee.Image(MWE_counter_season).updateMask(nodata).select([0],['nodata']);
  image = image.select('water').gt(0);
  image = image.addBands(nodataInMwe);
  var stats = image.select(['water','nodata'])//.unmask(0)
            .multiply(ee.Image.pixelArea().divide(1000000))
            .reduceRegion({
               reducer: ee.Reducer.sum(),
               geometry: sahel.geometry().bounds(),
               scale: 30,
               maxPixels: 1e12,
               tileScale: 1})
  stats = stats.map(set_ndv)             
  var result = ee.Feature(null,stats.combine({year:year}));
  return result;
}).aside(print));
//print(timeseries);

Export.table.toDrive({
  collection: timeseries,
  folder: "Sahel_idrogeologico", 
  description: "timeseries"
})

//first 5 years (1984-1989) extents 
var drought_five_years = timeseries.select('water').filter(ee.Filter.lt('year',1989));
drought_five_years = ee.ImageCollection(drought_five_years).aggregate_mean('water')
//print(drought_five_years)
var rainest_five_years = timeseries.select('water').filter(ee.Filter.gt('year',2014));
rainest_five_years = ee.ImageCollection(rainest_five_years).aggregate_mean('water')
//print(rainest_five_years)

var scale = 0.00025;
Export.image.toDrive({
  image: annual_recurrence_counter_season, 
  description: 'annual_recurrence_counter_season',
  folder: 'SAHEL',
  region: sahel.geometry().bounds(),
  crs:"EPSG:4326",
  crsTransform:"[0.00025, 0, -180, 0, -0.00025, 80]",
  maxPixels: 1E12
});

//Map.setCenter(-4.301766,15.220916,13)//-4.250126,15.215931

//occurrence of counter season water using counter_season_coll -
//for considering observations per year we need to subtract #nodata from 4 (number of months of couter season October-Nov-Dec-January)
var occurrenceSum = counter_season_coll.sum();
var obs = ee.Image.constant(4).multiply(36).subtract(occurrenceSum.select('nodata'));
var occurrenceCounterSeason = occurrenceSum.select('water').divide(obs).select([0],['occurrence']);
Map.addLayer(occurrenceCounterSeason,{min:0,max:1,palette:['azure','blue']},'occurrence');

var scale = 0.00025;
Export.image.toDrive({
  image: occurrenceCounterSeason, 
  description: 'occurrenceCounterSeason',
  folder: 'Sahel_idrogeologico',
  region: sahel.geometry().bounds(),
  crs:"EPSG:4326",
  crsTransform:"[0.00025, 0, -180, 0, -0.00025, 80]",
  maxPixels: 1E12
});









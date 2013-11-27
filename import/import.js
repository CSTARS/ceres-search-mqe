var sys = require('sys');
var MongoClient = require('mongodb').MongoClient, db;
var gpImporter = require('./exportPg');
var previewGenerator = require('./previewGenerator/esriPreview.js');

var config = null;


var importLog = "";
var lastRun = null;
var count = null;

var mapServiceTypes = ["MapServer","ImageServer","GeocodeServer","FeatureServer","GeometryServer",
     					"GeoDataServer","MobileServer","IndexGenerator","IndexingLauncher","SearchServer",
     					"NAServer","GPServer","GlobeServer","Map Service"];

function runImport() {
	lastRun = new Date();
	count = {
			error : 0,
			update : 0,
			found : 0,
			remove : 0,
			insert : 0
	}
	importLog = "\n==== Cbase Data Import @"+lastRun.toLocaleString()+" ====\n";
	
	MongoClient.connect(config.db.url, function(err, database) {
		if(!err) {
			db = database;
			log("connected to mongo db: "+config.db.url);
			gpImporter.getData(onPgDataLoad);
		} else {
			onComplete(err);
		}   
	});
}

function onPgDataLoad(err, data) {
	if( err ) return onComplete(err);

	count.found = data.length;
	log("data successfully loaded from Cbase");
	
	db.collection(config.db.mainCollection, function(err, collection) { 
		if( err ) return onComplete(err);
		log("found main collection: "+config.db.mainCollection+"\nInserting items into mongo");
				
		addItemToMongo(collection, data, 0);
	});
}

function addItemToMongo(collection, data, index) {
	// first cache a map preview image
	collection.find({id: data[index].id}).toArray(function(err, items) {
		if( err ) {
			log(err);
		} else {
			//createMapPreview(items.length > 0 ? items[0] : data[index], function(){
				if( items.length > 0 ) { // update
					data[index]._id = items[0]._id;
					delete items[0].lastMongoUpdate;
					
					// copy icon attributes
					if( items[0].hasPreview != null ) data[index].hasPreview = items[0].hasPreview;
					if( items[0].lastPreviewGeneration != null ) data[index].lastPreviewGeneration = items[0].lastPreviewGeneration;

					if( _checkDiff(items[0], data[index]) ) {
						count.update++; // something changed
					}
						
					data[index].lastMongoUpdate = lastRun.toLocaleString();
					collection.update({_id:items[0]._id}, data[index], function(err, result) {
						if( err ) {
							count.error++;
							log(err);
						}
	
						addNextItem(collection, data, index);
					});
	
	
				} else { // insert
					count.insert++;
					data[index].lastMongoUpdate = lastRun.toLocaleString();
	
					collection.insert(data[index], {w :1}, function(err, result) {
						if( err ) {
							count.error++;
							log(err);
						}
	
						addNextItem(collection, data,index);
					});
					
				}
			//});
		}
	});
}

function _checkDiff(item1, item2) {
	var key, tmp1, tmp2;
	var ignoreList = ["Date Entered","score","Uptime Date","Uptime Status"];
	for( key in item1 ) {
		if( ignoreList.indexOf(key) > -1 ) continue;

		if( !item2[key] ) return true;

		tmp1 = (typeof item1[key] == 'object') ? JSON.stringify(item1[key]) : item1[key];
		tmp2 = (typeof item2[key] == 'object') ? JSON.stringify(item2[key]) : item2[key];
		if( tmp1 != tmp2 ) return true;
	}
	for( key in item2 ) {
		if( ignoreList.indexOf(key) > -1 ) continue;
		if( !item1[key] ) return true;
	}

	return false;
}

function createMapPreview(item, callback) {
	// make sure this is even required
	if( !item.Resource ) return callback();
	if( item.Resource.indexOf("MapServer") == -1 &&
		item.Resource.indexOf("Map Service") == -1 ) return callback();
	
	// only do this once a day
	if( item.lastPreviewGeneration ) {
		if( new Date().getTime() - item.lastPreviewGeneration < 86400000 ) {
			return callback();
		}
	}
	item.lastPreviewGeneration = new Date().getTime();
	
	var url = "";
	if( item["Map Service"] && item["Map Service"].length > 0  ) {
		url = item["Map Service"][0];
	} else if( item["MapServer"] && item["MapServer"].length > 0  ) {
		url = item["MapServer"][0];
	}
	
	if( url == null ) {
		console.log("Error: "+item.id+" url is null");
		return callback();
	} else if( url.length == 0 ) {
		console.log("Error: "+item.id+" url is null");
		return callback();
	}
	
	previewGenerator.getUrl({
		url : url,
		width: 400,
		height: 400,
		loaded: function(err, resp) {
			//console.log(item.id+": loaded");
			if( err ) {
				//console.log(err);
				return callback();
			}
			previewGenerator.download(__dirname+"/../server/public/images/preview/"+item.id+".png", resp, function(e){
				if( e ) {
					//console.log(e);
					return callback();
				}
				//console.log(item.id+": downloaded");
				item.hasPreview = true;
				callback();
			});
		}
	});
}


function addNextItem(collection, data,index) {
	index++;
	if( index < data.length ) addItemToMongo(collection, data,index);
	else onComplete(null, collection);
}


function log(msg) {
	if( !msg ) return;
	if( typeof msg == 'object' ) msg = JSON.stringify(msg);	
	importLog += msg+"\n";
}

function onComplete(err, collection) {
	if( err ) return writeLog(err);
	
	removeItems(collection, function(){
		clearCache(function(){
			writeLog();
		});
	});
}

function writeLog(err) {
	
	if( err ) log(err);
	
	log("Import of cbase was finished @"+new Date().toLocaleString()+"\n"+
			count.found +" items found\n"+
			count.update +" items required updated\n"+
			count.insert +" items were new\n"+
			count.error+" items error'd on insert/update\n"+
			count.remove+" items removed");
	
	importLog += "==== End Cbase Import ====\n";
	console.log(importLog);
	
	count.timestamp = new Date();
	
	// add to mongo stats
	// example day query: db.items_update_stats.find({timestamp: {$gte: new Date(2013, 7, 16), $lt: new Date(2013, 7, 17)}});
	db.collection("items_update_stats", function(err, collection) { 
		collection.insert(count,function(err, removed){
			if( err ) console.log({error:true,message:"Error error adding stats to collection items_update_stats",errObj:err});
			db.close();
	    });
	});
}


function removeItems(collection, callback) {
	console.log({lastMongoUpdate : { $ne : lastRun.toLocaleString() }});
	collection.find({lastMongoUpdate : { $ne : lastRun.toLocaleString() }}).toArray(function(err, items){
		if( err ) log({error:true,message:"Error finding removed items",errObj:err});
		
		if( items.length == 0 ) {
			callback();
		} else {
			count.remove = items.length;
			collection.remove({lastMongoUpdate : { $ne : lastRun.toLocaleString() }},function(err, removed){
				if( err ) log({error:true,message:"Error clearing cache collection: "+config.db.cacheCollection,errObj:err});
				callback();
		    });
		}
		
	});
}


function clearCache(callback) {
	if( count.update == 0 && count.remove == 0 && count.insert  == 0) return callback();
	
	log("Clearing cache: "+config.db.cacheCollection);
	db.collection(config.db.cacheCollection, function(err, collection) { 
		collection.remove({},function(err, removed){
			if( err ) log({error:true,message:"Error clearing cache collection: "+config.db.cacheCollection,errObj:err});
			callback();
	    });
	});
}

// the config file should be the second argument
if( process.argv.length < 3 ) {
    console.log("you must provide the location of your config file");
    process.exit();
}

config = require(process.argv[2]);

runImport();

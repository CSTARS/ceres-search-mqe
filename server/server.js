/**
 * This will actually extend the MQE expressjs server
 * 
 * make sure mongo is fired up w/ text search enabled
 * mongod --setParameter textSearchEnabled=true
 * 
 */

var config = require(process.argv[2]);
var fs = require("fs");
var ObjectId = require('mongodb').ObjectID;
var nodemailer;

if( config.email ) {
	nodemailer = require("nodemailer");
	// create reusable transport method (opens pool of SMTP connections)
	var smtpTransport = nodemailer.createTransport("SMTP",{
	        host : config.email.host,
	        port : config.email.port
	});
}

// include auth model
var auth;
if( config.auth ) {
	auth = require(config.auth.script);
}

// express app
exports.bootstrap = function(server) {
	var db = server.mqe.getDatabase();
	
	var collection;
	var editCollection;
	var cacheCollection;
	var statsCollection;
	
	db.collection(config.db.mainCollection, function(err, coll) { 
		if( err ) return console.log(err);

		collection = coll;
	});
	
	db.collection(config.db.editCollection, function(err, coll) { 
		if( err ) return console.log(err);

		editCollection = coll;
	});
	
	db.collection(config.db.cacheCollection, function(err, coll) { 
		if( err ) return console.log(err);

		cacheCollection = coll;
	});

	if( config.import.statsCollection ) {
		db.collection(config.import.statsCollection, function(err, coll) { 
			if( err ) return console.log(err);

			statsCollection = coll;
		});
	}
	
	
	// make sure their is a an index one the id attribute.  It's used in import
	collection.ensureIndex( {id: 1}, function(err) {
		if( err ) console.log(err);
	});
	
	// embed url functionality
	server.app.get('/embed', function(req, res) {
		var org = req.query.org;
		var anchor = req.query.anchor;
		var root = req.query.root;
		
		fs.readFile(__dirname+'/public/inject.js','utf-8', function(err, data){
			if( err ) return res.send({error:true, message:err});
			
			if( root ) data += "\nCERES.host='"+root+"';"
			else data += "\nCERES.host='"+req.protocol+"://"+req.host+"';";
			if( org ) data += "\nCERES.embedOrg='"+org+"';";
			if( anchor ) data += "\nCERES.root='#"+anchor+"';";
			res.send(data);
		});
	});
	
	
	server.app.get('/rest/stats', function(req, res){
		if( !config.import.statsCollection ) return res.send([]);

		var start = new Date(req.query.start + "T00:00:00.000Z");
		var end = new Date(req.query.end + "T00:00:00.000Z");
		
		var q = {"timestamp": {$gte:start, $lt: end }};
		statsCollection.find(q).toArray(function(err, items) {
			if( err ) return res.send(err);
			res.send(items);
		});
	});

	
	server.app.get('/rest/geoPreview', function(req, res) {
		var limit = 1000;
		
		var query = req.query.q;
		var defaultQuery = req.query.dq;
		if( !query ) return res.send({error:true,message:"No query provided"});
		if( !defaultQuery ) return res.send({error:true,message:"No default query provided"});
		
		try {
			query = JSON.parse(query);
			defaultQuery = JSON.parse(defaultQuery);
		} catch (e) {
			return res.send({error:true,message:e});
		}
		
		var command = {
				text: config.db.mainCollection,  
				search : query.text,
				limit  : limit
		};
		var justGeoOptions = {};
		
		if( query.filters.length > 0 ) {
			command.filter = {};
			
			// set geo filter if it exits 
			// if so, remove from $and array and set as top level filter option
			if( config.db.geoFilter ) {
				for( var i = 0; i < query.filters.length; i++ ) {
					if( query.filters[i][config.db.geoFilter] ) {
						command.filter[config.db.geoFilter] = query.filters[i][config.db.geoFilter];
						justGeoOptions[config.db.geoFilter] = query.filters[i][config.db.geoFilter];
						query.filters.splice(i, 1);
						break;
					}
				}
			}
			
			if( query.filters.length > 0 )  command.filter["$and"] = query.filters;
			if( defaultQuery.filters.length > 0 )  {
			    justGeoOptions["$and"] = defaultQuery.filters;
			}
		}
		
		if( query.text.length == 0 ) {
			collection.find(command.filter,{Centroid:1}).limit(limit).toArray(function(err, items) {
				if( err ) return res.send(err);
				
				
				var ro = {filterPoints: {}};
				for( var i = 0; i < items.length; i++ ) {
					ro.filterPoints[items[i]._id] = items[i].Centroid;
				}
				
				collection.find(justGeoOptions,{Centroid:1}).limit(limit).toArray(function(err, items) {
					if( err ) return res.send({error:true,message:err});
					
					ro.allPoints = {};
					for( var i = 0; i < items.length; i++ ) {
						if( !ro.filterPoints[items[i]._id] ) {
							ro.allPoints[items[i]._id] = items[i].Centroid;
						}
					}
					
					res.send(ro);
				});
			});
		} else { 
			
			db.executeDbCommand(command,function(err, resp) {
				if( err ) return res.send(err);
				
				var items = {};
				
				// make sure we got something back from the mongo
				if( !(resp.documents.length == 0 || !resp.documents[0].results || resp.documents[0].results.length == 0) ) {
					for( var i = 0; i < resp.documents[0].results.length; i++ ) {
						var item = resp.documents[0].results[i].obj;
						items[item._id] = item.Centroid;
					}
				}
				
				var ro = {filterPoints: items};
				
				collection.find(justGeoOptions,{Centroid:1}).limit(limit).toArray(function(err, items) {
					if( err ) return res.send({error:true,message:err});
					
					ro.allPoints = {};
					for( var i = 0; i < items.length; i++ ) {
						if( !ro.filterPoints[items[i]._id] ) {
							ro.allPoints[items[i]._id] = items[i].Centroid;
						}
					}
					
					res.send(ro);
				});
			});
		}

	});
	
	server.app.use("/", server.express.static(__dirname+"/public"));
	
};

function notifyUpdate(item) {
	if( !config.email.to || !config.email.from ) return;
	var to = "";
	for( var i = 0; i < config.email.to.length; i++ ) {
		to += config.email.to[i]+",";
	}
	to = to.replace(/,$/,'');
	
	// setup e-mail data with unicode symbols
	var mailOptions = {
	    from: config.email.from,
	    to: to, // list of receivers
	    subject: "Creeks to Coast Directory Update",
	    html: item.organization+" has submitted an update to directory.  Click "+
	    	"<a href='http://"+config.server.host+"/admin.html#"+item._id+"'>here</a> to approve or deny to submission."
	}

	// send mail with defined transport object
	smtpTransport.sendMail(mailOptions, function(error, response){
	    if(error){
	        console.log(error);
	    }else{
	        console.log("Message sent: " + response.message);
	    }
	});
}


function cleanXml(txt) {
	return txt.replace(/&/g, '&amp;')
    		  .replace(/</g, '&lt;')
    		  .replace(/>/g, '&gt;')
    		  .replace(/"/g, '&quot;')
    		  .replace(/'/g, '&apos;');
}

function cap(str) {
    var pieces = str.toLowerCase().split(" ");
    for ( var i = 0; i < pieces.length; i++ )
    {
        var j = pieces[i].charAt(0).toUpperCase();
        pieces[i] = j + pieces[i].substr(1);
    }
    return pieces.join(" ");
}

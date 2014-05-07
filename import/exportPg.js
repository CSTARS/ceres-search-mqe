/**
 *  local tunnel connection
 *  ssh -f -N -L 65432:localhost:5432 username@cbase.casil.ucdavis.edu
 * */
var pg = require('pg');
var Proj4js = require('proj4'),
       proj = new Proj4js.Proj("EPSG:3857");
var config; 

try {
  config = require('/etc/ceres-search-mqe/pg.json');
} catch (e) {
  console.log('/etc/ceres-search-mqe/pg.json not found, import disabled');
  return;
}

var pgQueryString = 'SELECT json,cid,score FROM cbase.items';


var mapServiceTypes = ["MapServer","ImageServer","GeocodeServer","FeatureServer","GeometryServer",
                       	"GeoDataServer","MobileServer","IndexGenerator","IndexingLauncher","SearchServer",
                       	"NAServer","GPServer","GlobeServer"];

exports.getData = function(callback) {
	if( !config ) callback({error:true, message:'exportPg has no config file'});

	var conString = "postgres://"+config.username+":"+config.password+"@"+config.host+":"+config.port+"/"+config.db;
	
	var client = new pg.Client(conString);
	client.connect(function(err) {
	  if(err) return callback({error:true, message:'could not connect to postgres', errObj: err});
	  
	  console.log(pgQueryString);
	  client.query(pgQueryString, function(err, result) {
	    if(err) return callback({error:true, message:'error running pg query: '+pgQueryString, errObj: err});
	
	    console.log(result.rows.length);

		var success = 0;
		var error = 0;
		var arr = []
	
	    for( var i = 0; i < result.rows.length; i++ ) {
			try {
			   var data = eval('('+clean(result.rows[i].json)+')');
			   //var data = JSON.parse(result.rows[i].json);
			   arr.push(createMqeItem(data,result.rows[i].score));
			   success++;
			} catch (e) {
			 // TODO: bad records quietly fail for now
			 // console.log("Error parsing: "+result.rows[i].cid);
			 // console.log(e);
			 // console.log("******************");
			  error++;
			}
	    }

	    client.end();
	    callback(null, arr);
	  });
	});
}

function createMqeItem(data, score) {

	var item = {score:score};
	for( var key in data ) {
		if( typeof data[key] == 'string' ) {
			item[key] = data[key];
		} else if ( key == 'attributes' ) {
			for( var akey in data.attributes ) {
				// clean up attributes
				if( akey.split("(")[0] == "Topic" ) {
					for( var i = 0; i < data.attributes[akey].length; i++ ) {
						data.attributes[akey][i] = cleanCamelCase(data.attributes[akey][i]);
					}
				} else if ( akey.split("(")[0] == "Resource" ) {
					var arr = [];
					for( var i = 0; i < data.attributes[akey].length; i++ ) {
						var value = data.attributes[akey][i];
						if( value && value.length > 0 ) arr.push(value);
					}
					data.attributes[akey] = arr;
				}
				
				item[akey.split("(")[0]] = data.attributes[akey];
			}
		}	
	}

	// if there is a centroid, parse the string and project it
	try {
		projectCentroid(item);
	} catch(e) {}
	
	
	// combine map services
	combineMapServices(item);

	// this is a hack that should be done in the contribute section
	removeDuplicateResources(item);
	
	// turn date entered into a javascript date or remove
	fixDateEntered(item);
	
	return item;
}

function fixDateEntered(item) {
	if( !item["Date Entered"] ) return;
	
	try {
		var parts = item["Date Entered"][0].split("-");		
		item["Date Entered"] = new Date(parseInt(parts[0]), parseInt(parts[1])-1, parseInt(parts[2]));	
	} catch (e) {
		console.log(e);
		delete item["Date Entered"];
		return;
	}
}

function projectCentroid(item) {
	if( !item.Centroid ) return;
	
	var parts = item.Centroid[0].split("(");
	var type = parts[0].split(";");
	
	if( type.length == 1 || parts.length == 1 ) {
		//console.log("Centroid found, format unknown: "+item.Centroid);
		return;
	} else if( type[0] != "SRID=3857" || type[1] != "POINT" ) {
		//console.log("Centroid found, invalid type: "+parts[0]);
		return;
	}
	
	var point = parts[1].replace(/\)$/,'').split(" ");
	
	point = Proj4js.transform(proj, Proj4js.WGS84, new Proj4js.Point([parseFloat(point[0]),parseFloat(point[1])]));
	
	item.Centroid = { 
			type : "Point",
			coordinates : [point.x, point.y]
	}
}

function combineMapServices(item) {
	if( !item ) return;
	if( !item.Resource ) return;
	
	for( var i = 0; i < item.Resource.length; i++ ) {
		var type = item.Resource[i];
		item.filter_resources = [];
		
		if( mapServiceTypes.indexOf(type) > -1 ) {
			if( item.filter_resources.indexOf("Map Service") == -1 ) {
				item.filter_resources.push("Map Service");
			}
			
			if( !item["Map Service"] ) {
				item["Map Service"] = item[type];
			} else {
				for( var j = 0; j < item[type].length; j++ ) {
					if( item["Map Service"].indexOf(item[type][j]) == -1 ) {
						item["Map Service"].push(item[type][j]);
					}
				}
			}
		} else {
			item.filter_resources.push(item.Resource[i]);
		}
	}
}


function removeDuplicateResources(item) {
	if( !item ) return;
	if( !item.Resource ) return;
	
	for( var i = 0; i < item.Resource.length; i++ ) {
		var type = item.Resource[i];
		item[type] = cleanArray(item[type]);
		
		// remove duplicate items that exist in 'other' column
		if( type != "Other" && item.Other ) {
			for( var j = 0; j < item[type].length; j++ ) {
				if( item.Other.indexOf(item[type][j]) > -1 ) {
					item.Other.splice(item.Other.indexOf(item[type][j]),1);
				}
			}
		}
		
	}
}

function cleanArray(arr) {
	// remove all duplicate values
	var newArr = [];
	for( var i = 0; i < arr.length; i++ ) {
		if( arr[i].length == 0 ) continue;
		if( newArr.indexOf(arr[i]) == -1 ) newArr.push(arr[i]);
	}
	
	// a lot of the projects.atlas links have http and https, let's just keep the https
	var uris = {};
	for( var i = 0; i < newArr.length; i++ ) {
		var base = newArr[i].split(/:\/\//);
		if( base.length == 1 ) continue;
		
		if( !uris[base[1]] ) {
			uris[base[1]] = [base[0]];
		} else {
			uris[base[1]].push(base[0]);
		}
	}
	
	newArr = [];
	for( var key in uris ) {
		if( uris[key].length == 1 || uris[key].indexOf("https") == -1 ) {
			newArr.push(uris[key][0]+"://"+key);
		} else {
			newArr.push("https://"+key);
		}
	}
	
		
	return newArr;
}


function cleanCamelCase(txt) {
	var org = txt;
	
	txt = txt
		.replace(/([A-Z])/g, ' $1')
		// uppercase the first character
		.replace(/^./, function(str){ return str.toUpperCase(); });
	txt = toTitleCase(txt);
	
	// see if acronym
	// if 3+ on letter and capitilized 
	var words = txt.split(" ");
	var c = 0;
	for( var i = 0; i < words.length; i++ ) {
		if( words[i].length == 1 ) c++;
		else c = 0;
		if( c == 3 ) return org;
	}
	
	return txt;
}

function toTitleCase(str) {
    return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

function clean(txt) {
        return txt.replace(/[\n\r]/g,"<br />").replace(/^\s*/,"").replace(/\s*$/,"").replace(/\s\s+/g,"");
}

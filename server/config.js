var tokenConfig = require("/etc/mqe/tokens.js");
exports.debug = true;

exports.db = {
	// connection string for the database, includes database name
	url             : "mongodb://localhost:27017/ceresSearch",
	
	// collection where the queryable items are stored
	mainCollection  : "items",
	
	// collection that is used as a cache.  YOU SHOULD NOT TOUCH THIS
	// MQE has rights to delete at any time
	cacheCollection : "items_cache",
	
	// collection that is used to store edits to a record.
	editCollection : 'items_edits',
	
	// Filters your site uses, these will be returned in the results
	// MQE will also use this list to make sure indexes are built on these items
	indexedFilters  : ["filter_resources", "Publisher", "Topic"],
	
	/// filter used for geographic queries
	geoFilter : "Centroid",
	
	// currently MQE only allows one sort option, place the attribute you wish to sort on here
	sortBy          : "score",
	
	// which way to sort, defaul is ascending
	sortOrder       : "desc",
	
	// add the mongo text search score into the application sort score.  To do this, enable the flag
	// below and make sure that the 'sortBy' value is an int.
	useMongoTextScore : true,
	// if above is true, This factor will multiply that
	// to match your scored variable
	mongoTextScoreFactor : 50,
	
	// the text search index
	textIndexes :  ["Topic","Resource","Keyword", "title", "description", "Publisher","Group"],
	
	// object that maps a text index attribute to a weight.  attributes not listed will get a value of 1
	// more info: http://docs.mongodb.org/manual/tutorial/control-results-of-text-search
	textIndexWeights : {
		title : 5,
		Topic : 3
	},
	                 
	// attributes that are stored but will never be returned to a default search/get request
	blacklist       : ["lastMongoUpdate"],
	
	// should updates be allowed to fire
	allowUpdates    : true
		
}

exports.import = {
	// local script to be fired when update is called via admin api call
	module    : "/Users/jrmerz/dev/ceres/ceres-search-mqe/import/import.js",

	hour   : "*",
	minute : 55,
}

//auth server information
//exports.auth = {
//		script            : "/Users/jrmerz/dev/ceres/ceres-auth-node/auth",
//		token             : tokenConfig.token,
//		centralAuthServer : "http://localhost:4000",
//		appName           : "CCCDev",
//		twitter           : tokenConfig.twitter,
//		facebook          : tokenConfig.facebook,
		
		// these pages will require login and admin role
//		adminPages        : ["admin.html"],
		
		// page to redirect to after login
//		loginRedirectPage : "admin.html",
		
		// do accounts require approval?
//		requireApproval   : false
//}

exports.server = {

	// local config
	host : "localhost",
	
	// port outside world goes to.  most likely 80
	remoteport : 80,
	
	// local port on machine
	localport : 3000,
	
	// remote hosts that are allowed to access this sites mqe
	allowedDomains : ["testnode.com","localhost","192.168.1.113"],
	
	// server script
	script : "/Users/jrmerz/dev/ceres/ceres-search-mqe/server/server.js"
}

//exports.email = {
//	host      : "mx4.ceres.ca.gov",
//	port      : 25,
//	from      : "do-not-reply@ceres.ca.gov",
//	to        : ["jrmerz@gmail.com"]
//}

exports.schema = {
}

// dform options
exports.editForm = {
}

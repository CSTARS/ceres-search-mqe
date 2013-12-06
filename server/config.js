exports.debug = true;

exports.db = {
	// connection string for the database, includes database name
	url             : "mongodb://localhost:27017/ceresSearchCkan",
	
	// collection where the queryable items are stored
	mainCollection  : "items",
	
	// collection that is used as a cache.  YOU SHOULD NOT TOUCH THIS
	// MQE has rights to delete at any time
	cacheCollection : "items_cache",
	
	// collection that is used to store edits to a record.
	editCollection : 'items_edits',
	
	// Filters your site uses, these will be returned in the results
	// MQE will also use this list to make sure indexes are built on these items
	indexedFilters  : ["filter_resources", "Publisher", "Topic", "mimetypes", "organization"],
	
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
	module    : "/Users/jrmerz/dev/cstars/ckan-mqe-importer/ckan-importer.js",

	itemProcessor : '/Users/jrmerz/dev/ceres/ceres-search-mqe-ckan/import/itemProcessor.js',

	statsCollection : 'items_import_stats',

	hour   : "*",
	minute : 10,
}

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

exports.ckan = {
	groupByPackage : true,

	server : 'http://ceic.casil.ucdavis.edu'
}

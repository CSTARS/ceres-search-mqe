
exports.process = function(item) {
	if( !item.resources ) return;

	var resources = item.resources;

	item.id = item.ckan_id;

	item.resources = [];
	for( var i = 0; i < resources.length; i++ ) {
		var r = resources[i];

		if( r.resource_type) {
			var type = r.resource_type.replace(/\./g,'_');
			if( item.resources.indexOf(type) == -1 ) {
				item.resources.push(type);
				item[type] = [];
			}
			item[type].push(r.url);
		}

		if( r.mimetype ) {
			var mime = r.mimetype.replace(/;.*/,'');
			if( !item.mimetypes ) item.mimetypes = [];
			if( item.mimetypes.indexOf(mime) == -1 ) item.mimetypes.push(mime);
		} 
	}
}
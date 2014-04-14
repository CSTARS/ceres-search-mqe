
exports.process = function(item) {
	if( !item.resources ) return;

	var resources = item.resources;

	item.id = item.ckan_id;

	item.Resource = [];
	for( var i = 0; i < resources.length; i++ ) {
		var r = resources[i];

		if( r.format ) {
			var format = r.format.toLowerCase();
			if( item.Resource.indexOf(format) == -1 ) {
				item.Resource.push(format);
				item[format] = [];
			}
			item[format].push(r.url);
		}
	}

	if( item.organization ) {
		if( typeof item.Publisher == 'string' ) {
			item.Publisher = [item.Publisher];
			item.Publisher.push(item.organization);
		} else {
			item.Publisher = [item.organization];
		}
		delete item.organization;
	} 

	if( item.extras.spatial ) {
		try {
			item.Centroid = JSON.parse(item.extras.spatial);
		} catch (e) {}
	}

}
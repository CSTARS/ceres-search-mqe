Handlebars.registerHelper('result-list', function(items, options) {
    var out = "";
    if( !items ) return out;
	  
    var key = options.fn({});
    items.sort();

    // TODO: all of these require complex schema types
    //var schema = '';
    //if( CERES.result.schemaMap[key] ) schema = 'itemprop="'+CERES.result.schemaMap[key]+'"';
  
    var unique = [];
    $.each(items, function(i, el){
        if($.inArray(el, unique) === -1) unique.push(el);
    });
  
    var schema = '<span><span>';
    if( key == 'Contributor' ) {
    	schema = '<span itemprop="contributor" itemscope itemtype="http://schema.org/Organization"><span itemprop="name">';
    } else if ( key == 'Publisher' ) {
    	schema = '<span itemprop="publisher" itemscope itemtype="http://schema.org/Organization"><span itemprop="name">';
    } else if ( key == 'Topic' ) {
    	schema = '<span><span itemprop="keywords">';
    }
    
    for(var i=0, l=unique.length; i<l; i++) {
	   var q = CERES.mqe.getDefaultQuery();

        var f = {};
        f[key] = unique[i];
        q.filters.push(f);
        out = out + '<li><a href="'+CERES.mqe.queryToUrlString(q)+'" ><i class="icon-filter" style="color:#888"></i> ' +
        			schema+unique[i]+'</span></span></a></li>';
    }
    return out;
});

Handlebars.registerHelper('result-list-plain', function(items, options) {
	var out = "";
	if( !items ) return out;

    var key = options.fn({});

    var schema = '';
    if( CERES.result.schemaMap[key] ) schema = 'itemprop="'+CERES.result.schemaMap[key]+'"';

	items.sort();
	for(var i=0, l=items.length; i<l; i++) {
	    out += '<span '+schema+'>'+items[i]+'</span>';
	    if( i < items.length - 1 ) out += ", ";
	}
	return out;
});

Handlebars.registerHelper('description', function() {
	  return new Handlebars.SafeString(this.description);
});

CERES.result = (function() {
	
	var resultTemplate = null;
	
	var loaded = false;
	var waiting = null;
	
	var loadHandlers = [];
	var chart = null;
	var cResult = null;
	var host = null;

	// mapping our results attributes to the correct schema.org attribute
	var schemaMap = {
        "Keyword" : "keywords"
	}

	function init(h) {
		host = h;
		$.get(host ? host+'/handlebars_result.html' : '/handlebars_result.html', function(template){
			resultTemplate = Handlebars.compile($(template).html());
			
			loaded = true;
			
			if( waiting != null ) updateResult(waiting);
			
			for( var i = 0; i < loadHandlers.length; i++ ) {
				var f = loadHandlers[i];
				f();
			}
		});
		
		$(window).bind('result-update-event', function(e, result){
			updateResult(result);
		});
	}
	
	// fires when template is loaded
	function onLoad(handler) {
		if( resultTemplate == null ) loadHandlers.push(handler);
		else handler();
	}
	
	function updateResult(result) {
		cResult = result;
		if( !loaded ) {
			waiting = result;
			return;
		}
		
		$("#"+CERES.mqe.getResultPage()).html(getResultHtml(result));
		
		// add map icons / images
		if( result["Map Service"] && result["Map Service"].length > 0  ) {
			_addMapPreview(result.id,  result["Map Service"][0], result.hasPreview);
		} else if( result["MapServer"] && result["MapServer"].length > 0  ) {
			_addMapPreview(result.id,  result["MapServer"][0], result.hasPreview);
		} else if( result.Preview &&  result.Preview.length > 0 ) {
			$("#result-map-"+result.id).append($("<img src='"+ result.Preview[0] +"'  class='img-polaroid' style='width:200px' />" ));
		} else {
			$(".result-map-row").remove();
			$(".result-title-row").removeClass("span8").addClass("span11");
		}
		
		// add uptime chart if available
		if( result["Uptime Date"] && result["Uptime Status"] ) {
			if( CERES.chartsPackageReady ) {
				_createUptimeChart(result["Uptime Date"], result["Uptime Status"]);
			} else {
				google.setOnLoadCallback(function(){
					_createUptimeChart(result["Uptime Date"], result["Uptime Status"]);
				});
			}
		} else {
			chart = null;
			$("#result-uptime-outer").remove();
		}
		
		// muck with the date formate and display
		if( result["Date Entered"] && result["Date Entered"].match(/.*T.*Z$/) ) {
			// this doesn't work in IE ... of course
			// var d = new Date(result["Date Entered"]);
			// if( (d.getYear()+1900) < 1990 ) $("#result-date-entered").remove();
			
			var year = parseInt(result["Date Entered"].replace(/-.*/,''));
			if( year < 1990 ) {
				$("#result-date-entered").remove();
			} else {
				var ele = $("#result-date-entered div");
				var parts = ele.text().replace(/T.*/,'').split("-");
				ele.html(parts[1]+"-"+parts[2]+"-"+parts[0]);
			}
		}
		
		var btns = CERES.search.createResourceButtons(result);
		if( btns.length > 0 ) {
			$(".resource-btns")
			    .append($("<h4>Resources</h4>"))
				.append($(btns));	
		}
		
		
		$(".result-back-btn").on('click', function(){
			$(window).trigger("back-to-search-event");
		});

		// let outside resource know we are ready
		// using for static resourceing at the moment
		if( CERES.mqe.lpready ) CERES.mqe.lpready();
		CERES.mqe._lploaded = true;
	}
	
	function _addMapPreview(id, url, hasPreview) {
		var panel = $("#result-map-"+id);
		//panel.width(230);
		panel.css("padding-top","20px");
		
		var map = $("<div></div>");
		panel.append(map);
		
		// on error, try preview widget
		if( hasPreview ) {
			var img = $("<img class='img-polaroid' src='"+(host ? host : '')+"/images/preview/"+id+".png' style='width:200px;height:200px' />").error(function() {
			    map.html("");
			    map.esriPreview({
					url : url,
					height : 200,
					width : 200
				});
			});
			map.append(img);
		} else {
			map.esriPreview({
				url : url,
				height : 200,
				width : 200
			});
		}		
		
		panel.append($("<a href='http://ceres.ca.gov/mapviewer?zoom=true&url="+encodeURIComponent(url)+"'>Display in CERES Map Viewer</a>"))
	}
	
	function _createUptimeChart(dates, status) {
		if( !google.visualization ) return;

		// allow things to settle for width	
		// try / catch is for zombie.js
		var dt;
		try {
		 	dt = new google.visualization.DataTable();
		} catch (e) {
			return;
		}

		dt.addColumn('string', 'Date');
		dt.addColumn('number', 'Status');
		for( var i = 0; i < dates.length; i++ ) {
			dt.addRow(); 
			
			dt.setCell(i, 0, dates[i], dates[i],null);
            if( status[i] ) {
                    dt.setCell(i, 1, 1, "Up", null);
            } else {
                    dt.setCell(i, 1, 0, "Down", null);
            }
		}
		
		var options = {
				vAxis : {
						maxValue : 1,
						minValue : 0,
						gridlines : { 
							count : 3
						},
						textPosition : "none"
				},
				width : $('#result-uptime').width()-10,
				height : 225,
				pointSize : 5,
				title : "Service History",
				legend : {
					position : "none"
				}
		}
		
		chart = new google.visualization.LineChart($('#result-uptime')[0]);
	    chart.draw(dt, options);

	}
	
	$(window).on('resize', function(){
		if( chart == null ) return;
		_createUptimeChart(cResult["Uptime Date"], cResult["Uptime Status"]);
	})
	
	
	function getResultHtml(result) {
		return resultTemplate(result);
	}
	
	return {
		init : init,
		updateResult : updateResult,
		getResultHtml : getResultHtml,
		onLoad : onLoad,
		schemaMap : schemaMap
	}
	
})();
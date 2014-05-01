Handlebars.registerHelper('snippet', function() {
  return new Handlebars.SafeString(this.snippet);
});
Handlebars.registerHelper('publisher', function() {
	  return new Handlebars.SafeString(this.publisher);
});
Handlebars.registerHelper('btns', function() {
	  return new Handlebars.SafeString(this.btns);
});

CERES.search = (function() {
	
	// handle bar template layouts
	var RESULT_TEMPLATE = [
	    "<div class='search-result-row animated fadeInUp'>",
	    	"<h4><a href='#lp/{{id}}'>{{title}} </a>{{updated}}</h4>",
	    	"<div class='row-fluid'>",
	    		"<div class='span8' id='descriptionRow-{{id}}'>",
	    			"<div>{{publisher}}</div>",
	    			"<div>{{snippet}}</div><div style='margin:10px 0'>{{btns}}</div>",
	    		"</div>",
	    		"<div class='span3 offset1' id='mapPreviewRow-{{id}}'>",
	    			"<div class='mapPreviewPanel pull-right'></div>",
	    		"</div>",
	    	"</div>",
	    "</div>"
	].join('');
	
	var TITLE_TEMPLATE = "Search Results: <span style='color:#888'>{{start}} to {{end}} of {{total}}</span>";
	
	var aboutPanel = $(
			'<div class="aboutPanel animated bounceInDown">'+
			    '<a><i class=""></i></a>'+
				'<div class="aboutPanel-title">C<span class="aboutPanel-title-sub"> alifornia</span>'+
					'&nbsp;&nbsp;E<span class="aboutPanel-title-sub"> nvironmental</span>'+
					'&nbsp;&nbsp;R<span class="aboutPanel-title-sub"> esources</span>'+
					'&nbsp;&nbsp;E<span class="aboutPanel-title-sub"> valuation</span>'+
					'&nbsp;&nbsp;S<span class="aboutPanel-title-sub"> ystem</span>'+
				'</div>'+
				'<div class="AboutPanel-text">CERES is an information system developed by the <a href="http://resources.ca.gov/">'+
					'California Natural Resources Agency</a> to facilitate access to a variety of electronic data describing California\'s rich'+
					' and diverse environments. The goal of CERES is to improve environmental analysis and planning by integrating natural '+
					'and cultural resource information from multiple contributors and by making it available and useful to a wide variety of '+
					'users. (<a href="/about">more...</a>)</div>'+
			'</div>');
	
	var mapServiceTypes = ["MapServer","ImageServer","GeocodeServer","FeatureServer","GeometryServer",
          					"GeoDataServer","MobileServer","IndexGenerator","IndexingLauncher","SearchServer",
          					"NAServer","GPServer","GlobeServer","Map Service", "map service"];
	
	var filterLabels = {
		filter_resources : "Resource" 
	};

	var iconMap = {
		metadata : 'code',
		kml      : 'globe',
		download : 'download-alt',
		other    : 'cogs',
		document : 'file',
		documentation : 'copy',
		website  : 'link',
		html     : 'link',
		link     : 'link',
		preview  : 'picture',
		zip      : 'archive'
	}

	// template functions
	var rowTemplate;
	var titleTemplate;
	var allFiltersTemplate;
	
	var openFilters = [];
	var allFilterLinks = {};
	
	var host = null;
	
	function _initAbout() {
		//$("body").append(aboutPanel);
	}
	
	
	function init(chost) {
	    host = chost;
		if( CERES.embedOrg ) CERES.mqe.setDefaultFilter({Publisher:CERES.embedOrg});
		
		$("#all-filters").modal({show:false});
		_initAbout();

		rowTemplate = Handlebars.compile(RESULT_TEMPLATE);
		titleTemplate = Handlebars.compile(TITLE_TEMPLATE);
		
		$(window).bind("search-update-event", function(e, results){
			_updateResultsTitle(results);
			_updateResults(results);
			_updateFilters(results); // this should always be before adding active filters
			_updateActiveFilters(results);
			_updatePaging(results);
			$('html, body').scrollTop(0);
			
			// HACK: remove animation styling
			setTimeout(function(){
				$(".search-result-row").removeClass("animated").removeClass("fadeInUp");
			},500);
			
		});
		
		// set search handlers
		$("#search-btn").on('click', function(){
			_search();
		});
		
		$("#search-text").on('keypress', function(e){
			if( e.which == 13 ) _search();
		});
	}
	
	function _search() {
		var query = CERES.mqe.getCurrentQuery();
		query.page = 0;
		query.text = $("#search-text").val();
        if( query.text.toLowerCase().replace(/[\s']/g, "") == "ilovethe90s" ) {
        	window.location = (host ? host : '')+"/_90.html";
        }
		window.location = CERES.mqe.queryToUrlString(query);
	}
	
	function _updateActiveFilters() {
		var panel = $("#active-filters").html("");
		var query = CERES.mqe.getCurrentQuery();
		
		// make sure text box is always correct
		$("#search-text").val(query.text);

		panel.append("<h6 style='margin-top:0px'>Your Selections:</h6>");

		var count = 0;
		for( var i = 0; i < query.filters.length; i++ ) {
			// get query copy and splice array
			var tmpQuery = CERES.mqe.getCurrentQuery();
			tmpQuery.page = 0;
			
			tmpQuery.filters.splice(i,1);
			
			var f = "";
			var key = "";
			for( var j in query.filters[i] ) {
				key = j;
				f = query.filters[i][j]; 
			}

			if( key == 'Centroid' ) {
				var btn = '<div class="btn-group" style="margin:0 5px 5px 0"><a class="btn btn-primary btn-small dropdown-toggle" data-toggle="dropdown" href="#"> Location Filter'+
								' <span class="caret"></span></a><ul class="dropdown-menu" style="z-index:2000">' +
								'<li><a href="'+CERES.mqe.queryToUrlString(tmpQuery)+'" ><i class="icon-remove"></i> Remove</a></li>' +
								'<li><a id="geo-filter-edit"><i class="icon-edit"></i> Edit</a></li>' +
								'</ul></div>';
				btn = $(btn);
				panel.append(btn);
				btn.find("#geo-filter-edit").on('click', function(){
					CERES.map.show();
				});
				count++;
			} else if ( key == 'Publisher' && f == CERES.embedOrg ) {
				// this is an embed and we want to ignore this filter
			} else {
				panel.append($("<a href='"+CERES.mqe.queryToUrlString(tmpQuery)+"' style='margin:0 5px 5px 0' class='btn btn-primary btn-small'><i class='icon-remove icon-white'></i> "+_mapFilterLabel(f)+"</a>"));
				count++;
			}
			
		}
		
		if( count == 0 ) panel.find("h6").css("display","none");
		
		
	}
	
	function _updateFilters(results) {
		var panel = $("#filter-nav").html("");
		
		// add the title
		panel.append($('<li class="nav-header">Narrow Your Search</li>'));
		panel.append($('<li class="divider"></li>'));
		
		// first, get sorted filter list ... by nice name
		var list = [];
		for( var key in results.filters ) {
			list.push({key:key, label: key});
		}
		list.sort(function(a, b){
			if( a.label < b.label ) return -1;
			if( a.label > b.label ) return 1;
			return 0;
		});
		
		// add filter blocks
		var c = 0;
		for( c = 0; c < list.length; c++ ) {
			var key = list[c].key;
			var label = list[c].label;
			var safeKey = key.replace(/\./,'___');
			
			var title = $("<li><a id='filter-block-title-"+safeKey+"' class='search-block-title'>By "+_mapFilterLabel(label)+"</a></li>");
			
			var display = "";
			if( openFilters.indexOf(key) > -1 ) display = "style='display:block'" 
			var block = $("<ul id='filter-block-"+safeKey+"' class='filter-block' "+display+"></ul>");
			allFilterLinks[safeKey] = [];
			
			for( var i = 0; i < results.filters[key].length; i++ ) {
				var item = results.filters[key][i];
				var query = CERES.mqe.getCurrentQuery();
				query.page = 0;
				
				var filter = {};
				filter[key] = item.filter;
				query.filters.push(filter);
				
				if( i == 5 ) {
					var link = $("<li><a id='filter-all-"+safeKey+"' style='cursor:pointer;text-decoration:none'>[See All]</a></li>");
					block.append(link);
					link.find("a").on('click', function(){
						_showAllFilters($(this).attr("id").replace(/filter-all-/,''));
					});
				} else if ( i < 5 ) {
					block.append(
						$("<li><a style='text-decoration:none' href='"+CERES.mqe.queryToUrlString(query)+"'>"+
							"<span class='filter'>"+item.filter+"</span>"+
							(results.truncated ? "" : "&nbsp;&nbsp;<span class='label'>"+item.count+"</span>")+
							"</a></li>"));
				} 
				allFilterLinks[safeKey].push({filter:item.filter, link:"<a href='"+CERES.mqe.queryToUrlString(query)+
					"' style='text-decoration:none'><span class='filter'>"+item.filter+"</span>"+
					(results.truncated ? "" : "&nbsp;&nbsp;<span class='label'>"+item.count+"</span>")+
					"</a>"});
				
			}
			
			title.append(block);
			panel.append(title);
		}
		
		if( c == 0 ) {
			panel.append($("<div>No filters available for this search</div>"));
			return;
		}

		if( !_hasFilter(CERES.mqe.getCurrentQuery(), 'Centroid') ) {
			panel.append($('<li><a id="filter-block-title-geo" style="cursor:pointer;font-weight:bold">By Location</a></li>'));
			$("#filter-block-title-geo").on('click', function(){
				CERES.map.show();
			});
		}

		
		panel.append($('<li class="divider"></li>'));
		
		// add hide/show handlers for the blocks
		$(".search-block-title").on('click', function(e){
			var id = e.target.id.replace(/filter-block-title-/, '');
			var panel = $("#filter-block-"+id);
			
			if( panel.css("display") == "none" ) {
				panel.show('blind');
				openFilters.push(id);
			} else {
				panel.hide('blind');
				openFilters.splice(openFilters.indexOf(id),1);
			}
		});
	
	}
	
	function _showAllFilters(blockId) {
		if( !allFilterLinks[blockId] ) return;
		
		var filters = allFilterLinks[blockId];
		filters.sort(function(a, b){
			if( a.filter < b.filter ) return -1;
			if( a.filter > b.filter ) return 1;
			return 0;
		});
		
		$("#all-filters-header").html($("#filter-block-title-"+blockId).text().replace(/^By/,'')+
				" Filters<br /><span style='font-size:16px'>Search</span> <input type='text' class='all-filter-search' style='height:30px;margin:10px 0' />");
		$("#all-filters-header").find('.all-filter-search').on('keyup', function(){
			var search = $(this).val().length == 0 ? ".*" : ".*"+$(this).val().toLowerCase()+".*";
			search = RegExp(search);
			$("#all-filters-content div").each(function(){
				if( search.test($(this).attr("value").toLowerCase()) ) $(this).css('display','block');
				else $(this).css('display','none');
			});
		});
		
		$("#all-filters-content").html("");
		
		var c = $("#all-filters-content");
		
		for( var i = 0; i < filters.length; i++  ) {
			c.append($("<div style='padding:10px; ' class='all-filters-content-filter' value='"+filters[i].filter+
				"'><i class='icon-filter' style='color:#ccc'></i> <span>"+filters[i].link+"</span></div>"));
		}

		$(".all-filters-content-filter").on('click', function(){
			$("#all-filters").modal('hide');
		});
		
		$("#all-filters").modal('show');

	}
	
	function _updatePaging(results) {
		var tmpQuery = CERES.mqe.getCurrentQuery();
		var numPages = Math.ceil( parseInt(results.total) / tmpQuery.itemsPerPage );
		var cPage = Math.floor( parseInt(results.start+1) / tmpQuery.itemsPerPage );
		
		var buttons = [];
		
		// going to show 7 buttons
		var startBtn = cPage - 3;
		var endBtn = cPage + 3;
		
		if( endBtn > numPages ) {
			startBtn = numPages-7;
			endBtn = numPages;
		}
		if( startBtn < 0 ) {
			startBtn = 0;
			endBtn = 6;
			if( endBtn > numPages ) endBtn = numPages;
		}
		
		var panel = $("#search-paging-btns");
		var panelBottom = $("#search-paging-btns-bottom");
		panel.html("");
		panelBottom.html("");
		
		// add back button
		if( cPage != 0 ) {
			tmpQuery.page = cPage-1;
			panel.append($("<li><a href='"+CERES.mqe.queryToUrlString(tmpQuery)+"'>&#171;</a></li>"));
			panelBottom.append($("<li><a href='"+CERES.mqe.queryToUrlString(tmpQuery)+"'>&#171;</a></li>"));
		}
		
		for( var i = startBtn; i < endBtn; i++ ) {
			var label = i+1;
			tmpQuery.page = i;
			var btn = $("<li><a href='"+CERES.mqe.queryToUrlString(tmpQuery)+"'>"+label+"</a></li>");
			if( cPage == i ) btn.addClass('active');
			panel.append(btn);
			
			btn = $("<li><a href='"+CERES.mqe.queryToUrlString(tmpQuery)+"'>"+label+"</a></li>");
			if( cPage == i ) btn.addClass('active');
			panelBottom.append(btn);
		}
		
		// add next button
		if(  cPage != numPages-1 && numPages != 0 ) {
			tmpQuery.page = cPage+1;
			panel.append($("<li><a href='"+CERES.mqe.queryToUrlString(tmpQuery)+"'>&#187;</a></li>"));
			panelBottom.append($("<li><a href='"+CERES.mqe.queryToUrlString(tmpQuery)+"'>&#187;</a></li>"));
		}
	}
	
	function _updateResultsTitle(results) {
		var end = results.end;
		if( results.total < end ) end = results.total;
		
		var start = parseInt(results.start)+1;
		if( end == 0 ) start = 0;
		
		
		$("#results-title").html(titleTemplate({
			start : start,
			end   : end,
			total : results.total
		}));
	}
	
	function _updateResults(results) {
		var panel = $("#results-panel").html("");
		
		if( results.items.length == 0 ) {
			panel.append("<div style='font-style:italic;color:#999;padding:15px 10px'>No results found for your current search.</div>");
			return;
		}
		
		for( var i = 0; i < results.items.length; i++ ) {
			var item = results.items[i];
			
			var snippet = item.description ? item.description.replace(/<br\s*\/>/g," ").replace(/<[^>]*>/g,"") : "";
			if( snippet.length > 200 ) snippet = snippet.substr(0,200)+"... ";
			
			var publisher = "";
			if( item.Publisher && item.Publisher.length > 0 ) {
				
				for( var j = 0; j < item.Publisher.length; j++ ) {
					var query = CERES.mqe.getCurrentQuery();
					var p = item.Publisher[j];
					if( ! _hasFilter(query, 'Publisher', p) ) {
						query.filters.push({'Publisher':p});
					}
					query.page = 0;
					publisher += "<a href='"+CERES.mqe.queryToUrlString(query)+"'><i class='icon-filter'></i> "+p+"</a>"+(j < item.Publisher.length-1 ? " | " : "");
				}
				
			}
			
			var updated = "";
			if( item["Date Entered"] && item["Date Entered"].length > 0  ) {
				var d = new Date(item["Date Entered"][0]);
				var now = new Date();
				if( d.getYear() == now.getYear() ) updated = "<span class='badge'>Updated</span>";
			}
			
			var btns = createResourceButtons(item);
			
			var itemPanel = $(rowTemplate({
				id     : item.id,
				title   : item.title,
				updated : updated,
				snippet : snippet,
				publisher : publisher,
				btns : btns
			}));
			
			panel.append(itemPanel);
			
			if( item["Map Service"] && item["Map Service"].length > 0  ) {
				_addMapPreview(itemPanel, item.id, item["Map Service"][0], item.hasPreview);
			} else if( item["map service"] && item["map service"].length > 0  ) {
				_addMapPreview(itemPanel, item.id, item["map service"][0], item.hasPreview);
			} else if( item["MapServer"] && item["MapServer"].length > 0  ) {
				_addMapPreview(itemPanel, item.id,  item["MapServer"][0], item.hasPreview);
			} else if( item.Preview &&  item.Preview.length > 0 ) {
				itemPanel.find(".mapPreviewPanel").append($("<img src='"+ item.Preview[0] +"'  class='img-polaroid' style='width:150px' />" ));
			} else {
				$("#mapPreviewRow-"+item.id).remove();
				$("#descriptionRow-"+item.id).removeClass("span8").addClass("span12");
			}
		}

		_updateSeo();
	}

	function _updateSeo() {
		$("title").text("CERES - Search Results");

		var desc = $('meta[name="description"]');
		if( desc.length == 0 ) {
			desc = $('<meta name="description" />');
			$("head").append(desc);
		}
		desc.attr("content","CERES search results");
	}
	
	function createResourceButtons(item) {
		var btns = "";
		if( item.Resource && item.Resource.length > 0 ) {
			for( var j = 0; j < item.Resource.length; j++ ) {
				var r = item.Resource[j];
				if( !item[r] ) continue;
				if( item[r].length == 0 ) continue;
				
				btns += _createResourceButton(r, item[r]);
			}
		}
		return btns;
	}
	
	function _createResourceButton(resource, linkArray) {
		
		if( linkArray.length == 1 ) {
			if( linkArray[0] == "" ) return "";
			
			var schema = '<span>';
			if( resource == "Download" ) schema = '<span itemprop="distribution" itemscope itemtype="http://schema.org/DataDownload">';

			return schema+"<a class='btn'  style='margin:2px' href='"+linkArray[0]+"' itemprop='url' target='_blank' >" + 
					_getResourceIcon(resource)+resource+": "+_getResourceButtonLabel(resource, linkArray[0], true)+"</a></span>";
		}
		
		var btn = '<div class="btn-group"><a class="btn dropdown-toggle" data-toggle="dropdown" href="#"> '+
				_getResourceIcon(resource)+resource+' <span class="caret"></span></a><ul class="dropdown-menu" style="z-index:2000">';
		for( var i = 0; i < linkArray.length; i++ ) {
			var schema = '';
			if( resource == "Download" ) schema = 'itemprop="distribution" itemscope itemtype="http://schema.org/DataDownload"';
			btn += '<li '+schema+'><a href="'+linkArray[i]+'" target="_blank" itemprop="url">'+_getResourceButtonLabel(resource, linkArray[i], false)+'</a></li>';
		}
		btn += '</ul></div>';
		
		return btn;
	}
	
	// r is the resource name
	function _getResourceButtonLabel(r, link, isSingle) {
		// check if it's frs link
		var parts = link.split("?");
		if( parts.length > 1 ) {
			if( parts[0].match(/.*frs.*/) && parts[1].match(/.*group_id.*/) ) {
				return " <span style='font-size:11px;"+(isSingle ? 'color:#888' : '')+"'>Cal-Atlas File List</span>";
			}
		}
		
		if( r == 'Metadata' || r == 'Download' || r == 'Other' || r == 'KML' || r == 'Document' || r == 'Documentation' || r == 'Preview' ) {
			return " <span style='font-size:11px;"+(isSingle ? 'color:#888' : '')+"'>"+link.replace(/\/$/,'').replace(/.*\//,'').replace(/_/g," ")+"</span>";
		} else {
			return " <span style='font-size:11px;"+(isSingle ? 'color:#888' : '')+"'>"+link.replace(/.*:\/\//,'').replace(/\/$/,'').replace(/\/.*/,'')+"</span>";
		}
	}
	
	function _getResourceIcon(r) {
		r = r.toLowerCase();
		if( iconMap[r] ) return "<i class='icon-"+iconMap[r]+"'></i> ";
		if( mapServiceTypes.indexOf(r) > -1 ) return "<i class='icon-cloud'></i> ";
		return "";
	}
	
	
	
	
	
	function _addMapPreview(itemPanel, id, url, hasPreview) {
		itemPanel.find(".mapPreviewPanel").width(150);
		itemPanel.find(".mapPreviewPanel").css("text-align","center");
		
		var map = $("<div></div>");
		itemPanel.find(".mapPreviewPanel").append(map);
		
		// on error, try preview widget
		if( hasPreview ) {
			var img = $("<img class='img-polaroid' src='"+(host ? host : '')+"/images/preview/"+id+".png' style='width:150px;height:150px' />").error(function() {
			    map.html("");
			    map.esriPreview({
					url : url,
					height : 150,
					width : 150
				});
			});
			map.append(img);
		} else {
			map.esriPreview({
				url : url,
				height : 150,
				width : 150
			});
		}
		
		itemPanel.find(".mapPreviewPanel").append($("<a href='http://ceres.ca.gov/mapviewer?zoom=true&url="+encodeURIComponent(url)+"'>Display in CERES Map Viewer</a>"))
		
		//var inner = itemPanel.find(".search-result-row-inner");
		//if( inner.height() < 185 ) inner.height(185);
	}
	
	
	function _hasFilter(query, key, value) {
		for( var i = 0; i < query.filters.length; i++ ) {
			if( query.filters[i][key] && value == null ) return true;
			if(  query.filters[i][key] && query.filters[i][key] == value ) return true;
		}
		return false;
	}
	
	function _mapFilterLabel(label) {
		if( filterLabels[label] ) return filterLabels[label];
		return label;
	}
	
	
	return {
		init : init,
		createResourceButtons : createResourceButtons
	}
})();
                   
                   

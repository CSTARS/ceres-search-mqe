var ie = (function(){
    var undef,
        v = 3,
        div = document.createElement('div'),
        all = div.getElementsByTagName('i');
    while (
        div.innerHTML = '<!--[if gt IE ' + (++v) + ']><i></i><![endif]-->',
        all[0]
    );
    return v > 4 ? v : undef;
}());

CERES = {};

CERES.jslib = [
        "jslib/bootstrap.min.js",
        "jslib/handlebars.js",
        "mqe/mqe.js",
];

CERES.js = [
	     "js/app.js",
	     "js/search.js",
	     "js/result.js",
	     "js/map.js",
	     "js/jquery.esriPreview.js"
];


CERES.css = [
        "css/bootstrap.min.css",
        "css/bootstrap-responsive.min.css",
        "css/animate.css",
        "css/font-awesome.min.css",
        "css/style.css"
];

CERES.jquery = "//ajax.googleapis.com/ajax/libs/jquery/1.9.1/jquery.min.js";
CERES.gmaps = "https://maps.googleapis.com/maps/api/js?key=AIzaSyCf2En8KkOI8YXuI2zhpHNFQpnonJnl2cY&sensor=true";
CERES.html = "html/main.html";
CERES.host = "";
CERES.root = "#anchor";

try {
CERES.chartsPackageReady = false;
google.load('visualization', '1.0', {'packages':['corechart']});
google.setOnLoadCallback(function(){
    CERES.chartsPackageReady = true;
});
} catch (e) {}

window.onload = function() {
	// add jquery
	var head = document.getElementsByTagName("head")[0];
	
	// inject mobile meta tag
	var meta = document.createElement("meta");
	meta.name = "viewport";
	meta.content = "width=device-width, initial-scale=1, maximum-scale=1";
	head.appendChild(meta);
	
	// add google maps
	//var gmaps = document.createElement("script");
	//gmaps.src = CERES.gmaps;
	//head.appendChild(gmaps);
	
	// add jquery
	var jquery = document.createElement("script");
	jquery.src = CERES.jquery;
	
	// jquery.onload = CERES.onJqueryLoad;
	// Attach handlers for all browsers
	if( ie ) {
		var done = false;
		jquery.onreadystatechange = function() {
		    if ( !done && (!this.readyState ||
		            this.readyState === "loaded" || this.readyState === "complete") ) {
		    	done = true;
		    	CERES.onJqueryLoad();
		    }
		};
	} else {
		jquery.onload = CERES.onJqueryLoad;
	}
	head.appendChild(jquery);
}

CERES.onJqueryLoad = function() {
    $(window).load(function(){
        if( window.navigator.userAgent.match(/.*MSIE\s[67].*/) ) $("#no-support").show();
    });
    
	// IE cross-site for jquery
	// add ajax transport method for cross domain requests when using IE9
	if('XDomainRequest' in window && window.XDomainRequest !== null) {
	   $.ajaxTransport("+*", function( options, originalOptions, jqXHR ) {

	        var xdr;

	        return {
	            send: function( headers, completeCallback ) {
	                // Use Microsoft XDR
	                xdr = new XDomainRequest();
	                xdr.open(options.type, options.url); // NOTE: make sure protocols are the same otherwise this will fail silently
	                xdr.onload = function() {
	                    if(this.contentType.match(/\/xml/)){
	                        var dom = new ActiveXObject("Microsoft.XMLDOM");
	                        dom.async = false;
	                        dom.loadXML(this.responseText);
	                        completeCallback(200, "success", [dom]);
	                    } else {
	                    	var resp = this.responseText;
	                    	try {
	                    		resp = eval('('+resp+')');
	                    	} catch (e) {
	                    		CERES.error = e;
	                    	}
	                    	
	                        completeCallback(200, "success", [resp]);
	                    }
	                };

	                xdr.onprogress = function() {};

	                xdr.ontimeout = function(){
	                    completeCallback(408, "error", ["The request timed out."]);
	                };

	                xdr.onerror = function(){
	                    completeCallback(404, "error", ["The requested resource could not be found."]);
	                };

	                if( options.data != null ) xdr.send(options.data);
	                else xdr.send();
	            },
	            abort: function() {
	                if(xdr) xdr.abort();
	            }
	        };
	    });
	}
	
	var head = $('head');
	
	// add css
	for( var i = 0; i < CERES.css.length; i++ ) {
		head.append($('<link href="'+CERES.host+"/"+CERES.css[i]+'" rel="stylesheet" />'));
	}
	
	// inject root
	$(CERES.root).load(CERES.host+"/"+CERES.html); // IE doesn't seem to like this
	// try this..
	//$.getScript(CERES.host+"/"+CERES.html, function(){
	//	$(CERES.root).html(CERES.mainhtml);
	//});
	
	
	// add script tags
	var loadCount = 0;
	for( var i = 0; i < CERES.jslib.length; i++ ) {
		//var scriptUrl = CERES.jslib[i].match(/^[http|https].*/) ? CERES.jslib[i] : CERES.host+"/"+CERES.jslib[i];
		$.getScript(CERES.host+"/"+CERES.jslib[i], function(){
			loadCount++;
			if( loadCount == CERES.jslib.length ) {
				CERES.onLibsReady();
			}
		});
	}	
}

CERES.onLibsReady = function() {
	// add script tags
	var loadCount = 0;
	for( var i = 0; i < CERES.js.length; i++ ) {
		$.getScript(CERES.host+"/"+CERES.js[i], function(){
			loadCount++;
			if( loadCount == CERES.js.length ) {
				CERES.onReady();
			}
		});
	}	
}

CERES.onReady = function() {
	$("#accordion2").collapse();
	$("#accordion2").height("auto");
	
	
	CERES.search.init(CERES.host);
	CERES.mqe.init({
		defaultPage : "search",
		resultPage : "lp",
		resultQueryParameter : "id",
		hostUrl : CERES.host
	});
	CERES.result.init(CERES.host);
	CERES.map.init(CERES.host);
}

// if IE prototype out indexOf
if (!Array.prototype.indexOf) {
  Array.prototype.indexOf = function(elt /*, from*/) {
    var len = this.length >>> 0;

    var from = Number(arguments[1]) || 0;
    from = (from < 0)
         ? Math.ceil(from)
         : Math.floor(from);
    if (from < 0)
      from += len;

    for (; from < len; from++)
    {
      if (from in this &&
          this[from] === elt)
        return from;
    }
    return -1;
  };
}

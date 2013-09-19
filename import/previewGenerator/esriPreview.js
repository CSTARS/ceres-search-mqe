var Canvas = require('canvas');
var fs = require('fs');
var qs = require('querystring');
var Stream = require('stream');
var http = require('follow-redirects').http;

exports.getUrl = function(options) {
		var defaults = {};
		var plugin = {};

			plugin.ui = {
				_basemap : "http://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer",
				_url     : "",
				_width   : 250,
				_height  : 250,
				_isImageServer : false,
				_layerInfo : null, // this will tell you if the layer has been loaded
				_onLoad    :null,
				_format    : "",
				_bbox      : "",
				_sr        : "",
				
				// this is just for debug
				_queryUsed :"",

				init : function(url, width, height, onLoad){
					this._onLoad = onLoad;
					this._url = url;
					if( width ) this._width = width;
					if( height ) this._height = height;
										
					if( this._url && this._url.match(/.*ImageServer.*/) ) {
						this._isImageServer = true;	
					}
					
					this.loadLayer();
				},
				
				loadLayer : function() {
					var $this = this;
					
					var rUrl = "";

					// a little house cleaning
					if( this._url.match(/.*\/MapServer\/.*/ ) ) {
						this._url = this._url.replace(/\/MapServer\/.*/,'/MapServer');
					}
					
					if( this._isImageServer ) rUrl = this._url+"?f=json";
					else rUrl = this._url+"/layers?f=json";
					
					this._queryUsed = rUrl;

                    request({
                    	url : rUrl, 
                    	json : true,
                    	callback : function(error, result) {
                    		if( error ) {
                    			//console.log(error);
                    			$this.onComplete({error:true,message:"1. Preview Generation Failed.<br />Could not access service information."});
                    		} else {
     							if( !result.error ) {
     								$this._layerInfo = $this.create(result);
     							} else {
     								// a json response was returned but says invalid url
     								// more than likely an old server, try this instead
     								$this.tryFirstLayer();
     							}       
                    		}
                    	}	
                    });
				},
				
				tryRoot : function() {
					var $this = this;
					
					this._queryUsed = this._url+"?f=json";
                    request({
                    	url : this._url+"?f=json", 
                    	json : true,
                    	callback : function(error, result) {
                    		if( error ) {
                    			 $this.onComplete({error:true,message:"2. Preview Generation Failed.<br />Could not access service information."});
                    		} else {
     							if( !result.error ) {
     								$this._layerInfo = $this.create(result);
     							} else {
                                     $this.onComplete({error:true,message:"3. Preview Generation Failed.<br />Could not access service information."});
     							}
                    		}
                    	}
                    });
				},
				
				tryFirstLayer : function() {
					var $this = this;
					
					this._queryUsed = this._url+"/0?f=json";
                    request({
                    	url : this._url+"/0?f=json", 
                    	json : true,
                    	callback : function(error, result) {
                    		if( error ) {
                    			 $this.onComplete({error:true,message:"4. Preview Generation Failed.<br />Could not access service information."});
                    		} else {
    							if( !result.error ) {
    								$this.createImg(result);
    							} else {
    								// a json response was returned but says invalid url
    								// more than likely an old server, try this instead
    								$this.tryRoot();
    							}
                    		}
                    	}
                    });
				},
				
				create : function( info ) {
					var layer = null;
					var $this = this;
					
					if( !info ) {
                        return $this.onComplete({error:true,message:"5. Preview Generation Failed.<br />Could not access service information."});
					} else if ( !info.layers ) {
                        return $this.onComplete({error:true,message:"6. Preview Generation Failed.<br />Could not access service information."});
					}
					
					for( var i = 0; i < info.layers.length; i++ ) {
						if( info.layers[i].defaultVisibility ) {
							layer = info.layers[i];
							break;
						}
					}
					if( layer == null && info.layers.length > 0 ) {
						layer = info.layers[0];
					} else if(layer == null && layers.length == 0 ) {
                        return $this.onComplete({error:true,message:"No layers to display"});
					}
					
					// get img format's, try highest res, png
                    request({
                    	url : this._url+"?f=json", 
                    	json : true,
                    	callback : function(error, result) {
                    		if( error ) {
                    			$this.createImg(layer, info);
                    		} else {
    							if( !result.error && result.supportedImageFormatTypes ) {
    								var types = result.supportedImageFormatTypes.toLowerCase().split(",");
    								for( var i = 0; i < types.length; i++ ) {
    									if( types[i].match(/png\d+/) ) {
    										$this._format = types[i];
    										break;
    									}
    								}
    							}
    							$this.createImg(layer, info,  result.fullExtent);
                    		}
                    	}
                    });
				},
				
				createImg : function(layer, info, fullExtent) {
					var $this = this;
					var ext = layer.extent;
					if( !ext && fullExtent ) {
						ext = fullExtent;
					} else if ( !ext && info.initialExtent ) {
						ext = info.initialExtent;
					} else if ( !ext && info.fullExtent ) {
						ext = info.fullExtent;
					}

					this._bbox = this.getBbox(layer, ext);
					var wkid = null;
					if( ext && ext.spatialReference ) {
						var wkid = ext.spatialReference.wkid;
					}
					if( wkid == null ) wkid = 0;
					
					this._sr = "";
					if( wkid > 0 ) this._sr = wkid+"";

					var exportEndPoint = "/export";
					if( this._isImageServer ) exportEndPoint = "/exportImage";
					
					// default
					if( this._format.length == 0 ) this._format = "png";
					
                    var resp = {};

					// if we don't have an sr, the base map will most likely be off;
					if( this._sr.length > 0 ) {
						resp.bg = this._basemap+"/export?bbox="+this._bbox+"&format=png32&transparent=true&f=image&imageSR="+
								this._sr+"&bboxSR="+this._sr+"&size="+this._width+","+this._height;
					}
					
					resp.map = this._url+exportEndPoint+"?bbox="+this._bbox+"&format="+this._format+"&transparent=true&f=image&imageSR="+
						this._sr+"&bboxSR="+this._sr+"&size="+this._width+","+this._height;
					
				    $this.onComplete(null,resp);

				},
				
				getBbox : function(layer, extent) {
					if( extent == null ) return "";
						
					var w = this._width * 0.000254;
					var cScale = (extent.xmax - extent.xmin) / w;
					var h = this._height * 0.000254;
					var cScaleH = (extent.ymax - extent.ymin) / h;
					if( cScale > cScaleH ) cScale = cScaleH;
						
					if( cScale < layer.minScale || layer.minScale == 0 ) {
						return extent.xmin + "," + extent.ymin + "," + extent.xmax + "," + extent.ymax;
					}
						
					var x = extent.xmin + ((extent.xmax - extent.xmin) / 2);
					var y = extent.ymin + ((extent.ymax - extent.ymin) / 2);
					
					var minScale = layer.minScale != null ? layer.minScale : 500;
					
					var newWidth = (minScale-5) * (this._width * 0.000254);
					var newHeight = (minScale-5) * (this._height * 0.000254);
						
					var xMin = x - (newWidth / 2);
					var xMax = x + (newWidth / 2);
					var yMin = y - (newHeight / 2);
					var yMax = y + (newHeight / 2);
						
					return xMin + "," + yMin + "," + xMax + "," + yMax;
				},
				
				// make sure this only fires once
				onComplete : function(err, result) {
					if( this._onLoad ) this._onLoad(err,result);
					this._onLoad = null;
				}
					
			};
			
			plugin.ui.init(options.url, options.width, options.height, options.loaded);
}


exports.download = function(filename, urls, callback) {
	var Image = Canvas.Image
	  , canvas = new Canvas(400, 400)
	  , ctx = canvas.getContext('2d');
	  
	try {	
		request({
			url: urls.map, 
			encoding : "binary",
			callback : function(err1, mapData) {
				request({
					url : urls.bg,
					encoding : "binary",
					callback : function(err2, bgData) {
						if( err1 || err2 ) return callback();
						
						var img = new Image;
						img.src = new Buffer(bgData, "binary");
				    	setTimeout(function() { 
				    		try {
				    			ctx.drawImage(img, 0, 0);
				    		} catch(e) {
				    			console.log(urls.map);
					    		if( callback ) callback(e);
					    		callback = null;
					    		return;
					    	}
				    		
				    		img = new Image;
				    		img.src = new Buffer(mapData, "binary");
				    		setTimeout(function() {
				    			try {
					    			ctx.drawImage(img, 0, 0);
					    		} catch(e) {
						    		if( callback ) callback(e);
						    		callback = null;
						    		return;
						    	}
					    		
					    		var out = fs.createWriteStream(filename)
						    	  , s = canvas.createPNGStream();
					    		
						    	s.on('data', function(chunk){
						    	  out.write(chunk);
						    	});
						    	s.on('end', function(){
						    		if( callback ) callback(null);
						    		callback = null;
						    	});
				    		},250);
				    			
				    	},250);
				    	

					}
				})
			}
		});
	} catch(e) {
		if( callback ) callback(e);
		callback = null;
	}
}


requestCount = 0;
var request = function(o) {
	var r, req;
	
	// dealing with bug where 1000+ requests and node starts failing :/
	requestCount++;
	if( requestCount == 1000 ) {
		requestCount = 0;
		http = require('follow-redirects').http;
	}
	
	var onComplete = function(err, resp) {
		  if( o.callback ) {
			  if( req != null ) {
				  req.socket.destroy();
			  }
			  r = null;
			  req = null;
			  o.callback(err, resp);
		  }
		  o.callback = null;
	};
	
	if( !o.url ) return onComplete({error:true,message:"invalid url"});
	
	var parts = o.url.replace(/.*:\/\//,'').split("/");
	var options = {
		host: parts[0],
		port: 80,
		method: 'GET',
		agent: false
	};
	
	var p2 = o.url.split("?");
	
	if( p2.length > 1 ) {
		p2 = p2[1].split("&");
		var params = {};
		for( var i = 0; i < p2.length; i++ ) {
			var p = p2[i].split("=");
			params[p[0]] = p[1];
		}
		options.path = "/"+parts.slice(1,parts.length).join('/').replace(/\?.*/,'')+"?"+qs.stringify(params);
	} else {
		options.path = "/"+parts.slice(1,parts.length).join('/');
	}

	r = function(response) {
	  if( o.encoding ) response.setEncoding(o.encoding);
	  var data = '';
	  
	  //another chunk of data has been recieved, so append it to `str`
	  response.on('data', function (chunk) {
		  data += chunk;
	  });

	  //the whole response has been recieved, so we just print it out here
	  response.on('end', function () {
		  //onComplete(null, new Buffer(imgData, "binary"));
		  if( o.json ) {
			  try {
				  data = eval('('+data+')');
				  onComplete(null, data);
			  } catch (e) {
				  //console.log(data);
				  //console.log(e);
				  onComplete({error:true,message:"invalid json"});
			  }	  
		  } else {
			  onComplete(null, data);
		  }
	  });
	};

	req = http.request(options, r);
	
	req.setTimeout(10000);
	  
	req.on('timeout', function (chunk) {
		onComplete({error:true,message:"timeout"});
	}).on('error', function (e) {
		onComplete({error:true,message:"error",obj:e,options:options,stack:e.stack});
	}).on("socket", function (socket) {
	    socket.emit("agentRemove");
	});
	req.end();
}

// for testing
/*var $this = this;
var id = "e2d2c2db58a5fb69294dc0d8f0cb63ca";
this.getUrl({
	url : "http://mdimap.towson.edu/ArcGIS/rest/services/ImageryBaseMapsEarthCover/MD.State.NAIPImagery.2005/MapServer",
	width: 400,
	height: 400,
	loaded: function(err, resp) {
		if( err ) return console.log(err);
		console.log(resp);
		
		$this.download(id+".png", resp, function(e){
			if( e ) console.log(e);
			console.log(id+": downloaded");
		});
	}
});*/

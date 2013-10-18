// IE8 has no indexOf support....
if (!Array.prototype.indexOf) {
	Array.prototype.indexOf = function(obj, start) {
	     for (var i = (start || 0), j = this.length; i < j; i++) {
	         if (this[i] === obj) { return i; }
	     }
	     return -1;
	}
}

CERES.widgets = {};

CERES.app = (function() {
	
	var DEFAULT_PAGE = "search";
	var validPages = [DEFAULT_PAGE, "lp"];
	
	var cPage = "";
	var cText = null;
	
	$(window).ready(function(){
		// mqe.js handles the hash parsing and fires this event
		$(window).bind("page-update-event", function(e, hash){
			_updatePage(hash[0], hash);
			_updatePageContent(hash);
		});
	});
	
	function _updatePage(page, hash) {
		// track all hash updates
		if( window.gas ) {
		    if( hash.length > 0 && cText != hash[1] ) {
		        gas('send', 'event', 'navigation', 'text_query', { text: hash[1]});
		        cText = hash[1];
		    }
		    gas('send', 'pageview', window.location.pathname+window.location.hash);
		}
		
		if( page == cPage ) return;
		
		$('html, body').scrollTop(0);
		
		if( validPages.indexOf(page) == -1 ) page = DEFAULT_PAGE;
		
		$("#"+cPage).hide();
		$("#"+page).show();
		
		cPage = page;
	}
	
	function _updatePageContent(hash) {
		// stub for now
	}
	
	
})();

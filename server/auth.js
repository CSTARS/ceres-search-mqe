/**
 * Server authentication module
 */
var GoogleStrategy = require('passport-google').Strategy;
var FacebookStrategy = require('passport-facebook').Strategy;
var TwitterStrategy = require('passport-twitter').Strategy;
var request = require('request');
// setup the google strategy

var rootUrl = "http://auth.cstars.ucdavis.edu:3000";

//TODO: this should be a redis or like store
var users = {};

exports.init = function(server) {
	
	// set session code
	server.passport.serializeUser(function(user, done) {
	  done(null, user.email);
	});

	server.passport.deserializeUser(function(id, done) {
	  if( users[id] ) return done(null, users[id]);
	  done({error:true,message:"not logged in"})
	});
	
	// rest end point for are we logged in
	server.app.get('/rest/isLoggedIn', function(req, res){
		if( req.user ) {
			res.send({
				status : true,
				user   : req.user
			})
			return;
		}
		
		res.send({status:false});
	});
	
	// setup oauth providers
	_setupGoogleAuth(server);
	_setupFacebookAuth(server);
	_setupTwitterAuth(server);
	

	// Automatically apply the `requireLogin` middleware to all
	// routes starting with `/admin`
	server.app.all("/", requireLogin, function(req, res, next) {
	  next(); // if the middleware allowed us to get here,
	          // just move on to the next route handler
	});
};

//require login for admins
function requireLogin(req, res, next) {
	console.log("here");
	console.log(req);
	if (req.user) {
		next(); // allow the next route to run
	} else {
		// require the user to log in
		res.redirect("/login.html"); // or render a form, etc.
	}
}


// access auth server and see if user has account
function getCentralAuthUser(user, done) {
	request({url:rootUrl+"/rest/getUser?app=ccc&username="+user.email,json:true}, function (error, response, body) {
	  if (!error && response.statusCode == 200) {
		  	users[user.email] = user;
			
			done(null, user);
	  } else {
		  done({error:true});
	  }
    });
}

function _setupTwitterAuth(server) {
	server.passport.use(new TwitterStrategy({
	    consumerKey: "LRqsWLecmTBXqY48feEKEw",
	    consumerSecret: "6SKx9t45LAH4zjAjys6uVpyh6b8fgDvoCAWciyHWfQ",
	    callbackURL: rootUrl+"/auth/twitter/callback"
	  },
	  function(token, tokenSecret, profile, done) {
			
			var user = {
				identifier : profile.id+"",
				email      : profile.username+"@twitter.com",
				name       : profile.displayName,
				provider   : 'Twitter'
			};
			
			getCentralAuthUser(user, done);
			
	  }
	));
	
	server.app.get('/auth/twitter', server.passport.authenticate('twitter'));

	server.app.get('/auth/twitter/callback', server.passport.authenticate('twitter', { successRedirect: '/',
	                                     	failureRedirect: '/login' }));
}

function _setupFacebookAuth(server) {
	server.passport.use(new FacebookStrategy({
	    clientID: "270667999734842",
	    clientSecret: "8014c3c923b648cac2325b0f8573f72f",
	    callbackURL: rootUrl+"/auth/facebook/callback"
	  },
	  function(accessToken, refreshToken, profile, done) {
		  console.log(profile);
		  console.log(JSON.stringify(profile));
		  
			var user = {
				identifier : profile.profileUrl,
				email      : profile.username+"@facebook.com",
				name       : profile.displayName,
				provider   : 'Facebook'
			};
			
			getCentralAuthUser(user, done);
	  }
	));
	
	server.app.get('/auth/facebook', server.passport.authenticate('facebook'));

	server.app.get('/auth/facebook/callback', server.passport.authenticate('facebook', { successRedirect: '/',
	                                      failureRedirect: '/login.html' }));
}

function _setupGoogleAuth(server) {
	// setup google auth
	server.passport.use(new GoogleStrategy({
	    returnURL: rootUrl+'/auth/google/return',
	    realm: rootUrl+"/"
	  },
	  function(identifier, profile, done) {
		
		var user = {
			identifier : identifier,
			email      : profile.emails[0].value,
			name       : profile.displayName,
			provider   : 'Google'
		};
		
		getCentralAuthUser(user, done);
	  }
	));
	
	
	server.app.get('/auth/google', server.passport.authenticate('google'));
	
	server.app.get('/auth/google/return',  
			server.passport.authenticate('google', { successRedirect: '/',
			                       					 failureRedirect: '/login.html' }));
}
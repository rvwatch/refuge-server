var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var config = require('./config/app.json');
var fs = require('fs');
var session = require('express-session');
var passport = require('passport'), LocalStrategy = require('passport-local').Strategy;
var Fitbit = require('fitbit-oauth2');
var port = process.env.PORT || 3000;
const { Client } = require('pg');
const client = new Client({
  user: 'rick',
  host: 'localhost',
  database: 'refuge',
  port: 5432
});

app.use(
  bodyParser.urlencoded({
    extended: false
  })
);
app.use(bodyParser.json());
app.use(
  session({
    secret: 'ajsdfo9dsfoO*OFYIEUIOI#***(*EOIJ@',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
  })
);

app.use(passport.initialize());
app.use(passport.session());
passport.serializeUser(function(user, done) {
  done(null, user);
});
passport.deserializeUser(function(user, done) {
  done(null, user);
});
app.use(function(req, res, next) {
  res.set('Access-Control-Allow-Origin', 'http://localhost:3001');
  res.set('Access-Control-Allow-Credentials', 'true');
  next();
});

passport.use(new LocalStrategy(
  function(username, password, done) {
    console.log("attempting to log " +  username + " in");
    
    if(username == 'rick' && password == "1234") {
      return done(null, {username: 'rick'});
    }
    else {
      return done(null, false, { message: 'You can not log in brother.' });
    }
    // User.findOne({ username: username }, function(err, user) {
    //   if (err) { return done(err); }
    //   if (!user) {
    //     return done(null, false, { message: 'Incorrect username.' });
    //   }
    //   if (!user.validPassword(password)) {
    //     return done(null, false, { message: 'Incorrect password.' });
    //   }
    //   return done(null, user);
    // });
  }
));

app.get('/', function(req, res, next) {
  console.log(req.user);
  res.send('Yo! servers is runnin shit');
});

app.listen(port, function() {
  console.log('Final Project listening on 3000');
});

app.post('/hrm', function(req, res, next) {
  res.send('heart rate!' + req.body.heartrate);
});

// Simple token persist functions.
//
var tfile = './fb-token.json';
var persist = {
  read: function(filename, cb) {
    fs.readFile(
      filename,
      {
        encoding: 'utf8',
        flag: 'r'
      },
      function(err, data) {
        if (err) return cb(err);
        try {
          var token = JSON.parse(data);
          cb(null, token);
        } catch (err) {
          cb(err);
        }
      }
    );
  },
  write: function(filename, token, cb) {
    try {
      console.log('persisting new token:', JSON.stringify(token));
      fs.writeFile(filename, JSON.stringify(token), cb);
    } catch (err) {
      console.log(err);
    }
  }
};

// Instanciate a fitbit client.  See example config below.
//
var fitbit = new Fitbit(config.fitbit);

// In a browser, http://localhost:4000/fitbit to authorize a user for the first time.
//
app.get('/fitbit', function(req, res, next) {
  res.redirect(fitbit.authorizeURL());
});



// Callback service parsing the authorization token and asking for the access token.  This
// endpoint is refered to in config.fitbit.authorization_uri.redirect_uri.  See example
// config below.
//
app.get('/fitbit_auth_callback', function(req, res, next) {
  var code = req.query.code;
  fitbit.fetchToken(code, function(err, token) {
    if (err) return next(err);

    // persist the token
    persist.write(tfile, token, function(err) {
      res.redirect('/fb-profile');
    });
  });
});

// Call an API.  fitbit.request() mimics nodejs request() library, automatically
// adding the required oauth2 headers.  The callback is a bit different, called
// with ( err, body, token ).  If token is non-null, this means a refresh has happened
// and you should persist the new token.
//

app.get('/fb-profile', function(req, res, next) {
  res.set('Access-Control-Allow-Origin', '*');
  // client.connect();
  // let token = null;
  // client.query("select * from Users where user_id = '6JVNF6'", (err, res) => {
  //   if (err) {
  //     console.log(err);
  //   }
  //   token = res.rows[0].access_token;
  //   console.log(res.rows[0].access_token);

  //   client.end();
  // });
  var token = persist.read(tfile, function(err, token) {
    if (err) {
      console.log(err);
      res.redirect(fitbit.authorizeURL());
    }

    // Set the client's token
    fitbit.setToken(token);

    fitbit.request(
      {
        uri: 'https://api.fitbit.com/1/user/-/profile.json',
        method: 'GET'
      },
      function(err, body, token) {
        if (err) return next(err);
        var profile = JSON.parse(body);
        //console.log(profile);

        // if token is not null, a refesh has happened and we need to persist the new token
        if (token)
          persist.write(tfile, token, function(err) {
            if (err) return next(err);
            res.send(JSON.stringify(profile));
          });
        else res.send(JSON.stringify(profile));
      }
    );
  });
});

app.get('/hr-data', function(req, res, next) {
  
  let token = persist.read(tfile, function(err, token) {
    if (err) {
      console.log(err);
      res.redirect(fitbit.authorizeURL());
    }

    // Set the client's token
    fitbit.setToken(token);

    fitbit.request(
      {
        uri:
          'https://api.fitbit.com/1/user/-/activities/heart/date/today/1d/1min/time/00:00/23:59.json',
        method: 'GET'
      },
      function(err, body, token) {
        res.set('Access-Control-Allow-Origin', '*');
        if (err) return next(err);
        var heartRate = JSON.parse(body);
        // if token is not null, a refesh has happened and we need to persist the new token
        if (token)
          persist.write(tfile, token, function(err) {
            if (err) return next(err);
            res.send(JSON.stringify(heartRate));
          });
        else res.send(JSON.stringify(heartRate));
      }
    );
  });
});
//api.fitbit.com/1/user/-/activities/calories/date/today/1d/1sec/time/00:00/23:59.json.
app.get('/steps-taken', function(req, res, next) {
  let token = persist.read(tfile, function(err, token) {
    if (err) {
      console.log(err);
      res.redirect(fitbit.authorizeURL());
    }

    // Set the client's token
    fitbit.setToken(token);

    fitbit.request(
      {
        uri:
          'https://api.fitbit.com/1/user/-/activities/steps/date/today/1d/1min/time/00:00/23:59.json',
        method: 'GET'
      },
      function(err, body, token) {
        res.set('Access-Control-Allow-Origin', '*');
        if (err) return next(err);
        var steps = JSON.parse(body);
        // if token is not null, a refesh has happened and we need to persist the new token
        if (token)
          persist.write(tfile, token, function(err) {
            if (err) return next(err);
            res.send(JSON.stringify(steps));
          });
        else res.send(JSON.stringify(steps));
      }
    );
  });
});

app.post('/login', 
  function(req, res, next) {
    console.log('Posted the post');
    req.body.data
    res.set('Access-Control-Allow-Origin', 'http://localhost:3001');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    // res.set('Content-Type', 'application/json');
    // res.set('Accept', 'application/json');
    return next();
  },
  passport.authenticate('local'),
  function(req, res) {
    let user = {error: 'Invalid Credentials'};
    if (req.user) {
      user = req.user;
    }
    console.log('sending', user);
    res.send(JSON.stringify(user));
  });

  app.get('/logout', function(req, res){
    console.log('logging out');
    req.logout();
    res.send(JSON.stringify({}));
  });

  app.get('/currentuser', function(req, res) {
    let user = {};
    if (req.user) {
      user = req.user;
    }
    console.log('sending', user);
    res.send(JSON.stringify(user));
  });
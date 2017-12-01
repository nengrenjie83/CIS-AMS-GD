/*eslint-env   node*/

//------------------------------------------------------------------------------
// node.js starter application for Bluemix
//------------------------------------------------------------------------------

// This application uses express as its web server
// for more info, see: http://expressjs.com
var express = require('express');
var session = require('express-session');
// cfenv provides access to your Cloud Foundry environment
// for more info, see: https://www.npmjs.com/package/cfenv
//var cfenv = require('cfenv');
var path = require('path');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var routes = require('./routes/index');
var users = require('./routes/users');
var login = require('./routes/login');
var register = require('./routes/register');
var tasks = require('./routes/tasks');
var logout = require('./routes/logout');
var manageflow = require('./routes/manageflow');
var watson = require('./routes/watson');

//var manage = require('./routes/manage');
var processcon = require('./routes/process');
var feedback = require('./routes/feedback');

// create a new express server
var app = express();
var https = require('https');
var http = require('http');
var port = (process.env.VCAP_APP_PORT || 8000);
var ports = (process.env.VCAP_APP_PORTS || 1443);
var httpServer = http.createServer(app);
httpServer.listen(port, function(){
	console.log('app listening on http:' + port);
});
var io = require("socket.io").listen(httpServer);
io.sockets.on('connection', function (socket) {
	console.log('An user connected');
	console.log('connection, socket id: ', socket.id);
	io.emit('messages', 'Welcome to join!');//to all including self
	require('./web_socket')(io,socket);
});

var isBluemix = (process.env.ENV_BLUEMIX || false);

if (!isBluemix) {
	//process.env.CLOUDANT_URL = process.env.VCAP_SERVICE.url;
}else{
	if (!process.env.CLOUDANT_URL) {
	  console.error("Please put the URL of your Cloudant instance in an environment variable 'CLOUDANT_URL'")
	  process.exit(1)
	}
}


app.set('views', path.join(__dirname, 'views'));
//app.set('view engine', 'ejs');
app.engine('.html', require('ejs').renderFile);  
app.set('view engine', 'html');


// serve the files out of ./public as our main files
//app.use(express.static(__dirname + '/public'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser('sctalk admin manager'));

app.use(session({
	secret:"testkanban",
	resave: true,
    saveUninitialized: true,
	cookie:{maxAge:1000*60*60}
}));

/**
var CloudantStore = require('connect-cloudant')(session);
var cloudantStore = new CloudantStore({
     url: process.env.CLOUDANT_URL, //required
     databaseName: 'sessions',  //optional
     ttl: 86400,                 //optional
     prefix: 'sess',             //optional
     operationTimeout:2000,      //optional
     connectionTimeout:2000,      //optional
}); 
cloudantStore.on('connect', function() {
    console.log("Cloudant Session store is ready for use");
});
 
cloudantStore.on('disconnect', function() {
    console.log("An error occurred connecting to Cloudant Session Storage");
});
app.use(session({
    store: cloudantStore,
    secret: 'mykanban',
	resave: true,
    saveUninitialized: true,
    cookie: {maxAge:24*60*60*1000} //stay open for 1 day of inactivity
}));
**/

app.use(express.static(path.join(__dirname, 'public')));
app.use('/', routes);
app.use('/users', users);
app.use('/login', login);
app.use('/register', register);
app.use('/tasks', tasks);
app.use('/manageflow', manageflow);
//app.use('/manage', manage);
app.use('/logout', logout);
app.use('/process', processcon);
app.use('/watson', watson);
app.use('/feedback', feedback);

// get the app environment from Cloud Foundry
//var appEnv = cfenv.getAppEnv();


// start server on the specified port and binding host
//app.listen(appEnv.port, '0.0.0.0', function() {
  // print a message when the server starts listening
  //console.log("server starting on " + appEnv.url);
//});

// MySQL test
/**
var mysql = require('mysql');
var conn = mysql.createConnection({
    host: '199.79.62.196',
    user: 'syhyhqjb_kanban',
    password: 'testkanban',
    database:'syhyhqjb_kanban',
    port: 3306
});
conn.connect();
conn.query('SELECT 1 + 2 AS solution', function(err, rows, fields) {
    if (err) throw err;
    console.log('The solution is: ', rows[0].solution);
});
conn.end();


var session = require('express-session');
var MySQLStore = require('express-mysql-session')(session);
var options = {
    host: '199.79.62.196',
    port: 3306,
    user: 'syhyhqjb_kanban',
    password: 'testkanban',
    database: 'syhyhqjb_kanban'
};

var sessionStore = new MySQLStore(options);
app.use(session({
    key: 'session_cookie_name',
    secret: 'session_cookie_secret',
    store: sessionStore,
    resave: true,
    saveUninitialized: true
}));
**/


// Insert User
/**
User
  .build({ user_id: 'test', user_password: 'aaa'})
  .save()
  .then(function(anotherTask) {
    // you can now access the currently saved task with the variable anotherTask... nice!
	console.log("saved");
  }).catch(function(error) {
    // Ooops, do some error-handling
  })

var sequelize = new Sequelize('syhyhqjb_kanban', 'syhyhqjb_kanban', 'testkanban', {
  host: 'localhost',
  dialect: 'mysql',

  pool: {
    max: 5,
    min: 0,
    idle: 10000
  }
});
*/
//var sequelize = new Sequelize('mysql://syhyhqjb_kanban:wang2008@localhost:3306/syhyhqjb_kanban');


const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');

//var routes = require('./routes/index');
//var users = require('./routes/users');

const app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

//app.use('/', routes);
//app.use('/users', users);

/*
app.post('/analyze', function(req, res, next){
  console.log("starting process at: " + req.body.url);
  youtube_download.grabFrames(req.body.url, function(data){
    console.log(data);
    res.send(
      [{name: 'Sui Lu', start: 193, end: 375},
      {name: 'Catalina Ponor', start: 389, end: 566},
      {name: 'Deng Linlin', start: 581, end: 779},
      {name: 'Larisa Andreea Iordache', start: 800, end: 959},
      {name: 'Kseniia Afanaseva', start: 972, end: 1162},
      {name: 'Gabrielle Douglas', start: 1189, end: 1453},
      {name: 'Victoria Komova', start: 1470, end: 1742},
      {name: 'Alexandra Raisman', start: 1766, end: 1969}
        ]
    )
  })
});
*/


app.get('/', (req, res) => {
  res.render('index');
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  const err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});


module.exports = app;

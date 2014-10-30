var app = require('express')();
var Mongo = require('mongodb');
var config = require(__dirname + '/config/config.js');
var jade = require('jade');
var dns = require('dns');

var mongoClient = new Mongo.MongoClient(
  new Mongo.Server(config.db.host, config.db.port)
);
var db = mongoClient.db(config.db.name);


// open connection to mongo
mongoClient.open(function(err, mongoClient) {
  if (err) {
    console.log(err);
  }
});

app.enable('trust proxy');
app.get('/food', function(req, res) {
  var url = req.protocol + '://' +
            req.headers.host +
            req.originalUrl;
  var response = {
    self: url,
    total_foods: null,
    foods: []
  };

  var terms = [];
  if (req.query.name !== undefined) {
    var singleWord = (req.query.name.match(':') === null);
    var matchStart = (req.query.match_start === 'true');

    if (singleWord && matchStart) {
      terms.push({name: new RegExp('^' + req.query.name)});
    } else {
        req.query.name.split(':').forEach(function(term) {
        terms.push({name: new RegExp(term)});
      });
    }
  } else {
    terms.push({});
  }

  db.collection('data')
    .find({$and: terms}, {_id: false, sugar: false})
    .toArray(function(err, data) {
      response.total_foods = data.length;
      data.forEach(function(food) {
        response.foods.push(food);
      });
      res
        .set({'Content-Type': 'application/json'})
        .status(200)
        .send(JSON.stringify(response));
    });

  dns.reverse(req.ip, function(err, data) {
      db.collection('requests').insert(
        {
          timestamp: new Date(),
          ip: req.ip,
          reverseDNS: data[0],
          request: response.self
        },
        function(err, data) {
          if (err) {
            console.error(err);
          }
        }
      );
  });
});

app.get('*', function(req, res) {
  res
    .status(404)
    .send(jade.renderFile(
      __dirname + '/views/usage.jade',
      {url: req.protocol + '://' + req.headers.host}
    ))
    .end();
});

app.listen(config.app.port, config.app.ip);

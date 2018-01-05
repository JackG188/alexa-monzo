'use strict';

let express = require('express'),
    bodyParser = require('body-parser'),
    verify = require('./verify'),
    monzo = require('./monzo');

let app = express();

app.set('port', process.env.PORT || 3000);

app.use(express.static('public'));

app.use(bodyParser.json({
    verify: function getRawBody(req, res, buf) {
        req.rawBody = buf.toString();
    }
}));


app.get('/', function(req, res) {
    res.json({ message: 'The monzo skill is up and running.', since: (new Date()).toString() });
});
app.post('/monzo', verify, monzo);


app.listen(app.get('port'), function() {
    console.log('Monzo skill is up and running on port %d', app.get('port'));
});

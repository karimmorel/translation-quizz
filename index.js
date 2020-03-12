var express = require('express');
var session = require('express-session');
var mysql      = require('mysql');
var connection = mysql.createConnection({
  host     : '127.0.0.1',
  user     : 'root',
  password : 'root',
  database : 'translate_trainer',
  port     : '8889'
});
 
var app = express();

var bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
app.set('trust proxy', 1) // trust first proxy
app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true
}))

app.use(express.static(__dirname + '/assets'));

app.use(function (req, res, next) {
    // List of ids already responded
    if (!req.session.respondedids) {
        req.session.respondedids = [];
    }
    // Id of the actual word
    if(!req.session.intActualId) {
        req.session.intActualId = null;
    }
    // Response set by the guesser
    if(!req.session.strActualGuess) {
        req.session.strActualGuess = null;
    }
    next()
  })

  function setIdToSession(boolAddId, req, res, strActualGuess) 
  {
      if(boolAddId)
      {
          req.session.respondedids.push(req.params.id);
          req.session.intActualId = null;
          req.session.strActualGuess = null;
      }
      else
      {
          req.session.strActualGuess = strActualGuess;
      }
      res.redirect('/test/'+req.params.language);
  }

  function addIdToSessionOrNot(callback, language, response, id, req, res) { connection.query('SELECT * FROM translation WHERE id = '+id, function (error, results, fields) {
    var boolAddId = false;
    if (error) throw error;
    if(language == 'en')
    {
        if(results[0].french == response)
        {
            boolAddId = true;
        }
    }
    else if(language == 'fr')
    {
        if(results[0].english == response)
        {
            boolAddId = true;
        }
    }
    if(req && res)
    {
        callback(boolAddId, req, res, response);
    }
  });
} 


app.get('/', function(req, res){
    let arrTranslationList = connection.query('SELECT * FROM translation', function (error, results, fields) {
        if (error) throw error;
        res.setHeader('Content-type', 'text/html');
        res.render('index.ejs', {words : results});
      });
})
.post('/', function(req, res){

    var newFrenchWord = req.body.frenchword;
    var newEnglishWord = req.body.englishword;

    // Use MySQL
    connection.query('INSERT INTO translation (english, french) VALUES (\''+newEnglishWord+'\', \''+newFrenchWord+'\')', function (error, results, fields) {
        if (error) throw error;
    });

    // Redirection
    res.redirect('/');
})
.get('/delete/:strKeyToDelete', function(req, res){
    res.setHeader('Content-type', 'text/html');

    let deleteQuery = connection.query('DELETE FROM translation WHERE id = '+req.params.strKeyToDelete, function (error, results, fields) {
        if (error) throw error;
    });

    // Redirection
    res.redirect('/');
})
.get('/test/:language', function(req, res){
    res.setHeader('Content-type', 'text/html');

    let arrTranslationList = connection.query('SELECT * FROM translation', function (error, results, fields) {
        if (error) throw error;

    var intActualId = req.session.intActualId;
    var strActualGuess = req.session.strActualGuess;

    // Get a random word
    var arrRandomList = [];
    for (var key in results)
    {
        if (intActualId == null)
        {
            var strResultId = results[key].id.toString();
            var boolIfIncludes = req.session.respondedids.includes(strResultId)
            if(!boolIfIncludes)
            {
                arrRandomList.push(results[key]);
            }
        }
        else
        {
            if (intActualId == results[key].id)
            {
                arrRandomList.push(results[key]);
            }
        }
        
    }

    var arrWordToGuess = arrRandomList[Math.floor(Math.random() * arrRandomList.length)];

    // Compteur de mot côté vue
    var arrFullCount = results.length;
    var arrRandomCount = req.session.respondedids.length;

    if(arrWordToGuess)
    {
        req.session.intActualId = arrWordToGuess.id;

    // Render
    if (req.params.language == "en")
    {
        res.render('test.ejs', {language : req.params.language, wordtoguess : arrWordToGuess.english, response : arrWordToGuess.french, id : arrWordToGuess.id, arrFullCount : arrFullCount, arrRandomCount : arrRandomCount, strGuess : strActualGuess});
    }
    else if (req.params.language == "fr")
    {
        res.render('test.ejs', {language : req.params.language, wordtoguess : arrWordToGuess.french, response : arrWordToGuess.english, id : arrWordToGuess.id, arrFullCount : arrFullCount, arrRandomCount : arrRandomCount, strGuess : strActualGuess});
    }
}
else
{
    res.redirect('/end/'+req.params.language);
}
});  
})
.get('/response/:id/:language', function(req, res){

    if(req.query.response)
    {
        addIdToSessionOrNot(setIdToSession, req.params.language, req.query.response, req.params.id, req, res);
    }
    else
    {
        res.redirect('/test/'+req.params.language);
    }

})
.get('/reboot/:language', function(req, res){
    res.setHeader('Content-Type', 'text/html');
    req.session.respondedids = [];

    res.redirect('/test/'+req.params.language);
})
.get('/end/:language', function(req, res){
    res.setHeader('Content-Type', 'text/html');
    res.render('end.ejs', {language : req.params.language});
})
.use(function(req, res, next){
    res.setHeader('Content-Type', 'text/html');
    res.status(404).send('Error, page not found !');
});

var server = require('http').createServer(app);
var io = require('socket.io').listen(server);

io.on('connection', function (socket) {
    socket.on('submit-response', function (data) {
      console.log(data);
    });
  });

  server.listen('8080');
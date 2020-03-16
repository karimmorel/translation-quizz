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
    if (!session.respondedids) {
        session.respondedids = [];
    }
    // Id of the actual word
    if(!session.intActualId) {
        session.intActualId = null;
    }
    // Response set by the guesser
    if(!session.strActualGuess) {
        session.strActualGuess = null;
    }
    next()
  })

  function setIdToSession(boolAddId, language, response, id, res) 
  {

    if(res)
      {
        res.redirect('/test/'+language);
      }

      if(boolAddId)
      {
          session.respondedids.push(id);
          session.intActualId = null;
          session.strActualGuess = null;
          return true;
      }
      else
      {
          session.strActualGuess = response;
        return false;
      }

  }

  function addIdToSessionOrNot(callback, language, response, id, res) { connection.query('SELECT * FROM translation WHERE id = '+id, function (error, results, fields) {
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

            var boolReturn = callback(boolAddId, language, response, id, res);
            if(boolReturn == true)
            {
                return true;
            }
            else
            {
                return false;
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

    var intActualId = session.intActualId;
    var strActualGuess = session.strActualGuess;

    // Get a random word
    var arrRandomList = [];
    for (var key in results)
    {
        if (intActualId == null)
        {
            var strResultId = results[key].id.toString();
            var boolIfIncludes = session.respondedids.includes(strResultId)
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
    var arrRandomCount = session.respondedids.length;

    if(arrWordToGuess)
    {
        session.intActualId = arrWordToGuess.id;

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
        addIdToSessionOrNot(setIdToSession, req.params.language, req.query.response, req.params.id, res);
    }
    else
    {
        res.redirect('/test/'+req.params.language);
    }

})
.get('/reboot/:language', function(req, res){
    res.setHeader('Content-Type', 'text/html');
    session.respondedids = [];

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
    socket.on('submit-answer', function (data) {
      console.log(data);

        // Get data
        var strLanguage = data.language;
        var intId = data.id;
        var strAnswer = data.answer;


        var objReturnedData = {response : strAnswer, id : intId, language : strLanguage};


        // If Good or Wrung Answer
        var boolAnswer = addIdToSessionOrNot(setIdToSession, strLanguage, strAnswer, intId, null);


        // J'EN SUIS À RENVOYER LES ÉVÉNEMENTS good-answer ET wrong-answer
        // JE DOIS CRÉER UN CALLBACK POUR LES DÉCLENCHER CAR POUR LE MOMENT boolAnswser (l.230) EST TOUJOURS UNDEFINED
        // JE DOIS DONC FAIRE UN CALLBACK POUR QUE CELUI-CI SOIT APPELÉ À LA FIN DE L'EXÉCUTION DE addIdToSessionOrNot()

        console.log('JE RETOURNE CETTE VALEUR : '+boolAnswer);

        if (boolAnswer) {
            socket.emit('good-answer', objReturnedData);
        }
        else {
            socket.emit('wrong-answer', objReturnedData);
        }
        
    });
  });

  server.listen('8080');
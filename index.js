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
    if(!session.intCorrectAnswers) {
        session.intCorrectAnswers = 0;
    }
    if(!session.intWrongAnswers) {
        session.intWrongAnswers = 0;
    }

    // Variables for the quizz with limited amout of words
    if(!session.strActualGuessLimited) {
        session.strActualGuessLimited = null;
    }
    if(!session.respondedidsLimited) {
        session.respondedidsLimited = [];
    }
    if(!session.intActualIdLimited) {
        session.intActualIdLimited = null;
    }
    if(!session.wordsToGuessLimited) {
        session.wordsToGuessLimited = [];
    }
    if(!session.numberofwordsLimited) {
        session.numberofwordsLimited = null;
    }
    if(!session.intCorrectAnswersLimited) {
        session.intCorrectAnswersLimited = 0;
    }
    if(!session.intWrongAnswersLimited) {
        session.intWrongAnswersLimited = 0;
    }


    next()
  })

  function setIdToSession(boolAddId, language, response, id, boolAnswerAsked, res, boolLimited = false) 
  {
      if(boolLimited == true)
      {
          var respondedids = session.respondedidsLimited;
      }
      else
      {
        var respondedids = session.respondedids;
      }

    if(res)
      {
        res.redirect('/test/'+language);
      }

      if(boolAddId)
      {
          if(!respondedids.includes(id))
          {
              if(!boolAnswerAsked)
              {
                //If the user does not click on the "Ask the answer" button -->  Update number of good answer for this word
                connection.query('UPDATE translation SET answered = answered + 1 WHERE id = '+id, function (error, results, fields) {
                    if (error) throw error;
                    if(boolLimited == false)
                    {
                        session.intCorrectAnswers = session.intCorrectAnswers + 1;
                    }
                    else
                    {
                        session.intCorrectAnswersLimited = session.intCorrectAnswersLimited + 1;
                    }
                });
              }
              else
              {
                  //If the user click on the "Ask the answer" button -->  Update number of failed answer for this word
                connection.query('UPDATE translation SET failed = failed + 1 WHERE id = '+id, function (error, results, fields) {
                    if (error) throw error;
                    if(boolLimited == false)
                    {
                        session.intWrongAnswers = session.intWrongAnswers + 1;
                    }
                    else
                    {
                        session.intWrongAnswersLimited = session.intWrongAnswersLimited + 1;
                    }
                });
              }
            

              // Set session values differently if quizz with amount or without amount
              if(boolLimited == true)
              {
                session.respondedidsLimited.push(id);
                session.intActualIdLimited = null;
                session.strActualGuessLimited = null;
              }
              else
              {
                session.respondedids.push(id);
                session.intActualId = null;
                session.strActualGuess = null;
              }
          }
          return true;
      }
      else
      {
        if(boolLimited == true)
        {
            session.strActualGuessLimited = response;
        }
        else
        {
            session.strActualGuess = response;
        }
        return false;
      }

  }

  function addIdToSessionOrNot(callback, language, response, id, boolAnswerAsked, res, socket = null, boolLimited = false, numberofwords = null) { connection.query('SELECT * FROM translation WHERE id = '+id, function (error, results, fields) {
    var boolAddId = false;
    if (error) throw error;
    if(language == 'en')
    {
        if(results[0].main_language_translation.toLowerCase() == response.toLowerCase())
        {
            boolAddId = true;
        }
    }
    else if(language == 'fr')
    {
        if(results[0].focused_language_translation.toLowerCase() == response.toLowerCase())
        {
            boolAddId = true;
        }
    }

            var boolReturn = callback(boolAddId, language, response, id, boolAnswerAsked, res, boolLimited);

            if(res == null)
            {
            if(boolReturn == true)
            {
                if(boolLimited == true)
                {
                    newWordToGuessWithLimitedAmount(null, null, numberofwords, socket, language);
                }
                else
                {
                    newWordToGuess(null, null, socket, language);
                }
            }
            else
            {
                socket.emit('wrong-answer');
            }
        }
            
  });
} 



function newWordToGuess (res, req, socket = null, language = null) {
    let arrTranslationList = connection.query('SELECT * FROM translation WHERE language_id = (SELECT id FROM language WHERE slug = \''+language+'\' LIMIT 1)', function (error, results, fields) {
        if (error) throw error;

    var intActualId = session.intActualId;
    var strActualGuess = session.strActualGuess;

    // Get a random word
    var arrRandomList = [];
    for (var key in results)
    {
        if (intActualId == null)
        {
            var strResultId = results[key].id;
            var boolIfIncludes = session.respondedids.includes(strResultId);
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
    if(res && req)
    {
        res.render('test.ejs', {language : req.params.language, wordtoguess : arrWordToGuess.focused_language_translation, response : arrWordToGuess.main_language_translation, id : arrWordToGuess.id, arrFullCount : arrFullCount, arrRandomCount : arrRandomCount, strGuess : strActualGuess, limited : false, intCorrectAnswers : session.intCorrectAnswers, intWrongAnswers : session.intWrongAnswers});

    }
    else
    {
        arrWordToGuess.total = arrFullCount;
        arrWordToGuess.count = arrRandomCount;
        arrWordToGuess.intCorrectAnswers = session.intCorrectAnswers;
        arrWordToGuess.intWrongAnswers = session.intWrongAnswers;
        socket.emit('good-answer', arrWordToGuess);
    }
}
else
{
    if(res && req)
    {
        res.redirect('/end/'+req.params.language);
    }
    else
    {
        socket.emit('end-of-the-quizz');
    }
}
});  
}


function newWordToGuessWithLimitedAmount (res, req, numberofwords, socket = null, language = null) {
    connection.query('SELECT * FROM translation WHERE language_id = (SELECT id FROM language WHERE slug = \''+language+'\' LIMIT 1) ORDER BY answered ASC, failed DESC LIMIT '+numberofwords, function (error, results, fields) {
        if (error) throw error;

    var intActualId = session.intActualIdLimited;
    var strActualGuess = session.strActualGuessLimited;
    var wordsToGuess = session.wordsToGuessLimited;
    var respondedids = session.respondedidsLimited;
    var sessionNumberofwords = session.numberofwordsLimited;

    if(sessionNumberofwords == null)
    {
        session.numberofwordsLimited = numberofwords;
    }
    else if(sessionNumberofwords != numberofwords)
    {
        res.redirect('/reboot/'+req.params.language+'/'+numberofwords);
        session.numberofwordsLimited = null;
        return;
    }

    if(!wordsToGuess.length > 0)
    {
        session.wordsToGuessLimited = results;
    }
    else
    {
        results = wordsToGuess;
    }

    // Get a random word
    var arrRandomList = [];
    for (var key in results)
    {
        if (intActualId == null)
        {
            var strResultId = results[key].id;
            var boolIfIncludes = respondedids.includes(strResultId);
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
    var arrRandomCount = respondedids.length;

    if(arrWordToGuess)
    {
        session.intActualIdLimited = arrWordToGuess.id;

    // Render
    if(res && req)
    {
    if (req.params.language == "en")
    {
        res.render('test.ejs', {language : req.params.language, wordtoguess : arrWordToGuess.focused_language_translation, response : arrWordToGuess.main_language_translation, id : arrWordToGuess.id, arrFullCount : arrFullCount, arrRandomCount : arrRandomCount, strGuess : strActualGuess, limited : true, numberofwords : numberofwords, intCorrectAnswers : session.intCorrectAnswersLimited, intWrongAnswers : session.intWrongAnswersLimited});
    }
    else if (req.params.language == "fr")
    {
        res.render('test.ejs', {language : req.params.language, wordtoguess : arrWordToGuess.main_language_translation, response : arrWordToGuess.focused_language_translation, id : arrWordToGuess.id, arrFullCount : arrFullCount, arrRandomCount : arrRandomCount, strGuess : strActualGuess, limited : true, numberofwords : numberofwords, intCorrectAnswers : session.intCorrectAnswersLimited, intWrongAnswers : session.intWrongAnswersLimited});
    }
    }
    else
    {
        arrWordToGuess.total = arrFullCount;
        arrWordToGuess.count = arrRandomCount;
        arrWordToGuess.intCorrectAnswers = session.intCorrectAnswersLimited;
        arrWordToGuess.intWrongAnswers = session.intWrongAnswersLimited;
        socket.emit('good-answer', arrWordToGuess);
    }
}
else
{
    if(res && req)
    {
        res.redirect('/end/'+req.params.language+'/'+numberofwords);
    }
    else
    {
        socket.emit('end-of-the-quizz');
    }
}
});  
}


app.get('/:language', function(req, res){

    let arrTranslationList = connection.query('SELECT translation.*, language.name, language.slug FROM translation INNER JOIN language ON translation.language_id = language.id WHERE translation.language_id = (SELECT id FROM language WHERE slug = \''+req.params.language+'\' LIMIT 1)', function (error, results, fields) {
        if (error) throw error;
        res.setHeader('Content-type', 'text/html');
        res.render('index.ejs', {words : results, language : req.params.language});
      });
})
.post('/:language', function(req, res){

    var newFrenchWord = req.body.frenchword.replace(/'/g, "\\'");
    var newEnglishWord = req.body.englishword.replace(/'/g, "\\'");

    // Use MySQL
    connection.query('INSERT INTO translation (focused_language_translation, main_language_translation, language_id) VALUES (\''+newEnglishWord+'\', \''+newFrenchWord+'\', (SELECT id FROM language WHERE slug = \''+req.params.language+'\' LIMIT 1))', function (error, results, fields) {
        if (error) throw error;
    });

    // Redirection
    res.redirect('/'+req.params.language);
})
app.get('/languages', function(req, res){
    let arrTranslationList = connection.query('SELECT * FROM language', function (error, results, fields) {
        if (error) throw error;
        res.setHeader('Content-type', 'text/html');
        res.render('language.ejs', {languages : results});
      });
})
.post('/languages', function(req, res){

    var strName = req.body.name.replace(/'/g, "\\'");
    var strSlug = req.body.slug.replace(/'/g, "\\'");

    // Use MySQL
    connection.query('INSERT INTO language (name, slug) VALUES (\''+strName+'\', \''+strSlug+'\')', function (error, results, fields) {
        if (error) throw error;
    });

    // Redirection
    res.redirect('/languages');
})
.get('/language/delete/:strKeyToDelete', function(req, res){
    res.setHeader('Content-type', 'text/html');

    let deleteQuery = connection.query('DELETE FROM language WHERE id = '+req.params.strKeyToDelete, function (error, results, fields) {
        if (error) throw error;
    });

    // Redirection
    res.redirect('/languages');
})
.get('/delete/:language/:strKeyToDelete', function(req, res){
    res.setHeader('Content-type', 'text/html');

    let deleteQuery = connection.query('DELETE FROM translation WHERE id = '+req.params.strKeyToDelete, function (error, results, fields) {
        if (error) throw error;
    });

    // Redirection
    res.redirect('/'+req.params.language);
})
.get('/test/:language', function(req, res){
    res.setHeader('Content-type', 'text/html');

    newWordToGuess (res, req, null, req.params.language);
})
.get('/test/:language/:numberofwords', function(req, res){
    res.setHeader('Content-type', 'text/html');
    if(Number.isInteger(parseInt(req.params.numberofwords)))
    {
        newWordToGuessWithLimitedAmount (res, req, req.params.numberofwords, null, req.params.language);
    }
    else
    {
        res.redirect('/test/'+req.params.language+'/'+req.params.numberofwords);
    }
})
.get('/response/:id/:language', function(req, res){

    if(req.query.response)
    {
        addIdToSessionOrNot(setIdToSession, req.params.language, req.query.response, parseInt(req.params.id), req.query.answerasked, res);
    }
    else
    {
        res.redirect('/test/'+req.params.language);
    }

})
.get('/reboot/:language', function(req, res){
    res.setHeader('Content-Type', 'text/html');
    session.respondedids = [];
    session.intCorrectAnswers = 0;
    session.intWrongAnswers = 0;

    res.redirect('/test/'+req.params.language);
})
.get('/reboot/:language/:numberofwords', function(req, res){
    res.setHeader('Content-Type', 'text/html');
    session.respondedidsLimited = [];
    session.wordsToGuessLimited = [];
    session.intActualIdLimited = null;
    session.strActualGuessLimited = null;
    session.intCorrectAnswersLimited = 0;
    session.intWrongAnswersLimited = 0;

    res.redirect('/test/'+req.params.language+'/'+req.params.numberofwords);
})
.get('/end/:language', function(req, res){
    res.setHeader('Content-Type', 'text/html');
    res.render('end.ejs', {language : req.params.language});
})
.get('/end/:language/:numberofwords', function(req, res){
    res.setHeader('Content-Type', 'text/html');
    res.render('end.ejs', {language : req.params.language, numberofwords : req.params.numberofwords});
})
.use(function(req, res, next){
    res.setHeader('Content-Type', 'text/html');
    res.status(404).send('Error, page not found !');
});

var server = require('http').createServer(app);
var io = require('socket.io').listen(server);

io.on('connection', function (socket) {
    socket.on('submit-answer', function (data) {

        // Get data
        var strLanguage = data.language;
        var intId = data.id;
        var strAnswer = data.answer;
        var boolAnswerAsked = data.boolanswerasked;

        // Process with the answer sent
        addIdToSessionOrNot(setIdToSession, strLanguage, strAnswer, intId, boolAnswerAsked, null, socket);

    });

    socket.on('submit-answer-limited', function (data) {

        // Get data
        var strLanguage = data.language;
        var intId = data.id;
        var strAnswer = data.answer;
        var boolAnswerAsked = data.boolanswerasked;
        var numberofwords = data.numberofwords;

        // Process with the answer sent
        addIdToSessionOrNot(setIdToSession, strLanguage, strAnswer, intId, boolAnswerAsked, null, socket, true, numberofwords);
    });
  });

  server.listen('8080');
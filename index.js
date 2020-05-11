var express = require('express');
var session = require('express-session');
var mysql      = require('mysql');

var connection = mysql.createConnection({
  host     : '127.0.0.1',
  user     : 'root',
  password : 'root',
  database : 'translate_trainer',
  port     : '8889',
  multipleStatements: true
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

    if(!session.user_main_language) {
        session.user_main_language = 'SELECT * FROM language WHERE main_language = 1;';
    }

    // List of ids already responded
    if (!session.respondedids) {
        session.respondedids = [];
    }
    // Id of the actual word
    if(!session.intActualId) {
        session.intActualId = [];
    }
    // Response sent by the guesser
    if(!session.strActualGuess) {
        session.strActualGuess = [];
    }
    if(!session.intCorrectAnswers) {
        session.intCorrectAnswers = [];
    }
    if(!session.intWrongAnswers) {
        session.intWrongAnswers = [];
    }

    // Variables for the quizz with limited amout of words

    if(!session.strActualGuessLimited) {
        session.strActualGuessLimited = [];
    }
    if(!session.respondedidsLimited) {
        session.respondedidsLimited = [];
    }
    if(!session.intActualIdLimited) {
        session.intActualIdLimited = [];
    }
    if(!session.wordsToGuessLimited) {
        session.wordsToGuessLimited = [];
    }
    if(!session.numberofwordsLimited) {
        session.numberofwordsLimited = [];
    }
    if(!session.intCorrectAnswersLimited) {
        session.intCorrectAnswersLimited = [];
    }
    if(!session.intWrongAnswersLimited) {
        session.intWrongAnswersLimited = [];
    }
    next()
  })

  function setIdToSession(boolAddId, language, response, id, boolAnswerAsked, res, boolLimited = false) 
  {
      if(boolLimited == true)
      {
          var respondedids = session.respondedidsLimited[language];
      }
      else
      {
        var respondedids = session.respondedids[language];
      }

      // If Number of good and wrong answers not set
      if(session.intCorrectAnswers[language] == null)
      {
        session.intCorrectAnswers[language] = 0;
      }
      if(session.intWrongAnswers[language] == null)
      {
        session.intWrongAnswers[language] = 0;
      }

      // Set Limited too
      if(session.intCorrectAnswersLimited[language] == null)
      {
        session.intCorrectAnswersLimited[language] = 0;
      }
      if(session.intWrongAnswersLimited[language] == null)
      {
        session.intWrongAnswersLimited[language] = 0;
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
                        session.intCorrectAnswers[language] = session.intCorrectAnswers[language] + 1;
                    }
                    else
                    {
                        session.intCorrectAnswersLimited[language] = session.intCorrectAnswersLimited[language] + 1;
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
                        session.intWrongAnswers[language] = session.intWrongAnswers[language] + 1;
                    }
                    else
                    {
                        session.intWrongAnswersLimited[language] = session.intWrongAnswersLimited[language] + 1;
                    }
                });
              }
            

              // Set session values differently if quizz with amount or without amount
              if(boolLimited == true)
              {
                session.respondedidsLimited[language].push(id);
                session.intActualIdLimited[language] = null;
                session.strActualGuessLimited[language] = null;
              }
              else
              {
                session.respondedids[language].push(id);
                session.intActualId[language] = null;
                session.strActualGuess[language] = null;
              }
          }
          return true;
      }
      else
      {
        if(boolLimited == true)
        {
            session.strActualGuessLimited[language] = response;
        }
        else
        {
            session.strActualGuess[language] = response;
        }
        return false;
      }

  }

  function addIdToSessionOrNot(callback, language, response, id, boolAnswerAsked, res, socket = null, boolLimited = false, numberofwords = null) { connection.query('SELECT * FROM translation WHERE id = '+id, function (error, results, fields) {
    var boolAddId = false;
    if (error) throw error;

        if(results[0].main_language_translation.toLowerCase() == response.toLowerCase())
        {
            boolAddId = true;
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
    let arrTranslationList = connection.query('SELECT * FROM translation WHERE active = 1 AND language_id = (SELECT id FROM language WHERE slug = \''+language+'\' LIMIT 1)', function (error, results, fields) {
        if (error) throw error;

    var intActualId = session.intActualId[language];
    var strActualGuess = session.strActualGuess[language];

    if (session.respondedids[language] == null)
    {
        session.respondedids[language] = [];
    }
    if (session.intCorrectAnswers[language] == null)
    {
        session.intCorrectAnswers[language] = 0;
    }
    if (session.intWrongAnswers[language] == null)
    {
        session.intWrongAnswers[language] = 0;
    }

    // Get a random word
    var arrRandomList = [];
    for (var key in results)
    {
        if (intActualId == null)
        {
            var strResultId = results[key].id;
            var boolIfIncludes = session.respondedids[language].includes(strResultId);
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
    var arrRandomCount = session.respondedids[language].length;

    if(arrWordToGuess)
    {
        session.intActualId[language] = arrWordToGuess.id;

    // Render
    if(res && req)
    {
        res.render('test.ejs', {language : req.params.language, wordtoguess : arrWordToGuess.focused_language_translation, response : arrWordToGuess.main_language_translation, id : arrWordToGuess.id, arrFullCount : arrFullCount, arrRandomCount : arrRandomCount, strGuess : strActualGuess, limited : false, intCorrectAnswers : session.intCorrectAnswers[language], intWrongAnswers : session.intWrongAnswers[language]});

    }
    else
    {
        arrWordToGuess.total = arrFullCount;
        arrWordToGuess.count = arrRandomCount;
        arrWordToGuess.intCorrectAnswers = session.intCorrectAnswers[language];
        arrWordToGuess.intWrongAnswers = session.intWrongAnswers[language];
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
    connection.query('SELECT * FROM translation WHERE active = 1 AND language_id = (SELECT id FROM language WHERE slug = \''+language+'\' LIMIT 1) ORDER BY answered ASC, failed DESC LIMIT '+numberofwords, function (error, results, fields) {
        if (error) throw error;

    if(session.respondedidsLimited[language] == null)
    {
        session.respondedidsLimited[language] = [];
    }
    if(session.wordsToGuessLimited[language] == null)
    {
        session.wordsToGuessLimited[language] = [];
    } 
    if (session.intCorrectAnswersLimited[language] == null)
    {
        session.intCorrectAnswersLimited[language] = 0;
    }
    if (session.intWrongAnswersLimited[language] == null)
    {
        session.intWrongAnswersLimited[language] = 0;
    }   

    var intActualId = session.intActualIdLimited[language];
    var strActualGuess = session.strActualGuessLimited[language];
    var wordsToGuess = session.wordsToGuessLimited[language];
    var respondedids = session.respondedidsLimited[language];
    var sessionNumberofwords = session.numberofwordsLimited[language];

    if(sessionNumberofwords == null)
    {
        session.numberofwordsLimited[language] = numberofwords;
    }
    else if(sessionNumberofwords != numberofwords)
    {
        res.redirect('/reboot/'+req.params.language+'/'+numberofwords);
        session.numberofwordsLimited[language] = null;
        return;
    }

    if(!wordsToGuess.length > 0)
    {
        session.wordsToGuessLimited[language] = results;
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
        session.intActualIdLimited[language] = arrWordToGuess.id;

    // Render
    if(res && req)
    {
        res.render('test.ejs', {language : req.params.language, wordtoguess : arrWordToGuess.focused_language_translation, response : arrWordToGuess.main_language_translation, id : arrWordToGuess.id, arrFullCount : arrFullCount, arrRandomCount : arrRandomCount, strGuess : strActualGuess, limited : true, numberofwords : numberofwords, intCorrectAnswers : session.intCorrectAnswersLimited[req.params.language], intWrongAnswers : session.intWrongAnswersLimited[req.params.language]});
    }
    else
    {
        arrWordToGuess.total = arrFullCount;
        arrWordToGuess.count = arrRandomCount;
        arrWordToGuess.intCorrectAnswers = session.intCorrectAnswersLimited[language];
        arrWordToGuess.intWrongAnswers = session.intWrongAnswersLimited[language];
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

// If asking for favicon --> Redirect the request
function askingForFavicon (req, res)
{
    if (req.url === '/favicon.ico') {
        res.writeHead(200, {'Content-Type': 'image/x-icon'} );
        res.end();
        return false;
    }
    return true;
}

app.get('/error', function(req, res){
    res.render('error.ejs');
})
.get('/', function(req, res){
    res.redirect('/languages');
})
.get('/languages', function(req, res){
    var boolFavicon = askingForFavicon(req, res);
    if(boolFavicon ==  false)
    {
        return;
    }
    let arrTranslationList = connection.query('SELECT * FROM language WHERE active = 1 ORDER BY main_language DESC', function (error, results, fields) {
        if (error) throw error;
        res.setHeader('Content-type', 'text/html');
        res.render('language.ejs', {languages : results});
      });
})
.post('/languages', function(req, res){

    var strName = req.body.name.replace(/'/g, "\\'");
    var strSlug = req.body.slug.replace(/'/g, "\\'");

    if(strSlug && strName)
    {
        // Use MySQL
        connection.query('INSERT INTO language (name, slug) VALUES (\''+strName+'\', \''+strSlug+'\')', function (error, results, fields) {
            if (error) throw error;
        });
    }

    // Redirection
    res.redirect('/languages');
})
.get('/language/delete/:strKeyToDelete', function(req, res){
    res.setHeader('Content-type', 'text/html');

    let deleteQuery = connection.query('UPDATE language SET active = 0 WHERE id = '+req.params.strKeyToDelete, function (error, results, fields) {
        if (error) throw error;
    });

    // Redirection
    res.redirect('/languages');
})
.get('/delete/:language/:strKeyToDelete', function(req, res){
    res.setHeader('Content-type', 'text/html');

    let deleteQuery = connection.query('UPDATE translation SET active = 0 WHERE id = '+req.params.strKeyToDelete, function (error, results, fields) {
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
    session.respondedids[req.params.language] = [];
    session.intCorrectAnswers[req.params.language] = 0;
    session.intWrongAnswers[req.params.language] = 0;

    res.redirect('/test/'+req.params.language);
})
.get('/reboot/:language/:numberofwords', function(req, res){
    res.setHeader('Content-Type', 'text/html');
    session.respondedidsLimited[req.params.language] = [];
    session.wordsToGuessLimited[req.params.language] = [];
    session.intActualIdLimited[req.params.language] = null;
    session.strActualGuessLimited[req.params.language] = null;
    session.intCorrectAnswersLimited[req.params.language] = 0;
    session.intWrongAnswersLimited[req.params.language] = 0;

    res.redirect('/test/'+req.params.language+'/'+req.params.numberofwords);
})
.get('/end/:language', function(req, res){
    res.setHeader('Content-Type', 'text/html');
    res.render('end.ejs', {language : req.params.language, numberofwords : false});
})
.get('/end/:language/:numberofwords', function(req, res){
    res.setHeader('Content-Type', 'text/html');
    res.render('end.ejs', {language : req.params.language, numberofwords : req.params.numberofwords});
})
.get('/addtofav/:slug/:wordid', function(req, res){
    // Add a word to favorite
    connection.query('UPDATE translation SET favorite = 1 WHERE id = '+req.params.wordid, function (error, results, fields) {
        if (error) throw error;
    });
    res.redirect('/'+req.params.slug);
})
.get('/removefromfav/:slug/:wordid', function(req, res){
    // Remove a word from favorite
    connection.query('UPDATE translation SET favorite = 0 WHERE id = '+req.params.wordid, function (error, results, fields) {
        if (error) throw error;
    });
    res.redirect('/'+req.params.slug);
})
.get('/:language', function(req, res){
    var boolFavicon = askingForFavicon(req, res);
    if(boolFavicon ==  false)
    {
        return;
    }
    var sql = 'SELECT translation.*, language.name, language.slug FROM translation INNER JOIN language ON translation.language_id = language.id WHERE translation.active = 1 AND translation.language_id = (SELECT id FROM language WHERE slug = \''+req.params.language+'\' LIMIT 1); SELECT * FROM language WHERE slug = \''+req.params.language+'\';';
    sql += session.user_main_language;
    let arrTranslationList = connection.query(sql, function (error, results, fields) {
        if (error) throw error;
        if(results[1][0].active == 0){
            res.redirect('/error');
            return;
        };
            res.setHeader('Content-type', 'text/html');
            res.render('index.ejs', {words : results[0], slug : req.params.language, language : results[1][0], main_language : results[2][0]}); 
      });
})
.post('/:language', function(req, res){
    var newMainLanguageWord = req.body.frenchword.replace(/'/g, "\\'");
    var newLearnedLanguageWord = req.body.englishword.replace(/'/g, "\\'");

    if(newMainLanguageWord && newLearnedLanguageWord)
    {
        // Use MySQL
        connection.query('INSERT INTO translation (focused_language_translation, main_language_translation, language_id) VALUES (\''+newLearnedLanguageWord+'\', \''+newMainLanguageWord+'\', (SELECT id FROM language WHERE slug = \''+req.params.language+'\' LIMIT 1))', function (error, results, fields) {
            if (error) throw error;
        });
    }
    
    // Redirection
    res.redirect('/'+req.params.language);
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
$('#night-mode').click(function(){

    $('body').css({'background':'#010309'});
    $('#content').css({'color': '#EEE'});
    $('#response').css({'background': '#EEE'});
    $('#submit-response').css({'background': '#576574'});
    $('#button-ask-answer').css({'background': '#222f3e'});
    $('a').css({'background': 'none', 'color' : '#EEE'});
    $('#count-correct-answers').css({'color' : '#DDD'});
    $('#count-wrong-answers').css({'color' : '#DDD'});


    // Emit night-mode
    socket.emit('night-mode', {mode : 'night'});
    socket.emit('night-mode', {mode : 'light'});
});
var express = require('express');
var router = express.Router();

var loginCheck = function(req, res, next) {
    if(req.session.user_id){
        next();
    }else{
        res.redirect('login');
    }
};

router.get('/', loginCheck, function(req, res) {
    res.render('index', { user_id: req.session.user_id});
});

module.exports = router;
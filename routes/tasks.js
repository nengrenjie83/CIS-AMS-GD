var express = require('express');
var router = express.Router();

// load the Cloudant DB
var async = require('async'),
  Cloudant = require('cloudant'),
  cloudant = Cloudant({url: process.env.CLOUDANT_URL}),
  dbname = 'kanban',
  db = null,
  doc = null;
db = cloudant.db.use(dbname);


var loginCheck = function(req, res, next) {
    if(req.session.user_id){
        next();
    }else{
        res.redirect('login');
    }
};

router.get('/', loginCheck, function(req, res) {
	db.find({selector:{process_id:'p_001'}}, function(er, result) {
	  if (er) {
		throw er;
	  }

	  console.log('Found %d documents with name Alice', result.docs.length);
	if (result == null || typeof(result) == "undefined") {
		console.log("fail");
		res.render('login');
	} else {
		console.log("success");
		//res.setEncoding('utf8');
		if (req.session.user_pref_default_view == "list") {
			res.render('tasklist', { 'tasks': result.docs });
		} else　if (req.session.user_pref_default_view == "kanban") {
			
			// get current progress
			var current_progress = {};
			var kanban_info = {};
			db.get("processes_p001", function(err, data) {
				console.log("Error:", err);
				console.log("Data:", data);

				if (data == null || typeof(data) == "undefined") {
					console.log("fail");
					res.render('login');
				} else {
					console.log("success");
					current_progress = data.work_flow;
					kanban_info = {"column_number":process.length}
					res.render('kanban', { "tasks": result.docs, "process":current_progress, "rev": data._rev });
				}
			});
		}
		
	}
	});
});

router.post('/', loginCheck, function(req, res) {
	var err = "";

	// read current process
	var readProcess = function(callback) {
	  console.log("Reading process");
	  console.log(req.session.user_pref_default_process);
	  db.get(req.session.user_pref_default_process, function(err, data) {
		console.log("Error:", err);
		console.log("Data:", data);
		// keep a copy of the doc so we know its revision token
		doc = data;
   	    callback(err, data);
	  });
	};

	// update current process
	var updateProcess = function(callback) {
		console.log("Updating process");

		//console.log("rev:" + req.body.rev);
	    //console.log("doc.rev:" + doc._rev);
		//console.log(req.body.rev != doc._rev);
		  if (req.body.rev != doc._rev) {
			  err = "error";
			  callback(err, "Task has been changed edited by other user, please try again.");
		  } else {
				var start_status_id = req.body.start_status_id.substr(7);
				var end_status_id = req.body.end_status_id.substr(7);
				var work_flow = new Array();

				doc.work_flow.forEach(function(content){
					//var flow_status = JSON.parse(content);
					if (content.status_id == start_status_id) {
						content.tasks = req.body.start_tasks.split(',');
						if (req.body.start_tasks == "") {
							content.tasks = new Array();
						}
					} else if (content.status_id == end_status_id) {
						content.tasks = req.body.end_tasks.split(',');
						if (req.body.end_tasks == "") {
							content.tasks = new Array();
						}
					}
					work_flow.push(content);
				});
				doc.work_flow = work_flow;
				//console.log("work_flow:" + JSON.stringify(work_flow));
				//console.log("start:" + req.body.start_tasks);
				//console.log("end:" + req.body.end_tasks);
				
				db.insert(doc, function(err, data) {
					console.log("Error:", err);
					console.log("Data:", data);
					// keep the revision of the update so we can delete it
					doc._rev = req.body.rev;
					callback(err, data);
				});

		  }
	};

	// read a task document
	var readDocument = function(callback) {
	  console.log("Reading task document");
	  db.get(req.body._id, function(err, data) {
		console.log("Error:", err);
		console.log("Data:", data);
		// keep a copy of the doc so we know its revision token
		doc = data;
		callback(err, data);
	  });
	};

	// update a task document
	var updateDocument = function(callback) {
	  console.log("Updating task document");
	  // make a change to the document, using the copy we kept from reading it back
	  //console.log("before update:" + doc.task_status);
	  doc.task_status = req.body.task_status.substr(7);		  
	  //console.log("after update:" + doc.task_status);
	  if (req.body.rev == doc._rev) {
		  db.insert(doc, function(err, data) {
			console.log("Error:", err);
			console.log("Data:", data);
			// keep the revision of the update so we can delete it
			doc._rev = data.rev;
			callback(err, data);
		  });
	  } else {
		  callback(err, "");
	  }
	};

	async.series([readProcess, updateProcess, readDocument, updateDocument],function(err, results){
		console.log("final err:" + err);
		console.log("final results1:" + JSON.stringify(results[0]));
		console.log("final results2:" + JSON.stringify(results[1]));
		if (err != null) {
			//err = "Task has been changed edited by other user, please try again.";
			res.contentType('json');//返回的数据类型
			res.send(JSON.stringify({ "status":"success", "err":JSON.stringify(results[1])}));  
			res.end(); 
		}
		// results is now equal to ['one', 'two']
	});
	//async.series([]);
});

module.exports = router;
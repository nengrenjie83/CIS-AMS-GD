var express = require('express');
var router = express.Router();

if (process.env.hasOwnProperty("VCAP_SERVICES")) {
  // Running on Bluemix. Parse out the port and host that we've been assigned.
  var env = JSON.parse(process.env.VCAP_SERVICES);
  var host = process.env.VCAP_APP_HOST; 
  var port = process.env.VCAP_APP_PORT;

  console.log('VCAP_SERVICES: %s', process.env.VCAP_SERVICES);    

  // Also parse out Cloudant settings.
  credentials = env['cloudantNoSQLDB'][0].credentials;
  process.env.CLOUDANT_URL = credentials.url;
}

// load the Cloudant DB
var async = require('async'),
  Cloudant = require('cloudant'),
  cloudant = Cloudant({url: process.env.CLOUDANT_URL}),
  dbname = 'kanban',
  db = null,
  doc = null;
var doc_process = null;
db = cloudant.db.use(dbname);


var loginCheck = function(req, res, next) {
    if(req.session.user_id){
        next();
    }else{
        res.render('login', { "error":"" });
    }
};

//***********************************************************************
//Sort tasks
//***********************************************************************
var taskSort = function(process, tasks) {
	var newProcess = process;
	var tasksObj = {};
	  for (var i = 0; i < tasks.length; i++) {
		  tasksObj[tasks[i]._id] = tasks[i];
	  }
	 for (var j = 0; j< process.length; j++) {
		 var status = process[j];
		 var resultSortedTasks = [];
		 if (status.sortby == null || typeof(status.sortby) == "undefined") {
			 continue;
			 
		// 担当者よりソート
		 } else if (status.sortby == "assigner"){
			 var sortedTasks = {};
			 var task_assignment = "";
			  for (var k = 0; k < status.tasks.length; k++) {
				  var task_id = status.tasks[k];
				  if (tasksObj[task_id].task_assignment == null || tasksObj[task_id].task_assignment == "") {
					  task_assignment = "zzzzz";
				  } else {
					  task_assignment = tasksObj[task_id].task_assignment;
				  }
				  
				  if (task_assignment in sortedTasks) {
					  sortedTasks[task_assignment].push(task_id);
				  } else {
					  sortedTasks[task_assignment] = [task_id];
				  }
			  	}
			  for (var key in sortedTasks) {
				  resultSortedTasks = resultSortedTasks.concat(sortedTasks[key]);
			  }
			  
			  newProcess[j].tasks = resultSortedTasks;
		 }
	};	

	return newProcess;
};

//***********************************************************************
// Show tasks
//***********************************************************************
router.get('/', loginCheck, function(req, res) {
	db.find({selector:{process_id:req.session.user_current_process}}, function(er, result) {
	  console.log('Found %d documents with name Alice', result.docs.length);
		if (result == null || typeof(result) == "undefined") {
			console.log("fail");
			res.render('login');
		} else {
			console.log("success");
				// get current progress
				var current_progress = {};
				var kanban_info = {};
				db.get(req.session.user_current_process, function(err, data) {
					console.log("Error:", err);
					console.log("Data:", data);
					if (data == null || typeof(data) == "undefined") {
						console.log("fail");
						res.render('login');
					} else {
						console.log("success");
						current_progress = data.work_flow;
						kanban_info = {"column_number":process.length};
						current_progress = taskSort(current_progress, result.docs);
						req.session.task_settings = data.task_settings;
						console.log(JSON.stringify(result.docs));
						res.render('kanban', { "tasks": result.docs, "process":current_progress,
							"process_members":data.members,
							"current_progress_name":req.session.user_current_process_name, "current_process":req.session.user_current_process, "task_settings":data.task_settings, "rev": data._rev,
							"watson_classifier":data.watson_classifier, "language_setting":data.language});
					}
				});
			//}
			
		}
	});
});


router.post('/', loginCheck, function(req, res) {
	var err = "";

	// read current process
	var readProcess = function(callback) {
	  console.log("Reading process");;
	  db.get(req.session.user_current_process, function(err, data) {
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
		  if (req.body.rev != doc._rev) {
			  err = "error";
			  callback(err, "Task has been modified by other user, please try again.");
		  } else {
				var start_status_id = req.body.start_status_id.substr(7);
				var end_status_id = req.body.end_status_id.substr(7);
				var work_flow = new Array();
				var isOverWip = false;
				doc.work_flow.forEach(function(content){
					//var flow_status = JSON.parse(content);
					if (content.status_id == start_status_id) {
						content.tasks = req.body.start_tasks.split(',');
						if (req.body.start_tasks == "") {
							content.tasks = new Array();
						}
					} else if (content.status_id == end_status_id) {
						// check WIP
						console.log("WIP standard:" + content.wip);
						if (content.wip < req.body.end_tasks.split(',').length) {
							isOverWip = true;
							console.log("WIP:" + content.wip);
						}
						content.tasks = req.body.end_tasks.split(',');
						if (req.body.end_tasks == "") {
							content.tasks = new Array();
						}
					}
					work_flow.push(content);
				});
				doc.work_flow = work_flow;

				if (isOverWip) {
				  err = "error";
				  callback(err, "wip_over");
				} else {
					db.insert(doc, function(err, data) {
						console.log("Error:", err);
						console.log("Data:", data);
						doc._rev = req.body.rev;
						callback(err, null);
					});
				}

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
			callback(err, "");
		  });
	  } else {
		  callback(err, "error");
	  }
	};

	async.series([readProcess, updateProcess, readDocument, updateDocument],function(err, results){
		console.log("final err:" + err);
		console.log("final results1:" + JSON.stringify(results[0]));
		console.log("final aaaaaaaaaaaaresults2:" + JSON.stringify(results[1]));
		console.log("send json ####################################################################");
		res.contentType('json');
		res.send(JSON.stringify({ "status":"success", "err":JSON.stringify(results[1])}));  
		res.end(); 
	});
});

//add by jiajiao
router.get('/add',loginCheck, function(req,res){
		db.get(req.session.user_current_process, function(err, data) {
			console.log("Error:", err);
			console.log("Data:", data);
			if (data == null || typeof(data) == "undefined") {
				console.log("fail");
				data = {"status": "NG"};
			} else {
				console.log("success");
				//data = {"status": "OK", "system_names": data.system_names, "task_types": data.task_types, "members": data.members};		
				data = {"status": "OK", "task_settings": data.task_settings};
			}
			res.end(JSON.stringify(data));
		});
	
//	res.render('task_add')
});

router.post('/add',loginCheck, function(req, res) {
	
	var err = "";

	// update a task document
	console.log("Inserting task document");
	// make a change to the document, using the copy we kept from reading it back
	//console.log("before update:" + doc.task_status);
	//doc.id = "task_20160706010101";
	var now = new Date();
	var strTaskID = "task_" + now.getTime();
	//strTaskID = "task_20160707010101";
	var insertTask = function(callback) {
		var newTask = {};
		newTask._id = strTaskID;
		newTask.type = "task";
		newTask.task_assignment = req.body.task_assignment;
		newTask.process_id = req.session.user_current_process;
		for(var task_setting_id in doc_process.task_settings){
			if(doc_process.task_settings[task_setting_id].item_type === "Unused") {
			} else {
				newTask[task_setting_id] = req.body[task_setting_id];
			}
		}
		/**
		doc = {
			_id : strTaskID,
			type : "task",
			process_id : req.session.user_current_process,
			task_name : req.body.task_name,
			task_status : "1",
			task_detail : req.body.detail,
			task_start_est : req.body.startEst,
			task_end_est : req.body.finishEst,
			task_priority : "A",
			task_type : req.body.taskTypeID,
			task_systemname : req.body.systemName,
			task_totaltime : req.body.totalWork,
			task_remaintime : req.body.totalWork,
			task_assignment : req.body.owner,
			task_approver : req.body.approver,
			complete_type : ""
		}
		*/
		db.insert(newTask, function(err, data) {
			console.log("Error:", err);
			console.log("Data:", data);
			callback(err, data);
		});
	};

	// read current process
	var readProcess = function(callback) {
	  console.log("Reading process");
	  console.log(req.session.user_current_process);
	  db.get(req.session.user_current_process, function(err, data) {
		console.log("Error:", err);
		console.log("Data:", data);
		// keep a copy of the doc so we know its revision token
		doc_process = data;
   	    callback(err, data);
	  });
	};

	// update current process
	var updateProcess = function(callback) {
		console.log("Updating process");
		doc_process.work_flow[0].tasks.push(strTaskID);
			db.insert(doc_process, function(err, data) {
				console.log("Error:", err);
				console.log("Data:", data);

				callback(err, data);
			});	  
	};

	async.series([readProcess, updateProcess,insertTask],function(err, results){
		console.log("final err:" + err);
		console.log("final results1:" + JSON.stringify(results[0]));
		console.log("final results2:" + JSON.stringify(results[1]));
		if (err === null) {
				data = {"status": "OK", "message":"task created."}
				res.end(JSON.stringify(data))
		}
	});


});


//add by jiajiao
router.get('/edittask',loginCheck, function(req,res){
	console.log("edit task");
	console.log(req.query.task_id);
		db.get(req.query.task_id, function(err, data) {
			console.log("Error:", err);
			console.log("Data:", data);
			if (data == null || typeof(data) == "undefined") {
				console.log("fail");
				data = {"status": "NG"};
			} else {
				console.log("success");
				//data = {"status": "OK", "task_name": data.task_name, "task_type": data.task_type, "system_name": data.task_systemname, "task_start_est": data.task_start_est, "task_end_est": data.task_end_est, "task_totaltime": data.task_totaltime, "task_remaintime": data.task_remaintime, "task_assignment": data.task_assignment, "task_approver": data.task_approver, "task_detail": data.task_detail};
				data = {"status": "OK","taskObj":data,"task_settings": req.session.task_settings};
			}
			res.end(JSON.stringify(data));
		});
	
//	res.render('task_add')
});

router.post('/edittask', function(req,res){

	var err = null;

	// read current Task
	var readEditingTask = function(callback) {
	  console.log("Reading to edit task");;
	  db.get(req.body.task_id, function(err, data) {
		console.log("Error:", err);
		console.log("Data:", data);
		// keep a copy of the doc so we know its revision token
		doc = data;
   	    callback(err, data);
	  });
	};

	// update current Task
	var updateEditingTask = function(callback) {
		console.log("Editing task");
		  if (req.body.task_rev != doc._rev) {
			  err = "error";
			  callback(err, "Task has been modified by other user, please try again.");
		  } else {
			console.log(doc.task_name);
			doc.task_name = req.body.task_name;
			doc.task_type1 = req.body.task_type1;
			doc.task_type2 = req.body.task_type2;
			doc.task_size = req.body.task_size;
			doc.task_importance = req.body.task_importance;
			doc.task_emergency = req.body.task_emergency;
			doc.task_start_estimate = req.body.task_start_estimate;
			doc.task_end_estimate = req.body.task_end_estimate;
			doc.task_assignment = req.body.task_assignment;
			db.insert(doc, function(err, data) {
				console.log("Error:", err);
				console.log("Data:", data);
				doc._rev = req.body.rev;
				callback(err, null);
			});
		  }
	};

	async.series([readEditingTask, updateEditingTask],function(err, results){
		console.log("final err:" + err);
		console.log("final results1:" + JSON.stringify(results[0]));
		console.log("final results2:" + JSON.stringify(results[1]));
		if (err != null) {
			//err = "Task has been changed edited by other user, please try again.";
			res.contentType('json');//返回的数据类型
			res.send(JSON.stringify({ "status":"OK", "err":JSON.stringify(results[1])}));  
			res.end(); 
		}
		if (err === null) {
			data = {"status": "OK", "message":"task edited."}
			res.end(JSON.stringify(data))
		}
	});

});


router.post('/deletetask', function(req,res){

	// read current process
	var readProcess = function(callback) {
	  console.log("Reading process");;
	  db.get(req.session.user_current_process, function(err, data) {
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
		  if (req.body.process_rev != doc._rev) {
			  err = "error";
			  callback(err, "Task has been modified by other user, please try again.");
		  } else {
				var current_status_id = req.body.current_status_id.substr(7);
				var work_flow = new Array();
				doc.work_flow.forEach(function(content){
					//var flow_status = JSON.parse(content);
					if (content.status_id == current_status_id) {
						content.tasks = req.body.current_status_tasks.split(',');
						if (req.body.start_tasks == "") {
							content.tasks = new Array();
						}
					}
					work_flow.push(content);
				});
				doc.work_flow = work_flow;
				db.insert(doc, function(err, data) {
					console.log("Error:", err);
					console.log("Data:", data);
					// keep the revision of the update so we can delete it
					doc._rev = req.body.rev;
					callback(err, data);
				});
		  }
	};

	async.series([readProcess, updateProcess],function(err, results){
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

	db.destroy(req.body.task_id, req.body.task_rev, function(err, data) {
		console.log("Error:", err);
		console.log("Data:", data);
		data = {"status": "OK", "message":"task deleted."}
		res.end(JSON.stringify(data));
	});

});

//***********************************************************************
// Get Messages
//***********************************************************************
router.post('/getmessage', loginCheck, function(req, res) {
	var language_setting = req.body.language_setting;
	console.log("language:" + language_setting);
	if (language_setting === "ch" || language_setting === "jp") {
	} else {
		language_setting = "en";
	}
	db.get("message_" + language_setting, function(err, data) {
		console.log("message_" + language_setting);
		console.log("Error:", err);
		console.log("Data:", data);
		if (data == null || typeof(data) == "undefined") {
			console.log("fail");
			res.render('login');
		} else {
			console.log("success");
			res.contentType('json');
			res.send(JSON.stringify(data));  
			res.end(); 
		}
	});
});

module.exports = router;
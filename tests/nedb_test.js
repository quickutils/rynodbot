
var Datastore = require('nedb')

var db = {};
db.DeletedMessage = new Datastore({ filename: './deleted_message_.db', autoload: true });
for (var a = 0; a < 20; a++) {
	var deletedMessage = { 
		date: + new Date(),
		chat_id: 123456,
		message_id: 123456,
		user_id: 123456,
		user_name: "User"+a,
		message: "the spammed message"
	}

	db.DeletedMessage.insert(deletedMessage, function (err, newDoc) {
	  console.log(newDoc)
	});
}
db.DeletedMessage.find({ user_name: 'User1' }, function (err, docs) {
  console.log(docs)
});

//Spam Messages Table

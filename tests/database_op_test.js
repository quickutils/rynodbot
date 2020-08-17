const DatabaseOp = require('../src/database_op.js')
const Datastore = require('nedb')

const db= {};
var bannedGroupsString = "";
db.BannedUsers = new Datastore({ filename: './banned_users_test.db', autoload: true });

testAddBannedUser();
//testGenBanneduserData();

function testAddBannedUser() {
	//add banned user
	var userObject = { 
		user_id: 132,
		user_name: "testname",
		banned_groups_data: "KaceTestingRoom-2:-142341324314:Spams the group with the text 'hello world':"+(+new Date())+",KaceTestingRoom:94278426746:Admin requested the user to be banned:"+(+new Date())
	}
	DatabaseOp.banAUser(db.BannedUsers,userObject,function (err, bannedGroupCount, newDoc) {
		nextText();
	});
}

function nextText() {
	//checkBannedUser
	userObject = { 
		user_id: 132,
		user_name: "testname",
		banned_groups_data: "TestTest:274572684:Posted bad videos in the group:"+(+new Date())
	}
	DatabaseOp.banAUser(db.BannedUsers,userObject,function (err, bannedGroupCount, newDoc) {
		console.log("banned in "+bannedGroupCount+" Groups");
		bannedGroupsString = newDoc.banned_groups_data;
		testOtherAfterAsync()
	});
}

function testOtherAfterAsync() {
	//bannedGroupsToObject
	const groups = DatabaseOp.bannedGroupsToObject(bannedGroupsString);
	console.log(groups);

	//bannedGroupToString
	const groupss = DatabaseOp.bannedGroupToString(groups);
	console.log(groupss);
	testGenBanneduserData();
}

function testGenBanneduserData() {
	DatabaseOp.getBannedUserData(db.BannedUsers, 132, function (err, docs) {
		console.log(docs);
	});
}











const DriveApi = require('../src/google_drive_api.js');
const RynodObjects = require('../src/rynod_object.js');

/*DriveApi.getFiles(function(err, files){
	//console.log(files);
});

DriveApi.getFilesInFolder("BACKUP", function(err, files){
	console.log(files);
});

DriveApi.doesFolderExists('RYNOD_BOT_BACKUP', function(err, exists, folder){
	console.log(exists + " " + folder.id);
});

DriveApi.doesFolderExists('RYNOD_BOT_BACKUP', function(err, exists){
	console.log(exists);
	if (exists === false) {
		console.log("it does not exist create it");
		DriveApi.createFolder('RYNOD_BOT_BACKUP', function(err, file) {
			console.log(file);
		});
	}
});

var fileMetadata = {
	'name': 'banned_users_test.db'
};
DriveApi.uploadFile('./tests/banned_users_test.db', fileMetadata, function(err, data) {
	if (err) console.log(err);
	else console.log(data);
});

DriveApi.downloadFile({id: "1oHcfsYEeSmvWQQXouLoXfggDqLUZkybH", name: "test"}, RynodObjects.GlobalBannedUsersPath, function(){
	console.log("we good");
});

DriveApi.downloadFileByName("banned_users_test.db", RynodObjects.GlobalBannedUsersPath, function(){
	console.log("we good");
});*/

DriveApi.downloadFileFromFolder("BACKUP", "banned_users_test.ddb", RynodObjects.GlobalBannedUsersPath, function(err, success){
	console.log("we good " + success);
});

/**P
	:author: Azeez Adewale <azeezadewale98@gmail.com>
	:date: 30 September 2019
**/

const datastore = require('nedb');
const DriveApi = require('./google_drive_api.js');
const SuperRynodObjects = require('./rynod_super_object.js');
const fs = require('fs');

/**
	The bot api. You will get that from @BotFather on telegram
**/
const API = (process.env.BOT_API ? process.env.BOT_API : "981455809:AAHGoADyrV_AKUpMT2T2ddL-xz6U1iSgE7Y") ;

/**
	Bot name
**/
const BotName = (process.env.BOT_NAME ? process.env.BOT_NAME : "thesoldier_bot") ;

/**
	Bot name
**/
const BotRealName = (process.env.BOT_NAME ? process.env.BOT_REAL_NAME : "RynodBot") ;

/**
	The number of group a user has been banned in to initailize a 
	global ban on the user 
**/
var BannedGroupLimit = 2;

var RemoteBackupFolder = "RYNODBOD_BACKUP" ;

const DatabaseFolder = './databases/' ;

const DeletedMessagesName = 'deleted_message_.db';
const BannedUsersName = 'banned_user_.db';
const GlobalBannedUsersName = 'global_banned_user_.db';
const ChatSettingsName = 'ChatSettings.json';
const LastMessagesName = 'LastMessages.json';
const BotChatMessagesName = 'BotChatMessages.json';
const AdministratorsName = 'Administrators.json';
const SuperAdministratorsName = 'SuperAdministrators.json';

const DeletedMessagesPath = DatabaseFolder + DeletedMessagesName;
const BannedUsersPath = DatabaseFolder + BannedUsersName;
const GlobalBannedUsersPath = DatabaseFolder + GlobalBannedUsersName;
const ChatSettingsPath = DatabaseFolder + ChatSettingsName;
const LastMessagesPath = DatabaseFolder + LastMessagesName;
const BotChatMessagesPath = DatabaseFolder + BotChatMessagesName;
const AdministratorsPath = DatabaseFolder + AdministratorsName;
const SuperAdministratorsPath = DatabaseFolder + SuperAdministratorsName;

/**
	The database
**/
const Db = {}
/**
	The database for deleted messages
**/
Db.DeletedMessages ; 

/**
	The database for banned users
**/
Db.BannedUsers ;

/**
	The database for globally banned users
**/
Db.GlobalBannedUsers ;

/**
	The various operation types
**/
const OperationType = {
	None: 0,
	LinkVerification: 1,
	ReviewUser: 2,
	ForwardedMessage: 3
}

/**
	Telegram message type
**/
const MessageType = { 
	Message: 1, 
	Photo: 2, 
	Audio: 3, 
	Video: 4, 
	Document: 5, 
	Animation: 6, 
	Voice: 7, 
	VideoNote: 8
} ;

/**
	The default setting for a chat/group that does not 
	have a setting.
	
**/
const DefaultChatSetting = {
							ChatId: 123,
							BotShouldBeSilent: false, 
							OperationElapseTime: 30, 
							SpamCount: 3, 
							BotOnRogueLevel: false, 
							CleanUpLastBotInteractions: true, 
							CacheSize: 100
						}

/**
	This is the list of operation that is pending for all the user 
	in a chats and groups managed by the bot. It contains all the 
	requested operation. 
	
	The list is updated, deleted depending from within rynod_util.js 
	The structure is as below 
	
	::
		
		[
			{
				ChatId: 0, 
				OperationType: RynodObjects.OperationType.None, 
				Author: "", 
				UserId: 0, 
				ExtraData: "", 
				MessageData: {}, 
				MessageIds : [], 
				Time: + new Date()
			},
			...
		]
		
	The pending operation is time consious. A pending operation that 
	has passed the group/chat setting **OperationElapseTime** will be 
	deleted and all messages on the operation will be deleted too.
	
**/
const RequestedOperations = [];

/**
	The type of parse mode for telegram sendMessage 
	api
**/
const ParseMode = {
	HTML: "HTML",
	MARKDOWN: "MARKDOWN"
}

/**

**/
function FetchAndLoadDatabase(callback) {
	if (!fs.existsSync(DatabaseFolder)){ fs.mkdirSync(DatabaseFolder); }
	DriveApi.doesFolderExists(RemoteBackupFolder, function(err, exists, folder){
		if (exists) {
			console.log("backup folder found: " + exists + " " + folder.name + " " + folder.id);
			DriveApi.getFilesInFolder(RemoteBackupFolder, function(err, files){
				if (files.length > 0) {
					for (var file of files) {
						console.log("Looking for : " + file.name);
						DriveApi.downloadFile(file, DatabaseFolder + "/" + file.name, function(err, success, file){
							if (success === false) { 
								if (err) console.log(err);
							} else {
								console.log("Downloaded the backup database: " + file.name);
								if (file.name === DeletedMessagesName) {
									Db.DeletedMessages = new datastore({ filename: DeletedMessagesPath, autoload: true }); 
									console.log("Loaded DeletedMessages db");
								} else if (file.name === BannedUsersName) {
									Db.BannedUsers = new datastore({ filename: BannedUsersPath, autoload: true });
									console.log("Loaded BannedUsers db");
								} else if (file.name === GlobalBannedUsersName) {
									Db.GlobalBannedUsers = new datastore({ filename: GlobalBannedUsersPath, autoload: true });
									console.log("Loaded GlobalBannedUsers db");
								} else if (file.name === ChatSettingsName) {
									fs.readFile(ChatSettingsPath, 'utf8', function readFileCallback(err, data){
										if (err){
											console.log(err);
										} else {
											SuperRynodObjects.ChatSettings = JSON.parse(data); 
										}
									});
								} else if (file.name === LastMessagesName) {
									fs.readFile(LastMessagesPath, 'utf8', function readFileCallback(err, data){
										if (err){
											console.log(err);
										} else {
											SuperRynodObjects.LastMessages = JSON.parse(data); 
										}
									});
								} else if (file.name === BotChatMessagesName) {
									fs.readFile(BotChatMessagesPath, 'utf8', function readFileCallback(err, data){
										if (err){
											console.log(err);
										} else {
											SuperRynodObjects.BotChatMessages = JSON.parse(data); 
										}
									});
								} else if (file.name === AdministratorsName) {
									fs.readFile(AdministratorsPath, 'utf8', function readFileCallback(err, data){
										if (err){
											console.log(err);
										} else {
											SuperRynodObjects.Administrators = JSON.parse(data);
										}
									});
								}  else if (file.name === SuperAdministratorsName) {
									fs.readFile(SuperAdministratorsPath, 'utf8', function readFileCallback(err, data){
										if (err){
											console.log(err);
										} else {
											SuperRynodObjects.SuperAdministrators = JSON.parse(data);
										}
									});
								}  
							}
							
						});
					}
				} else {
					loadDB____();
				}
				callback();
			});
		} else {
			console.log("The backup folder cannot be found");
			if (err) {
				console.log(err);
				return;
			}
			DriveApi.createFolder(RemoteBackupFolder, function(err, folder) {
				console.log(RemoteBackupFolder + " folder has been created");
				loadDB____();
				callback();
			});
		}
		
		
	});
	
}

function loadDB____() { 
	if (Db.DeletedMessages == null) {
		Db.DeletedMessages = new datastore({ filename: DeletedMessagesPath, autoload: true }); 
		console.log("Loading DeletedMessages db");
	}
	if (Db.BannedUsers == null) {
		Db.BannedUsers = new datastore({ filename: BannedUsersPath, autoload: true });
		console.log("Loading BannedUsers db");
	}
	if (Db.GlobalBannedUsers == null) {
		Db.GlobalBannedUsers = new datastore({ filename: GlobalBannedUsersPath, autoload: true });
		console.log("Loading GlobalBannedUsers db");
	}
}

function BackupDatabaseToDrive(folderId) {
	
	//backup the consistent variables (It should be in db later)
	var chJson = JSON.stringify(SuperRynodObjects.ChatSettings);
	if (!fs.existsSync(ChatSettingsPath)){ fs.unlinkSync(ChatSettingsPath); }
	fs.writeFile(ChatSettingsPath, chJson, 'utf8', function(err, res) {
		//console.log(chJson);
	});
	var lmJson = JSON.stringify(SuperRynodObjects.LastMessages);
	if (!fs.existsSync(LastMessagesPath)){ fs.unlinkSync(LastMessagesPath); }
	fs.writeFile(LastMessagesPath, lmJson, 'utf8', function(err, res) {
		//console.log(lmJson);
	});
	var bcmJson = JSON.stringify(SuperRynodObjects.BotChatMessages);
	if (!fs.existsSync(BotChatMessagesPath)){ fs.unlinkSync(BotChatMessagesPath); }
	fs.writeFile(BotChatMessagesPath, bcmJson, 'utf8', function(err, res) {
		//console.log(bcmJson);
	});
	var aJson = JSON.stringify(SuperRynodObjects.Administrators);
	if (!fs.existsSync(AdministratorsPath)){ fs.unlinkSync(AdministratorsPath); }
	fs.writeFile(AdministratorsPath, aJson, 'utf8', function(err, res) {
		//console.log(aJson);
	});
	var saJson = JSON.stringify(SuperRynodObjects.SuperAdministrators);
	if (!fs.existsSync(SuperAdministratorsPath)){ fs.unlinkSync(SuperAdministratorsPath); }
	fs.writeFile(SuperAdministratorsPath, saJson, 'utf8', function(err, res) {
		//console.log(saJson);
	});
	
	//now backup files in the databse folder
	fs.readdir(DatabaseFolder, (err, files) => {
		files.forEach(fileName => {
			if (fs.lstatSync(DatabaseFolder + "/" + fileName).isDirectory() === false) {
				console.log("Backing up: " + DatabaseFolder + "/" + fileName);
				DriveApi.doesFileExists(RemoteBackupFolder, fileName, function(err, exists, fileName, file){
					if (exists === true) {
						DriveApi.updateFile(file.id, DatabaseFolder + "/" + file.name, function(err, data) {
							if (err) console.log(file.name + " update in drive failed");
							else console.log(file.name + " update in drive successfull");
						});
					} else {
						console.log("We good to create: "+DatabaseFolder);
						var fileMetadata = {
							'name': fileName,
							'parents': [folderId]
						};
						DriveApi.uploadFile(DatabaseFolder + "/" + fileName, fileMetadata, function(err, data) {
							if (err) console.log(fileName + " upload to drive failed");
							else console.log(fileName + " upload to drive successfull");
						});
					}
				});
			}
		});
	});
}

/**
	Export objects
**/
module.exports = {
	API,
	BotName,
	BotRealName,
	BannedGroupLimit,
	Db,
	OperationType,
	MessageType,
	//DefaultChatSetting,
	RequestedOperations,
	ParseMode,
	GlobalBannedUsersPath,
	BannedUsersPath,
	DeletedMessagesPath,
	FetchAndLoadDatabase,
	RemoteBackupFolder,
	DatabaseFolder,
	BackupDatabaseToDrive,
	DriveApi
};
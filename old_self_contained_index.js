var express = require('express')
var app = express()
var bodyParser = require('body-parser')
const axios = require('axios');
const keyValue = require('@thecarisma/key-value-db');
const datastore = require('nedb')

//file base databases
const db = {}
db.DeletedMessage = new datastore({ filename: './deleted_message_.db', autoload: true }); //deleted messages
db.BannedUser = new datastore({ filename: './banned_user_.db', autoload: true }); //banned user

const API = "981455809:AAHGoADyrV_AKUpMT2T2ddL-xz6U1iSgE7Y" ;
const botName = "thesoldier_bot" ;
const Type = { Message: 1, Photo: 2, Audio: 3, Video: 4, Document: 5, Animation: 6, Voice: 7, VideoNote: 8} ;
var lastMessagesCount = 100;
var chatSettings = [ ]; // { chatId: "", botShouldBeSilent: false, captchaExpirationInSeconds: 30, spamCount: 3, botOnRogueLevel: false, cleanUpLastBotInteractions: true };
var administrators = new keyValue.KeyValueDB("thecarisma=1000") ;
var administratorsAccessGroups = new keyValue.KeyValueDB("thecarisma=-388185853,") ;

/*Operation option 
	0 - None
	1 - Verify for link
	2 - review a user
	3 - Verify Forwarded message
*/
var requestedOperations = [];
var lastRequestedoperation = { chatId: 0, operationCode: 0, author: "", sender_id: 0, extraData: "", messageData: "", messagesId : [], time: + new Date()};

//The chat/group related datas
var lastChatId = 0;
var lastMessages = [];
var lastMessageData = { text: "", message_id: "", sender: "", is_bot: false, sender_id: "", chat_id: 0, index: 0, type: Type.Message, mediaObjects: []}; 
var lasBotChatId = 0 ;
var lasBotMessageId = 0 ;

app.use(bodyParser.json()) // for parsing application/json 
app.use(
  bodyParser.urlencoded({
    extended: true
  })
) // for parsing application/x-www-form-urlencoded

//This is the route the API will call
app.post('/', function(req, res) {
	//console.log(req.body);
	const { message } = req.body ; 
	if (!message || (!message.text && !message.caption) && !message.forward_from ) {
		return res.end();
	}
	var messageText = "";
	var hasCaption = false;
	var messageType = Type.Message;
	var mediaObjects = [];
	if (message.text) {
		messageText = message.text.trim().toLowerCase();
	} else {
		if (message.caption) {
			messageText = message.caption.trim().toLowerCase();
		} else {
			
		}
		
		hasCaption = true;
		if (message.photo) {
			messageType = Type.Photo;
			mediaObjects = message.photo;
			
		} else if (message.audio) {
			messageType = Type.Audio;
			mediaObjects = message.audio;
			
		} else if (message.video) {
			messageType = Type.Video;
			mediaObjects = message.video;
			
		} else if (message.document) {
			messageType = Type.Document;
			mediaObjects = message.document;
			
		} else if (message.animation) {
			messageType = Type.Animation;
			mediaObjects = message.animation;
			
		} else if (message.voice) {
			messageType = Type.Voice;
			mediaObjects = message.voice;
			
		} else if (message.video_note) {
			messageType = Type.VideoNote;
			mediaObjects = message.video_note;
			
		}
		
		//if it not array put the object in an array 
		if (!mediaObjects.length) {
			var ___mediaObjects = mediaObjects ;
			mediaObjects = [ ___mediaObjects ];
		}
		var previousMediaId ;
		for (var a = 0; a < mediaObjects.length; a++) {
			console.log("Media: "+mediaObjects[a].file_id+":"+ previousMediaId)
			if (previousMediaId === mediaObjects[a].file_id.substring(0,20)) {
				mediaObjects.splice(a, 1);
				continue; 
			}
			previousMediaId = mediaObjects[a].file_id.substring(0,20) ;
		}
		/*for (var a = 0; a < mediaObjects.length; a++) {
			console.log(">>>After Media: "+mediaObjects[a])
		}*/
	}
	const messageId = message.message_id ;
	const chatId = message.chat.id;
	const senderId = message.from.id;
	const senderIsBot = message.from.is_bot;
	const senderUsername = message.from.username;
	const isForwarded = (message.forward_from ? true : false);
	console.log(message);
	console.log("LastMessage="+lastMessageData.text);
  
	lastChatId = chatId;
	var chatSettingRes = getChatSettings(chatSettings, ''+chatId);
	if (chatSettingRes[0] === false) { 
		chatSettings.push({ chatId: ""+chatId, botShouldBeSilent: false, captchaExpirationInSeconds: 30, spamCount: 3, botOnRogueLevel: false, cleanUpLastBotInteractions: true })
		chatSettingRes = getChatSettings(chatSettings, ''+chatId);
	}
	//at here
	var chatSetting = chatSettingRes[1];
	var havePendingOp = doesUserHasPendingOperation(res, API, requestedOperations, senderUsername, chatId, messageId, chatSetting);
	if (havePendingOp[0] !== true && messageText.indexOf(botName) < 0 && !isLink(messageText) && senderUsername.replace('@', '').trim() != botName) {
		lastMessageData = { text: messageText.trim(), chat_id: chatId, message_id: messageId, sender: senderUsername, is_bot: senderIsBot, sender_id: senderId, index: lastMessages.length, type: messageType, mediaObjects: mediaObjects}; 
		lastMessages.push(lastMessageData);
		//not done from here
		var isSpamResult = isSpam(lastMessages, lastMessageData, chatSetting.spamCount, chatSetting.botOnRogueLevel);
		if (isSpamResult[0] == true) { 
			//spam detected
			//check if has been ban in another group then remove in all the other groups 
			//if it ban for the first time tell group, user has to be added in 30 days
			kickChatMember(res, API, lastMessageData.chat_id, lastMessageData.sender, "Spammed the group with message '" + lastMessageData.text + "'", senderId, false);
			if (chatSetting.botShouldBeSilent == false) { 
				var msg = [Type.Message, "The user @" + lastMessageData.sender + " has spammed the group, the messages has been removed and the user blacklisted", null, null];
				sendMessage(res, API, chatId, msg, lastMessageData.sender, "HTML", false, 0, true);
			}
			for (var a = 0; a < isSpamResult[1].length; a++) {
				deleteMessage(res, API, lastMessageData.chat_id, isSpamResult[1][a].id, isSpamResult[1][a].message, "@"+lastMessageData.sender, false);
				lastMessages.splice(isSpamResult[1][a].index, 1);
			}
			return res.end();
		}
		if (lastMessages.length > lastMessagesCount) {
			lastMessages.splice(0, lastMessages.length - lastMessagesCount);
		}
	}
	
	if (messageText.indexOf('Usage:') >= 0) {
		return res.end();
		
	} else if (havePendingOp[0] === true && (messageText.replace('@', '').replace(botName, '').replace(/\s+/g, '').trim().length < 3)) {
		var answerText = messageText.replace('@', '').replace(botName, '').trim();
		havePendingOp[2].messagesId.push([false, chatId, messageId, messageText]);
		if (havePendingOp[2].operationCode === 1) { //resolve link
			if (chatSetting.cleanUpLastBotInteractions === true ) {
				for (var i = 0; i < havePendingOp[2].messagesId.length; i++) {
					deleteMessage(res, API, havePendingOp[2].messagesId[i][1], havePendingOp[2].messagesId[i][2], havePendingOp[2].messagesId[i][3], "@"+botName, false);
				}
			}
			if (answerText == havePendingOp[2].extraData) {
				sendMessage(res, API, chatId, havePendingOp[2].messageData, havePendingOp[2].author, "HTML", false, 0, false);
			} else {
				//tell the bot group about user failure to verify [log group] 
				
			}
			requestedOperations.splice(havePendingOp[3], 1);
			
		} else if (havePendingOp[2].operationCode === 2) { //resolve forwarded message
			if (chatSetting.cleanUpLastBotInteractions === true ) {
				for (var i = 0; i < havePendingOp[2].messagesId.length; i++) {
					deleteMessage(res, API, havePendingOp[2].messagesId[i][1], havePendingOp[2].messagesId[i][2], havePendingOp[2].messagesId[i][3], "@"+botName, false);
				}
			}
			if (answerText == havePendingOp[2].extraData) {
				sendMessage(res, API, chatId, havePendingOp[2].messageData, havePendingOp[2].author, "HTML", false, 0, false);
			} else {
				//tell the bot group about user failure to verify [log group]
				
			}
			requestedOperations.splice(havePendingOp[3], 1);
			
		} else if (havePendingOp[2].operationCode === 3) { //review user
			console.log("Review User Operation Execution Of: " + havePendingOp[2].extraData+"$"+answerText);
			var userId = 0 ;
			var userName = "" ;
			var h = lastMessages.length;
			while (h--) {
			   if ('@' + lastMessages[h].sender === havePendingOp[2].extraData && lastMessages[h].chat_id === havePendingOp[2].chatId) {
				   userId = lastMessages[h].sender_id;
				   userName = lastMessages[h].sender;
				   break;
			   }
			}
			if (answerText.indexOf('1') >= 0) { //delete last message
				var i = lastMessages.length;
				while (i--) {
				   if ('@' + lastMessages[i].sender === havePendingOp[2].extraData && lastMessages[i].chat_id === havePendingOp[2].chatId) {
					   deleteMessage(res, API, lastMessages[i].chat_id, lastMessages[i].message_id, lastMessages[i].text, ('@' + lastMessages[i].sender), false);
					   lastMessages.splice(i, 1);
					   break;
				   }
				}
				if (chatSetting.cleanUpLastBotInteractions === true ) {
					for (var i = 0; i < havePendingOp[2].messagesId.length; i++) {
						deleteMessage(res, API, havePendingOp[2].messagesId[i][1], havePendingOp[2].messagesId[i][2], havePendingOp[2].messagesId[i][3], "@"+botName, false);
					}
				}
			}
			if (answerText.indexOf('2') >= 0) { //Ban user 
				if (chatSetting.cleanUpLastBotInteractions === true ) {
					for (var i = 0; i < havePendingOp[2].messagesId.length; i++) {
						deleteMessage(res, API, havePendingOp[2].messagesId[i][1], havePendingOp[2].messagesId[i][2], havePendingOp[2].messagesId[i][3], "@"+botName, false);
					}
				}
				if (userId !== 0) {
					kickChatMember(res, API, havePendingOp[2].chatId, userId,  userName, "Admin requested ban on the user", false);
					if (chatSetting.botShouldBeSilent == false) { 
						var msg = [Type.Message, "The user " + havePendingOp[2].extraData + " has been kicked out of the group", null, null];
						sendMessage(res, API, havePendingOp[2].chatId, msg, "HTML", false, 0, false);
					}
				} else {
					if (chatSetting.botShouldBeSilent == false) { 
						var msg = [Type.Message, "Unable to ban " + havePendingOp[2].extraData + ". Try again some other time", null, null];
						sendMessage(res, API, havePendingOp[2].chatId, msg, lastMessageData.sender, "HTML", false, 0, false);
					}
				}
			}
			if (answerText.indexOf('3') >= 0) { //Delete all messages from this user
				//should be concorent 
				if (chatSetting.cleanUpLastBotInteractions === true ) {
					for (var i = 0; i < havePendingOp[2].messagesId.length; i++) {
						deleteMessage(res, API, havePendingOp[2].messagesId[i][1], havePendingOp[2].messagesId[i][2], havePendingOp[2].messagesId[i][3], "@"+botName, false);
					}
				}
				var i = lastMessages.length;
				while (i--) {
				   if ('@' + lastMessages[i].sender === havePendingOp[2].extraData && lastMessages[i].chat_id === havePendingOp[2].chatId) {
					   deleteMessage(res, API, lastMessages[i].chat_id, lastMessages[i].message_id, lastMessages[i].text, ('@' + lastMessages[i].sender), false);
					   lastMessages.splice(i, 1);
					   i = lastMessages.length;
				   }
				}
			}
			requestedOperations.splice(havePendingOp[3], 1);
		}
		return res.end('ok');
		
	}  else if (isLink(messageText)) { 
		deleteMessage(res, API, chatId, messageId, lastMessageData.text, lastMessageData.sender, false);
		var verifyMessage = getCaptcha(`@`+senderUsername+` your message contain a link prove you not a bot.`, chatSetting.captchaExpirationInSeconds);
		lastRequestedoperation = { chatId: chatId, operationCode: 1, author: senderUsername, senderId: senderId, extraData: verifyMessage[1], messageData: [messageType, "@"+senderUsername+" posted: " + messageText,mediaObjects,0], messagesId : [], time: + new Date()};
		requestedOperations.push(lastRequestedoperation);
		var msg = [Type.Message, verifyMessage[0], null, null];
		sendMessage(res, API, chatId, msg, senderUsername, "HTML", true, requestedOperations.length-1, true);
		
		
	} else if (isForwarded === true) {
		deleteMessage(res, API, chatId, messageId, lastMessageData.text, lastMessageData.sender, false);
		var verifyMessage = getCaptcha(`@`+senderUsername+` prove you not a bot to post your forwarded message.`, chatSetting.captchaExpirationInSeconds);
		lastRequestedoperation = { chatId: chatId, operationCode: 2, author: senderUsername, senderId: senderId, extraData: verifyMessage[1], messageData: [messageType, "@"+senderUsername+" forwarded: " + messageText,mediaObjects,0], messagesId : [], time: + new Date()};
		requestedOperations.push(lastRequestedoperation);
		var msg = [Type.Message, verifyMessage[0], null, null];
		sendMessage(res, API, chatId, msg, senderUsername, "HTML", true, requestedOperations.length-1, true);
		
		
	} else if (messageText.indexOf(botName) >= 0 && isForwarded === false) {	
		//check if it user is administrator	
		console.log("AdminLevel="+administrators.get(senderUsername)+",AccessGroups="+administratorsAccessGroups.get(senderUsername));
		if (administrators.get(senderUsername) === '') {
			if (chatSetting.botShouldBeSilent === false) {
				var msg = [Type.Message, "@" + senderUsername + " is not authorized to interact with the bot", null, null];
				sendMessage(res, API, chatId, msg, senderUsername, "HTML", false, 0, true);
				return ;
			} else {
				return res.end(senderUsername + ' Not authorized to interact with the bot');
			}
			return;
		}
		
		//check if the user has access to the group chat
		if (administratorsAccessGroups.get(senderUsername).indexOf(""+chatId+",") < 0 && administrators.get(senderUsername) !== "1000") {
			if (chatSetting.botShouldBeSilent === false) {
				var msg = [Type.Message, "@" + senderUsername + " is not authorized to interact with the bot in this group", null, null];
				sendMessage(res, API, chatId, msg, senderUsername, "HTML", false, 0, true);
				return ;
			} else {
				return res.end(senderUsername + " is not authorized to interact with the bot in this group");
			}
		}
		
		messageText = messageText.replace('@', '').replace(botName, '').trim();
		if (messageText.indexOf('hello') >= 0) {
			var msg = [Type.Message, "Hello what can i do for you @" + senderUsername, null, null];
			sendMessage(res, API, chatId, msg, senderUsername, "HTML", false, 0, true);
			
		} else if (messageText.indexOf('delete') >= 0 && messageText.indexOf('last') >= 0 && messageText.indexOf('message') >= 0) {
			var lastMsg = getLastMessage(lastMessages, chatId); 
			if (lastMsg[0] === true) {
				deleteMessage(res, API, chatId, lastMsg[1], lastMsg[3], lastMessageData.text, lastMessageData.sender, false);
				deleteMessage(res, API, chatId, messageId, messageText, botName, true);
				lastMessages.splice(lastMsg[2], 1);
				
			} else {
				if (chatSetting.botShouldBeSilent === false) {
					var msg = [Type.Message, "The server has been reset and all previous message log has been cleared", null, null];
					sendMessage(res, API, chatId, msg, senderUsername, "HTML", false, 0, true);
				} else {
					return res.end("The server has been reset and all previous message log has been cleared");
				}
			}
			
		} else if (messageText.indexOf('unban') >= 0 && messageText.indexOf('@') >= 0) {
			//check if the user has access level 2 to the group chat
			if (administrators.get(senderUsername) !== "2" && administrators.get(senderUsername) !== "1000") {
				sendBotLastMessageToGroup(res, API, chatId, "@" + senderUsername + " does not have enough permission to change bot settings for this group", senderUsername, chatSetting.botShouldBeSilent);
				return;
			}
			messageText = messageText.substring(messageText.indexOf('@'), messageText.length);
			console.log("Unban User="+messageText);
			//TODO check if in global list. If in global list impossible to ban 
			if (1 === 2) {
				var msg = [Type.Message, "The member "+messageText+" is in the global ban list and has been banned forever", null, null];
				sendMessage(res, API, chatId, msg, senderUsername, "HTML", false, 0, true);
			} else {
				unBanChatMember(res, API, chatId, messageText, false);
				var msg = [Type.Message, "This user "+messageText+" has been unbanned. He cannot be added automatically but can join using link or invite.", null, null];
				sendMessage(res, API, chatId, msg, senderUsername, "HTML", false, 0, true);
			}
			return;
			
		} else if (messageText.indexOf('review') >= 0 && messageText.indexOf('@') >= 0) {
			//check if the user has access level 2 to the group chat
			if (administrators.get(senderUsername) !== "2" && administrators.get(senderUsername) !== "1000") {
				sendBotLastMessageToGroup(res, API, chatId, "@" + senderUsername + " does not have enough permission to change bot settings for this group", senderUsername, chatSetting.botShouldBeSilent);
				return;
			}
			messageText = messageText.substring(messageText.indexOf('@'), messageText.length);
			console.log("Review User="+messageText);
			if (messageText == "@"+botName) {
				var msg = [Type.Message, "You cannot review the bot activity this way. Use other commands", null, null];
				sendMessage(res, API, chatId, msg, senderUsername, "HTML", false, 0, true);
				return;
			}
			lastRequestedoperation = { chatId: chatId, operationCode: 3, author: senderUsername, senderId: senderId, extraData: messageText, messageData: [messageType,messageText,mediaObjects,0], messagesId : [], time: + new Date()};
			lastRequestedoperation.messagesId.push([false, chatId, messageId, messageText]);
			requestedOperations.push(lastRequestedoperation);
			var msg = [Type.Message, getUserMessageOptions(messageText), null, null];
			sendMessage(res, API, chatId, msg, senderUsername, "HTML", true, requestedOperations.length-1, true);
			
		} else if (messageText.indexOf('clear') >= 0 && messageText.indexOf('logs') >= 0) {
			//clear log in the group 
			return res.end('ok');
			
		} else if (messageText.indexOf('help') >= 0) {
			var msg = [Type.Message, getHelpMessage(), null, null];
			sendMessage(res, API, chatId, msg, senderUsername, "HTML", false, 0, true); 
			
		}  
		else if (messageText.indexOf('statistics') >= 0) {
			db.DeletedMessage.find({ chat_id: chatId }, function (err, docs) {
				var msgValue = "" ;
				var doc = "";
				var previousMsgValue = "" ;
				for (var i = 0; i < docs.length; i++) {
					if (docs[i].user_name == docs[i].message || docs[i].user_name == botName || previousMsgValue == docs[i].message) {
						continue;
					}
					doc = "Deleted Spam Message: <b>" + docs[i].message + "</b> Sent by <b>" + docs[i].user_name + '</b>                                ';
					msgValue += doc;
					previousMsgValue = docs[i].message; //avoid multiple entry such as spam messages
				}
				console.log(doc);
				var msg = [Type.Message, msgValue, null, null];
				deleteMessage(res, API, chatId, messageId, messageText, senderUsername, false);
				sendMessage(res, API, chatId, msg, botName, "HTML", false, 0, true); 
				
			});
		} 
		else if (messageText.indexOf('=') >= 0) { 
			//check if the user has access level 2 to the group chat
			if (administrators.get(senderUsername) !== "2" && administrators.get(senderUsername) !== "1000") {
				sendBotLastMessageToGroup(res, API, chatId, "@" + senderUsername + " does not have enough permission to change bot settings for this group", senderUsername, chatSetting.botShouldBeSilent);
				return;
			}
			//1 = add admin/change level
			//2 = remove admin
			var adminOp = 0 ;
			if (messageText.indexOf('admin') >= 0) {
				if (messageText.indexOf('removeadmin') >= 0) {
					adminOp = 2;
					
				} else {
					adminOp = 1;
				}
				messageText = messageText.split('admin')[1];
			}
			var configSettings = new keyValue.KeyValueDB(messageText.replace(/\s+/g, ''), false, '=', ',', true) ;
			console.log('Config Settings: '+configSettings);
			if (adminOp !== 0) {
				if (configSettings.get("name") === "") {
					sendBotLastMessageToGroup(res, API, chatId, "@"+senderUsername + " Your admin settings command is invalid. Check the text.", senderUsername, chatSetting.botShouldBeSilent);
					return;
				}
				if (adminOp === 1) {//add admin/ change level
					if (administratorsAccessGroups.get(configSettings.get("name")).indexOf(""+chatId+",") < 0) {
						administratorsAccessGroups.set(configSettings.get("name"), ""+administratorsAccessGroups.get(configSettings.get("name"))+chatId+",")
					}
					if (configSettings.get("level") !== "") {
						administrators.add(configSettings.get("name"), configSettings.get("level"));
					} else {
						administrators.set(configSettings.get("name"), "1");
					}
				} else { //remove admin
					administrators.remove(configSettings.get("name"));
					administratorsAccessGroups.remove(configSettings.get("name"));
					
				}
				console.log("NewAdminConfig: "+administrators);
				sendBotLastMessageToGroup(res, API, chatId, "Administrators changes has been applied for this group", "@"+botName, chatSetting.botShouldBeSilent);
				return;
				
			} else {
				var settingIndex = getChatSettingIndex(chatSettings, ''+chatId);
				if (configSettings.get("elapsetime") !== '') { 
					chatSettings[settingIndex].captchaExpirationInSeconds = Number(configSettings.get("elapsetime"));
				}
				if (configSettings.get("spamcount") !== '') { 
					var x = Number(configSettings.get("spamcount"));
					if (x >= 2) {
						chatSettings[settingIndex].spamCount = x;
					}						
				}
				if (configSettings.get("silent") !== '') {
					if (configSettings.get("silent") === "true") {
						chatSettings[settingIndex].botShouldBeSilent = true;
					} else {
						chatSettings[settingIndex].botShouldBeSilent = false;
					}
				}
				if (configSettings.get("cleanup") !== '') {
					if (configSettings.get("cleanup") === "true") {
						chatSettings[settingIndex].cleanUpLastBotInteractions = true;
					} else {
						chatSettings[settingIndex].cleanUpLastBotInteractions = false;
					}
				}
				if (configSettings.get("rogue") !== '') { 
					if (configSettings.get("rogue") === "true") {
						chatSettings[settingIndex].botOnRogueLevel = true;
					} else {
						chatSettings[settingIndex].botOnRogueLevel = false;
					}
				}
				sendBotLastMessageToGroup(res, API, chatId, "Settings changes has been applied for this group", senderUsername, chatSetting.botShouldBeSilent);
				return;
			}
			
		}
		else {
			return res.end();
		}
	} else {
		return res.end();
	}	
	
	
});

function isLink(text) {
	return (text.indexOf('https://') >= 0 || text.indexOf('http://') >= 0 || text.indexOf('.com') >= 0 || text.indexOf('wwww.') >= 0)
}

function getChatSettingIndex(chatSettings, chatId) {
	var i = chatSettings.length;
	while (i--) {
	   if ( chatSettings[i].chatId === chatId) {
		   return i;
	   }
	}
	return i;
}

function getChatSettings(chatSettings, chatId) {
	var i = chatSettings.length;
	while (i--) {
	   if ( chatSettings[i].chatId === chatId) {
		   return [true, chatSettings[i]];
	   }
	}
	return [false, null];
}

/**
	This closes the stream
*/
function sendBotLastMessageToGroup(res, API, chatId, message, userName, silent) {
	if (silent === false) {
		var msg = [Type.Message, message, null, null];
		sendMessage(res, API, chatId, msg, userName, "HTML", false, 0, true);
	} else {
		return res.end(message);
	}
}

function kickChatMember(res, botAPI, chatId, userId, userName, reason, closeConnection) {
	if (chatId == 0) {
		console.log('Error: Chat Id is empty');
		if (closeConnection === true) res.end('Error: Recipent Chat Id is empty');
		return;
	}
	var messageId = 0;
	var config = { chat_id: chatId, user_id: userId} ;
	axios.post('https://api.telegram.org/bot' + botAPI + '/kickChatMember', config ) 
	.then(response => {
		var bannedUser = { 
			date: + new Date(),
			chat_id: chatId,
			user_id: userId,
			user_name: userName,
			reason: reason
		}
		db.BannedUser.insert(bannedUser, function (err, newDoc) {
		  console.log("Banned User. Reason: "+newDoc.reason+", Chat ID: "+newDoc.chat_id)
		});
		if (closeConnection === true) res.end('ok')
    })
    .catch(err => {
		console.log('Error :', err)
		/*if (err.description.indexOf('user is an administrator') >= 0) {
			closeConnection = false;
			sendMessage(res, botAPI, chatId, 'The user cannot be banned he is an admin. Kick him out manually', "HTML", false, 0, true);
		} else {
			console.log('Error :', err)
		}*/
		
		if (closeConnection === true) res.end('Error :' + err)
    });
	
}

function unBanChatMember(res, botAPI, chatId, userId, closeConnection) {
	if (chatId == 0) {
		console.log('Error: Chat Id is empty');
		if (closeConnection === true) res.end('Error: Recipent Chat Id is empty');
		return;
	}
	var messageId = 0;
	var config = { chat_id: chatId, user_id: userId} ;
	axios.post('https://api.telegram.org/bot' + botAPI + '/unbanChatMember', config ) 
	.then(response => {
		if (closeConnection === true) res.end('ok')
    })
    .catch(err => {
		console.log('Error :', err)
		if (closeConnection === true) res.end('Error :' + err)
    });
	
}

function sendMessage(res, botAPI, recipentId, message, recipentName, parseMode, isOperation, operationIndex, closeConnection) {
	if (recipentId == 0) {
		console.log('Error: Recipent Id is empty');
		if (closeConnection === true) res.end('Error: Recipent Id is empty');
		return;
	}
	var messageId = 0;
	var apiMethod = "sendMessage" ;
	var config ;
	var type = message[0];
	var messageValue = message[1];
	var medias = message[2];
	var mediaGroupId = message[3];
	if (type === Type.Message) {
		config = { chat_id: recipentId, text: messageValue, parse_mode: parseMode };
	
	} else {
		console.log("MessageType="+type+",MediaGroup="+mediaGroupId);
		if (mediaGroupId === 0) {
			if (type === Type.Photo) {
				apiMethod = "sendPhoto" ;
				config = { chat_id: recipentId, photo: medias[0].file_id, caption: messageValue, parse_mode: parseMode };
			
			} else if (type === Type.Audio) {
				apiMethod = "sendAudio" ;
				config = { chat_id: recipentId, audio: medias[0].file_id, caption: messageValue, parse_mode: parseMode };
				
			} else if (type === Type.Video) {
				apiMethod = "sendVideo" ;
				config = { chat_id: recipentId, video: medias[0].file_id, caption: messageValue, parse_mode: parseMode };
				
			} else if (type === Type.Document) {
				apiMethod = "sendDocument" ;
				config = { chat_id: recipentId, document: medias[0].file_id, caption: messageValue, parse_mode: parseMode };
				
			} else if (type === Type.Animation) {
				apiMethod = "sendAnimation" ;
				config = { chat_id: recipentId, animation: medias[0].file_id, caption: messageValue, parse_mode: parseMode };
				
			} else if (type === Type.Voice) {
				apiMethod = "sendVoice" ;
				config = { chat_id: recipentId, voice: medias[0].file_id, caption: messageValue, parse_mode: parseMode };
				
			} else if (type === Type.VideoNote) {
				apiMethod = "sendVideoNote" ;
				config = { chat_id: recipentId, video_note: medias[0].file_id, caption: messageValue, parse_mode: parseMode };
				
			} else { //assume it message
				
			
			}
			
		} else { //media group
			
			
		}
	}
	
	axios.post('https://api.telegram.org/bot' + botAPI + '/'+apiMethod, config ) 
	.then(response => {
		lasBotChatId = recipentId; 
		messageId = response.data.result.message_id;
		if (isOperation === true) {
			requestedOperations[operationIndex].messagesId.push([true, recipentId, messageId, messageValue]);
		}
		console.log('Sent Message to user ' + recipentName)
		if (closeConnection === true) res.end('ok')
	})
	.catch(err => {
		console.log('Error :', err)
		if (closeConnection === true) res.end('Error :' + err)
	});
	
}

function deleteMessage(res, botAPI, chat_id, message_id, message, senderName, closeConnection) {
	var config = { chat_id: chat_id, message_id: message_id };
	axios.post('https://api.telegram.org/bot' + botAPI + '/deleteMessage', config ) 
	.then(response => {
		if (senderName == message || senderName.indexOf('@') < 0) { senderName = botName; } 
		var deletedMessage = { 
			date: + new Date(),
			chat_id: chat_id,
			message_id: message_id,
			user_name: senderName,
			message: message
		}
		db.DeletedMessage.insert(deletedMessage, function (err, newDoc) {
		  console.log("Deleted Message. Message ID: "+newDoc.message+", Chat ID: "+newDoc.chat_id)
		});
		if (closeConnection === true) res.end('ok')
    })
    .catch(err => {
		console.log('Error :', err)
		if (closeConnection === true) res.end('Error :' + err)
    });
}

function getUserMessageOptions(user) {
	return `Review ` + user +` activity. Select an option below, you can select more than one? 
	
1. Delete last message
2. Ban user 
3. Delete all messages from the user
	`;
}

function getHelpMessage() {
	return `Usage: @` + botName + ` <b>COMMAND/REQUEST</b>
The following command and request is honoured. Note that only the <i>administators</i> can send command to the bot. 
	
<b>help</b> - Display this help message	
<b>unban</b> - unban a member if not in global list e.g <code>unban @_the_banned_username</code>
<b>review</b> - Request an operation on user e.g <code>review @_the_username</code>

<b>SETTINGS</b>
The settings commands should be entered in a key value pair format, for multiple setting command at once it should be seperated with comma.
e.g <code>silent=true,elapsetime=30</code>. Only Administrators with higher permission can change settings.

<b>addAdmin</b> - add a new bot administrator or change the admin permission level e.g <code>addAdmin name=thecarisma,level=1</code>
<b>removeAdmin</b> - remove a bot administrator e.g <code>removeAdmin name=thecarisma</code>

<b>elapsetime</b> - set the time it takes for an operation to expire in seconds (30 seconds by default) e.g <code>elapsetime=50</code>
<b>silent</b> - set the bot to be silent or send all information message e.g <code>silent=true</code>
<b>spamcount</b> - change how many time a message is repeated to tag as spam (3 by default) e.g <code>spamcount=2</code>
<b>cleanup</b> - enable or Disable the bot from deleting verification messages e.g <code>cleanup=false</code>
<b>rogue</b> - enable rogue for a very strict spam filter e.g <code>rogue=true</code>
`;
}

function getCaptcha(message, captchaExpirationInSeconds) {
	var expectedAnswer = getRandomInt(1, 9) ;
	var first = getRandomInt(1, expectedAnswer);
	var last = expectedAnswer - first;
	return [message + ` The captcha expires in ` + captchaExpirationInSeconds + ` seconds
<code>
` + first + ` + ` + last + ` = ?
</code>`, expectedAnswer];
};

function getOpExpireText(operationCode, author) {
	if (operationCode === 1) {
		return "Link verification captcha expired for @"+author ;
		
	} else if (operationCode === 2) {
		return "Forwarded message captcha verification expired for @"+author ;
		
	} else/* if (operationCode === 3)*/ {
		return "The last operation requested by @"+author +  " expired " ;
	} 
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getLastMessage(messages, chatId) {
	var i = messages.length;
    while (i--) {
       if (messages[i].chat_id === chatId) {
		   return [true, messages[i].message_id, i, messages[i].text];
       }
    }
    return [false, 0, i, ""];
}

function isSpam(messages, message, spamCount, botOnRogueLevel) {
    var i = messages.length;
	var count = 0 ;
	var spamMessageIds = [] ;
    while (i--) {
       if ((messages[i].text === message.text || (botOnRogueLevel === true && messages[i].text.length <= 5)) && messages[i].chat_id === message.chat_id && messages[i].sender_id === message.sender_id) {
		   count++;
		   spamMessageIds.push({id: messages[i].message_id, index: i, message: messages[i].text});
		   if (count == spamCount) {
			   return [true, spamMessageIds];
		   }
       }
    }
    return [false, spamMessageIds];
}

/*
	This return an array that further describe the operation
	[0] = true if found else false
	[1] = true if the time is past the number of seconds else false (e.g 15 seconds for link)
	[2] = the found actual operation object
	[3] = the index where the found pending operation is
*/
function doesUserHasPendingOperation(res, API, requestedOperations, author, chatId, messageId, chatSetting) {
	var i = requestedOperations.length;
	while (i--) {
		var timeElapsed = ((+ new Date()) - requestedOperations[i].time) / 1000;
		var timeExpired = timeElapsed > chatSetting.captchaExpirationInSeconds;
		console.log(timeElapsed);
		var isAuthor = requestedOperations[i].author === author && requestedOperations[i].chatId === chatId;
		if (timeExpired === true) {
			//remove from list (notify group it expired better to notify bot log group instead)
			if (isAuthor === true) requestedOperations[i].messagesId.push([false, requestedOperations[i].chatId, messageId, ""]);
			if (chatSetting.cleanUpLastBotInteractions === true ) {
				for (var j = (requestedOperations[i].operationCode == 2? 1 : 0); j < requestedOperations[i].messagesId.length; j++) {
					deleteMessage(res, API, requestedOperations[i].messagesId[j][1], requestedOperations[i].messagesId[j][2], requestedOperations[i].messagesId[j][3], "@"+botName, false);
				}
			}
			if (chatSetting.botShouldBeSilent === false) {
				var msg = [Type.Message, getOpExpireText(requestedOperations[i].operationCode, requestedOperations[i].author), null, null];
				sendMessage(res, API, requestedOperations[i].chatId, msg, requestedOperations[i].author, "HTML", false, 0, false);
			}
			requestedOperations.splice(i, 1);
			i = requestedOperations.length; //find better way to manage the list after removing from it
		}
		if (isAuthor === true) {
			if (timeExpired === false) {
				return [true, timeExpired, requestedOperations[i], i];
			} else {
				return [false, false, {}, i];
			}
		}
    }
	return [false, false, {}, i];
}

// Finally, start our server
app.listen((process.env.PORT ? process.env.PORT : 5000), function() { 
	console.log('Telegram app listening on port ' + (process.env.PORT ? process.env.PORT : 5000))
})
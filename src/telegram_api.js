/**P
	:author: Azeez Adewale <azeezadewale98@gmail.com>
	:date: 30 September 2019
**/
const axios = require('axios');
const RynodObjects = require('./rynod_object.js');
const DatabaseOp = require('./database_op.js')
const SuperRynodObjects = require('./rynod_super_object.js');

/**
	Delete  a message from a telegram group/chat. The deleted 
	message full data is recoreded into the database for statistics 
	and analysis.
	
	**parameters**:
		chatId: int
			the group/chat id
		messageId: int
			the message id to delete
		message: Object
			the full message object for record
		userId: int
			the author of the message telegram id
**/
function deleteMessage(chatId, messageId, message, userId) {
	var config = { chat_id: chatId, message_id: messageId };
	axios.post('https://api.telegram.org/bot' + RynodObjects.API + '/deleteMessage', config ) 
	.then(response => {
		if (userId === 0) return;
		var deletedMessage = { 
			date: + new Date(),
			chat_id: chatId,
			message_id: messageId,
			user_id: userId,
			message: message
		}
		//use the database_op
		RynodObjects.Db.DeletedMessages.insert(deletedMessage, function (err, newDoc) {
		  console.log("Deleted Message. Message ID: "+newDoc.message+", Chat ID: "+newDoc.chat_id)
		});
    })
    .catch(err => {
		console.log('Error :', err)
    });
}

/**

**/
function sendMessage(chatId, message, parseMode, operationIndex, addABotChatMessage/*optional*/) {
	if (chatId == 0) {
		return;
	}
	var messageId = 0;
	var apiMethod = "sendMessage" ;
	var config ;
	var type = message.Type;
	var messageValue = message.Text;
	var medias = message.MediaObjects;
	var mediaGroupId = message.MediaGroupId;
	if (type === RynodObjects.MessageType.Message) {
		config = { chat_id: chatId, text: messageValue, parse_mode: parseMode };
	
	} else {
		if (mediaGroupId === 0) {
			if (type === RynodObjects.MessageType.Photo) {
				apiMethod = "sendPhoto" ;
				config = { chat_id: chatId, photo: medias[0].file_id, caption: messageValue, parse_mode: parseMode };
			
			} else if (type === RynodObjects.MessageType.Audio) {
				apiMethod = "sendAudio" ;
				config = { chat_id: chatId, audio: medias[0].file_id, caption: messageValue, parse_mode: parseMode };
				
			} else if (type === RynodObjects.MessageType.Video) {
				apiMethod = "sendVideo" ;
				config = { chat_id: chatId, video: medias[0].file_id, caption: messageValue, parse_mode: parseMode };
				
			} else if (type === RynodObjects.MessageType.Document) {
				apiMethod = "sendDocument" ;
				config = { chat_id: chatId, document: medias[0].file_id, caption: messageValue, parse_mode: parseMode };
				
			} else if (type === RynodObjects.MessageType.Animation) {
				apiMethod = "sendAnimation" ;
				config = { chat_id: chatId, animation: medias[0].file_id, caption: messageValue, parse_mode: parseMode };
				
			} else if (type === RynodObjects.MessageType.Voice) {
				apiMethod = "sendVoice" ;
				config = { chat_id: chatId, voice: medias[0].file_id, caption: messageValue, parse_mode: parseMode };
				
			} else if (type === RynodObjects.MessageType.VideoNote) {
				apiMethod = "sendVideoNote" ;
				config = { chat_id: chatId, video_note: medias[0].file_id, caption: messageValue, parse_mode: parseMode };
				
			} else { //assume it message
				
			
			}
			
		} else { //media group
			
			
		}
	}
	
	axios.post('https://api.telegram.org/bot' + RynodObjects.API + '/'+apiMethod, config ) 
	.then(response => {
		lasBotChatId = chatId; 
		messageId = response.data.result.message_id;
		console.log("Sent a new message to chat '" + chatId + "' at " + (new Date()));
		if (operationIndex > -1) {//operation
			RynodObjects.RequestedOperations[operationIndex].MessageIds.push({
				MessageId: messageId,
				Message: message,
				UserId: 0 
			});
		} else if (operationIndex === -2) {//bot message
			if (addABotChatMessage) {
				message.MessageId = messageId;
				message.UserId = 0;
				//console.log(message);
				addABotChatMessage(chatId, message);
			}
		}
	})
	.catch(err => {
		console.log('Error :', err)
	});
	
}

/**

**/
function kickChatMember(chatId, userId, userName, reason, checkGlobal, sendBotNotification, addABotChatMessage) {
	//cannot kick group admin or bot admin
	if (chatId == 0) {
		console.log('Error: Chat Id is empty');
		return;
	}
	var messageId = 0;
	var config = { chat_id: chatId, user_id: userId} ;
	axios.post('https://api.telegram.org/bot' + RynodObjects.API + '/kickChatMember', config ) 
	.then(response => {
		if (checkGlobal === false) return;
		var userObject = { 
			user_id: userId,
			user_name: userName,
			banned_groups_data: "UnknownGroupName" + ":" + chatId + ":" + reason + ":" + (+new Date())
		}
		DatabaseOp.banAUser(RynodObjects.Db.BannedUsers,userObject,function (err, bannedGroupCount, newDoc) {
			console.log("Banned Count: " + bannedGroupCount + ", User: " + userName);
			if (bannedGroupCount >= RynodObjects.BannedGroupLimit) {
				console.log(""+bannedGroupCount+","+RynodObjects.BannedGroupLimit);
				//add to global banned list
				DatabaseOp.banAUser(RynodObjects.Db.GlobalBannedUsers,userObject,function (gErr, gBannedGroupCount, gNewDoc) {
					console.log("The member " + userName + " has been caugth in the global ban list initiatin ban on all groups and chats managed by the bot");
					for (var lastMessage of SuperRynodObjects.LastMessages) {
						if (lastMessage.ChatId === chatId) continue; //current group. already removed
						if (lastMessage.ChatId === userId) continue; //private chat
						getChatMember(lastMessage.ChatId, userId, function(sentChatId, result) {
							if (result.data.result.status === 'member') {
								//also listen for the person added again
								//maybe delete all the user messages too
								var msg = {
									Type: RynodObjects.MessageType.Message,
									Text: "The member @" + userName + " has been caught in the global ban list. Removing the member from this group",
									MediaObjects: [],
									MediaGroupId: 0
								};
								sendMessage(sentChatId, msg, RynodObjects.ParseMode.HTML, -2, addABotChatMessage);
								kickChatMember(sentChatId, userId, userName, "The user is caught up in the global ban list", false)
								console.log("Delete in group : " + sentChatId);
							}
						}); 
					}
					if (sendBotNotification) {
						sendBotNotification(
							{
								text: "The member " + userName + " has been caugth in the global ban list initiating ban on all groups and chats managed by the bot",
								date: (+ new Date())
							}
						)
					}
					//RynodObjects.Db.BannedUsers.remove({ user_id: userId }, { multi: true }, function (err, numRemoved) {
						//done 
					//});
					
				});
				
			}
		});
    })
    .catch(err => {
		console.log('Error :', err)
		/*if (err.description.indexOf('user is an administrator') >= 0) {
			closeConnection = false;
			//sendMessage(res, botAPI, chatId, 'The user cannot be banned he is an admin. Kick him out manually', "HTML", false, 0, true);
		} else {
			console.log('Error :', err)
		}*/
    });
	
}


/**

**/
function getChatMember(chatId, userId, callbackFunction, errorCallback) {
	var __config = { chat_id: chatId, user_id: userId };
	axios.post('https://api.telegram.org/bot' + RynodObjects.API + '/getChatMember', __config ) 
	.then(response => {
		callbackFunction(chatId, response);
	})
	.catch(err => {
		if (errorCallback) { errorCallback(err); }
	});
}


/**

**/
function getChatAdministrators(chatId, callbackFunction, errorCallback) {
	var __config = { chat_id: chatId };
	axios.post('https://api.telegram.org/bot' + RynodObjects.API + '/getChatAdministrators', __config ) 
	.then(response => {
		callbackFunction(response);
	})
	.catch(err => {
		if (errorCallback) { errorCallback(err); }
	});
}


/**
	Export the functions
**/
module.exports = {
	deleteMessage,
	sendMessage,
	kickChatMember,
	DatabaseOp,
	getChatMember,
	getChatAdministrators
};
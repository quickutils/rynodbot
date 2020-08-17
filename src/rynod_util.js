/**P
	:author: Azeez Adewale <azeezadewale98@gmail.com>
	:date: 29 September 2019
**/

const RynodObjects = require('./rynod_object.js');
const SuperRynodObjects = require('./rynod_super_object.js');
const TelegramApi = require('./telegram_api.js');

/**
	Chached Version of the last message data for quick 
	search and result
**/
var cachedLastMessageData = { ChatId: -1 } ;

/**
	Chached Version of the last chat setting for quick 
	search and result
**/
var cachedChatSetting = { ChatId: -1 } ;

/**
	Chached Version of the chat adminstrator for quick 
	search and result
**/
var cachedChatAdministrator = { ChatId: -1, UserId: -1} ;

/**
	Chached Version of the bot super adminstrator for quick 
	search and result
**/
var cachedSuperAdministrator = { UserId: -1 } ;

/**
	Clear the cache of the bot 
**/
function clearCache() {
	cachedLastMessageData = { ChatId: -1 } ;
	cachedChatSetting = { ChatId: -1 } ;
	cachedChatAdministrator = { ChatId: -1, UserId: -1} ;
	cachedSuperAdministrator = { UserId: -1 } ;
}

/**
	Check whether a string is a valid url address
	
	**parameters**:
		urlString: String
			the string to check if it url
			
	**return**:
		true if the string is valid url else false
**/
function isUrlAddress(urlString) {
	return (urlString.indexOf('https://') >= 0 || urlString.indexOf('http://') >= 0 || urlString.indexOf('.com') >= 0 || urlString.indexOf('wwww.') >= 0);
}

/**
	Send a notification to various channel when an operation 
	is carried out in the bot. This can be banned user, deletes 
	message e.t.c. 
	
	This function can be expanded to send notification to various 
	channels e.g email, registered callback urls.
	
	..note:
		The only place notified currently is the bot telegram log 
		channel
		
	The object parameter must contains at least two field which is 
	text and date, any extra field can be appended 
	
	::
		
		{
			text: "The user @thecarisma with id '12345' spammed the group",
			date: "1569774789883"
		}
		
	**parameters**:
		object: Object
			The valid JSON object that contains operation detail
**/
function sendBotNotification(object) {
	console.log("Notification Text: " + object.text);
}


/**
	Get a custom text to indicate what operation expires  
	
	**parameters**:
		opType: Object
			the operation type 
		author: String
			the author of the operation
			
	**return**:
		the text about expired operation
**/
function getOpExpireText(opType, author) {
	if (opType === RynodObjects.OperationType.LinkVerification) {
		return "Link verification captcha expired for @" + author ;
		
	} else if (opType === RynodObjects.OperationType.ForwardedMessage) {
		return "Forwarded message captcha verification expired for @" + author ;
		
	} else {
		return "The last operation requested by @" + author +  " expired " ;
	} 
}

/**
	Get a random integer between a minumum and maximum 
	range 
	
	**parameters**:
		min: int
			the minimum range
		max: int
			the maximum range
			
	**return**:
		a random number between given range
**/
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
	Check if the author of an operation, message is the 
	bot itself.
	
	**parameters**:
		author: String 
			the sender name
			
	**return**:
		true if the author is the bot
**/
function authorIsBot(author) {
	if (!author) return '' ;
	return author.replace('@', '').trim() === RynodObjects.BotName && author === RynodObjects.BotName;
}

/**
	Update a chat settings for a group or chat, this function 
	expects the full chatSetting object to be sent as parameter 
	as the old value is completely replaced. 
	
	If the ChatId of the chatSetting object is not in the list of 
	group setting it is added into the list

	**parameters**:
		chatSetting: Object
			the group/chat setting including the set ChatId
			
	**see**:
		`SuperRynodObjects.DefaultSetting` for Object structure
**/
function updateChatSetting(chatSetting) {
	var index = getChatSettingIndex(chatSetting.ChatId);
	if (index === -1) {
		SuperRynodObjects.ChatSettings.push(chatSetting);
	} else {
		SuperRynodObjects.ChatSettings[index] = chatSetting;
	}
}

/**
	Get the setting for a chat or group. If the group/chat 
	does not have a setting the default setting is applied 
	for the group. 
	
	The chatSetting is cahced for speed and performance.
	
	**parameters**:
		chatId: int
			the group or chat id
			
	**return**:
		the group or chat settings 
**/
function getChatSetting(chatId) {
	var index = getChatSettingIndex(chatId);
	if (index === -1) {
		var newSetting = {
			ChatId: chatId,
			BotShouldBeSilent: false, 
			OperationElapseTime: 30, 
			SpamCount: 3, 
			BotOnRogueLevel: false, 
			CleanUpLastBotInteractions: true, 
			CacheSize: 100
		};
		SuperRynodObjects.ChatSettings.push(newSetting);
		cachedChatSetting = newSetting;
	} else {
		cachedChatSetting = SuperRynodObjects.ChatSettings[index];
	}	
	return cachedChatSetting;
}

/**
	Get the index where the chat or group id is found in the list of 
	chat settings
	
	**parameters**:
		chatId: int
			the group or chat id
			
	**return**:
		the index of the group or chat setting
**/
function getChatSettingIndex(chatId) {
	for (var a = 0; a < SuperRynodObjects.ChatSettings.length; a++) {
		if (SuperRynodObjects.ChatSettings[a].ChatId === chatId) {
			return a;
		}
	}
	return -1;
}

/**
	Add a new last message to a group or chat database. If the 
	chat/group has been added before the list of last message 
	is updated.
	
	The maximum number of last messages that can be added is 
	managed by group/chat setting `CacheSize`
	
	The second parameter is a valid message data like below: 
	
	:: 
		
		{ 
			Text: "the final last message", 
			MessageId: 1353156, 
			AuthorUsername: "thecarisma", 
			AuthorId: 24355353, 
			AuthorIsBot: false, 
			Type: RynodObjects.MessageType.Message, 
			MediaObjects: []
		}
	
	**parameters**:
		chatId: int
			the group or chat id
		newMessage: Object
			the new message data to add to the list
**/
function addALastMessage(chatId, newMessage) {
	var index = getLastMessagesIndex(chatId);
	var setting = getChatSetting(chatId);
	if (index === -1) {
		SuperRynodObjects.LastMessages.push(
			{
				ChatId: chatId,
				LastMessages: [
					newMessage
				]
			}
		);
	} else {
		SuperRynodObjects.LastMessages[index].LastMessages.push(newMessage);
		SuperRynodObjects.LastMessages[index].LastMessages.splice(0, SuperRynodObjects.LastMessages[index].LastMessages.length - setting.CacheSize);
	}
}

/**
	Get the index where the chat or group id is found in the list of 
	saved last messages
	
	**parameters**:
		chatId: int
			the group or chat id
			
	**return**:
		the index of the last messages in the group or chat
**/
function getLastMessagesIndex(chatId) {
	for (var a = 0; a < SuperRynodObjects.LastMessages.length; a++) {
		if (SuperRynodObjects.LastMessages[a].ChatId === chatId) {
			return a;
		}
	}
	return -1;
}

/**
	Get all the last messages from a group or chat, this 
	does not include message sent by the bot or message that 
	request the bot for an operation.
	
	the number of messages in the list depends on the CacheSize 
	of each of the group settings.
	
	**parameters**:
		chatId: int
			the group or chat id
			
	**return**:
		the last messages in the group or chat
**/
function getLastMessages(chatId) {
	for (var lastMessages of SuperRynodObjects.LastMessages) {
		if (lastMessages.ChatId === chatId) {
			return lastMessages.LastMessages;
		}
	}
	return [];
}

/**
	Get the last message in a particular group or chat.
	
	The last returned last message is cached to prevent 
	finding it again of the chatId is same as the last chatId 
	sent as parameter.
	
	**parameters**:
		chatId: int
			the group or chat id
			
	**return**:
		the last message in the group or chat
**/
function getLastMessageData(chatId) {
	if (cachedLastMessageData.ChatId === chatId) {
		return cachedLastMessageData;
	}
	var lstMsgs = getLastMessages(chatId);
	if (lstMsgs.length > 0) {
		cachedLastMessageData = lstMsgs[lstMsgs.length-1]
	}
	return cachedLastMessageData;
}

/**

**/
function removeChatLastMessageAt(chatIndex, lastMessageIndex) {
	if (chatIndex < 0) return;
	SuperRynodObjects.LastMessages[chatIndex].LastMessages.splice(lastMessageIndex, 1);
}

/**
	Delete an operation from the list of pending requested operations 
	using the index of the operation.

	**parameters**:
		index: int
			the index in the list to delete
			
	**return**:
		the operation object that was deleted
**/
function removeRequestedOperationAt(index) {
	return RynodObjects.RequestedOperations.splice(index, 1);
}

/**
	Add a new operation to the list of pending requested operation.
	The parameter is a valid operation data like below: 
	
	:: 
		
		{
			ChatId: 0, 
			OperationType: RynodObjects.OperationType.None, 
			Author: "", 
			UserId: 0, 
			ExtraData: "", 
			MessageData: "", 
			MessageIds : [], 
			Time: + new Date()
		}
		
	The `ChatId` is the group where the operation is taking place. 
	`OperationType` is the type of operation to be carried out. `Author` 
	is the name of the user that requested the operation. `UserId` is 
	the author telegram id. `ExtraData` is any extra object which will be 
	needed during operation e.g OperationType of LinkVerification will have 
	it expected answer as it extra data. `MessageIds` is the list of id of 
	the messages sent in the group for the operation that are to be deleted 
	when operation complete, failed or time elapsed. `Time` is used to check 
	if the operation has passed the chat/group **OperationElapseTime**.
		
	**parameters**:
		operation: Object
			add a new operation to the list 
**/
function addRequestedOperation(operation) {
	RynodObjects.RequestedOperations.push(operation);
	return RynodObjects.RequestedOperations.length - 1;
}

/**

**/
function getBotChatMessageIndex(chatId) {
	for (var a = 0; a < SuperRynodObjects.BotChatMessages.length; a++) {
		if (SuperRynodObjects.BotChatMessages[a].ChatId === chatId) {
			return a;
		}
	}
	return -1;
}

/**

**/
function addABotChatMessage(chatId, newBotChatMessage) {
	var index = getBotChatMessageIndex(chatId);
	var setting = getChatSetting(chatId);
	if (index === -1) {
		SuperRynodObjects.BotChatMessages.push(
			{
				ChatId: chatId,
				LastMessages: [
					newBotChatMessage
				]
			}
		);
	} else {
		SuperRynodObjects.BotChatMessages[index].LastMessages.push(newBotChatMessage);
		SuperRynodObjects.BotChatMessages[index].LastMessages.splice(0, SuperRynodObjects.BotChatMessages[index].LastMessages.length - setting.CacheSize);
	}
}

/**

**/
function getBotChatMessages(chatId) {
	for (var botChatMessages of SuperRynodObjects.BotChatMessages) {
		if (botChatMessages.ChatId === chatId) {
			return botChatMessages.LastMessages;
		}
	}
	return [];
}

/**

**/
function removeBotChatMessageAt(chatIndex, botChatMessageIndex) {
	if (chatIndex < 0) return;
	SuperRynodObjects.BotChatMessages[chatIndex].LastMessages.splice(botChatMessageIndex, 1);
}

/**
	**parameters**:
		chatSetting: Object
			the group/chat setting
		author: String 
			the author to look for his/her/it pending operation
		chatId: int
			the group/chat id
		currentMessageData: Object
			the current message object
			
	**return**:
		an Object with the operation data
**/
function checkUserPendingOperation(chatSetting, author, chatId, currentMessageData) {
	var i = RynodObjects.RequestedOperations.length;
	while (i--) {
		var timeElapsed = ((+ new Date()) - RynodObjects.RequestedOperations[i].Time) / 1000;
		var timeExpired = timeElapsed > chatSetting.OperationElapseTime;
		var isAuthor = RynodObjects.RequestedOperations[i].Author === author && RynodObjects.RequestedOperations[i].ChatId === chatId;
		//console.log(timeElapsed);
		if (timeExpired === true) {
			var expireText = getOpExpireText(RynodObjects.RequestedOperations[i].OperationType, RynodObjects.RequestedOperations[i].Author);
			sendBotNotification(
				{
					text: expireText,
					date: (+ new Date())
				}
			)
			if (isAuthor === true) { 
				RynodObjects.RequestedOperations[i].MessageIds.push({
					MessageId: currentMessageData.MessageId,
					Message: currentMessageData,
					UserId: 0 
				});
			}
			if (chatSetting.CleanUpLastBotInteractions === true ) {
				for (var j = (RynodObjects.RequestedOperations[i].OperationType === 2 ? 1 : 0); j < RynodObjects.RequestedOperations[i].MessageIds.length; j++) {
					TelegramApi.deleteMessage(RynodObjects.RequestedOperations[i].ChatId, RynodObjects.RequestedOperations[i].MessageIds[j].MessageId, RynodObjects.RequestedOperations[i].MessageIds[j].Message, RynodObjects.RequestedOperations[i].MessageIds[j].UserId);
				}
			}
			if (chatSetting.BotShouldBeSilent === false) {
				var msg = {
					Type: RynodObjects.MessageType.Message,
					Text: expireText,
					MediaObjects: [],
					MediaGroupId: 0
				};
				TelegramApi.sendMessage(RynodObjects.RequestedOperations[i].ChatId, msg, RynodObjects.ParseMode.HTML, -1);
			}
			RynodObjects.RequestedOperations.splice(i, 1);
			i = RynodObjects.RequestedOperations.length; //find better way to manage the list after removing from it
		}
		if (isAuthor === true) {
			if (timeExpired === false) {
				return {
					HasOperation: true,
					Index: i,
					Operation: RynodObjects.RequestedOperations[i]
				};
			} else {
				break;
			}
		}
    }
	return {
			HasOperation: false,
			Index: i
		};	
}

/**

**/
function isSpam(chatSetting, lastMessages, currentMessageData, callbackFunction) {
	var i = lastMessages.length;
	var count = 0 ;
	var spamMessageIds = [] ;
    while (i--) {
		if ((lastMessages[i].Text === currentMessageData.Text || (chatSetting.BotOnRogueLevel === true && lastMessages[i].Text.length <= 5)) && lastMessages[i].AuthorId === currentMessageData.AuthorId) {
			count++;
			spamMessageIds.push({
			   Id: lastMessages[i].MessageId, 
			   Index: i, 
			   Message: lastMessages[i]
			});
			if (count === chatSetting.SpamCount) {
				callbackFunction(spamMessageIds);
				return ;
			}
       }
    }
}

/**

**/
function getSuperAdministrator(userId) {
	if (cachedSuperAdministrator.UserId === userId) {
		return {
			IsAdmin: true,
			IsSuperAdmin: true,
			Detail: cachedSuperAdministrator
		};
	}
	for (var administrator of SuperRynodObjects.SuperAdministrators) {
		if (administrator.UserId === userId) {
			cachedSuperAdministrator = administrator;
			return {
				IsAdmin: true,
				IsSuperAdmin: true,
				Detail: cachedSuperAdministrator
			};
		}
	}
	return {
		IsAdmin: false
	};
}

/**

**/
function addAdministrator(chatId, adminObject) {
	var index = getAdministratorIndex(chatId);
	if (index === -1) {
		SuperRynodObjects.Administrators.push(
			{
				ChatId: chatId,
				Adminstrators: [
					adminObject
				]
			}
		);
	} else {
		SuperRynodObjects.Administrators[index].Adminstrators.push(adminObject);
	}
}

/**

**/
function getAdministratorIndex(chatId) {
	for (var a = 0; a < SuperRynodObjects.Administrators.length; a++) {
		if (SuperRynodObjects.Administrators[a].ChatId === chatId) {
			return a;
		}
	}
	return -1;
}

/**

**/
function getAdministratorIndexWithName(chatId, name) {
	for (var group of SuperRynodObjects.Administrators) {
		if (group.ChatId === chatId) {
			for (var a = 0; a < group.Adminstrators.length; a++) {
				if (group.Adminstrators[a].Name === name) {
					return a;
				}
			}
		}
	}
	return -1;
}

/**

**/
function getAdministrator(chatId, userId) {
	if (cachedChatAdministrator.ChatId === chatId && cachedChatAdministrator.UserId === userId) {
		return {
			IsAdmin: true,
			Detail: cachedChatAdministrator
		};
	}
	for (var group of SuperRynodObjects.Administrators) {
		if (group.ChatId === chatId) {
			for (var administrator of group.Adminstrators) {
				if (administrator.UserId === userId) {
					cachedChatAdministrator = administrator;
					cachedChatAdministrator.ChatId = chatId;
					return {
						IsAdmin: true,
						Detail: cachedChatAdministrator
					};
				}
			}
		}
	}
	return {
		IsAdmin: false
	};
}

/**

**/
function getAdministratorWithName(chatId, name) {
	if (cachedChatAdministrator.ChatId === chatId && cachedChatAdministrator.Name === name) {
		return {
			IsAdmin: true,
			Detail: cachedChatAdministrator
		};
	}
	for (var group of SuperRynodObjects.Administrators) {
		if (group.ChatId === chatId) {
			for (var administrator of group.Adminstrators) {
				if (administrator.Name === name) {
					cachedChatAdministrator = administrator;
					cachedChatAdministrator.Name = name;
					return {
						IsAdmin: true,
						Detail: cachedChatAdministrator
					};
				}
			}
		}
	}
	return {
		IsAdmin: false
	};
}

/**

**/
function isDefined(param) {
	return typeof param !== "undefined";
}

/**

**/
function findChatMemberInCache(chatId, userName) {
	var result = {};
	result.Id = 0;
	for (var lastMessages of SuperRynodObjects.LastMessages) {
		if (lastMessages.ChatId === chatId) {
			for (var lastMessage of lastMessages.LastMessages) {
				if (lastMessage.AuthorUsername === userName) {
					result.Found = true;
					result.Id = lastMessage.AuthorId;
					return result;
				}
			}
		}
	}
	result.Found = false;
	return result;
}

/**
	Export the functions
**/
module.exports = {
	isUrlAddress,
	sendBotNotification,
	getOpExpireText,
	getRandomInt,
	authorIsBot,
	updateChatSetting,
	getChatSettingIndex,
	getChatSetting,
	addALastMessage,
	removeChatLastMessageAt,
	getLastMessagesIndex,
	getLastMessages,
	getLastMessageData,
	removeRequestedOperationAt,
	addRequestedOperation,
	checkUserPendingOperation,
	isSpam,
	getSuperAdministrator,
	addAdministrator,
	getAdministratorIndex,
	getAdministratorIndexWithName,
	getAdministrator,
	getAdministratorWithName,
	clearCache,
	getBotChatMessageIndex,
	addABotChatMessage,
	getBotChatMessages,
	removeBotChatMessageAt,
	isDefined,
	findChatMemberInCache
};

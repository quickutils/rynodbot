var express = require('express');
var app = express();
var bodyParser = require('body-parser');
const keyValue = require('@thecarisma/key-value-db');

const TelegramBotUtil = require('./src/telegram_bot_util.js');
const TelegramApi = require('./src/telegram_api.js');
const RynodUtil = require('./src/rynod_util.js');
const RynodObjects = require('./src/rynod_object.js');
const SuperRynodObjects = require('./src/rynod_super_object.js');

app.use(bodyParser.json()) 
app.use(
  bodyParser.urlencoded({
    extended: true
  })
)

app.post('/', function(req, res) {
	//console.log(req.body);	
	var tempMessage = req.body.message ; 
	if (!RynodUtil.isDefined(tempMessage)) {
		tempMessage = req.body.edited_message ; //edited message
		
		if (!RynodUtil.isDefined(tempMessage)) {
			//TODO: If tempMessage is always null, request bot to become admin
			return res.end(); 
		}
	}
	const message = tempMessage;
	TelegramBotUtil.checkAndAddAdmins(message.chat.id, RynodUtil.getChatSettingIndex(message.chat.id));
	if (RynodUtil.isDefined(message.new_chat_member)) {
		res.end();
		newUserAdded(message);
	}
	if ((!message.text && !message.caption) && !message.forward_from ) {
		return res.end();
	}
	res.end();
	perform(message);
});


/**X
	Perform all the request asynchronously 
	
	I dont't even know if it trully asyn
**/
async function perform(message) {
	var messageText = "";
	var hasCaption = false;
	var messageType = RynodObjects.MessageType.Message;
	var mediaObjects = [];
	if (message.text) {
		messageText = message.text.trim();
	} else {
		if (message.caption) {
			messageText = message.caption.trim();
		} else {
			
		}
		
		hasCaption = true;
		if (message.photo) {
			messageType = RynodObjects.MessageType.Photo;
			mediaObjects = message.photo;
			
		} else if (message.audio) {
			messageType = RynodObjects.MessageType.Audio;
			mediaObjects = message.audio;
			
		} else if (message.video) {
			messageType = RynodObjects.MessageType.Video;
			mediaObjects = message.video;
			
		} else if (message.document) {
			messageType = RynodObjects.MessageType.Document;
			mediaObjects = message.document;
			
		} else if (message.animation) {
			messageType = RynodObjects.MessageType.Animation;
			mediaObjects = message.animation;
			
		} else if (message.voice) {
			messageType = RynodObjects.MessageType.Voice;
			mediaObjects = message.voice;
			
		} else if (message.video_note) {
			messageType = RynodObjects.MessageType.VideoNote;
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
	}
	var messageId = message.message_id ;
	var mediaGroupId = 0;
	var chatId = message.chat.id;
	var senderId = message.from.id;
	var senderIsBot = message.from.is_bot;
	var senderUsername = message.from.username;
	var isForwarded = (message.forward_from ? true : false);
	var chatSetting = RynodUtil.getChatSetting(chatId);
	var lastMessagesIndex = RynodUtil.getLastMessagesIndex(chatId);
	var lastMessages = RynodUtil.getLastMessages(chatId);
	var currentMessageData = { 
								Text: messageText.trim(), 
								MessageId: messageId, 
								AuthorUsername: senderUsername, 
								AuthorId: senderId, 
								AuthorIsBot: senderIsBot,
								Type: messageType, 
								MediaObjects: mediaObjects,
								MediaGroupId: mediaGroupId
							};
	var pendingOp = RynodUtil.checkUserPendingOperation(chatSetting, senderUsername, chatId, currentMessageData);
	
	//console.log("CurrentMessage: " + messageText);
	//console.log("LastMessage:    " + RynodUtil.getLastMessageData(chatId).Text);
	//console.log(chatSetting);
	//console.log(pendingOp);

	//check spam
	if (pendingOp.HasOperation === false 
										/**&& messageText.indexOf(RynodObjects.BotName) < 0 **/
													&& !messageText.startsWith('/') && !RynodUtil.isUrlAddress(messageText) 
																		&& !RynodUtil.authorIsBot(senderUsername)
																		&& isForwarded === false) {
		RynodUtil.addALastMessage(chatId, currentMessageData);
		RynodUtil.isSpam(chatSetting, lastMessages, currentMessageData, function (result) {
			//check if has been ban in another group then remove in all the other groups 
			//if it ban for the first time tell group, user has to be added in 30 days
			var z = RynodUtil.getAdministratorIndexWithName(chatId, senderUsername);
			if (z === -1) {
				TelegramApi.kickChatMember(chatId, senderId, senderUsername, "Spammed the group with message '" + currentMessageData.Text + "'", true, RynodUtil.sendBotNotification, RynodUtil.addABotChatMessage); 
				if (chatSetting.BotShouldBeSilent === false) {
					var msg = {
						Type: RynodObjects.MessageType.Message,
						Text: "@" + currentMessageData.AuthorUsername + " has been banned from this group by " + RynodObjects.BotRealName + " for spamming",
						MediaObjects: [],
						MediaGroupId: 0
					};
					TelegramApi.sendMessage(chatId, msg, RynodObjects.ParseMode.HTML, -2, RynodUtil.addABotChatMessage);
					RynodUtil.sendBotNotification(
						{
							text: currentMessageData.AuthorUsername + " has been banned from this group by " + RynodObjects.BotRealName + " for spamming",
							date: (+ new Date())
						}
					)
				}
				for (var spam of result) {
					TelegramApi.deleteMessage(chatId, spam.Message.MessageId, spam.Message, senderId);
					RynodUtil.removeChatLastMessageAt(lastMessagesIndex, spam.Index);
				}
			} else {
				RynodUtil.sendBotNotification(
					{
						text: "@" + currentMessageData.AuthorUsername + " has been banned from this group by " + RynodObjects.BotRealName + " for spamming",
						date: (+ new Date())
					}
				)
			}
		});
		return;
		
	}
	
	//accept commands treat operation 
	if (pendingOp.HasOperation === true /*&& (messageText.replace('@', '').replace(RynodObjects.BotName, '').replace(/\s+/g, '').trim().length < 3)*/) {
		var response = messageText.replace('@', '').replace(RynodObjects.BotName, '');
		pendingOp.Operation.MessageIds.push({
			MessageId: messageId,
			Message: currentMessageData,
			UserId: senderId 
		});
		if (chatSetting.CleanUpLastBotInteractions === true) {
			for (var i = 0; i < pendingOp.Operation.MessageIds.length; i++) {
				TelegramApi.deleteMessage(pendingOp.Operation.ChatId, pendingOp.Operation.MessageIds[i].MessageId, pendingOp.Operation.MessageIds[i].Message, pendingOp.Operation.MessageIds[i].UserId);
			}
		}
		if (pendingOp.Operation.OperationType === RynodObjects.OperationType.LinkVerification || pendingOp.Operation.OperationType === RynodObjects.OperationType.ForwardedMessage) { //captcha verification
			TelegramBotUtil.treatCaptchaOperation(pendingOp, response);
		}
		
	}
	if (RynodUtil.isUrlAddress(messageText)) {
		TelegramApi.deleteMessage(chatId, messageId, currentMessageData, senderId);
		TelegramBotUtil.urlCaptchaOperation(senderUsername, chatSetting.OperationElapseTime, function (op, msg) {
			currentMessageData.Text = "@" + senderUsername + " posted: " + currentMessageData.Text ;
			op.MessageData = currentMessageData;
			op.UserId = senderId;
			op.ChatId = chatId;
			var index = RynodUtil.addRequestedOperation(op);			
			TelegramApi.sendMessage(chatId, msg, RynodObjects.ParseMode.HTML, index);
		});
		
	} else if (isForwarded === true) {
		TelegramApi.deleteMessage(chatId, messageId, currentMessageData, senderId);
		TelegramBotUtil.forwardedCaptchaOperation(senderUsername, chatSetting.OperationElapseTime, function (op, msg) {
			currentMessageData.Text = "@" + senderUsername + " forwarded: " + currentMessageData.Text ;
			op.MessageData = currentMessageData;
			op.UserId = senderId;
			op.ChatId = chatId;
			var index = RynodUtil.addRequestedOperation(op);			
			TelegramApi.sendMessage(chatId, msg, RynodObjects.ParseMode.HTML, index);
		});
		
	} else if (messageText.startsWith('/')) {
		var command = messageText.toLowerCase();
		if (!messageText.startsWith('/dellastmsg') && !messageText.startsWith('/review') && !messageText.startsWith('/unban') &&
			!messageText.startsWith('/kick') && !messageText.startsWith('/clearlog') && !messageText.startsWith('/statistic') && 
			!messageText.startsWith('/setting') && !messageText.startsWith('/help') && !messageText.startsWith('/backup')) {
			return;
		}
		var superPermissionData = RynodUtil.getSuperAdministrator(senderId);
		var permissionData = RynodUtil.getAdministrator(chatId, senderId);
		if (permissionData.IsAdmin === false) {
			permissionData = RynodUtil.getAdministratorWithName(chatId, senderUsername);
		}
		if (permissionData.IsAdmin === false && superPermissionData.IsAdmin === false) {
			if (chatSetting.CleanUpLastBotInteractions === true) {
				TelegramApi.deleteMessage(chatId, currentMessageData.MessageId, currentMessageData, currentMessageData.AuthorId);
			}
			if (chatSetting.BotShouldBeSilent === false) {
				var msg = {
					Type: RynodObjects.MessageType.Message,
					Text: "@" + senderUsername + " is not authorized to interact with the bot",
					MediaObjects: [],
					MediaGroupId: 0
				};
				TelegramApi.sendMessage(chatId, msg, RynodObjects.ParseMode.HTML, -2, RynodUtil.addABotChatMessage);
			}
			return;
		}
		
		if (messageText.trim() === '/help') {
			if (chatSetting.CleanUpLastBotInteractions === true) {
				TelegramApi.deleteMessage(chatId, currentMessageData.MessageId, currentMessageData, currentMessageData.AuthorId);
			}
			TelegramBotUtil.sendSimpleMessage(chatId, TelegramBotUtil.getHelpMessage());
			
		} else if (messageText.startsWith('/dellastmsg')) {
			var lastMessageData = RynodUtil.getLastMessageData(chatId);
			if (lastMessageData.ChatId !== -1) {
				TelegramApi.deleteMessage(chatId, lastMessageData.MessageId, lastMessageData, lastMessageData.AuthorId);
				TelegramApi.deleteMessage(chatId, messageId, currentMessageData, senderId);
				RynodUtil.removeChatLastMessageAt(chatId, lastMessages.length - 1);
				RynodUtil.sendBotNotification(
					{
						text: "@" + currentMessageData.AuthorUsername + " has been banned from this group for spamming",
						date: (+ new Date())
					}
				)
				RynodUtil.clearCache();
			} else {
				TelegramApi.deleteMessage(chatId, messageId, currentMessageData, senderId);
				if (chatSetting.BotShouldBeSilent === false) {
					TelegramBotUtil.sendSimpleMessage(chatId, "Fresh install detected. The bot has not logged a message from this chat group");
				}
				RynodUtil.sendBotNotification(
					{
						text: "Fresh install detected. The bot has not logged a message from this chat group",
						date: (+ new Date())
					}
				)
			}
			
		}/** else if (messageText.startsWith('/review')) {
			
		}**/ else if (messageText.startsWith('/unban')) {
			var extraData = messageText.replace('/unban', '').replace('@', '').trim();
			if (extraData.indexOf('global ') > -1 || extraData.indexOf('g ') > -1) {//unbanned from global list
				if (superPermissionData.IsAdmin === false) {
					TelegramBotUtil.sendSimpleMessage(chatId, "The user @" + senderUsername + " is not a super admin for the bot and cannot remove user from global ban list.");
					return;
				}
				extraData = extraData.replace('global ', '').replace('g ', '').trim();	
				RynodObjects.Db.GlobalBannedUsers.remove({ user_name: extraData }, { multi: true }, function (err, numRemoved) {
					if (numRemoved === 0) {
						TelegramBotUtil.sendSimpleMessage(chatId, "The user " + extraData + " is not in the global blacklist");
						return;
					}
					if (!err) {
						TelegramBotUtil.sendSimpleMessage(chatId, "The user " + extraData + " has been removed from the global ban list");
						return;
					} else {
						TelegramBotUtil.sendSimpleMessage(chatId, "Cannot unban " + extraData + " globaly");
						console.log("Error occur while unbaning user " + extraData);
					}
				});
					
			} else {
				console.log(":::"+extraData);
				TelegramApi.DatabaseOp.checkBannedUserName(RynodObjects.Db.BannedUsers, extraData, function (bannedGroupCount, retValue) {
					if (bannedGroupCount === 0) { 
						TelegramBotUtil.sendSimpleMessage(chatId, "The user " + extraData + " is not blacklisted in this group ");
						return;
					}
					for (var group of retValue.Groups) {
						if (group.ChatId === chatId) {
							RynodObjects.Db.BannedUsers.remove({ user_name: extraData }, { multi: true }, function (err, numRemoved) {
								if (!err) {
									if (chatSetting.BotShouldBeSilent === false) {
										TelegramBotUtil.sendSimpleMessage(chatId, "The user @" + extraData + " has been unbanned, he/she can rejoin the group using the link");
									}
									return;
								} else {
									TelegramBotUtil.sendSimpleMessage(chatId, "Cannot unban " + extraData + " in this group ");
								}
							});
						}
					}
				});	
				
			}
			
		} else if (messageText.startsWith('/kick')) {
			var extraData = messageText.replace('/kick', '').replace('@', '').trim();	
			var result = RynodUtil.findChatMemberInCache(chatId, extraData);
			if (result.Found === true) {
				TelegramApi.kickChatMember(chatId, result.Id, extraData, "Was kicked out by an administrator", true, RynodUtil.sendBotNotification, RynodUtil.addABotChatMessage);
			} else {
				TelegramBotUtil.sendSimpleMessage(chatId, "The user @" + extraData + " cannot be kicked, not found in the members cache list");
				return;
			}		
			
		} else if (messageText.startsWith('/backup')) {
			backup(chatId);
			
		} else if (messageText.startsWith('/clearlog')) {
			var botMessagesInGroup = RynodUtil.getBotChatMessages(chatId);
			for (var msg of botMessagesInGroup) {
				TelegramApi.deleteMessage(chatId, msg.MessageId, msg, msg.AuthorId);
			}
			TelegramApi.deleteMessage(chatId, currentMessageData.MessageId, currentMessageData, currentMessageData.AuthorId);
			
		} else if (messageText.startsWith('/statistic')) {
			var extraData = messageText.replace('/statistic', '').trim();
			var jresult = {};
			
			if (extraData === "bannedusers") {
				
				console.log("<code>" + JSON.stringify(jresult, null, 4) + "</code>")
				if (chatSetting.BotShouldBeSilent === false) {
					//TelegramBotUtil.sendSimpleMessage(chatId, "<code>" + JSON.stringify(jresult, null, 4) + "</code>");
				}
				return;
			}
			
		} else if (messageText.startsWith('/setting')) {
			var extraData = messageText.replace('/setting', '').trim();
			if (extraData === "") {
				TelegramBotUtil.sendSimpleMessage(chatId, "<code>" + JSON.stringify(chatSetting, null, 4) + "</code>");
				return;
			}
			
			var configSettings = new keyValue.KeyValueDB(extraData.replace(/\s+/g, ''), false, '=', ',', true) ;
			if (configSettings.getLike("addadmin") !== '') { 
				RynodUtil.addAdministrator(chatId, 
				{
					Name: configSettings.getLike("addadmin").replace('@', ''), 
					UserId: 0, 
					AccessLevel: 1
				});
			}
			if (configSettings.getLike("removeadmin") !== '') { 
				console.log("Remove a new Admin: " + configSettings.getLike("removeadmin"));
			}
			if (configSettings.getLike("elapsetime") !== '') { 
				chatSetting.OperationElapseTime = Number(configSettings.getLike("elapsetime"));
			}
			if (configSettings.getLike("spamcount") !== '') { 
				var x = Number(configSettings.getLike("spamcount"));
				if (x >= 2) {
					chatSetting.SpamCount = x;
				}						
			}
			if (configSettings.getLike("cachesize") !== '') { 
				var x = Number(configSettings.getLike("cachesize"));
				if (x >= 50 && x < 200) {
					chatSetting.CacheSize = x;
				}						
			}
			if (configSettings.getLike("silent") !== '') {
				if (configSettings.getLike("silent") === "true") {
					chatSetting.BotShouldBeSilent = true;
				} else {
					chatSetting.BotShouldBeSilent = false;
				}
			}
			if (configSettings.getLike("cleanup") !== '') {
				if (configSettings.getLike("cleanup") === "true") {
					chatSetting.CleanUpLastBotInteractions = true; 
				} else {
					chatSetting.CleanUpLastBotInteractions = false;
				}
			}
			if (configSettings.getLike("rogue") !== '') { 
				if (configSettings.getLike("rogue") === "true") {
					chatSetting.BotOnRogueLevel = true;
				} else {
					chatSetting.BotOnRogueLevel = false;
				}
			}
			RynodUtil.updateChatSetting(chatSetting);
			TelegramBotUtil.sendSimpleMessage(chatId, "Bot Settings changes has been applied for this group");			
			RynodUtil.sendBotNotification(
				{
					text: "The group " + chatId + " setting has changes",
					date: (+ new Date())
				}
			)
			
		} else {
			//if (chatSetting.CleanUpLastBotInteractions === true) {
			//	TelegramApi.deleteMessage(chatId, currentMessageData.MessageId, currentMessageData, currentMessageData.AuthorId);
			//}
			//TelegramBotUtil.sendSimpleMessage(chatId, TelegramBotUtil.getHelpMessage());
		}
		
	}
	
}

/**
	
**/
async function newUserAdded(message) {
	var chatId = message.chat.id;
	var chatSetting = RynodUtil.getChatSetting(chatId);
	TelegramApi.DatabaseOp.checkBannedUser(RynodObjects.Db.GlobalBannedUsers, message.new_chat_member.id, function (bannedGroupCount, retValue) {
		if (bannedGroupCount > 0) {
			if (chatSetting.BotShouldBeSilent === false) {
				TelegramBotUtil.sendSimpleMessage(chatId, "@" + message.new_chat_member.username + " has been banned globally due to a violation, please contact admins to lift this ban");
			}
			TelegramApi.kickChatMember(chatId, message.new_chat_member.id, message.new_chat_member.username, "Caught in global ban list", false, RynodUtil.sendBotNotification, RynodUtil.addABotChatMessage); 
		} else {
			//check if banned in the specific group
			TelegramApi.DatabaseOp.checkBannedUser(RynodObjects.Db.BannedUsers, message.new_chat_member.id, function (bannedGroupCount, retValue) {
				console.log("AddedUserCount Inner:"+bannedGroupCount);
				if (bannedGroupCount === 0) return;
				for (var group of retValue.Groups) {
					console.log(group);
					console.log(chatId);
					if (group.ChatId === chatId) {
						if (chatSetting.BotShouldBeSilent === false) {
							TelegramBotUtil.sendSimpleMessage(chatId, "@" + message.new_chat_member.username + " has been banned due to a violation, please contact admins to lift this ban");
						}
						TelegramApi.kickChatMember(chatId, message.new_chat_member.id, message.new_chat_member.username, "Caught in global ban list", false, RynodUtil.sendBotNotification, RynodUtil.addABotChatMessage); 
						return;
					}
				}
			});		
		}
		
	});		
}

function backup(chatId) {
	RynodObjects.DriveApi.doesFolderExists(RynodObjects.RemoteBackupFolder, function(err, exists, folder){
		var msggg = "The bot cannot start backup to google drive";
		if (exists === true) {
			RynodObjects.BackupDatabaseToDrive(folder.id);
			msggg = "The bot has start backup to google drive";
		} 
		if (chatId) {
			//TelegramBotUtil.sendSimpleMessage(chatId, msggg);
		}
	});
}

RynodObjects.FetchAndLoadDatabase(function() {
	// Finally, start our server
	app.listen((process.env.PORT ? process.env.PORT : 5000), function() { 
		setInterval(backup, 1000 * 60 * 60);
		console.log('Telegram app listening on port ' + (process.env.PORT ? process.env.PORT : 5000))
	})
});


//TODO: verify link in edited message
/**P
	:author: Azeez Adewale <azeezadewale98@gmail.com>
	:date: 29 September 2019
**/

const RynodUtil = require('./rynod_util.js');
const RynodObjects = require('./rynod_object.js');
const TelegramApi = require('./telegram_api.js');

/**
	The minimum value the expected captcha answer will be
**/
const answerMinRange = 1 ;

/**
	The maximum value the expected captcha answer will be
**/
const answerMaxRange = 9 ;

/**
	Get a captcha message to solve to validate an operation in the telegram 
	group. 
	
	The following object is returned 
	
	:: 
	
		{
			Message: "${message}. The captcha expires in ${expirationInSeconds} seconds {captcha that evaluate to ${expectedAnswer}}",
			ExpectedAnswer: "${expectedAnswer}"
		}
		
	
	**parameters**:
		message: String
			the message for extra info on the catpcha
		expirationInSeconds: int
			the message for extra info on the catpcha
			
	**return**:
		an Object that contains the full captcha string and expected answer

**/
function getCaptchaMessage(message, expirationInSeconds) {
	var expectedAnswer = RynodUtil.getRandomInt(answerMinRange, answerMaxRange) ;
	var first = RynodUtil.getRandomInt(2, expectedAnswer);
	var last = expectedAnswer - first;
	if (last === 0) {
		last = 1 ; first -= 1 ;
	}
	if (first === 0) {
		first = 1 ; last -= 1 ;
	}
	const captchaDatas = {};
	captchaDatas.Message = message + ` The captcha expires in ` + expirationInSeconds + ` seconds
<code>
` + first + ` + ` + last + ` = ?
</code>`;
	captchaDatas.ExpectedAnswer = expectedAnswer;
	return captchaDatas;
};

/**
	A plain text to send to the group for action to take on 
	a particular user
	
	**parameters**:
		user: String
			the user to request action on
			
	**return**:
		the text that list action options
**/
function getUserMessageOptions(user) {
	return `Review ` + user +` activity. Select an option below, you can select more than one? 
	
1. Delete last message
2. Ban user 
3. Delete all messages from the user
	`;
}

/**
	A plain text to send to the group for list of command the 
	bot accepts
			
	**return**:
		the help text for the bot
**/
function getHelpMessage() {
	return `Control spam in various group and monitor users operations

The bot <i>administators</i> can control me by sending these commands:
	
<b>General</b>
/help - show this help 
/dellastmsg - delete last message
/unban - remove a user from black list
/kick - kick a user from the chat and add to black list
/clearlog - delete all the message sent by the bot
/backup - backup database and setting to google drive
/setting - change or show the group bot setting 

<b>Setting</b>
The settings commands should be entered in a key value pair format, for multiple setting command at once it should be seperated with comma.
e.g /setting <code>silent=true,elapsetime=30</code>. Only Administrators with higher permission can change settings.

<i>addAdmin</i> - add a new bot administrator or change the admin permission level e.g /setting <code>addAdmin name=thecarisma,level=1</code>
<i>removeAdmin</i> - remove a bot administrator e.g /setting <code>removeAdmin name=thecarisma</code>
<i>elapsetime</i> - set the time it takes for an operation to expire in seconds (30 seconds by default) e.g /setting <code>elapsetime=50</code>
<i>silent</i> - set the bot to be silent or send all information message e.g /setting <code>silent=true</code>
<i>spamcount</i> - change how many time a message is repeated to tag as spam (3 by default) e.g /setting <code>spamcount=2</code>
<i>cleanup</i> - enable or Disable the bot from deleting verification messages e.g /setting <code>cleanup=false</code>
<i>rogue</i> - enable rogue for a very strict spam filter e.g /setting <code>rogue=true</code>
<i>cachesize</i> - change the cache size (min: 50, max: 200) e.g /setting <code>cachesize=120</code>
`;
}

/**
	Treat link post in a chat/group by sending verification captcha 
	for the sender to solve, if captcha time elapsed or verification 
	failed the link is forever removed from the group.
	
	The last parameter is the callback function which is called with 
	the link verification operation object.
	
	**parameters**:
		userName: String 
			the user name on telegram
		elapseTime: int
			the time in seconds when the captcha expires
		callbackFunction: function
			the function that is called with the new operation object
**/
function urlCaptchaOperation(userName, elapseTime, callbackFunction) {
	var verificationMessage = getCaptchaMessage('@'+userName+' your message contain a link prove you not a bot', elapseTime);
	callbackFunction(
	{
		OperationType: RynodObjects.OperationType.LinkVerification, 
		Author: userName,
		ExtraData: verificationMessage.ExpectedAnswer, 
		MessageIds : [], 
		Time: + new Date()
	}, {
		Type: RynodObjects.MessageType.Message,
		Text: verificationMessage.Message,
		MediaObjects: [],
		MediaGroupId: 0
	});
}

function forwardedCaptchaOperation(userName, elapseTime, callbackFunction) {
	var verificationMessage = getCaptchaMessage('@'+userName+'  prove you not a bot to post your forwarded message', elapseTime);
	callbackFunction(
	{
		OperationType: RynodObjects.OperationType.ForwardedMessage, 
		Author: userName,
		ExtraData: verificationMessage.ExpectedAnswer, 
		MessageIds : [], 
		Time: + new Date()
	}, {
		Type: RynodObjects.MessageType.Message,
		Text: verificationMessage.Message,
		MediaObjects: [],
		MediaGroupId: 0
	});
}

function treatCaptchaOperation(pendingOp, response) {
	if (response === ''+pendingOp.Operation.ExtraData) {
		TelegramApi.sendMessage(pendingOp.Operation.ChatId, pendingOp.Operation.MessageData, RynodObjects.ParseMode.HTML, -1);
	} else {
		RynodUtil.sendBotNotification(
			{
				text: "The user @" + pendingOp.Operation.Author + " url/forwarded message captcha verification failed",
				date: (+ new Date())
			}
		)
	}
	RynodUtil.removeRequestedOperationAt(pendingOp.Index);
}

function sendSimpleMessage(chatId, messageText, operationIndex) {
	var msg = {
		Type: RynodObjects.MessageType.Message,
		Text: messageText,
		MediaObjects: [],
		MediaGroupId: 0
	};
	TelegramApi.sendMessage(chatId, msg, RynodObjects.ParseMode.HTML, (typeof operationIndex !== "undefined" ? operationIndex : -2), RynodUtil.addABotChatMessage);
}

/**

**/
function checkAndAddAdmins(chatId, chatSettingIndex) {
	if (chatSettingIndex === -1) {
		TelegramApi.getChatAdministrators(chatId,  function (response) {
			var admins = response.data.result;
			var addedAdmins = '';
			for (var admin of admins) {
				if (admin.user.is_bot === false && typeof admin.user.username !== 'undefined') {
					RynodUtil.addAdministrator(chatId, 
					{
						Name: admin.user.username, 
						UserId: admin.user.id, 
						AccessLevel: 1
					});
					addedAdmins += '@' + admin.user.username + ', ';
				}
			}
			//sendSimpleMessage(chatId, "The group admins " + addedAdmins + "has been added as the bot administrators");
			RynodUtil.sendBotNotification(
				{
					text: "The group admins " + addedAdmins + " has been added as the bot administrators for the group " + chatId,
					date: (+ new Date())
				}
			)
		});
	}
}

/**
	Export the functions
**/
module.exports = {
	getCaptchaMessage,
	getUserMessageOptions,
	getHelpMessage,
	urlCaptchaOperation,
	forwardedCaptchaOperation,
	treatCaptchaOperation,
	sendSimpleMessage,
	checkAndAddAdmins
};
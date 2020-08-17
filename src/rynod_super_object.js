
/**
	The setting list for all the groups/chats managed 
	by the bot. 
	
	The data is stored as an object with the chat Id and the 
	settings data. The structure is as below 
	
	::
	
		[
			{
				ChatId: 123,
				BotShouldBeSilent: false, 
				OperationElapseTime: 30, 
				SpamCount: 3, 
				BotOnRogueLevel: false, 
				CleanUpLastBotInteractions: true, 
				CacheSize: 100
			}
			...
		]
	
	
	The `ChatId` is the id of a group. The `BotShouldBeSilent` 
	indicate if the bot should print less message in the group. 
	`OperationElapseTime` indicates the time in seconds when 
	a pending operation expires. `SpamCount` is the number of time a 
	message is posted in the group to mark it as spam. 
	`BotOnRogueLevel` if set to true extra messure will be taken to 
	detect a message as spam e.g sending text less than 5 characters. 
	`CleanUpLastBotInteractions` if true will clear all the bot 
	messages when the coresponding operation is complete. `CacheSize` 
	is the number of message that can be held for each group.
**/
var ChatSettings = [ ];

/**
	The list of last messages for each of the groups the bot 
	manages. the record is managed by the group chatId. The number 
	of last messages that can be stored is managed by each group 
	settings `CacheSize` value. The structure is as below 
	
	::
		
		[
			{
				ChatId: 123,
				LastMessages: [
					{ 
						Text: "second to the last message", 
						MessageId: 1353156, 
						AuthorUsername: "thecarisma", 
						AuthorId: 24355353, 
						AuthorIsBot: false, 
						Type: RynodObjects.MessageType.Message, 
						MediaObjects: [],
						MediaGroupId: 0
					},
					...
				]
			},
			...
		]
	
**/
var LastMessages = [];

/**
	The list of message sent by the bot itself in each if the 
	chat and group the bot is managing. The structure is as below 
	
	::
		
		[
			{
				ChatId: 123,
				LastMessages: [
					{ 
						Text: "second to the last message", 
						MessageId: 1353156, 
						AuthorUsername: "thecarisma", 
						AuthorId: 24355353, 
						AuthorIsBot: false, 
						Type: RynodObjects.MessageType.Message, 
						MediaObjects: [],
						MediaGroupId: 0
					},
					...
				]
			},
			...
		]
	
**/
var BotChatMessages = [];

/**
	This contains the list of administrator for each of the 
	group or super group, there are different admin for each group 
	to prevent each group admin to have control on his/her 
	group or chat only. The structure is as below 
	
	::
	
		[
			{
				ChatId: 123,
				Adminstrators: [
					{ 
						Name: "thecarisma", 
						UserId: 1234, 
						AccessLevel: 1
					},
					...
				]
			},
			...
		]
		
		
**/
var Administrators = [] ;

/**
	The administrators in this list has super contol of the bot in all 
	the group. The structure is as below 
	
	::
	
		[
			{ 
				Name: "thecarisma", 
				UserId: 1234
			},
			{ 
				Name: "nickdyk", 
				UserId: 4321
			}
		]
		
**/
var SuperAdministrators = [
	{
		Name: "thecarisma",
		UserId: 843343244
	}
];


/**
	Export the functions
**/
module.exports = {
	ChatSettings,
	LastMessages,
	BotChatMessages,
	Administrators,
	SuperAdministrators
};

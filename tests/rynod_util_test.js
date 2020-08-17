const RynodUtil = require('../src/rynod_util.js');
const RynodObjects = require('../src/rynod_object.js');

console.log(RynodUtil.isUrlAddress("https://azeezadewale.com"));

console.log(RynodUtil.getRandomInt(10, 15));
console.log(RynodUtil.getRandomInt(2, 3));



RynodUtil.addALastMessage(
							124, 
							{ 
								Text: "second to the last message", 
								MessageId: 1353156, 
								AuthorUsername: "thecarisma", 
								AuthorId: 24355353, 
								AuthorIsBot: false, 
								Type: RynodObjects.MessageType.Message, 
								MediaObjects: [],
								MediaGroupId: 0
							}
					)
RynodUtil.addALastMessage(
							125, 
							{ 
								Text: "heyo checkout https://www.azeezadewale.com", 
								MessageId: 1353156, 
								AuthorUsername: "adewale", 
								AuthorId: 87674736, 
								AuthorIsBot: false,
								Type: RynodObjects.MessageType.Message, 
								MediaObjects: [],
								MediaGroupId: 0
							}
					)
RynodUtil.addALastMessage(
							124, 
							{ 
								Text: "the final last message", 
								MessageId: 1353156, 
								AuthorUsername: "ryan", 
								AuthorId: 4476325, 
								AuthorIsBot: false, 
								Type: RynodObjects.MessageType.Message, 
								MediaObjects: [],
								MediaGroupId: 0
							}
					)

console.log(RynodUtil.getLastMessagesIndex(125));
console.log(RynodUtil.getLastMessages(124));
console.log(RynodUtil.getLastMessageData(124));
console.log(RynodUtil.getLastMessageData(125));
//console.log(RynodObjects.LastMessages);

var setting = RynodUtil.getChatSetting(123);
console.log(setting);
setting.CacheSize = 2 ;
RynodUtil.updateChatSetting(setting);
console.log(RynodUtil.getChatSetting(123));

//the CacheSize is now 2, the last two messageData Stays
RynodUtil.addALastMessage(
							124, 
							{ 
								Text: "this is after CacheSize is set", 
								MessageId: 1353156, 
								AuthorUsername: "marty", 
								AuthorId: 13244, 
								AuthorIsBot: false, 
								Type: RynodObjects.MessageType.Message, 
								MediaObjects: [],
								MediaGroupId: 0
							}
					)
console.log(RynodUtil.getLastMessages(124));
console.log(RynodObjects.LastMessages)

RynodUtil.addRequestedOperation({
			ChatId: 1213131, 
			OperationType: RynodObjects.OperationType.None, 
			Author: "thecarisma", 
			UserId: 12345, 
			ExtraData: "20", 
			MessageData: "Verify 7 + 13 =", 
			MessageIds : [], 
			Time: + new Date()
		});
console.log(RynodObjects.RequestedOperations);



//getOpExpireText
console.log(RynodUtil.getOpExpireText(RynodObjects.OperationType.LinkVerification, "thecarisma"));
console.log(RynodUtil.getOpExpireText(RynodObjects.OperationType.ForwardedMessage, "thecarisma"));
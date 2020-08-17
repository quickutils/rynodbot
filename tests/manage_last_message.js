
var spliceTo10 = true;
var spliceCount = getRandomInt(1, 4) ;
var lastMessages = [];

for (var index = 0; index < getRandomInt(15, 30); index++) {
	var lastMessageData = { text: "At." + index + "".trim(), chat_id: 123, message_id: 213, sender: "User"+index, is_bot: false, sender_id: 312+index}; 
	lastMessages.push(lastMessageData);
}
//console.log(lastMessages);

var index = lastMessages.length - 1;
if (spliceTo10 == true) {
	if (lastMessages.length > spliceCount) {
		lastMessages.splice(0, lastMessages.length - spliceCount);
	}

}
var aMessage = { text: "At." + index, chat_id: 123, message_id: 213, sender: "User"+index, is_bot: false, sender_id: 312+index}; 
console.log(lastMessages);
console.log(aMessage);
var isSpamResult = isSpam(lastMessages, aMessage, 1);
console.log(isSpamResult)
for (var a = 0; a < isSpamResult[1].length; a++) { 
	lastMessages.splice(isSpamResult[1][a].index, 1);
}
console.log(lastMessages);




////
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function isSpam(messages, message, spamCount) {
    var i = messages.length;
	var count = 0 ;
	var spamMessageIds = [] ;
    while (i--) {
       if (messages[i].text === message.text && messages[i].chat_id === message.chat_id && messages[i].sender_id === message.sender_id) {
		   count++;
		   spamMessageIds.push({id: messages[i].message_id, index: i});
		   if (count == spamCount) {
			   return [true, spamMessageIds];
		   }
       }
    }
    return [false, spamMessageIds];
}
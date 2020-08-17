
var requestedOperations = [];
var lastRequestedOperation = { operationCode: 0, author: "", extraData: "", messageData: {}, messagesId : [], time: 0};

for (var index = 0; index < getRandomInt(2, 6); index++) {
	var lastRequestedOperation = { operationCode: 2, author: "User"+index, extraData: "", messageData: {}, messagesId : [], time: + new Date()};
	requestedOperations.push(lastRequestedOperation);
	for (var a = 0; a < 12400000; a++) {}
}

console.log(requestedOperations);
console.log(doesUserHasPendingOperation(requestedOperations, "User3"))

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/*
	This return an array that further describe the operation
	[0] = true if found else false
	[1] = true if the time is past the number of seconds else false (e.g 15 seconds for link)
	[2] = the found actual operation object
*/
function doesUserHasPendingOperation(requestedOperations, author) {
	var i = requestedOperations.length;
	while (i--) {
       if (requestedOperations[i].author === author) {
		   return [true, ((+ new Date()) - requestedOperations[i].time) / 1000 > 15, requestedOperations[i]];
       }
    }
	return [false, 0, {}];
}
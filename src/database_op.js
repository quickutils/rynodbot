/**P
	:author: Azeez Adewale <azeezadewale98@gmail.com>
	:date: 28 September 2019
**/

/**
	Ban a new user from a group. The user data is first 
	queried in the database to check if he has been banned 
	before if banned before and has pass the number of 
	group limit, a global ban is initiated on such user. 
	
	The first parameter must be a valid nedb opened database 
	object for banned users record.
	
	The second parameter is the userObject in the following 
	Object format
	
	::
	
		var userObject = { 
			user_id: 132, 
			user_name: "testname",
			banned_groups_data: "TestTest:274572684:Posted bad videos in the group:2019-09-29T15:50:03.635Z"
		}
	
	The third argument is the callback function that is called 
	when the database operation is done, the callbackFunction 
	function is called with err as first argument, the number of group 
	the user is banned in as the second argument and the newly 
	updated banned user document in the database.
	The callbackFunction must be in the following format 
	
	::
	
		function callbackFunction(err, bannedGroupCount, newDoc) {
			
		}
		
	The err parameter hold the error value if an error occur 
	while adding the new banned record. 
	The newDoc argument will contain the new value of the added 
	document
	
	..note::
		The chatId must be unique
	
	**parameters**:
		database: nedb database object
			The opened nedb database object for banned users
		userObject: Object
			The user document object to update or add
		callbackFunction: function
			The call back function to be executed on completion
			
**/
function banAUser(database, userObject, callbackFunction) {
	checkBannedUser(database, userObject.user_id, function (bannedGroupCount, retValue) {
		console.log(retValue);
		if (retValue.Present === false) {
			database.insert(userObject, function(err, newDoc) {
				callbackFunction(err, 1, newDoc)
			});
		} else {
			var bannedGroupDatas = bannedGroupsToObject(userObject.banned_groups_data);
			for (var groupData of bannedGroupDatas) {
				retValue.Groups.push(groupData);
			}
			userObject.banned_groups_data = bannedGroupToString(retValue.Groups);
			database.update({ user_id: userObject.user_id }, userObject, function (err, numReplaced) {
				callbackFunction(err, bannedGroupCount, userObject);
			});
		}
		
	});
}

/**
	Check if the user has already been banned before, 
	if the user has been banned before the data of groups 
	will be returned in a list that contains all the 
	groups Object
	
	::
		
		[
			{
				Name: 'KaceTestingRoom',
				ChatId: 94278426746,
				Reason: 'invalid Forward',
				Date: '2019-09-29T15'
			},
			...
		]
		
	The callbackFunction is called with the number of group the 
	user has been banned in first parameter and the groups data 
	in the second parameter	
	
	**parameters**:
		database: nedb database object
			The opened nedb database object for banned users
		userId: number
			The id of the user to check from the database
		userId: function
			The call back function to be executed on completion
			
	**return**:
		An Object that contains the number of 
**/
function checkBannedUser(database, userId, callbackFunction) {
	var returnValue = {
		Present: false
	};
	var groups ;
	database.find({ user_id: userId }, function (err, docs) {
		if (err) {
			callbackFunction(0, returnValue);
			return ;
		}
		for (var i = 0; i < docs.length; i++) {
			groups = bannedGroupsToObject(docs[i].banned_groups_data);
			returnValue = {
					Present: true,
					Id: docs[i]._id,
					UserId: docs[i].user_id,
					GroupsCount: groups.length,
					Groups: groups
				};
		}
		callbackFunction((groups ? groups.length : 0), returnValue);
		return;
	});
}

function checkBannedUserName(database, userName, callbackFunction) {
	var returnValue = {
		Present: false
	};
	var groups ;
	database.find({ user_name: userName }, function (err, docs) {
		if (err) {
			callbackFunction(0, returnValue);
			return ;
		}
		for (var i = 0; i < docs.length; i++) {
			groups = bannedGroupsToObject(docs[i].banned_groups_data);
			returnValue = {
					Present: true,
					Id: docs[i]._id,
					UserId: docs[i].user_id,
					GroupsCount: groups.length,
					Groups: groups
				};
		}
		callbackFunction((groups ? groups.length : 0), returnValue);
		return;
	});
}

/**
	Get the banned user data from the database, the result is 
	sent as the second parameter in the callbackFunction. 
	
	The callbackFunction must be declared with two aregument as 
	
	::
	
		function callbackFunction(err, userData) {
			
		}
		
	if the user is found in the banned user database the fully 
	organized data will be sent as the userData parameter and the 
	err parameter will be null if an error occur the err parameter 
	will hold the detail of the error and if the user is not found the 
	userData is an empty object {}.
	
	.. note:: 
		the userData result does not include the user name profile 
		picture, description and other detail only the data of group
		the user was banned from and the **user_id**. the user_id 
		value can be used to get the user detail from telegram api
		
	The userData result is returned in the following format 
	
	::
	
		{
			
		}
		
	**parameters**:
		database: nedb database object
			The opened nedb database object for banned users
		userId: number
			The id of the user to check from the database
		userId: function
			The call back function to be executed on completion
	
**/
function getBannedUserData(database, userId, callbackFunction) {
	database.find({ user_id: userId }, function (err, docs) {
		var returnValue = {};
		
		//we should meet only one doc if present
		if (docs.length === 0) {
			callbackFunction(err, returnValue);
			return;
		}
		returnValue = docs[0];
		returnValue.banned_groups_data = bannedGroupsToObject(returnValue.banned_groups_data);
		returnValue.banned_group_count = returnValue.banned_groups_data.length;
		callbackFunction(err, returnValue);
	});
}


/**
	Convert the string value of groups where user is banned from 
	into a valid list with the groups object data. 
	The bannedGroup parameter expect the groups 
	to be seperated by comma, each group should hold it chatid and 
	name e.g The following string below holds 3 groups the user is 
	banned from.
	
	::
	
		var bannedGroup = "KaceTestingRoom-2:-142341324314:Spammed group:2019-09-29T15:50:03.635Z,KaceTestingRoom:94278426746:invalid Forward:2019-09-29T15:50:03.635Z" ;
		var value = bannedGroupsToObject(bannedGroup);
		//console,log(value)
		[ { Name: 'KaceTestingRoom-2',
			ChatId: '-142341324314',
			Reason: 'Spammed group',
			Date: '2019-09-29T15' },
		  { Name: 'KaceTestingRoom',
			ChatId: '94278426746',
			Reason: 'invalid Forward',
			Date: '2019-09-29T15' } ]
	
	
	**parameters**:
		bannedGroup: String
			The flat string with containing the groups
			
	**return**:
		A valid list containing the groups Object from parsed string
**/
function bannedGroupsToObject(bannedGroup) {
	var splitedValue = bannedGroup.split(',');
	var splitedGValue;
	var bannedGroupObject = [];
	var name = "";
	var chatid = "";
	var character;
	for (var i = 0; i < splitedValue.length; i++) {
		splitedGValue = splitedValue[i].split(':');
		if (splitedGValue[0].length < 1) continue;
		bannedGroupObject.push(
			{
				Name: splitedGValue[0],
				ChatId: Number(splitedGValue[1]),
				Reason: splitedGValue[2],
				Date: splitedGValue[3]
			}
		)
	}
	return bannedGroupObject;
}

/**
	Convert the list containing the groups a user was banned from 
	into it string representation. E.g. the object below is 
	converted to it string value
	
	::
	
		var bannedGroup = [ 
							{ 
								Name: 'KaceTestingRoom-2',
								ChatId: -142341324314,
								Reason: 'Spammed group',
								Date: '2019-09-29T15' 
							},
							{ 
								Name: 'KaceTestingRoom',
								ChatId: 94278426746,
								Reason: 'invalid Forward',
								Date: '2019-09-29T15' 
							} 
						]
		var value = bannedGroupToString(bannedGroup) ;
		//console,log(value)
		KaceTestingRoom-2:-142341324314:Spammed group:2019-09-29T15:50:03.635Z,KaceTestingRoom:94278426746:invalid Forward:2019-09-29T15:50:03.635Z
	
	
	**parameters**:
		bannedGroup: list
			The List containing the groups object
			
	**return**:
		A flat string for the group
**/
function bannedGroupToString(bannedGroup) {
	var retValue = "";
	for (var i = 0; i < bannedGroup.length; i++) {
		if (retValue.indexOf(bannedGroup[i].ChatId + ':') > -1) continue;
		retValue += bannedGroup[i].Name + ':' + bannedGroup[i].ChatId + ':' + bannedGroup[i].Reason + ':' + bannedGroup[i].Date ;
		if (i !== bannedGroup.length - 1) {
			retValue += ',' ;
		}
	}
	return retValue;
}

/**
	Export the function
**/
module.exports = {
	banAUser,
	checkBannedUser,
	getBannedUserData,
	bannedGroupsToObject,
	bannedGroupToString,
	checkBannedUserName
};














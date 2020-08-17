const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

const SCOPES = ['https://www.googleapis.com/auth/drive'];
const TOKEN_PATH = 'token.json';

var Auth ;

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

function getAuth(callback) {
	fs.readFile('credentials.json', (err, content) => {
	if (err) return console.log('Error loading client secret file:', err);
		authorize(JSON.parse(content), function(auth) {
			callback(auth);
		});
	});
}

function getFiles(callback) {
	getAuth(function(auth) {
		const drive = google.drive({version: 'v3', auth});
		drive.files.list({
			includeRemoved: false,
			spaces: 'drive',
			fields: 'nextPageToken, files(id, name, parents, mimeType, modifiedTime)',
			}, function (err, response) {
			   callback(err, response.data.files);
		});
	});
	
}

function getFilesInFolder(folderName, callback) {
	getAuth(function(auth) {
		const drive = google.drive({version: 'v3', auth});
		drive.files.list({
			includeRemoved: false,
			spaces: 'drive',
			fields: 'nextPageToken, files(id, name, parents, mimeType, modifiedTime)',
			}, function (err, response) {
			   var files = [];
			   var folderId = "";
			   for (var file of response.data.files) {
				   if (file.name == folderName) {
					   folderId = file.id;
					   break;
				   }
			   }
			   if (folderId !== "") {
				   for (var file of response.data.files) {
					   if (!file.parents) continue;
					   if (file.parents[0] === folderId) {
						   files.push(file);
					   }
				   }
			   }
			   callback(err, files);
		});
	});
	
}

function doesFolderExists(folderName, callback) {
	getAuth(function(auth) {
		const drive = google.drive({version: 'v3', auth});
		drive.files.list({
			includeRemoved: false,
			spaces: 'drive',
			mimeType: 'application/vnd.google-apps.folder',
			fields: 'nextPageToken, files(id, name, parents, mimeType, modifiedTime)',
			}, function (err, response) {
				if (err) {
					if (callback) { callback(err, false); }
					return;
				}
				for (var file of response.data.files) {
				   if ( file.name === folderName && file.mimeType === 'application/vnd.google-apps.folder' ) {
						if (callback) { callback(err, true, file); }
						return;
				   }
			   }
			   if (callback) { callback(err, false); }
			}
		);
	});
}

function doesFileExists(parentFolder, fileName, callback) {
	getAuth(function(auth) {
		getFilesInFolder(parentFolder, function(err, files){
			if (err) {
				if (callback) { callback(err, false, fileName); }
				return;
			}
			var fileId = "";
			for (var file of files) {
				if (file.name == fileName) {
					if (callback) { callback(err, true, fileName, file); }
					return;
				}
		    }
			if (callback) { callback(err, false, fileName); }
		});
	});
}

/**
 * Lists the names and IDs of up to 10 files.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function uploadFile(filePath, fileMetadata, callback) {
	getAuth(function(auth) {
		const drive = google.drive({version: 'v3', auth});
		
		var media = {
			mimeType: 'application/octet-stream',
			body: fs.createReadStream(filePath)
		};
		drive.files.create({
			resource: fileMetadata,
			media: media,
			fields: 'id'
		}, function (err, file) {
			callback(err, (file ? file.data : file));
		});
	});
}


function updateFile(fileId, filePath, callback) {
	getAuth(function(auth) {
		const drive = google.drive({version: 'v3', auth});
		
		var media = {
			mimeType: 'application/octet-stream',
			body: fs.createReadStream(filePath)
		};
		drive.files.update({
			media: media,
			fileId: fileId
		}, function (err, file) {
			callback(err, (file ? file.data : file));
		});
	});
}

function createFolder(folderName, callback) {
	getAuth(function(auth) {
		const drive = google.drive({version: 'v3', auth});
		var fileMetadata = {
			'name': folderName,
			'mimeType': 'application/vnd.google-apps.folder'
		};
		drive.files.create({
			resource: fileMetadata,
			fields: 'id'
		}, function (err, file) {
			callback(err, file.data);
		});
	});
}

function downloadFile(file, destinationPath, callback) {
	getAuth(function(auth) {
		const drive = google.drive({ version: 'v3', auth });
		const dest = fs.createWriteStream(destinationPath);
		drive.files.get({fileId: file.id, alt: 'media'}, {responseType: 'stream'}, function(err, res) {
			if (err || typeof res === "undefined") callback(err, false, file); 
			res.data.on('end', () => {
				callback(err, true, file);
			}).on('error', err => {
				callback(err, false, file);
			}).pipe(dest);
		});
	});
    
};

function downloadFileByName(fileName, destinationPath, callback) {
	getAuth(function(auth) {
		getFiles(function(err, files){
			var fileId = "";
			for (var file of files) {
				if (file.name == fileName) {
				   fileId = file.id;
				   break;
				}
		    }
			
			if (fileId === "") { callback(err, false); return;}
			downloadFile(fileId, destinationPath, callback);
		});
	});
    
};

function downloadFileFromFolder(folderName, fileName, destinationPath, callback) {
	getAuth(function(auth) {
		getFilesInFolder(folderName, function(err, files){
			var fileId = "";
			for (var file of files) {
				if (file.name == fileName) {
				   fileId = file.id;
				   break;
				}
		    }
			
			if (fileId === "") { callback(err, false); return;}
			downloadFile(fileId, destinationPath, callback);
		});
	});
    
};

/**
	Export the functions
**/
module.exports = {
	createFolder,
	uploadFile,
	doesFolderExists,
	getFiles,
	downloadFile,
	getFilesInFolder,
	downloadFileByName,
	downloadFileFromFolder,
	updateFile,
	doesFileExists
};
chrome.app.runtime.onLaunched.addListener(function() {
  chrome.app.window.create('window.html', {
  	'id': 'main_window',
    'minWidth':640,
    'minHeight':400,
    'bounds' : {
	    'width':700,
	    'height':500,
    },
    'frame' : 'none'
  });
});

chrome.syncFileSystem.onServiceStatusChanged.addListener(function(service_info) {
	console.log("service status changed");
	console.log(service_info);
});

chrome.syncFileSystem.onFileStatusChanged.addListener(function(file_info) {
	console.log("file status changed");
	console.log(file_info);
	if (file_info.direction == 'remote_to_local') {
		chrome.runtime.sendMessage({'type' : 'local_file_status_changed'});
	}
});
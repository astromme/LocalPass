chrome.app.runtime.onLaunched.addListener(function() {
  chrome.app.window.create('window.html', {
    'minWidth':640,
    'minHeight':400,
    'width':700,
    'height':500,
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
});
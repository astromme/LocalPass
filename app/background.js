chrome.app.runtime.onLaunched.addListener(function() {
  chrome.app.window.create('window.html', {
    'width': 700,
    'height': 500,
    'frame' : 'none'
  });
});
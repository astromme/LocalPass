chrome.app.runtime.onLaunched.addListener(function() {
  chrome.app.window.create('window.html', {
    'minWidth':700,
    'minHeight':500,
    'frame' : 'none'
  });
});
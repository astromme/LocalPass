chrome.app.runtime.onLaunched.addListener(function() {
  chrome.app.window.create('window.html', {
    'minWidth':640,
    'minHeight':400,
    'width':700,
    'height':500,
    'frame' : 'none'
  });
});
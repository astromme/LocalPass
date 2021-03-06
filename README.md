LocalPass
=========

LocalPass is a password manager app written using the Chrome packaged app platform. 


Installation
------------

* Install [Chrome Canary][canary-dl]
* Enable "Experimental Extension APIs" in chrome://flags
* Download [this zip of LocalPass][localpass-dl]
* Unzip LocalPass-master.zip
* On chrome://extensions click the "Enable Developer Mode" checkbox
* Click the "Load unpacked extension..." button and select the app subdirectory of LocalPass
* Run the app from the new tab page

Architecture
------------

LocalPass stores and encrypts the password database locally. No unencrypted data is ever sent to the server, and the server never has the decryption key.


Technologies
------------

* [Chrome App Platform][chrome-app-platform]
* [AngularJS][angularjs]
* [Stanford Javascript Crypto Library][sjcl]
* [JSONEditor][jsoneditor]

Authors
-------

* Andrew Stromme &lt;andrew.stromme@gmail.com&gt;


[canary-dl]: https://www.google.com/intl/en/chrome/browser/canary.html
[localpass-dl]: https://github.com/astromme/LocalPass/archive/master.zip
[chrome-app-platform]: http://developer.chrome.com/stable/apps/about_apps.html
[angularjs]: http://angularjs.org/
[sjcl]: http://bitwiseshiftleft.github.com/sjcl/
[jsoneditor]: https://github.com/josdejong/jsoneditoronline
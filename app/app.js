angular.module('localPass', ['ui']);

var local_database_url = "idb://local_database";
var remote_database_url = "idb://remote_database";

function generate_guid()
{
    var S4 = function ()
    {
        return Math.floor(
                Math.random() * 0x10000 /* 65536 */
            ).toString(16);
    };

    return (
            S4() + S4() + "-" +
            S4() + "-" +
            S4() + "-" +
            S4() + "-" +
            S4() + S4() + S4()
        );
}

function toArray(list) {
  return Array.prototype.slice.call(list || [], 0);
}

Array.prototype.remove = function() {
    var what, a = arguments, L = a.length, ax;
    while (L && this.length) {
        what = a[--L];
        while ((ax = this.indexOf(what)) !== -1) {
            this.splice(ax, 1);
        }
    }
    return this;
};

/*
angular.module('localpass.directive', []).directive('different', function() {
  return {
    require: 'ngModel',
    link: function(scope, elm, attrs, ctrl) {
      ctrl.$parsers.unshift(function(viewValue) {
        if (INTEGER_REGEXP.test(viewValue)) {
          // it is valid
          ctrl.$setValidity('different', true);
          return viewValue;
        } else {
          // it is invalid, return undefined (no model update)
          ctrl.$setValidity('different', false);
          return undefined;
        }
      });
    }
  };
});

*/

function errorHandler(e) {
  console.error(e);
}

function readAsText(fileEntry, callback) {
  fileEntry.file(function(file) {
    var reader = new FileReader();

    reader.onerror = errorHandler;
    reader.onload = function(e) {
      callback(e.target.result);
    };

    reader.readAsText(file);
  });
}

function bytesToSize(bytes) {
  var sizes = [ "Bytes", "KB", "MB", "GB", "TB" ];
  var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
  return Math.round(bytes/ Math.pow(1024, i ), 2) + " " + sizes[i];
}

function CreatePasswordControl($scope) {
    $scope.password = '';
    $scope.password_again = '';

    $scope.verifyPasswordCreation = function() {
        if ($scope.password != $scope.password_again) {
            $scope.createPasswordForm.$setValidity('different', false);
        } else {
            $scope.createPasswordForm.$setValidity('different', true);
            $scope.setPassword($scope.password, function() {
                // first, we encrypt the uuid for a way to verify the password easily later
                $scope.config.encrypted_uuid = $scope.encrypt($scope.config.uuid);

                $scope.save('config.json', angular.toJson($scope.config), function() {
                    $scope.$apply(function() {
                        $scope.setHidden('dbLockScreenClass');
                        $scope.setHidden('dbPasswordCreationScreenClass');
                        $scope.password = ''
                        $scope.password_again = ''
                    });
                });
            });
        }
    }
}

function EnterPasswordControl($scope) {
    $scope.password = '';

    $scope.verifyPassword = function() {
        if ($scope.password.length = 0) {
            return;
        }

        $scope.setPassword($scope.password, function() {

            // check if the uuid decryption matches to verify the password
            try {
                if ($scope.config.uuid != $scope.decrypt($scope.config.encrypted_uuid)) {
                    $scope.$apply(function() {
                        $scope.password = '';
                    })
                    $('#database_locked_widget_form').addClass('shake')
                    setTimeout(function() {
                        $('#database_locked_widget_form').removeClass('shake')
                    }, 1000);
                    console.log("password is wrong");
                    return;

                }
            } catch(e) {
                console.log("error while checking password: " + e);
                return;
            }

            $scope.updateCache(function(err) {
                if (err) {
                    console.log("error while updating cache");
                    return;
                }
                    
                $scope.$apply(function() {
                    console.log("password is correct. unlocking");
                    $scope.password = '';
                    $('#database_locked_widget input[type=password]').blur()
                    $scope.setHidden('dbLockScreenClass');
                    $scope.setHidden('dbPasswordCreationScreenClass');
                });
            });
        });
    }
}






function updateUsageStats() {
  chrome.syncFileSystem.getUsageAndQuota(fileSystem, function(storageInfo) {
    usageBytesText.innerHTML = bytesToSize(storageInfo.usageBytes);
    quotaBytesText.innerHTML = bytesToSize(storageInfo.quotaBytes);
  });
  myFile.getMetadata(function(data) {
    lastSavedText.innerHTML = data.modificationTime;
  });
}


function DatabaseControl($scope) {
    $scope.dbLockScreenClass = 'hiddenBelow';
    $scope.dbPasswordCreationScreenClass = 'shown';

    $scope.filesystem = null;
    $scope.config = null;    
    $scope.database = null;
    $scope.decrypted = null;

    $scope.editor = new JSONEditor(document.getElementById("jsoneditor"));
    $scope.status_message = ''; // shown to the user as feedback
    

    $scope.init = function() {
        console.log('init');

        var get_config = function() {
            console.log('getting config');
            $scope.filesystem.root.getFile('config.json', {create: true}, function(f) {
                f.file(function (file) {
                    var reader = new FileReader();
                    reader.onloadend = function() {
                        console.log('got config');
                        try {
                            $scope.config = angular.fromJson(this.result);
                        } catch(e) {
                            $scope.config = angular.fromJson('{}');
                        }
                        parse_config();
                    }
                    reader.readAsText(file);
                });
            });  
        }

        var parse_config = function() {
            if ('uuid' in $scope.config) {
                // existing database
                console.log('existing datbase');
                $scope.initializeDecryptedSection();

                $scope.$apply(function() {
                    $scope.setVisible('dbLockScreenClass');
                    $scope.setHidden('dbPasswordCreationScreenClass');
                });

                setTimeout(function() {
                    $('#database_locked_widget input[type=password]').focus();
                }, 100);

            } else {
                // fresh database
                console.log('new database');
                $scope.config.uuid = generate_guid();

                $scope.setHidden('dbLockScreenClass');
                $scope.setVisible('dbPasswordCreationScreenClass');

                setTimeout(function() {
                    $('#database_password_creation_widget input[type=password]')[0].focus()
                }, 100);

                $scope.initializeDecryptedSection();
            }
        }

        chrome.syncFileSystem.requestFileSystem(function(fs) {
            console.log('got filesystem');
            $scope.filesystem = fs;
            get_config()
        });
    }

    $scope.closeWindow = function() {
        window.close();
    }

    $scope.destroy = function() {
        chrome.syncFileSystem.deleteFileSystem($scope.filesystem, function() {
        });
    }

    $scope.onChanges = function(err, response) {
        console.log("onChanges()");
        console.log(response);
        //TODO: conflict resolution
    }

    $scope.initializeDecryptedSection = function() {
        $scope.decrypted = Object();

        $scope.decrypted.derived_key = null;

        $scope.decrypted.selected_entry = null;
        $scope.decrypted.selected_entry_id = null;

        $scope.decrypted.cache = {};
    } 

    // Async. Notifies when finished via on_finished_callback
    $scope.setPassword = function(password, on_finished_callback) {
        var mypbkdf2 = new PBKDF2(password, "a4npq2kno", 1000, 16);

        var status_callback = function(percent_done) {
            $scope.status_message = percent_done + "%"};

        var result_callback = function(key) {
            $scope.decrypted.derived_key = key;
            $scope.status_message = '';
            on_finished_callback();
        };

        mypbkdf2.deriveKey(status_callback, result_callback);
    }

    $scope.import = function() {
        // "type/*" mimetypes aren't respected. Explicitly use extensions for now.
        // See crbug.com/145112.
        var accepts = [{
            //mimeTypes: ['text/*'],
            extensions: ['js', 'css', 'txt', 'html', 'xml', 'tsv', 'csv', 'rtf']
        }];

        chrome.fileSystem.chooseEntry({type: 'openFile', accepts: accepts}, function(readOnlyEntry) {
            if (!readOnlyEntry) {
                return;
            }

            readOnlyEntry.file(function(file) {
                readAsText(readOnlyEntry, function(result) {
                    var parser = new DOMParser();
                    var xmlDoc = parser.parseFromString(result,"text/xml");
                    var json = angular.fromJson(xml2json(xmlDoc, ''));

                    var handleSubgroups = function(object, prefixString) {
                        var groups = object.group;
                        if (!groups) { return; }
                        if (!groups.forEach) { groups = [groups]; };
                        groups.forEach(function(group) {
                            var entries = group.entry;
                            if (!entries) { entries = Object({}) }
                            if (!entries.forEach) { entries = [entries]; }
                            entries.forEach(function(entry) {
                                entry.tags = [prefixString + group.title];
                                var db_entry = $scope.createNewEntry(entry, true /*suppress updating search */);

                                //TODO: update for new entry/object system

                                // db_entry.creation = db_entry.contents.creation;
                                // db_entry.last_access = db_entry.contents.lastaccess;
                                // db_entry.last_modification = db_entry.contents.lastmod;
                                // delete db_entry.contents.creation;
                                // delete db_entry.contents.lastaccess;
                                // delete db_entry.contents.lastmod;
                            });

                            if (group.group) {
                                handleSubgroups(group, prefixString + group.title + '/');
                            }
                        });
                    }

                    handleSubgroups(json.database, '');

                    $scope.$apply(function() {
                        $scope.updateSearch();
                    });
                });

            });
        });
    }

    // encrypts a piece of data
    $scope.encrypt = function(data) {
        var json = angular.toJson(data);
        return sjcl.encrypt($scope.decrypted.derived_key, json);
    }

    // decryptes a piece of data
    $scope.decrypt = function(data) {
        //console.log(data);
        try {
            var json = sjcl.decrypt($scope.decrypted.derived_key, data);
            console.log(json);
        } catch(e) {
            console.log("$scope.decrypt() Error when decrypting data: " + e);
            return false;
        }

        return angular.fromJson(json);
    }

    $scope.updateCache = function(callback) {
        var dirReader = $scope.filesystem.root.createReader();
        var entries = [];
        var numberRead = 0;

        // Call the reader.readEntries() until no more results are returned.
        var readEntries = function() {
            dirReader.readEntries (function(results) {
                if (!results.length) {
                    console.log('entries:');
                    console.log(entries);
                    entries.forEach(function(entry, i) {
                        if (entry.name == "config.json") { return; }

                        readAsText(entry, function(contents) {
                            var e = angular.fromJson($scope.decrypt(contents));
                            console.log(e);
                            try {
                                $scope.decrypted.cache[e.uuid] = e;
                            } catch(e) {
                                console.log("error decrypting entry: " + e);
                            }

                            numberRead += 1;
                            if (numberRead == entries.length-1) { // config.json is skipped
                                // finished. update search then callback

                                $scope.updateSearch();
                                callback();
                            }
                        });
                    });
                } else {
                    entries = entries.concat(toArray(results));
                    readEntries();
                }
            }, errorHandler);
        };

        console.log("reading objects/")
        readEntries(); // Start reading dirs.
    }

    // locks the database, removing the decrypted section
    // and showing the lock screen
    $scope.lock = function() {
        delete $scope.decrypted;
        $scope.initializeDecryptedSection();

        $scope.setVisible('dbLockScreenClass');
        $scope.dbSelectionVisible = true;
    }

    $scope.isLocked = function() {
        if (!$scope.decrypted) {
            return true;
        }

        return !$scope.decrypted.derived_key;
    }

    $scope.filename = function(object) {
        if (!('uuid' in object)) {
            console.log('error, object has no uuid');
        }
        return object.uuid;
    }

    $scope.createNewEntry = function(contents, suppressUpdatingSearch) {
        var entry = Object();
        entry.uuid = generate_guid();
        entry.contents = contents;

        var c = $scope.encrypt(entry);
        $scope.save($scope.filename(entry), c, function() {
            // Update the cache
            $scope.decrypted.cache[entry.uuid] = entry;

            if (!suppressUpdatingSearch) {
                $scope.$apply(function() {
                   $scope.updateSearch();
                });
            }
        });
    }

    $scope.addEntryClicked = function() {
        console.log("addEntryClicked()");
        $scope.editorToDatabase();
        $scope.createNewEntry({'title': $scope.newEntryTitle});
        $scope.newEntryTitle = '';
    }

    $scope.entry = function(id) {
        return $scope.decrypted.cache[id];
    }

    $scope.save = function(filename, contents, callback) {
        $scope.filesystem.root.getFile(filename, {create: true}, function(file) {
            file.createWriter(function (fileWriter) {
                var blob = new Blob([contents], {type: 'text/plain'});
                fileWriter.onwriteend = function() {
                    callback();
                }
                fileWriter.write(blob);
            });
        });
    }

    $scope.search = function(query) {
        if (!query) {
            query = '';
        }
        console.log("calling search("+query+")");
        console.log($scope.decrypted.cache);

        var results = [];
        if (!query) {
            for (uuid in $scope.decrypted.cache) {
                results.push(new Object({'uuid':uuid, 'object': $scope.entry(uuid)}));
            }
        } else {
            var search = query.toLowerCase();

            for (uuid in $scope.decrypted.cache) {
                var object = $scope.entry(uuid);
                var field = String(object.contents.title).toLowerCase();
                index = field.indexOf(search);
                if (index != -1) {
                    results.push(new Object({'uuid':uuid, 'object':object}));
                }
            }
        }

        results.sort();
        console.log('results:');
        console.log(results);

        $scope.decrypted.selected_entry_id = null;
        $scope.decrypted.filtered_entries = results;
    }

    $scope.updateSearch = function() {
        $scope.search($scope.searchString);
    }

    $scope.editorToDatabase = function() {
        if ($scope.decrypted.selected_entry_id) {
            // Update the cache
            $scope.decrypted.selected_entry.contents = $scope.editor.get();
            $scope.decrypted.cache[$scope.decrypted.selected_entry_id] = $scope.decrypted.selected_entry;

            // Encrypt
            var encrypted = $scope.encrypt($scope.decrypted.selected_entry);

            // Save
            $scope.save($scope.filename($scope.decrypted.selected_entry), encrypted, function() {

            });
        }
    }

    $scope.databaseToEditor = function() {
        if ($scope.decrypted.selected_entry_id) {
            // Use the cached version
            $scope.decrypted.selected_entry = $scope.decrypted.cache[$scope.decrypted.selected_entry_id];
            $scope.editor.set($scope.decrypted.selected_entry.contents);
        } else {
            //TODO: Disable editor and let the user know that they should select something
        }
    }

    $scope.entryClicked = function($event) {
        $scope.editorToDatabase();
        var uuid = $event.currentTarget.attributes['uuid'].value;
        $scope.decrypted.selected_entry_id = uuid;
        $scope.databaseToEditor();
    }

    $scope.entryCopy = function($event) {
        console.log($event);
    }

    $scope.setVisible = function(variable) {
        $scope[variable] = 'shown';
    }

    $scope.setHidden = function(variable) {
        $scope[variable] = 'hiddenBelow';
    }

}
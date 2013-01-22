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

function CreatePasswordControl($scope) {
    $scope.password = '';
    $scope.password_again = '';

    $scope.verifyPasswordCreation = function() {
        if ($scope.password != $scope.password_again) {
            $scope.createPasswordForm.$setValidity('different', false);
        } else {
            $scope.createPasswordForm.$setValidity('different', true);
            $scope.setPassword($scope.password, function() {
                $scope.updateCache(function(err) {
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
            $scope.enterPasswordForm.$setValidity('incorrect', true);
            return;
        }

        $scope.setPassword($scope.password, function() {
            $scope.updateCache(function(err) {
                if (err) {
                    $scope.enterPasswordForm.$setValidity('incorrect', true);
                    return;
                }

                $scope.password = '';
                $scope.enterPasswordForm.$setValidity('incorrect', false);
                $scope.setHidden('dbLockScreenClass');
                $scope.setHidden('dbPasswordCreationScreenClass');
            });
        });
    }
}

function DatabaseControl($scope) {
    $scope.dbLockScreenClass = 'hiddenBelow';
    $scope.dbPasswordCreationScreenClass = 'shown';
    
    $scope.database = undefined;
    $scope.decrypted = undefined;

    $scope.editor = new JSONEditor(document.getElementById("jsoneditor"));
    $scope.status_message = ''; // shown to the user as feedback
    

    $scope.init = function() {
        Pouch(local_database_url, function(err, db) {
            $scope.database = db;
            $scope.database.changes({conflicts:true}, $scope.onChanges)

            $scope.database.get('config', function(err, doc) {
                if (err) {
                    console.log('config is undefined, assuming fresh state');

                    var config = {
                        _id : 'config',
                        uuid : generate_guid(),
                    }

                    $scope.database.put(config, function(err, response) {
                        $scope.setHidden('dbLockScreenClass');
                        $scope.setVisible('dbPasswordCreationScreenClass');
                    });
                    $scope.initializeDecryptedSection();

                } else { // success
                    $scope.initializeDecryptedSection();

                    $scope.$apply(function() {
                        $scope.setVisible('dbLockScreenClass');
                        $scope.setHidden('dbPasswordCreationScreenClass');
                    });
                }
            });
        });

        Pouch(remote_database_url, function(err, db) {
            $scope.remote_database = db;
        });

        //TODO: have credentials stored in chrome.storage.sync
        //chrome.storage.sync.get(null, function(items) {});
        //var config = items['config'];
    }

    $scope.closeWindow = function() {
        window.close();
    }

    $scope.onChanges = function(err, response) {
        console.log("onChanges()");
        console.log(response);
        //TODO: conflict resolution
    }

    $scope.initializeDecryptedSection = function() {
        $scope.decryptedSection = Object();

        $scope.decryptedSection.derived_key = undefined;

        $scope.decryptedSection.selected_entry = undefined;
        $scope.decryptedSection.selected_entry_id = undefined;

        $scope.decryptedSection.cache = {};
    } 

    // Async. Notifies when finished via on_finished_callback
    $scope.setPassword = function(password, on_finished_callback) {
        var mypbkdf2 = new PBKDF2(password, "a4npq2kno", 1000, 16);

        var status_callback = function(percent_done) {
            $scope.status_message = percent_done + "%"};

        var result_callback = function(key) {
            $scope.decryptedSection.derived_key = key;
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
                    parser = new DOMParser();
                    xmlDoc = parser.parseFromString(result,"text/xml");
                    json = angular.fromJson(xml2json(xmlDoc, ''));

                    $scope.new();

                    var handleSubgroups = function(object, prefixString) {
                        var groups = object.group;
                        if (!groups) { return; }
                        if (!groups.forEach) { groups = [groups]; };
                        groups.forEach(function(group) {
                            var entries = group.entry;
                            if (!entries) { entries = Object({}) }
                            if (!entries.forEach) { entries = [entries]; }
                            entries.forEach(function(entry) {
                                //TODO: update for new entry/object system
                                entry.tags = [prefixString + group.title];
                                var db_entry = $scope.addEntry(entry.title, entry, true /*suppress updating search */);
                                db_entry.creation = db_entry.contents.creation;
                                db_entry.last_access = db_entry.contents.lastaccess;
                                db_entry.last_modification = db_entry.contents.lastmod;
                                delete db_entry.contents.creation;
                                delete db_entry.contents.lastaccess;
                                delete db_entry.contents.lastmod;
                            });

                            if (!(group.group === undefined)) {
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

    $scope.replicateLocalToRemote = function(callback) {
        Pouch.replicate(local_database_url, remote_database_url, function(err, changes) {
            if (err) {
                console.log("failed to replicate to remote database: "+err);
            }

            callback(err, changes);
        });
    }

    $scope.replicateRemoteToLocal = function() {
        Pouch.replicate(remote_database_url, local_database_url, function(err, changes) {
            if (err) {
                console.log("failed to replicate to local database: "+err);
            }

            callback(err, changes);
        });
    }

    $scope.encrypt = function(data) {
        var json = angular.toJson(data);
        return sjcl.encrypt($scope.decryptedSection.derived_key, json);
    }

    $scope.decrypt = function(data) {
        console.log(data);
        try {
            var json = sjcl.decrypt($scope.decryptedSection.derived_key, data);
        } catch(e) {
            console.log("$scope.decrypt() Error when decrypting data: " + e);
            return false;
        }

        return angular.fromJson(json);
    }

    $scope.updateCache = function(callback) {
        $scope.database.allDocs(function(err, response) {
            for (var entry in response['rows']) {
                if (entry['type'] != 'entry') {
                    continue;
                }

                try {
                    $scope.decryptedSection.cache[entry.id] = $scope.decrypt(entry.contents);
                } catch(e) {
                    callback(e);
                }
            }

            callback();
        });
    }

    $scope.lock = function() {
        delete $scope.decryptedSection;
        $scope.initializeDecryptedSection();

        $scope.setVisible('dbLockScreenClass');
        $scope.dbSelectionVisible = true;
    }

    $scope.isLocked = function() {
        if (!$scope.decryptedSection) {
            return false;
        }

        return $scope.decryptedSection.derived_key == undefined;
    }

    $scope.createNewEntry = function(contents, suppressUpdatingSearch) {

        var c = $scope.encrypt(contents);
        $scope.database.post({'contents' : c, 'type': 'entry'}, function(err, response) {
            // Update the cache
            $scope.decryptedSection.cache[response['id']] = contents;

            if (!suppressUpdatingSearch) {
                $scope.updateSearch();
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
        return $scope.decryptedSection.cache[id];
    }

    $scope.search = function(query) {
        console.log("calling search("+query+")");

        var results = [];
        if (!query) {
            for (uuid in $scope.decryptedSection.cache) {
                results.push(new Object({'uuid':uuid, 'object': $scope.entry(uuid)}));
            }
        } else {
            var search = query.toLowerCase();

            for (uuid in $scope.decryptedSection.cache) {
                var object = $scope.entry(uuid);
                var field = String(object.title).toLowerCase();
                index = field.indexOf(search);
                if (index != -1) {
                    results.push(new Object({'uuid':uuid, 'object':object}));
                }
            }
        }

        results.sort();
        console.log('results:');
        console.log(results);

        $scope.decryptedSection.selected_entry_id = undefined;
        $scope.decryptedSection.filtered_entries = results;
    }

    $scope.updateSearch = function() {
        $scope.search($scope.searchString);
    }

    $scope.editorToDatabase = function() {
        if ($scope.decryptedSection.selected_entry_id != undefined) {
            //TODO: Only update if there are changes so that we don't save revisions that don't matter
            // Update the cache
            $scope.decryptedSection.cache[$scope.decryptedSection.selected_entry_id] = $scope.editor.get();

            // Encrypt
            $scope.decryptedSection.selected_entry.contents = $scope.encrypt($scope.editor.get());

            // Save to PouchDB
            $scope.database.put($scope.decryptedSection.selected_entry);
        }
    }

    $scope.databaseToEditor = function() {
        if ($scope.decryptedSection.selected_entry_id != undefined) {
            // Use the cached version
            $scope.decryptedSection.selected_entry = $scope.decryptedSection.cache[$scope.decryptedSection.selected_entry_id];
            $scope.editor.set($scope.decryptedSection.selected_entry);
        } else {
            //TODO: Disable editor and let the user know that they should select something
        }
    }

    $scope.entryClicked = function($event) {
        $scope.editorToDatabase();
        var uuid = $event.currentTarget.attributes['uuid'].value;
        $scope.decryptedSection.selected_entry_id = uuid;
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
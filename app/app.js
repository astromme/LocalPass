/*
    Database: {
        uuid (string)
        name (string)
        selected_entry (integer)
        encrypted_root (encrypted json)
    }

    It is important to never store the unencrypted root within the database
    structure to ensure that it never gets inadvertently saved to permanant
    storage.
*/

angular.module('localPass', ['ui']);

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
                $scope.$apply(function() {
                    $scope.save();

                    var config = {
                        'config': {
                            'database_uuid' : $scope.database.uuid
                        }
                    };

                    chrome.storage.sync.set(config, function() {
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
            if ($scope.decrypt()) {
                $scope.enterPasswordForm.$setValidity('incorrect', false);
                $scope.password = '';
            } else {
                $scope.enterPasswordForm.$setValidity('incorrect', true);
            }
        });
    }
}

function DatabaseControl($scope) {
    $scope.dbLockScreenClass = 'hiddenBelow';
    $scope.dbPasswordCreationScreenClass = 'shown';
    
    $scope.database = undefined;
    $scope.derived_key = undefined;
    $scope.selected_entry = undefined;
    $scope.editor = new JSONEditor(document.getElementById("jsoneditor"));
    $scope.status_message = ''; // shown to the user as feedback
    

    $scope.init = function() {
        chrome.storage.sync.get(null, function(items) {
            var config = items['config'];

            if (config === undefined) {
                console.log('config is undefined, assuming fresh state');
                $scope.new();

                $scope.setHidden('dbLockScreenClass');
                $scope.setVisible('dbPasswordCreationScreenClass');
                return;
            }

            $scope.load(config['database_uuid']);

        });
    }

    $scope.closeWindow = function() {
        window.close();
    }

    // Async. Notifies when finished via on_finished_callback
    $scope.setPassword = function(password, on_finished_callback) {
        var mypbkdf2 = new PBKDF2(password, "a4npq2kno", 1000, 16);

        var status_callback = function(percent_done) {
            $scope.status_message = percent_done + "%"};

        var result_callback = function(key) {
            $scope.derived_key = key;
            $scope.status_message = '';
            $scope.database.has_password = true;
            on_finished_callback();
        };

        mypbkdf2.deriveKey(status_callback, result_callback);
    }


    $scope.new = function() {
        $scope.database = Object({
            'name' : 'Unamed Database',
            'uuid' : generate_guid(),
            'encrypted_root' : undefined,
        });
    }

    $scope.load = function(database_uuid) {
        chrome.storage.local.get(database_uuid, function(keys) {
            $scope.database = keys[database_uuid];
            $scope.unencrypted_root = undefined;
            $scope.database.selected_entry = undefined;
            $scope.derived_key = undefined;

            $scope.$apply(function() {
                $scope.setVisible('dbLockScreenClass');
                $scope.setHidden('dbPasswordCreationScreenClass');
            });
        });
    }

    $scope.save = function() {
        if ($scope.derived_key == undefined) {
            $scope.setVisible('dbPasswordCreationScreenClass');
            return;
        }

        $scope.encrypt();
        var data = {};
        data[$scope.database.uuid] = $scope.database;
        chrome.storage.local.set(data);
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

    $scope.encrypt = function() {
        $scope.editorToDatabase();
        if ($scope.unencrypted_root === undefined) {
            $scope.unencrypted_root = Object({
                'entries' : {},
                'objects' : {}
            });
        }
        var root = angular.copy($scope.unencrypted_root);
        delete root.filtered_entries;
        delete root.selected_entry;
        var json = angular.toJson(root);
        $scope.database.encrypted_root = sjcl.encrypt($scope.derived_key, json);
    }

    $scope.decrypt = function() {
        try {
            var json = sjcl.decrypt($scope.derived_key, $scope.database.encrypted_root);
        } catch(e) {
            console.log("$scope.decrypt() Error when decrypting database: " + e);
            return false;
        }
        $scope.$apply(function() {
            $scope.unencrypted_root = angular.fromJson(json);

            //TODO: cleanup so that this only exists in one place (see $scope.encrypt())
            if (!('entries' in $scope.unencrypted_root)) {
                $scope.unencrypted_root['entries'] = {};
            }
            if (!('objects' in $scope.unencrypted_root)) {
                $scope.unencrypted_root['objects'] = {};
            }
            $scope.databaseToEditor();
            $scope.updateSearch();
            $scope.setHidden('dbLockScreenClass');
            $scope.dbSelectionVisible = false;
        });
        return true;
    }

    $scope.lock = function() {
        $scope.save();
        $scope.unencrypted_root = undefined;
        $scope.database.selected_entry = undefined;
        $scope.derived_key = undefined;
        $scope.setVisible('dbLockScreenClass');
        $scope.dbSelectionVisible = true;
    }

    $scope.isLocked = function() {
        return $scope.unencrypted_root == undefined;
    }

    $scope.createNewEntry = function(title, contents, suppressUpdatingSearch) {
        if (contents === undefined) { contents = Object({}) };
        var object = Object({
            uuid: generate_guid(),
            previous_state_uuid : null,
            title: title,
            contents: contents
        });

        var entry_uuid = generate_guid();

        $scope.unencrypted_root.objects[object.uuid] = object;
        $scope.unencrypted_root.entries[entry_uuid] = object.uuid;

        if (!suppressUpdatingSearch) {
            $scope.updateSearch();
        }

        return object;
    }

    $scope.updateEntry = function(entryUUID, differences) {
        var old_object_uuid = $scope.unencrypted_root.entries[entryUUID];
        var old_object = $scope.unencrypted_root.objects[old_object_uuid];
        var new_object = angular.copy(old_object);

        for (key in differences) {
            new_object[key] = differences[key];
        }

        new_object.uuid = generate_guid();
        new_object.old_object_uuid = old_object_uuid;

        $scope.unencrypted_root.objects[new_object.uuid] = new_object;
        $scope.unencrypted_root.entries[entryUUID] = new_object.uuid;
    }

    $scope.addEntryClicked = function() {
        $scope.createNewEntry($scope.newEntryTitle);
        $scope.newEntryTitle = '';

        console.log($scope.unencrypted_root);
    }

    $scope.entry = function(uuid) {
        var object_uuid = $scope.unencrypted_root.entries[uuid];
        return $scope.unencrypted_root.objects[object_uuid];
    }

    $scope.search = function(query) {
        var results = [];
        if (!query) {
            for (uuid in $scope.unencrypted_root.entries) {
                var object_uuid = $scope.unencrypted_root.entries[uuid];
                results.push(new Object({'uuid':uuid,
                                         'object': $scope.unencrypted_root.objects[object_uuid]}));
            }
        } else {
            var search = query.toLowerCase();

            for (uuid in $scope.unencrypted_root.entries) {
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
        $scope.selected_entry = undefined;
        $scope.unencrypted_root.filtered_entries = results;
    }

    $scope.updateSearch = function() {
        $scope.search($scope.searchString);
    }

    $scope.editorToDatabase = function() {
        if ($scope.database.selected_entry != undefined) {
            $scope.updateEntry($scope.database.selected_entry, {'contents': $scope.editor.get() });
        }
    }

    $scope.databaseToEditor = function() {
        if ($scope.database.selected_entry != undefined) {
            $scope.editor.set($scope.entry($scope.database.selected_entry).contents);
        } else {
            //TODO: Disable editor and let the user know that they should select something
        }
    }

    $scope.entryClicked = function($event) {
        $scope.editorToDatabase();
        var uuid = $event.currentTarget.attributes['uuid'].value;
        $scope.database.selected_entry = uuid;
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
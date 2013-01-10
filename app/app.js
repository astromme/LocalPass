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
            $scope.setPassword($scope.password, function() {$scope.save()});
            $("#create_password_modal").modal('hide');
        }
    }
}

function EnterPasswordControl($scope) {
    $scope.password = '';

    $scope.verifyPassword = function() {
        $scope.setPassword($scope.password, function() {
            if ($scope.decrypt()) {
                $scope.enterPasswordForm.$setValidity('incorrect', false);
                 $("#enter_password_modal").modal('hide');

            } else {
                $scope.enterPasswordForm.$setValidity('incorrect', true);
            }
        });
    }
}

function DatabaseControl($scope) {
    $scope.database = undefined;
    $scope.derived_key = undefined;
    $scope.selected_entry = undefined;
    $scope.editor = new JSONEditor(document.getElementById("jsoneditor"));
    $scope.status_message = ''; // shown to the user as feedback
    
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
            on_finished_callback();
        };

        mypbkdf2.deriveKey(status_callback, result_callback);
    }

    $scope.new = function() {
        $scope.database = Object({
            'name' : 'Unamed Database',
            'uuid' : generate_guid(),
            'encrypted_root' : undefined
        });

        $scope.unencrypted_root = Object({
            'entries' : {},
        });
    }

    $scope.load = function(database_uuid) {
        $scope.database = chrome.storage.local.get(database_uuid);
    }

    $scope.save = function() {
        if ($scope.derived_key == undefined) {
            $("#create_password_modal").modal('show');
            return;
        }

        $scope.encrypt();
        //var data = { $scope.database.uuid : $scope.database };
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
                    })
                });

            });
        });
    }

    $scope.encrypt = function() {
        $scope.editorToDatabase();
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
            $scope.databaseToEditor();
            $scope.updateSearch();
        });
        return true;
    }

    $scope.lock = function() {
        $scope.encrypt();
        $scope.unencrypted_root = undefined;
        $scope.database.selected_entry = undefined;
        $scope.derived_key = undefined;
    }

    $scope.unlock = function() {
        if ($scope.database == undefined) {
            return;
        }

        $("#enter_password_modal").modal('show');
    }

    $scope.isLocked = function() {
        return $scope.unencrypted_root == undefined;
    }

    $scope.addEntry = function(title, contents, suppressUpdatingSearch) {
        if (contents === undefined) { contents = Object({}) };
        var entry = Object({
            uuid: generate_guid(),
            title: title,
            contents: contents
        });
        $scope.unencrypted_root.entries[entry.uuid] = entry;

        if (!suppressUpdatingSearch) {
            $scope.updateSearch();

        }

        return entry;
    }
 
    $scope.addEntryClicked = function() {
        $scope.addEntry($scope.newEntryTitle);
        $scope.newEntryTitle = '';
    };

    $scope.search = function(query) {
        var results = [];
        if (!query) {
            for (uuid in $scope.unencrypted_root.entries) {
                results.push($scope.unencrypted_root.entries[uuid]);
            }
        } else {
            var search = query.toLowerCase();

            for (uuid in $scope.unencrypted_root.entries) {
                var entry = $scope.unencrypted_root.entries[uuid];
                var field = String(entry.title).toLowerCase();
                index = field.indexOf(search);
                if (index != -1) {
                    results.push(entry);
                }
            }
        }

        results.sort();
        $scope.selected_entry = undefined;
        $scope.unencrypted_root.filtered_entries = results;
    }

    $scope.updateSearch = function() {
        $scope.search($scope.searchString);
    }

    $scope.editorToDatabase = function() {
        if ($scope.database.selected_entry != undefined) {
            $scope.unencrypted_root.entries[$scope.database.selected_entry].contents = $scope.editor.get();
        }
    }

    $scope.databaseToEditor = function() {
        if ($scope.database.selected_entry != undefined) {
            $scope.editor.set($scope.unencrypted_root.entries[$scope.database.selected_entry].contents);
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
}
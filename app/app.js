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
        $scope.database = chrome.storage.get(database_uuid);
    }

    $scope.save = function() {
        $scope.encrypt();
        chrome.storage.set($scope.database.uuid, $scope.database);
    }

    $scope.encrypt = function() {
        $scope.editorToDatabase();
        var root = angular.copy($scope.unencrypted_root);
        delete root.filtered_entries;
        delete root.selected_entry;
        var json = angular.toJson(root);
        $scope.database.encrypted_root = sjcl.encrypt($scope.derived_key, json);
    }

    $scope.lock = function() {
        $scope.encrypt();
        $scope.unencrypted_root = undefined;
        $scope.database.selected_entry = undefined;
    }

    $scope.unlock = function() {
        if ($scope.database == undefined) {
            return;
        }

        var json = sjcl.decrypt(derived_key, $scope.database.encrypted_root);
        $scope.unencrypted_root = angular.fromJson(json);
        $scope.databaseToEditor;
    }

    $scope.isLocked = function() {
        return $scope.unencrypted_root == undefined;
    }
 
    $scope.addEntry = function() {
        var entry = Object({
            uuid: generate_guid(),
            title: $scope.newEntryTitle,
            contents: Object({})
        });
        $scope.unencrypted_root.entries[entry.uuid] = entry;
        $scope.newEntryTitle = '';
        $scope.updateSearch();
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
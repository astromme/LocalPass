var module = angular.module('localPass', ['ui', 'ui.directives'])
var controller = null;

module.directive('noPropagateClick', function() {
    return function(scope, element, attrs) {
        $(element).click(function(event) {
            event.stopPropagation()
            return false;
        });
    }
})


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

function createErrorHandler() {
    var extra_info = arguments;

    return function(e) {
        console.log("error: " + Array.prototype.join.call(extra_info, ", "));
        console.error(e);
    }
}

function readAsText(fileEntry, callback) {
  fileEntry.file(function(file) {
    var reader = new FileReader();

    reader.onerror = createErrorHandler("while reading file");
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
                        $scope.$parent.create_password_screen_visible = false;
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
                if ($scope.isLocked()) {
                    $scope.$apply(function() {
                        $('#database_locked_widget input[type=password]').select()
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
                    
                console.log("password is correct. unlocking");

                $scope.$apply(function() {
                    $scope.password = '';
                    $('#database_locked_widget input[type=password]').blur()
                    $scope.$parent.lock_screen_visible = false;
                });
            });
        });
    }
}


function DatabaseControl($scope) {
    $scope.lock_screen_visible = false;
    $scope.create_password_screen_visible = false;


    $scope.filesystem = null;
    $scope.config = null;    
    $scope.database = null;
    $scope.decrypted = null;

    $scope.editor = null;
    $scope.status_message = ''; // shown to the user as feedback

    $scope.database_root = "default";
    

    $scope.init = function() {
        console.log('init');
        controller = $scope;

        $('#entries_list ul').keydown(function (e) {
            if ((e.which == 67 /* c */) && e.metaKey) {
                $scope.entryCopy(e)
                e.preventDefault();
            }
        });

        $scope.editor = new JSONEditor(document.getElementById("jsoneditor"),
                                   {
                                    'mode': 'editor',
                                    'history': true,
                                    'change': $scope.onEditorChange
                                   });

        chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
            if (message.type = "local_file_status_changed") {
                $scope.updateCache(function() {});
            }    
        });

        var get_config = function() {
            console.log('getting config');
            $scope.filesystem.root.getFile('config.json', {create: true}, function(f) {
                f.file(function (file) {
                    var reader = new FileReader();
                    reader.onload = function() {
                        console.log('got config');
                        try {
                            $scope.config = angular.fromJson(this.result);
                        } catch(e) {
                            console.log("Parsing config failed. Config was:");
                            console.log(this.result);
                            console.log(this.error);
                            $scope.config = angular.fromJson('{}');
                        }
                        parse_config();
                    }

                    reader.onerror = function() {
                        console.log("reading config errored:");
                        console.log(reader.error);
                    }

                    reader.onabort = function() {
                        console.log("reading config aborted");
                    }

                    reader.readAsText(file);
                });
            }, createErrorHandler("while getting config"));  
        }

        var parse_config = function() {
            if ('uuid' in $scope.config) {
                // existing database
                console.log('existing datbase');
                $scope.initializeDecryptedSection();

                console.log('showing lock screen')
                $scope.$apply(function() {
                    $scope.lock_screen_visible = true;
                });

                // once done showing, hide the loading screen class
                $('#database_locked_widget').one('webkitTransitionEnd', function(e) {
                    console.log("hiding loading screen class");
                    $scope.$apply(function() {
                        $scope.hide('dbLoadingScreenClass');
                    });
                });

                setTimeout(function() {
                    $('#database_locked_widget input[type=password]').focus();
                }, 100);

            } else {
                // fresh database
                console.log('new database');
                $scope.config.uuid = generate_guid();
                $scope.initializeDecryptedSection();

                console.log('showing password create screen');
                $scope.$apply(function() {
                    $scope.create_password_screen_visible = true;
                });
            
                // once done showing, hide the loading screen class
                $('#database_password_creation_widget').one('webkitTransitionEnd', function(e) {
                    console.log("hiding loading screen class");
                    $scope.$apply(function() {
                        $scope.hide('dbLoadingScreenClass');
                    });
                });
  
                setTimeout(function() {
                    $('#database_password_creation_widget input[type=password]')[0].focus()
                }, 100);
            }
        }

        chrome.syncFileSystem.requestFileSystem(function(fs) {
            if (fs === null) {
                console.log("fs was null, failing");
                return;
            }

            console.log('got filesystem: ' + fs);
            chrome.syncFileSystem.getUsageAndQuota(fs, function(storageInfo) {
                console.log(storageInfo);
                console.log(bytesToSize(storageInfo.usageBytes) + " used of");
                console.log(bytesToSize(storageInfo.quotaBytes) + " quota.");
            });
            $scope.filesystem = fs;
            get_config()
        });
    }

    $scope.closeWindow = function() {
        window.close();
    }

    $scope.destroy = function() {
        console.log("deleting filesystem...");
        chrome.syncFileSystem.deleteFileSystem($scope.filesystem, function(success) {
            if (success) {
                console.log("filesystem deleted.");
            } else {
                console.log("filesystem delete failed.");
            }
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

        var translation = {
            "lastaccess": "last_access",
            "lastmod": "last_modification",
        };

        var root_level_keys = [
            "creation",
            "last_access",
            "last_modification",
        ];

        chrome.fileSystem.chooseEntry({type: 'openFile', accepts: accepts}, function(readOnlyEntry) {
            if (!readOnlyEntry) {
                return;
            }

            readOnlyEntry.file(function(file) {
                readAsText(readOnlyEntry, function(result) {
                    var parser = new DOMParser();
                    var xmlDoc = parser.parseFromString(result,"text/xml");
                    var json = angular.fromJson(xml2json(xmlDoc, ''));

                    var handleGroup = function(object, prefixString) {
                        if (!object) { return; }

                        var groups;
                        if (object.forEach) {
                            groups = object;
                        } else {
                            groups = [object];
                        };

                        console.log(prefixString + " groups: " + groups);

                        groups.forEach(function(group) {
                            if (prefixString == "" && group.title == "Backup") {
                                // skip backup entries because I
                                // don't know what to do with them
                                // TODO: try and reconstruct history? Sounds hard.
                                return;
                            }

                            handleEntry(group.entry, prefixString + group.title + '/');
                            handleGroup(group.group, prefixString + group.title + '/');
                        });
                    };

                    var handleEntry = function(object, prefixString) {
                        if (!object) {
                            return;
                        }

                        var entries;
                        if (object.forEach) {
                            entries = object;
                        } else {
                            entries = [object];
                        }

                        console.log(prefixString + " entries: " + entries);

                        entries.forEach(function(entry) {
                            entry.labels = [prefixString];

                            // process translations
                            for (key in translation) {
                                // skip translations that don't do anything
                                if (key == translation[key]) {
                                    continue;
                                }

                                entry[translation[key]] = entry[key];
                                delete entry[key];
                            }

                            var root_keys = {};

                            //process keys that need to be moved to the root
                            for (var i=0; i<root_level_keys.length; i++) {
                                var key = root_level_keys[i];
                                root_keys[key] = entry[key];
                                delete entry[key];
                            }

                            $scope.createNewEntry(entry, root_keys, true /*suppress updating search */);
                        });
                    };

                    handleGroup(json.database.group, '');

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
            //console.log(json);
        } catch(e) {
            console.log("$scope.decrypt() Error when decrypting data: " + e);
            return false;
        }

        return angular.fromJson(json);
    }

    $scope.removeAllEntries = function() {
        var processEntries = function(entries) {
            var numberRemoved = 0;

            entries.forEach(function(entry, i) {
                entry.remove(function() {
                    console.log("removed");

                    numberRemoved += 1;
                    if (numberRemoved == entries.length-1) { // config.json is skipped
                        $scope.closeWindow();
                    }
                }, createErrorHandler("removing entry"));
            });
        }

        // Call the reader.readEntries() until no more results are returned.
        var readEntries = function(dirReader, entries) {
            dirReader.readEntries (function(results) {
                if (results.length) {
                    entries = entries.concat(toArray(results));
                    return readEntries(dirReader, entries);
                }

                processEntries(entries);

            }, createErrorHandler("while parsing directory tree in $scope.removeAllEntries()"));
        };

        console.log("removing everything");
        var dirReader = $scope.filesystem.root.createReader();
        var entries = [];
        readEntries(dirReader, entries); // Start reading dirs.
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

                    if (entries.length == 1) {
                        // it should just be config.json
                        $scope.updateSearch();
                        return callback();
                    }

                    entries.forEach(function(entry, i) {
                        if (entry.name == "config.json") { return; }

                        readAsText(entry, function(contents) {
                            var e = angular.fromJson($scope.decrypt(contents));
                            console.log(e);

                            if (e) {
                                try {
                                    $scope.decrypted.cache[e.uuid] = e;
                                } catch(e) {
                                    console.log("error decrypting entry: " + e);
                                }  
                            }


                            numberRead += 1;
                            if (numberRead == entries.length-1) { // config.json is skipped
                                // finished. update search then callback

                                $scope.updateSearch();
                                return callback();
                            }
                        });
                    });
                } else {
                    entries = entries.concat(toArray(results));
                    readEntries();
                }
            }, createErrorHandler("while parsing directory tree in $scope.updateCache()"));
        };

        console.log("reading objects/")
        readEntries(); // Start reading dirs.
    }

    // locks the database, removing the decrypted section
    // and showing the lock screen
    $scope.lock = function() {
        delete $scope.decrypted;
        $scope.initializeDecryptedSection();

        $scope.lock_screen_visible = true;
    }

    $scope.isUnlocked = function() {
        if (!$scope.decrypted) {
            return false;
        }

        if (!$scope.decrypted.derived_key) {
            return false;
        }

        return ($scope.config.uuid === $scope.decrypt($scope.config.encrypted_uuid));
    }

    $scope.isLocked = function() {
        return !$scope.isUnlocked();
    }

    $scope.filename = function(object) {
        if (!('uuid' in object)) {
            console.log('error, object has no uuid');
        }
        return object.uuid;
    }

    $scope.createNewEntry = function(contents, root_level_keys, suppressUpdatingSearch) {
        var entry = Object();
        entry.uuid = generate_guid();
        entry.contents = contents;
        for (key in root_level_keys) {
            entry[key] = root_level_keys[key];
        }

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

    $scope.deleteEntryWithID = function(id, suppressUpdatingSearch) {
        var filename = $scope.filename($scope.entry(uuid));

        $scope.filesystem.root.getFile(filename, {create: false}, function(fileEntry) {

            fileEntry.remove(function() {
                delete $scope.decrypted.cache[id];
                console.log('File removed.');

                if (!suppressUpdatingSearch) {
                    $scope.$apply(function() {
                        $scope.updateSearch();
                    });
                }

            }, createErrorHandler("deleting file"));

        }, createErrorHandler("getting handle of file to delete"));
    }

    $scope.deleteEntryClicked = function() {
        console.log("deleteEntryClickedd()");
        $scope.deleteEntryWithID($scope.decrypted.selected_entry_id);
    }

    $scope.entry = function(id) {
        return $scope.decrypted.cache[id];
    }

    $scope.save = function(filename, contents, callback) {
        $scope.filesystem.root.getFile(filename, {create: true}, function(file) {
            file.createWriter(function (fileWriter) {
                var blob = new Blob([contents], {type: 'text/plain'});
                fileWriter.onwrite = function() {
                    callback();
                }

                fileWriter.onerror = createErrorHandler("write failed: " + filename);

                fileWriter.write(blob);
            });
        }, createErrorHandler("saving file", filename));
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

        results.sort(function(a,b) {
            var a = a.object.contents.title;
            var b = b.object.contents.title;

            if (a) { a = a.toLowerCase(); }
            if (b) { b = b.toLowerCase(); }

            if (a == b) {
                return 0;
            } else if (a < b) {
                return -1;
            } else {
                return 1;
            }
        });

        console.log(results.length + ' results:');
        //console.log(results);

        $scope.deselectActiveEntry();
        $scope.decrypted.filtered_entries = results;
    }

    $scope.updateSearch = function() {
        $scope.search($scope.searchString);
    }

    $scope.onEditorChange = function() {
        console.log("editor change"); //: " + $scope.editor.history);
        // console.log(params);
        $scope.$apply(function() {
            $scope.status_message = '';
        });
    }

    $scope.editorToDatabase = function() {
        if ($scope.decrypted.selected_entry_id) {
            $scope.status_message = "saving...";

            // Update the cache
            $scope.decrypted.selected_entry.contents = $scope.editor.get();
            $scope.decrypted.cache[$scope.decrypted.selected_entry_id] = $scope.decrypted.selected_entry;

            // Encrypt
            var encrypted = $scope.encrypt($scope.decrypted.selected_entry);

            // Save
            $scope.save($scope.filename($scope.decrypted.selected_entry), encrypted, function() {
                console.log("all changes saved");
                $scope.$apply(function() {
                    $scope.status_message = 'all changes saved.';
                });
            });
        }
    }

    $scope.databaseToEditor = function() {
        if ($scope.decrypted.selected_entry_id) {
            // Use the cached version
            $scope.decrypted.selected_entry = $scope.decrypted.cache[$scope.decrypted.selected_entry_id];
            $scope.editor.set($scope.decrypted.selected_entry.contents);
            $scope.editor.setName($scope.decrypted.selected_entry.contents.title);
            $scope.editor.expandAll();
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

    $scope.deselectActiveEntry = function() {
        $scope.editorToDatabase();
        $scope.decrypted.selected_entry_id = null;
    }

    $scope.indexInFilteredEntries = function(entry_id) {
        for (var i=0; i<$scope.decrypted.filtered_entries.length; i++) {
            if ($scope.decrypted.filtered_entries[i].uuid == entry_id) {
                return i;
            }
        }
        return -1;
    }

    $scope.selectPreviousEntry = function() {
        console.log("selectPreviousEntry()");
        var index = $scope.indexInFilteredEntries($scope.decrypted.selected_entry_id);
        if (index > 0) {
            $scope.editorToDatabase();
            $scope.decrypted.selected_entry_id = $scope.decrypted.filtered_entries[index-1].uuid;
            $scope.databaseToEditor();

            var container = $('#entries_list');
            var item = $('#'+$scope.decrypted.selected_entry_id);

            var element_at_top = item.offset().top - container.offset().top + container.scrollTop();

            if (container.scrollTop() > element_at_top) {
                container.scrollTop(element_at_top);
            }
        }
    }

    $scope.selectNextEntry = function() {
        console.log("selectNextEntry()");
        var index = $scope.indexInFilteredEntries($scope.decrypted.selected_entry_id);
        if (index < $scope.decrypted.filtered_entries.length-1) {
            $scope.editorToDatabase();
            $scope.decrypted.selected_entry_id = $scope.decrypted.filtered_entries[index+1].uuid;
            $scope.databaseToEditor();

            var container = $('#entries_list');
            var item = $('#'+$scope.decrypted.selected_entry_id);

            var element_at_bottom = item.offset().top - container.offset().top + container.scrollTop() - container.height() + item.height();
            
            if (container.scrollTop() < element_at_bottom) {
                container.scrollTop(element_at_bottom);
            }
        }
    }

    $scope.entryCopy = function($event) {
        console.log("entryCopy()");
        var copy_helper = document.getElementById("hidden_copy_helper");
        var data = undefined;
        if ($event.shiftKey) {
            data = $scope.decrypted.selected_entry.contents.username;
        } else {
            var data = $scope.decrypted.selected_entry.contents.password;
        }
        if (data === undefined) {
            copy_helper.value = "";
            console.log("can't copy empty string");
            //TODO: Show visible feedback when an entry doesn't have a username/password
        } else {
            copy_helper.value = data;
        }
        copy_helper.select();
        document.execCommand('copy', false, null);
        copy_helper.value = '';
        $('#'+$scope.decrypted.selected_entry_id).focus();
    }

    $scope.showWithAnimation = function(variable) {
        $scope[variable] = 'shownAnimation';
    }
    
    $scope.show = function(variable) {
        $scope[variable] = 'shown';
    }

    $scope.hideWithAnimation = function(variable) {
        $scope[variable] = 'hiddenBelowAnimation';
    }

    $scope.hide = function(variable) {
        $scope[variable] = 'hiddenBelow';
    }

}
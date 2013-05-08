// on_each_entry_callback(entry, entry_root_keys)
// on_finished_callback()
function parse_keypassx_xml(xmlString, on_each_entry_callback, on_finished_callback) {
    var translation = {
        "lastaccess": "last_access",
        "lastmod": "last_modification",
    };

    var root_level_keys = [
        "creation",
        "last_access",
        "last_modification",
    ];

    var finished = false;
    var items = 0;
    var callbacksRecieved = 0;
    var parser = new DOMParser();
    var xmlDoc = parser.parseFromString(xmlString,"text/xml");
    var json = angular.fromJson(xml2json(xmlDoc, ''));

    var track_entries = function() {
        callbacksRecieved += 1;
        if (finished && items == callbacksRecieved) {
            console.log('done');
            return on_finished_callback();
        }
    };

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


            console.log("entry.");
            items += 1;
            on_each_entry_callback(entry, root_keys, track_entries);
        });
    };

    console.log('starting');
    handleGroup(json.database.group, '');
    finished = true;
}
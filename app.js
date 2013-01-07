function DatabaseControl($scope) {
    $scope.database_name = "Dummy Database";
    $scope.selected_entry = undefined;
    $scope.editor = new JSONEditor(document.getElementById("jsoneditor"));
    
    $scope.closeWindow = function() {
        window.close();
    }

    $scope.lock = function() {
        $scope.editorToDatabase();
        var json = angular.toJson($scope.unlocked_database);
        $scope.locked_database = sjcl.encrypt('dummy_password', json);
        $scope.unlocked_database = undefined;
        $scope.selected_entry = undefined;
    }

    $scope.unlock = function() {
        if ($scope.locked_database == undefined) {
            $scope.unlocked_database = {
                'name' : 'Dummy Database',
                'entries' : []
            }
            return;
        }
        var json = sjcl.decrypt('dummy_password', $scope.locked_database);
        $scope.unlocked_database = angular.fromJson(json);
        $scope.databaseToEditor;
    }

    $scope.isLocked = function() {
        return $scope.unlocked_database == undefined;
    }
 
    $scope.addEntry = function() {
        $scope.unlocked_database.entries.push({
            title: $scope.newEntryTitle,
            contents: {}
            });
        $scope.newEntryTitle = '';
    };

    $scope.editorToDatabase = function() {
        if ($scope.selected_entry != undefined) {
            $scope.unlocked_database.entries[$scope.selected_entry]['contents'] = $scope.editor.get();
        }
    }

    $scope.databaseToEditor = function() {
        if ($scope.selected_entry != undefined) {
            $scope.editor.set($scope.unlocked_database.entries[$scope.selected_entry]['contents']);
        } else {
            //TODO: Disable editor and let the user know that they should select something
        }
    }

    $scope.entryClicked = function($event) {
        $scope.editorToDatabase();
        var index = $event.toElement.attributes['ng-index'].value;
        $scope.selected_entry = index;
        $scope.databaseToEditor();
    }
}
var componentName = 'imageSetManager';
module.exports.name = componentName;
require('./style.less');

var app = angular.module(componentName, ['sideBar', 'wiTreeView', 'wiDroppable', 'ngDialog', 'wiToken']);
app.component(componentName, {
    template: require('./template.html'),
    controller: imageSetManagerController,
    controllerAs: 'self',
    bindings: {
        token: "<"
    },
    transclude: true
});

function imageSetManagerController($scope, $http, wiToken) {
    let self = this;
    $scope.treeConfig = [];
    const BASE_URL = "http://dev.i2g.cloud";
    // let Authorization = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VybmFtZSI6Imh1bmduayIsIndob2FtaSI6Im1haW4tc2VydmljZSIsInJvbGUiOjIsImNvbXBhbnkiOiJFU1MiLCJpYXQiOjE1NTY5NDMxNDQsImV4cCI6MTU1NzgwNzE0NH0.uY8DVdMhkAE36hO-RFVa7ZyRqJhNhysCFybUR0Zxy2c";

    this.$onInit = function () {
        wiToken.setToken(self.token);
        getTree();
    }
    this.runMatch = function (node, criteria) {
        return node.name.includes(criteria);
    }
    this.getLabel = function (node) {
        if (node.idImageSet) {
            return node.name;
        } else if (node.idWell) {
            return node.name;
        }
    }
    this.getIcon = function (node) {
        if (node.idImage) {
            return 'image-16x16';
        } else if (node.idImageSet)
            return "image-set-16x16"
        else if (node.idWell)
            return "well-16x16";
    }
    this.getChildren = function (node) {
        if (node.idWell) {
            return node.images;
        }
    }
    this.clickFunction = function ($event, node) {
        if (node.idImageSet && node.idWell) {
            console.log("CLicked on imageSet");
        } else {
            getImageSet(node.idWell, node, function (err, images) {
                console.log(node.idWell);
                node.images = images;
                console.log(arguments);
            });
        }
    }
    self.deleteImageSet = function () {
        console.log("delete image set");
    }
    self.createImageSet = function () {
        console.log('Create image set');
    }
    self.importImages = function () {
        console.log("Import images");
    }
    self.exportImageSet = function () {
        console.log("Export image set");
    }
    self.refresh = getTree;

    function getTree() {
        $scope.treeConfig = [];
        getWells($scope.treeConfig, function (err, wells) {
            $scope.treeConfig = wells;
        });
    }

    function getWells(treeConfig, cb) {
        $http({
            method: 'POST',
            url: BASE_URL + '/project/well/list',
            data: {
                idProject: 32
            },
            headers: {
                "Authorization": wiToken.getToken(),
            }
        }).then(function (response) {
            cb(null, response.data.content, treeConfig);
        }, function (err) {
            cb(err);
        });
    }

    function getImageSet(wellId, wellNodeChildren, cb) {
        $http({
            method: 'POST',
            url: BASE_URL + '/project/well/image-set/list',
            data: {
                idWell: wellId
            },
            headers: {
                "Authorization": wiToken.getToken(),
            }
        }).then(function (response) {
            console.log(response);
            cb(null, response.data.content, wellNodeChildren);
        }, function (err) {
            cb(err);
        });
    }


}
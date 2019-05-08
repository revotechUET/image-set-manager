var componentName = 'imageSetManager';
module.exports.name = componentName;
require('./style.less');

var app = angular.module(componentName, [
    'sideBar', 'wiTreeView',
    'wiToken', 'editable', 'ngclipboard', 'wiDialog'
]);
app.component(componentName, {
    template: require('./template.html'),
    controller: imageSetManagerController,
    controllerAs: 'self',
    bindings: {
        token: "<",
        idProject: "<",
        baseUrl: "<"
    },
    transclude: true
});

function imageSetManagerController($scope, $http, $timeout, $element, wiToken, wiDialog) {
    let self = this;
    self.treeConfig = [];
    self.selectedNode = null;
    const BASE_URL = "http://dev.i2g.cloud";

    this.$onInit = function () {
        self.baseUrl = self.baseUrl || BASE_URL;
        if (self.token)
            wiToken.setToken(self.token);
        getTree();
        $element.find('.image-holder').draggable({
            start: function (event, ui) {
                ui.helper[0].focus();
            }
        });
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
            return 'image-normal-16x16';
        } else if (node.idImageSet)
            return "image-set-16x16"
        else if (node.idWell)
            return "well-16x16";
    }
    this.getChildren = function (node) {
        if (node.idImageSet) {
            return null;
        } else {
            return node.imageSets;
        }
    }

    function updateNode(node) {
        if (node.idImageSet && node.idWell) {

        } else {
            getImageSet(node.idWell, function (err, imageSets) {
                node.imageSets = imageSets;
            });
        }
    }

    this.clickFunction = function ($event, node) {
        updateNode(node);
        self.selectedNode = node;
    }
    self.createImageSet = function () {
        wiDialog.promptDialog({
            title: "New Image Set",
            inputName: "name",
            input: 'ImgSet_'
        }, createImageSet);
    }

    function createImageSet(imageSetName) {
        if (!self.selectedNode) return;
        $http({
            method: 'POST',
            url: self.baseUrl + '/project/well/image-set/new',
            data: {
                name: imageSetName,
                idWell: self.selectedNode.idWell
            },
            headers: {
                "Authorization": wiToken.getToken(),
            }
        }).then(function (response) {
            if (response.data.code == 200) {
                let node = self.treeConfig.find((n) => (self.selectedNode.idWell === n.idWell));
                updateNode(node);
            } else {
                self.createImageSet();
            }
        }, function (err) {
            console.error(err);
        });
    }

    self.deleteImageSet = function () {
        if (!self.selectedNode || !self.selectedNode.idImageSet) return;
        wiDialog.confirmDialog("Confirmation",
            `Are you sure to delete image set "${self.selectedNode.name}"?`,
            function (yesno) {
                if (yesno) {
                    deleteImageSet(self.selectedNode.idImageSet);
                }
            });
    }

    function deleteImageSet(idImageSet) {
        $http({
            method: 'POST',
            url: self.baseUrl + '/project/well/image-set/delete',
            data: {
                idImageSet: idImageSet
            },
            headers: {
                "Authorization": wiToken.getToken(),
            }
        }).then(function (response) {
            let node = self.treeConfig.find((aNode) => (self.selectedNode.idWell === aNode.idWell));
            updateNode(node);
        }, function (err) {
            self.createImageSet();
        });
    }
    self.importImages = function () {
        console.log("Import images");
    }
    self.exportImageSet = function () {
        console.log("Export image set");
    }
    self.refresh = getTree;

    self.rowClick = function (image) {
        console.log("row click");
        $timeout(() => {
            self.imgUrl = image.imageUrl;
        });
    }
    self.previewImagecheck = function() {
        self.hasPreview = self.previewImageCheckValue;
        if(!self.previewImageCheckValue){
            self.imgUrl = null;
        }
    };
    self.keyDown = function ($event) {
        if ($event.key === 'Escape') {
            $timeout(() => {
                self.imgUrl = null;
            });
        }
    }

    self.getFocus = function ($event) {
        $event.currentTarget.focus();
    }

    function getTree() {
        self.treeConfig = [];
        getWells(self.treeConfig, self.idProject, function (err, wells) {
            if (!err) self.treeConfig = wells;
        });
    }

    function getWells(treeConfig, idProject, cb) {
        $http({
            method: 'POST',
            url: self.baseUrl + '/project/well/list',
            data: {
                idProject: idProject
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

    function getImageSet(wellId, cb) {
        $http({
            method: 'POST',
            url: self.baseUrl + '/project/well/image-set/list',
            data: {
                idWell: wellId
            },
            headers: {
                "Authorization": wiToken.getToken(),
            }
        }).then(function (response) {
            cb(null, response.data.content);
        }, function (err) {
            cb(err);
        });
    }

    self.getImages = getImages

    function getImages(imageSet) {
        return (imageSet || {}).images;
    }
    self.deselectAll = function () {
        deselectAll(self.selectedNode);
    }

    function deselectAll(imageSet) {
        let images = getImages(imageSet);
        if (!images) return;
        images.forEach((img) => {
            img._selected = false;
        });
    }

    self.addImage = function () {
        self.selectedNode.images = self.selectedNode.images || [];
        self.selectedNode.images.push({
            name: 'newImage',
            topDepth: 0,
            bottomDepth: 100,
            imageUrl: null,
            idImageSet: self.selectedNode.idImageSet,
            _created: true
        });
    }

    self.deleteImage = function () {
        let images = getImages(self.selectedNode);
        if (!images) return;
        let image = images.find((img) => (img._selected));
        image._deleted = true;
    }

    self.imageSetup = function (image) {
        wiDialog.imageGaleryDialog(function (imgUrl) {
            image.imageUrl = imgUrl;
            image._updated = true;
        });
    }
    self.updateImageName = function (image, newVal) {
        image.name = newVal;
        image._updated = true;
    }
    self.updateImageTopDepth = function (image, newVal) {
        image.topDepth = newVal;
        image._updated = true;
    }
    self.updateImageBottomDepth = function (image, newVal) {
        image.bottomDepth = newVal;
        image._updated = true;
    }
    self.applyImageActions = function () {
        updateListImage();
    }

    async function updateListImage() {
        let images = self.getImages(self.selectedNode);
        
        for (let idx = 0; idx < images.length; idx++) {
            let image = images[idx];
            if (image._deleted) {
                if (image._created) {
                    images.splice(idx, 1);
                } else {
                    let response = await doDeleteImagePromise(self.selectedNode.idImageSet, image.idImage);
                    console.log('Done delete', response);
                }
            } else if (image._created) {
                let response = await doCreateImagePromise(self.selectedNode.idImageSet, image);
                console.log('Done create', response);
            } else if (image._updated) {
                let response = await doUpdateImagePromise(self.selectedNode.idImageSet, image);
                console.log('Done update', response);
            }
        }
        console.log("DONE ALL");
        let response = await $http({
            method: 'POST',
            url: self.baseUrl + '/project/well/image-set/info',
            data: {
                idImageSet: self.selectedNode.idImageSet
            },
            headers: {
                "Authorization": wiToken.getToken(),
            }
        });
        $timeout(() => {
            self.selectedNode.images = response.data.content.images; 
        });
        // for (let idx = 0; idx < images.length; idx++) {
        //     let image = images[idx];
        //     if (image._deleted) {
        //         if (image._created) {
        //             images.splice(idx, 1);
        //         } else {
        //             doDeleteImage(self.selectedNode.idImageSet, image.idImage);
        //         }
        //         // image._deleted = false;
        //     } else if (image._created) {
        //         doCreateImage(self.selectedNode.idImageSet, image);
        //         // image._created = false;
        //     } else if (image._updated) {
        //         doUpdateImage(self.selectedNode.idImageSet, image);
        //         // image._updated = false;

        //     }
        // }
    }
    function doDeleteImagePromise(idImageSet, idImage) {
        return $http({
            method: 'POST',
            url: self.baseUrl + '/project/well/image-set/image/delete',
            data: {
                idImage: idImage
            },
            headers: {
                "Authorization": wiToken.getToken(),
            }
        });
    }
    function doDeleteImage(idImageSet, idImage) {
        $http({
            method: 'POST',
            url: self.baseUrl + '/project/well/image-set/image/delete',
            data: {
                idImage: idImage
            },
            headers: {
                "Authorization": wiToken.getToken(),
            }
        }).then(function (response) {
            console.log(response.data.content);
        }, function (err) {
            console.error(err);
        });
    }

    function doCreateImagePromise(idImageSet, image) {
        image.idImageSet = idImageSet;
        return $http({
            method: 'POST',
            url: self.baseUrl + '/project/well/image-set/image/new',
            data: image,
            headers: {
                "Authorization": wiToken.getToken(),
            }
        });
    }
    function doCreateImage(idImageSet, image) {
        image.idImageSet = idImageSet;
        $http({
            method: 'POST',
            url: self.baseUrl + '/project/well/image-set/image/new',
            data: image,
            headers: {
                "Authorization": wiToken.getToken(),
            }
        }).then(function (response) {
            console.log(response.data.content);
        }, function (err) {
            console.error(err);
        });
    }

    function doUpdateImagePromise(idImageSet, image) {
        return $http({
            method: 'POST',
            url: self.baseUrl + '/project/well/image-set/image/edit',
            data: image,
            headers: {
                "Authorization": wiToken.getToken(),
            }
        });
    }
    function doUpdateImage(idImageSet, image) {
        $http({
            method: 'POST',
            url: self.baseUrl + '/project/well/image-set/image/edit',
            data: image,
            headers: {
                "Authorization": wiToken.getToken(),
            }
        }).then(function (response) {
            console.log(response.data.content);
        }, function (err) {
            console.error(err);
        });
    }
}
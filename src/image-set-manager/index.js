var componentName = 'imageSetManager';
module.exports.name = componentName;
require('./style.less');

var app = angular.module(componentName, [
    'sideBar', 'wiTreeView',
    'wiApi', 'editable', 'ngclipboard', 'wiDialog'
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

function imageSetManagerController($scope, $timeout, $element, wiToken, wiApi, wiDialog) {
    let self = this;
    self.treeConfig = [];
    self.selectedNode = null;
    const BASE_URL = "http://dev.i2g.cloud";

    this.$onInit = function () {
        self.hasPreview = true;
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
            wiApi.getImageSetsPromise(node.idWell)
                .then(imageSets => {
                    let imgs = imageSets.sort((img1, img2) => (img1.orderNum - img2.orderNum));
                    $timeout(() => node.imageSets = imgs)
                })
                .catch(err => console.error(err));
            /*getImageSet(node.idWell, function (err, imageSets) {
                node.imageSets = imageSets;
            });*/
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

    async function createImageSet(imageSetName) {
        if (!self.selectedNode) return;
        try {
            await wiApi.createImageSetPromise(self.selectedNode.idWell, name);
            let node = self.treeConfig.find((n) => (self.selectedNode.idWell === n.idWell));
            updateNode(node);
        }
        catch(err) {
            console.error(err);
            self.createImageSet();
        }
    }

    self.deleteImageSet = function () {
        if (!self.selectedNode || !self.selectedNode.idImageSet) return;
        wiDialog.confirmDialog("Confirmation",
            `Are you sure to delete image set "${self.selectedNode.name}"?`,
            function (yesno) {
                if (yesno) {
                    try {
                        wiApi.deleteImageSetPromise(self.selectedNode.idImageSet);
                    }
                    catch(err) {
                        console.error(err);
                    }
                }
            });
    }

    self.importImages = function () {
        console.log("Import images");
    }
    self.exportImageSet = function () {
        console.log("Export image set");
    }
    self.refresh = getTree;

    self.rowClick = function($event, image) {
        if (!$event.ctrlKey && !$event.metaKey && !$event.shiftKey) {
            self.deselectAll();
            image._selected = !image._selected;
            return;
        }
        if ($event.ctrlKey || $event.metaKey) {
            image._selected = !image._selected;
            return;
        }
        if ($event.shiftKey) {
            let selectedImages = self.selectedNode.images.filter(img => img._selected);
            if (image.orderNum < selectedImages[0].orderNum) {
                self.selectedNode.images.forEach(img => {
                    if ((img.orderNum - image.orderNum)*(img.orderNum - selectedImages[0].orderNum) < 0) {
                        img._selected = true;
                    }
                });
            }
            else if (image.orderNum > selectedImages[selectedImages.length-1].orderNum) {
                self.selectedNode.images.forEach(img => {
                    if ((img.orderNum - image.orderNum)*(img.orderNum - selectedImages[selectedImages.length-1].orderNum) < 0) {
                        img._selected = true;
                    }
                });
            }
        }
        image._selected = !image._selected;
    }
    self.preview = function (image) {
        // console.log("row click");
        $timeout(() => {
            self.imgUrl = image.imageUrl;
        });
    }
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
        wiApi.getWellsPromise(self.idProject)
            .then(wells => $timeout(() => self.treeConfig = wells))
            .catch(err => console.error(err));
    }

    self.getImages = getImages

    function getImages(imageSet) {
        try {
            return (imageSet || {}).images.sort((img1, img2) => (img1.orderNum - img2.orderNum));
        }
        catch(e) {return []}
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
        let well = self.treeConfig.find((aNode) => (self.selectedNode.idWell === aNode.idWell));
        let topDepth = getTopDepth(well);
        let bottomDepth = getBottomDepth(well);
        self.selectedNode.images = self.selectedNode.images || [];
        let selectedIdx = self.selectedNode.images.findIndex(img => img._selected);
        if (selectedIdx < 0) {
            let oNum = 0;
            if (self.selectedNode.images.length > 0) {
                oNum = self.selectedNode.images[self.selectedNode.images.length-1].orderNum;
            }
            self.selectedNode.images.push({
                name: 'newImage',
                topDepth: topDepth,
                bottomDepth: Math.min(bottomDepth, topDepth + 100),
                imageUrl: null,
                idImageSet: self.selectedNode.idImageSet,
                orderNum: oNum,
                _created: true
            });
        }
        else {
            let oNum = self.selectedNode.images[selectedIdx].orderNum + 1;
            for( let j = selectedIdx + 1; j < self.selectedNode.images.length; j++ ) {
                self.selectedNode.images[j].orderNum = oNum + j - selectedIdx;
                self.selectedNode.images[j]._updated = true;
            }
            self.selectedNode.images.splice(selectedIdx, 0, {
                name: 'newImage',
                topDepth: topDepth,
                bottomDepth: Math.min(bottomDepth, topDepth + 100),
                imageUrl: null,
                idImageSet: self.selectedNode.idImageSet,
                orderNum: oNum,
                _created: true
            })
        }
    }

    self.deleteImage = function () {
        let images = getImages(self.selectedNode);
        if (!images) return;
        images.filter((img) => (img._selected)).forEach(img => img._deleted = true);
        //image._deleted = true;
    }

    self.imageSetup = function (image) {
        wiDialog.imageUploadDialog(function (imgUrl) {
            if (image.imageUrl != imgUrl && imgUrl) {
                image.imageUrl = imgUrl;
                image._updated = true;
            }
        });
    }
    self.updateImageName = function (image, newVal) {
        if (image.name != newVal) {
            image.name = newVal;
            image._updated = true;
        }
    }
    self.updateImageTopDepth = function (image, newVal) {
        newVal = parseFloat(newVal)
        if (newVal >= image.bottomDepth) {
            return console.log("Error again");
        }
        let well = self.treeConfig.find((aNode) => (self.selectedNode.idWell === aNode.idWell));
        let topDepth = getTopDepth(well);
        let bottomDepth = getBottomDepth(well);
        if ((newVal - topDepth) * (newVal - bottomDepth) < 0) {
            image.topDepth = newVal;
            image._updated = true;
        }
        else {
            console.log("Error");
        }
    }
    self.updateImageBottomDepth = function (image, newVal) {
        newVal = parseFloat(newVal)
        if (newVal <= image.topDepth) {
            return console.log("Error again");
        }
        let well = self.treeConfig.find((aNode) => (self.selectedNode.idWell === aNode.idWell));
        let topDepth = getTopDepth(well);
        let bottomDepth = getBottomDepth(well);
        if ((newVal - topDepth) * (newVal - bottomDepth) < 0) {
            image.bottomDepth = newVal;
            image._updated = true;
        }
        else {
            console.log("Error");
        }
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
                    try {
                        await wiApi.deleteImagePromise(image.idImage);
                    }
                    catch(err) {
                        console.error(err);
                    }
                }
            } else if (image._created) {
                image.idImageSet = self.selectedNode.idImageSet;
                try {
                    await wiApi.createImagePromise(image);
                }
                catch(err) {
                    console.error(err);
                }
            } else if (image._updated) {
                try {
                    await wiApi.updateImagePromise(image);
                }
                catch(err) {
                    console.error(err);
                }
            }
        }
        try {
            let imageSet = await wiApi.getImageSetPromise(self.selectedNode.idImageSet);
            $timeout(() => {
                self.selectedNode.images = imageSet.images;
            });
        }
        catch(err) {
            console.error(err);
        }
    }

    function getTopDepth(well) {
        let startHdr = well.well_headers.find((wh) => (wh.header === 'STRT'));
        return wiApi.convertUnit(parseFloat(startHdr.value), startHdr.unit, 'm');
    }
    function getBottomDepth(well) {
        let stopHdr = well.well_headers.find((wh) => (wh.header === 'STOP'));
        return wiApi.convertUnit(parseFloat(stopHdr.value), stopHdr.unit, 'm');
    }
}

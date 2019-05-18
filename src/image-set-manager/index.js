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
    const DEFAULT_HEIGHT = 1;
    self.treeConfig = [];
    self.unitOptions = [{id:1,name:'M'},{id:2,name:'m'},{id:3,name:'meter'},{id:4,name:'meters'},
    {id:5,name:'metres'},{id:6,name:'METERS'},{id:7,name:'METRES'},{id:8,name:'F'},{id:9,name:'FEET'},
    {id:10,name:'feet'},{id:11,name:'Ft'},{id:12,name:'ft'}];
    //self.unit = self.unitOptions[0];
    self.selectedNode = null;
    const BASE_URL = "http://api-1.i2g.cloud";

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

    function updateNode(node, force) {
        if (node.idImageSet && node.idWell) {
            let well = self.treeConfig.find(w => w.idWell === node.idWell);
            self.unit = self.unitOptions.find(uOpt => (uOpt.name === getUnit(well).trim()));
            if(force){
                wiApi.getImageSetPromise(node.idImageSet).then((imageSet) => {
                    $timeout(() => {node.images = imageSet.images});
                }).catch((err) => {
                    console.error(err);
                });
            }
        } else {
            self.unit = self.unitOptions.find(uOpt => (uOpt.name === getUnit(node).trim()));
            wiApi.getImageSetsPromise(node.idWell)
                .then(imageSets => {
                    let imgs = imageSets.sort((img1, img2) => (img1.orderNum - img2.orderNum));
                    $timeout(() => node.imageSets = imgs)
                })
                .catch(err => console.error(err));
        }
    }

    this.clickFunction = function ($event, node, selectedObjs) {
        updateNode(node);
        self.selectedNode = node;
        self.selectedNodes = Object.values(selectedObjs).map(obj => obj.data);
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
            await wiApi.createImageSetPromise(self.selectedNode.idWell, imageSetName);
            let node = self.treeConfig.find((n) => (self.selectedNode.idWell === n.idWell));
            updateNode(node);
        }
        catch(err) {
            wiDialog.errorMessageDialog(err.message, function(){
                self.createImageSet();
            });
        }
    }

    self.deleteImageSet = function () {
        if (!self.selectedNode || !self.selectedNode.idImageSet) return;
        wiDialog.confirmDialog("Confirmation",
            `Are you sure to delete image set "${self.selectedNodes.filter(n => n.idImageSet).map(n => n.name).toString().replace(/,/g, ', ')}"?`,
            async function (yesno) {
                if (yesno) {
                    try {
                        for (let _node of self.selectedNodes) {
                            if (_node.idImageSet) {
                                await wiApi.deleteImageSetPromise(_node.idImageSet);
                            }
                        }
                        getTree();
                    }
                    catch(err) {
                        console.error(err);
                    }
                }
            });
    }

    self.importImages = function () {
        console.log("Import images");
        wiDialog.importImagesDialog(self.idProject, "ImpImgSet", function() {});
    }
    self.exportImageSet = function () {
        console.log("Export image set");
    }
    self.refresh = getTree;

    self.refreshImageSet = function () {
        updateNode(self.selectedNode, true);
    }

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
                console.log("ok");
            });
        }
    }

    self.getFocus = function ($event) {
        $event.currentTarget.focus();
    } 

    function getTree() {
        wiApi.getWellsPromise(self.idProject)
            .then(wells => $timeout(
                () => self.treeConfig = wells.sort(
                    (w1, w2) => (w1.name.localeCompare(w2.name))
                )
            ))
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

    self.addImage = async function () {
        let well = self.treeConfig.find((aNode) => (self.selectedNode.idWell === aNode.idWell));
        let topDepth = wiApi.getWellTopDepth(well);
        let bottomDepth = wiApi.getWellBottomDepth(well);
        self.selectedNode.images = self.selectedNode.images || [];
        let selectedIdx = self.selectedNode.images.findIndex(img => img._selected);
        let imageObj = {
            name: 'newImage',
            topDepth: topDepth,
            bottomDepth: Math.min(bottomDepth, topDepth + DEFAULT_HEIGHT),
            imageUrl: null,
            idImageSet: self.selectedNode.idImageSet
        }
        let oNum = 0;
        if (selectedIdx < 0) {
            if (self.selectedNode.images.length > 0) {
                let previousImage = self.selectedNode.images[self.selectedNode.images.length-1];
                oNum = previousImage.orderNum;
                imageObj.topDepth = previousImage.bottomDepth;
                imageObj.bottomDepth = Math.min(bottomDepth, imageObj.topDepth + DEFAULT_HEIGHT);
            }
        }
        else {
            oNum = self.selectedNode.images[selectedIdx].orderNum + 1;
            for( let j = selectedIdx + 1; j < self.selectedNode.images.length; j++ ) {
                self.selectedNode.images[j].orderNum = oNum + j - selectedIdx;
                self.selectedNode.images[j]._updated = true;
            }
            let previousImage = self.selectedNode.images[selectedIdx];
            imageObj.topDepth = previousImage.bottomDepth;
            imageObj.bottomDepth = Math.min(bottomDepth, imageObj.topDepth + DEFAULT_HEIGHT);
        }
        imageObj.orderNum = oNum;
        try {
            let image = await wiApi.createImagePromise(imageObj);
            image._created = true;
            if (selectedIdx < 0) {
                $timeout(() => {
                    self.selectedNode.images.push(image);
                });
            }
            else {
                $timeout(() => {
                    self.selectedNode.images.splice(selectedIdx, 0, image);
                });
            }
        }
        catch(err) {
            console.error(err);
        }
    }

    self.deleteImage = function () {
        let images = getImages(self.selectedNode);
        if (!images) return;
        images.filter((img) => (img._selected)).forEach(img => img._deleted = true);
        //image._deleted = true;
    }

    self.imageSetup = function (image) {
        wiDialog.imageUploadDialog(image.idImage, function (imgUrl) {
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
    self.getImageTopDepth = function(image) {
        return wiApi.bestNumberFormat(wiApi.convertUnit(image.topDepth, 'm', self.unit.name), 2);
    }
    self.updateImageTopDepth = function (image, newVal) {
        newVal = wiApi.convertUnit(parseFloat(newVal),self.unit.name,'m');
        if (newVal >= image.bottomDepth) {
            return console.log("Error again");
        }
        let well = self.treeConfig.find((aNode) => (self.selectedNode.idWell === aNode.idWell));
        let topDepth = wiApi.getWellTopDepth(well);
        let bottomDepth = wiApi.getWellBottomDepth(well);
        if ((newVal - topDepth) * (newVal - bottomDepth) < 0) {
            image.topDepth = newVal;
            image._updated = true;
        }
        else {
            console.log("Error");
        }
    }
    self.getImageBottomDepth = function(image) {
        
        return wiApi.bestNumberFormat(wiApi.convertUnit(image.bottomDepth, 'm', self.unit.name), 2);
    }
    self.updateImageBottomDepth = function (image, newVal) {
        newVal = wiApi.convertUnit(parseFloat(newVal), self.unit.name, 'm');
        if (newVal <= image.topDepth) {
            return console.log("Error again");
        }
        let well = self.treeConfig.find((aNode) => (self.selectedNode.idWell === aNode.idWell));
        let topDepth = wiApi.getWellTopDepth(well);
        let bottomDepth = wiApi.getWellBottomDepth(well);
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
                        if (image.imageUrl) await wiApi.deleteImageFilePromise(image.imageUrl);
                        await wiApi.deleteImagePromise(image.idImage);
                    }
                    catch(err) {
                        console.error(err);
                    }
                }
            } else if (image._created) {
                if (image.imageUrl) {
                    try {
                        await wiApi.updateImagePromise(image);
                    }
                    catch(err) {
                        console.error(err);
                    }
                }
                else {
                    try {
                        await wiApi.deleteImagePromise(image.idImage);
                    }
                    catch(err) {
                        console.error(err);
                    }
                }
            } else if (image._updated) {
                if (image.imageUrl) {
                    try {
                        await wiApi.updateImagePromise(image);
                    }
                    catch(err) {
                        console.error(err);
                    }
                }
                else {
                    try {
                        await wiApi.deleteImagePromise(image.idImage);
                    }
                    catch(err) {
                        console.error(err);
                    }
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

    function getUnit(well) {
        return well.unit;
    }
    self.getTopDepth = function() {
        try {
            let well = self.treeConfig.find((aNode) => (self.selectedNode.idWell === aNode.idWell));
            return wiApi.bestNumberFormat(wiApi.getWellTopDepth(well, self.unit.name));
        }
        catch(err) {
            return "";
        }
    }
    self.getBottomDepth = function() {
        try {
            let well = self.treeConfig.find((aNode) => (self.selectedNode.idWell === aNode.idWell));
            return wiApi.bestNumberFormat(wiApi.getWellBottomDepth(well, self.unit.name));
        }
        catch(err) {
            return "";
        }
    }
}

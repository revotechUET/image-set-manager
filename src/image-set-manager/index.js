import Vue from 'vue';
import { ngVue, WiTree } from '@revotechuet/misc-component-vue';
import WiVirtualList from 'wi-vlist';
var componentName = 'imageSetManager';
export const name = componentName;
import './style.less';

var app = angular.module(componentName, [
    'sideBar', 'wiTreeView', 'wiTreeViewVirtual',
    'wiApi', 'editable', 'ngclipboard', 'wiDialog', ngVue,
]);
app.component(componentName, {
    template: require('./template.html'),
    controller: imageSetManagerController,
    controllerAs: 'self',
    bindings: {
        token: "<",
        idProject: "<",
        idWell: '<',
        idImageSet: '<',
        baseUrl: "<",
        onUpdateListImageFinished: "<"
    },
    transclude: true
});
imageSetManagerController.$inject = ['$scope', '$timeout', '$element', '$compile', 'wiToken', 'wiApi', 'wiDialog'];
function imageSetManagerController($scope, $timeout, $element, $compile, wiToken, wiApi, wiDialog) {
    Object.assign($scope, { WiTree });
    let self = this;
    const DEFAULT_HEIGHT = 1;
    self.treeConfig = [];
    self.unitOptions = [{id:1,name:'M'},{id:2,name:'m'},{id:3,name:'meter'},{id:4,name:'meters'},
    {id:5,name:'metres'},{id:6,name:'METERS'},{id:7,name:'METRES'},{id:8,name:'F'},{id:9,name:'FEET'},
    {id:10,name:'feet'},{id:11,name:'Ft'},{id:12,name:'ft'}];
    //self.unit = self.unitOptions[0];
    self.selectedNode = null;
    const BASE_URL = localStorage.getItem("BASE_URL");

    this.$onInit = function () {
        self.hasPreview = true;
        self.baseUrl = self.baseUrl || BASE_URL;
        if (self.token)
            wiToken.setToken(self.token);
        self.idSelectedWell = self.idWell;
        getTree();
        $element.find('.image-holder').draggable({
            start: function (event, ui) {
                ui.helper[0].focus();
            },
            containment:'parent'
        });
    }
    this.runMatch = function (node, criteria) {
        let keySearch = criteria.toLowerCase();
        let searchArray = node.name.toLowerCase();
        return searchArray.includes(keySearch);
        // return node.name.includes(criteria);
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

    async function updateNode(node, force) {
        if (node.idImageSet && node.idWell) {
            let well = self.treeConfig.find(w => w.idWell === node.idWell);
            self.unit = self.unitOptions.find(uOpt => (uOpt.name === getUnit(well).trim()));
            if(force){
                await new Promise(res => {
                    wiApi.getImageSetPromise(node.idImageSet).then((imageSet) => {
                        Vue.set(node, 'images', imageSet.images);
                        res();
                    }).catch((err) => {
                        console.error(err);
                    });
                })
            }
        } else {
            self.unit = self.unitOptions.find(uOpt => (uOpt.name === getUnit(node).trim()));
            await new Promise((res) => {
                wiApi.getImageSetsPromise(node.idWell)
                    .then(imageSets => {
                        let imgs = imageSets.sort((img1, img2) => (img1.orderNum - img2.orderNum));
                        Vue.set(node, 'imageSets', imgs);
                        node.$meta.render++;
                        res();
                    }).catch(err => {
                        console.error(err);
                    });
            })
        }
    }
    
    function updateVListTable() {
        delete self.vListWrapper;
        self.vListWrapper = createVirtualTableWrapper();
    }
    this.topDepth = 0;
    this.bottomDepth = 0;
    this.clickFunction = function ($event, node, selectedNodes) {
        updateNode(node)
            .then(() => {
                updateListImage();
            });
        self.selectedNode = node;
        self.selectedNodes = selectedNodes;
        let well = self.treeConfig.find((aNode) => (self.selectedNode.idWell === aNode.idWell));
        wiApi.getWellDepth(well.idWell)
        .then(depth => {
            $timeout(() => {
                self.topDepth = depth.topDepth;
                self.bottomDepth = depth.bottomDepth;
            })
        })
        // self.vListWrapper = createVirtualTableWrapper();
    }
    self.createImageSet = function () {
        wiDialog.promptDialog({
            title: "New Image Set",
            inputName: "Name",
            input: 'ImgSet_'
        }, createImageSet);
    }
    self.renameImageSet = function () {
        wiDialog.promptDialog({
            title: "Rename Image Set",
            inputName: "New name",
            input: 'New name'
        }, renameImageSet);
    }
    async function renameImageSet(imageSetName) {
        if (!self.selectedNode) return;
        try {
            console.log(self.selectedNode);
            await wiApi.renameImageSetPromise(imageSetName, self.selectedNode.idImageSet );
            let node = self.treeConfig.find((n) => (self.selectedNode.idWell === n.idWell));
            updateNode(node);
        }
        catch(err) {
            wiDialog.errorMessageDialog(err.message, function(){
                self.renameImageSet();
            });
        }
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
        updateNode(self.selectedNode, true)
            .then(updateListImage);
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
            if (selectedImages.length) {
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
        }
        image._selected = !image._selected;
    }
    self.preview = function (image) {
        wiApi.getImage(`${image.imageUrl}?service=WI_BACKEND&token=${wiToken.getToken()}`).then(url => {
            self.imgUrl = url;
            $scope.$digest();
        });
    }
    self.closePreview = function () {
        $timeout(() => {
            self.imgUrl = null;
            // console.log("ok");
        });
    }
    self.keyDown = function ($event) {
        if ($event.key === 'Escape') {
            $timeout(() => {
                self.imgUrl = null;
                // console.log("ok");
            });
        }
    }

    self.getFocus = function ($event) {
        $event.currentTarget.focus();
    } 

    function getTree() {
        wiApi.getWellsPromise(self.idProject)
            .then(wells => $timeout(() => {
                self.treeConfig = wells.sort(
                    (w1, w2) => (w1.name.localeCompare(w2.name))
                )
                if (self.idSelectedWell) {
                    const selectedWell = self.treeConfig.find(w => w.idWell === self.idSelectedWell);
                    if (selectedWell) {
                        updateNode(selectedWell).then(async () => {
                            selectedWell.$meta.expanded = true;
                            await self.tree.$nextTick();
                            self.tree.updateTree();
                            let selectedNode = selectedWell;
                            if (self.idImageSet) {
                                const imageSetNode = self.getChildren(selectedWell).find(z => z.idImageSet === self.idImageSet);
                                if (imageSetNode) {
                                    selectedNode = imageSetNode;
                                    self.clickFunction({}, imageSetNode, [selectedNode]);
                                }
                            }
                            self.initSelectedNodes = [selectedNode];
                            self.selectedNode = selectedNode;
                        })
                    }
                    self.idSelectedWell = null;
                }
            }))
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
        try {
        
            let well = self.treeConfig.find((aNode) => (self.selectedNode.idWell === aNode.idWell));
            // let topDepth = wiApi.getWellTopDepth(well);
            // let bottomDepth = wiApi.getWellBottomDepth(well);
            let { topDepth, bottomDepth} = await wiApi.getWellDepth(well.idWell);
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
            let image = await wiApi.createImagePromise(imageObj);
            image._created = true;
            if (selectedIdx < 0) {
                $timeout(() => {
                    self.selectedNode.images.push(image);
                    updateVListTable();
                });
            }
            else {
                $timeout(() => {
                    self.selectedNode.images.splice(selectedIdx, 0, image);
                    updateVListTable();
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
        updateVListTable();
    }

    self.imageSetup = function (image) {
        wiDialog.imageUploadDialog(image.idImage, function (imgUrl) {
            if (image.imageUrl != imgUrl && imgUrl) {
                image.imageUrl = imgUrl;
                image._updated = true;
            }
        }, self.idProject);
    }
    self.updateImageName = function (image, newVal) {
        if (image.name != newVal) {
            image.name = newVal;
            image._updated = true;
        }
    }
    self.getImageTopDepth = function(image) {
        if (image && _.isFinite(image.topDepth)) 
            return wiApi.bestNumberFormat(wiApi.convertUnit(image.topDepth, 'm', (self.unit||{}).name || 'm'), 2);
        return 1000;
    }
    self.updateImageTopDepth = function (image, newVal) {
        newVal = wiApi.convertUnit(parseFloat(newVal),(self.unit||{}).name || 'm','m');
        // if (newVal >= image.bottomDepth) {
        //     return console.log("Error again");
        // }
        let topDepth = image.topDepth;
        // let well = self.treeConfig.find((aNode) => (self.selectedNode.idWell === aNode.idWell));
        // let topDepth = wiApi.getWellTopDepth(well);
        // let bottomDepth = wiApi.getWellBottomDepth(well);
        if (isNaN(newVal)){
            image.topDepth = topDepth;
        }else if((newVal !== topDepth) || ((topDepth - newVal) > 0)){
            image.topDepth = newVal;
            image._updated = true;
        }
        // if ((newVal - topDepth) * (newVal - bottomDepth) < 0) {
        //     image.topDepth = newVal;
        //     image._updated = true;
        //     console.log((newVal - topDepth) * (newVal - bottomDepth));

        // }
        else {
            console.log("Error");
        }
    }
    self.getImageBottomDepth = function(image) {
        if (image && _.isFinite(image.bottomDepth)) 
            return wiApi.bestNumberFormat(wiApi.convertUnit(image.bottomDepth, 'm', (self.unit||{}).name || 'm'), 2);
        return 0;
    }
    self.updateImageBottomDepth = function (image, newVal) {
        newVal = wiApi.convertUnit(parseFloat(newVal), (self.unit||{}).name || 'm', 'm');
        // if (newVal <= image.topDepth) {
        //     return console.log("Error again");
        // }
        let bottomDepth = image.bottomDepth;
        // let well = self.treeConfig.find((aNode) => (self.selectedNode.idWell === aNode.idWell));
        // let topDepth = wiApi.getWellTopDepth(well);
        // let bottomDepth = wiApi.getWellBottomDepth(well);
        if (isNaN(newVal)){
            image.bottomDepth = bottomDepth;
        }
        else if((newVal !== bottomDepth) || ((bottomDepth - newVal) > 0)){
            image.bottomDepth = newVal;
            image._updated = true;
        }
        // if ((newVal - topDepth) * (newVal - bottomDepth) < 0) {
        //     image.bottomDepth = newVal;
        //     image._updated = true;
        // }
        else {
            console.log("Error");
        }
    }
    self.applyImageActions = function () {
        updateListImage();
    }

    async function updateListImage() {
        let images = self.getImages(self.selectedNode);
        for (let idx = images.length - 1; idx >= 0; idx--) {
            let image = images[idx];
            if (!image.imageUrl) {
                try {
                    await wiApi.deleteImagePromise(image.idImage);
                    continue;
                }
                catch(err) {
                    console.error(err);
                }
            }
            if (image._deleted) {
                try {
                    if (image.imageUrl) await wiApi.deleteImageFilePromise(image.imageUrl);
                    await wiApi.deleteImagePromise(image.idImage);
                }
                catch(err) {
                    console.error(err);
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
            } else if (image._updated) {
                if (image.imageUrl) {
                    try {
                        await wiApi.updateImagePromise(image);
                    }
                    catch(err) {
                        console.error(err);
                    }
                }
            }
        }
        try {
            if (self.selectedNode.idImageSet) {
                const imageSet = await wiApi.getImageSetPromise(self.selectedNode.idImageSet);
                self.selectedNode.images = imageSet.images;
            }
            self.closePreview();
            updateVListTable();
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
            // let well = self.treeConfig.find((aNode) => (self.selectedNode.idWell === aNode.idWell));
            // return wiApi.bestNumberFormat(wiApi.getWellTopDepth(well, (self.unit||{}).name || 'm'));
            return wiApi.bestNumberFormat(wiApi.convertUnit(self.topDepth, 'm', (self.unit||{}).name || 'm'));
        }
        catch(err) {
            return "";
        }
    }
    self.getBottomDepth = function() {
        try {
            // let well = self.treeConfig.find((aNode) => (self.selectedNode.idWell === aNode.idWell));
            // return wiApi.bestNumberFormat(wiApi.getWellBottomDepth(well, (self.unit||{}).name || 'm'));
            return wiApi.bestNumberFormat(wiApi.convertUnit(self.bottomDepth, 'm', (self.unit||{}).name || 'm'));
        }
        catch(err) {
            return "";
        }
    }
    /*
    function debounce(func, wait, immediate) {
        var timeout;
        return function () {
            var context = this, args = arguments;
            var later = function () {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            var callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    };
    let _renderingFlag = false;
    const _setRenderingFlag = debounce((value) => {
        $timeout(() => {
            _renderingFlag = value;
        })
    }, 500)
    this.getRenderingFlag = () => _renderingFlag;
    */
    const htmlTemplate = `
        <div ng-class="{'deleted': image._deleted, 'updated': image._updated, 'created': image._created}" 
            ng-click="self.rowClick($event, image);">
            <div class="image-select-btn cell" ng-style="{'width': self.widthArr[0]}">
                <span ng-class="{'enabled': image._selected}" class="image-status fa fa-check">
                </span>
            </div>
            <div class="image-editable cell" ng-style="{'width': self.widthArr[1]}">
                <editable params="image" item-value="image.name" set-value="self.updateImageName"
                    enabled="true"></editable>
            </div>
            <div class="image-editable cell" ng-style="{'width': self.widthArr[2]}">
                <editable params="image" item-value="self.getImageTopDepth"
                    set-value="self.updateImageTopDepth" enabled="true"></editable>
            </div>
            <div class="image-editable cell" ng-style="{'width': self.widthArr[3]}">
                <editable params="image" item-value="self.getImageBottomDepth"
                    set-value="self.updateImageBottomDepth" enabled="true"></editable>
            </div>
            <div class="image-btn-group cell" ng-style="{'width': self.widthArr[4]}">
                <span ng-click="self.imageSetup(image)" class="button-td">Upload</span>
                <span ng-click="self.preview(image)" class="button-td" ng-disabled="!image.imageUrl"
                    ng-class="{'disable': !image.imageUrl}" style="margin-left: 10px;">Preview</span>
            </div>
            <div style="clear: both;"></div>
        </div>
    `;

    const linkFn = $compile(htmlTemplate);

    function createTableRowEle(index) {
        if (index < 0 || !self.selectedNode || !self.selectedNode.images || !self.selectedNode.images[index])
            return document.createElement("div");

        // if (!_renderingFlag)
        //     _renderingFlag = true;
        const image = self.selectedNode.images[index];

        let newScope = $scope.$new();
        newScope.image = image;
        newScope.self = self;
        const ele = document.createElement('div');
        // requestAnimationFrame(() => {
            linkFn(newScope, node => {
                ele.appendChild(node[0]);
                // _setRenderingFlag(false);
            })
        // });
        return ele;
    };
    function createVirtualTableWrapper() {
        const container = $element.find('.image-table-container .content > div')[0];
        $(container).empty();
        const containerHeight = $(container).height();
        const wrapper = new WiVirtualList({
            height: +containerHeight,
            itemHeight: 37,
            htmlContainerElement: container,
            totalRows: (self.selectedNode.images || []).length || 1,
            generatorFn: row => {
              return createTableRowEle(row);
            }
          });
        wrapper.setContainerStyle({ 'width': '100%' , 'border': 'none'});
        return wrapper;
    }

    this.widthArr = [];
    this.onTableInit = function(tableWidthArr) {
        // $timeout(() => {
            self.widthArr = tableWidthArr;
        // })
    }
    this.onHeaderWidthChanged = function(leftColIdx, leftColWidth, rightColIdx, rightColWidth) {
        // $timeout(() => {
            self.widthArr[leftColIdx] = leftColWidth;
            self.widthArr[rightColIdx] = rightColWidth;
        // });
    }
}

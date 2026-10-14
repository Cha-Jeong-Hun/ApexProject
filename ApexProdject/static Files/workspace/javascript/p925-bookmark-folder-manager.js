/* =========================================================
 * Page 925 Bookmark Folder Manager
 *
 * Tree Static ID:
 * P925_FOLDER_TREE
 *
 * Hidden Items:
 * P925_PARENT_BOOKMARK_ID
 * P925_PARENT_LEVEL
 * P925_FOLDER_CREATES
 * P925_FOLDER_CHANGES
 * P925_FOLDER_DELETES
 * ========================================================= */
(function ($) {
    "use strict";

    var TREE_REGION_ID = "P925_FOLDER_TREE";
    var TREE_SELECTOR = "#" + TREE_REGION_ID;
    var MENU_ID = "P925FolderContextMenu";
    var EVENT_NAMESPACE = ".p925FolderManagerV6";

    var tempSequence = 0;
    var contextNode = null;
    var activeInlineEdit = null;

    /*
     * 신규 폴더를 생성할 때 부모가 되는 현재 선택 노드
     *
     * type:
     * D    = 즐겨찾기 루트
     * F    = 기존 DB 폴더
     * TEMP = 아직 저장되지 않은 신규 폴더
     */
    var selectedParentNode = null;

    var LABEL_SELECTOR =
        ".a-TreeView-label, " +
        ".p925-temp-folder-label";

    var CONTENT_SELECTOR =
        TREE_SELECTOR + " .a-TreeView-content, " +
        TREE_SELECTOR + " .p925-temp-folder-content";


    /* =====================================================
     * Page Item / JSON
     * ===================================================== */

    function itemExists(itemName) {
        return document.getElementById(itemName) !== null;
    }


    function getItemValue(itemName) {
        if (!itemExists(itemName)) {
            return "";
        }

        return apex.item(itemName).getValue();
    }


    function readJsonArray(itemName) {
        var value = getItemValue(itemName);

        if (!value) {
            return [];
        }

        try {
            return JSON.parse(value);
        } catch (error) {
            console.error(
                "[P925] JSON 파싱 오류:",
                itemName,
                value,
                error
            );

            return [];
        }
    }


    function writeJsonArray(itemName, value) {
        if (!itemExists(itemName)) {
            console.error(
                "[P925] Hidden Item이 존재하지 않습니다:",
                itemName
            );

            apex.message.alert(
                itemName +
                " Hidden Item이 존재하지 않습니다."
            );

            return false;
        }

        apex.item(itemName).setValue(
            JSON.stringify(value),
            null,
            true
        );

        return true;
    }


    function getParentInfo() {
        var parentId = Number(
            getItemValue("P925_PARENT_BOOKMARK_ID")
        );

        var parentLevel = Number(
            getItemValue("P925_PARENT_LEVEL")
        );

        if (
            Number.isNaN(parentId) ||
            Number.isNaN(parentLevel) ||
            parentId <= 0
        ) {
            return null;
        }

        return {
            bookmarkId: parentId,
            level: parentLevel
        };
    }


    /* =====================================================
     * APEX Tree API
     * ===================================================== */

    function getTreeWidget() {
        var region;

        try {
            region = apex.region(TREE_REGION_ID);
        } catch (error) {
            region = null;
        }

        if (
            !region ||
            typeof region.widget !== "function"
        ) {
            return $();
        }

        return region.widget();
    }


    function getTreeNode(element) {
        var tree$ = getTreeWidget();
        var node$;
        var nodes;

        if (
            !tree$.length ||
            !element
        ) {
            return null;
        }

        /*
         * 임시 폴더는 APEX Tree 모델에 존재하지 않음
         */
        if (
            $(element).hasClass(
                "p925-temp-folder-content"
            ) ||
            $(element).closest(
                ".p925-temp-folder-node"
            ).length
        ) {
            return null;
        }

        node$ = $(element).closest(
            ".a-TreeView-node"
        );

        if (!node$.length) {
            return null;
        }

        try {
            nodes = tree$.treeView(
                "getNodes",
                node$
            );
        } catch (error) {
            console.error(
                "[P925] Tree 노드 조회 실패:",
                error
            );

            return null;
        }

        return nodes && nodes.length
            ? nodes[0]
            : null;
    }


    function getNodeValue(node) {
        var tree$ = getTreeWidget();
        var adapter;
        var value;

        if (!node) {
            return null;
        }

        value =
            node.value ||
            node.identity ||
            node.id ||
            node.nodeValue ||
            null;

        if (
            value !== null &&
            value !== undefined
        ) {
            return String(value);
        }

        try {
            adapter = tree$.treeView(
                "getNodeAdapter"
            );

            if (
                adapter &&
                typeof adapter.getIdentity ===
                    "function"
            ) {
                value = adapter.getIdentity(node);
            }
        } catch (error) {
            value = null;
        }

        return (
            value === null ||
            value === undefined
        )
            ? null
            : String(value);
    }


    function parseTreeNode(contentElement) {
        var node = getTreeNode(contentElement);
        var value = getNodeValue(node);

        if (
            !value ||
            !window.BookmarkNodeUtil ||
            typeof window.BookmarkNodeUtil.parse !==
                "function"
        ) {
            return null;
        }

        return window.BookmarkNodeUtil.parse(value);
    }


    function getNodeLabel(element) {
        var storedName = $(element).attr(
            "data-folder-name"
        );

        if (
            storedName !== undefined &&
            storedName !== null
        ) {
            return String(storedName);
        }

        return $.trim(
            $(element)
                .find(LABEL_SELECTOR)
                .first()
                .text()
        );
    }


    /* =====================================================
     * 선택 처리
     * ===================================================== */

    function clearTempFolderSelection() {
        $(TREE_SELECTOR)
            .find(
                ".p925-temp-folder-content.is-selected"
            )
            .removeClass("is-selected")
            .attr(
                "aria-selected",
                "false"
            );
    }


    function clearApexTreeVisualSelection() {
        $(TREE_SELECTOR)
            .find(".a-TreeView-row.is-selected")
            .removeClass("is-selected");

        $(TREE_SELECTOR)
            .find(
                ".a-TreeView-content.is-selected"
            )
            .removeClass("is-selected");
    }


    function selectTempFolder(contentElement) {
        if (!contentElement) {
            return;
        }

        clearTempFolderSelection();
        clearApexTreeVisualSelection();

        $(contentElement)
            .addClass("is-selected")
            .attr(
                "aria-selected",
                "true"
            );
    }


    function setSelectedApexNode(
        contentElement
    ) {
        var nodeInfo =
            parseTreeNode(
                contentElement
            );

        if (
            !nodeInfo ||
            nodeInfo.type === "P"
        ) {
            selectedParentNode = null;
            return;
        }

        selectedParentNode = {
            type:
                nodeInfo.type,

            bookmarkId:
                Number(
                    nodeInfo.bookmarkId
                ),

            tempId:
                null,

            level:
                Number(
                    nodeInfo.level
                ),

            contentElement:
                contentElement
        };

        console.log(
            "[P925] 선택 부모 변경:",
            {
                type:
                    selectedParentNode.type,

                bookmarkId:
                    selectedParentNode.bookmarkId,

                level:
                    selectedParentNode.level
            }
        );
    }


    function setSelectedTempNode(
        contentElement,
        tempId,
        level
    ) {
        selectedParentNode = {
            type: "TEMP",
            bookmarkId: null,
            tempId: tempId,
            level: Number(level),
            contentElement: contentElement
        };
    }


    /* =====================================================
     * 신규 폴더 JSON
     * ===================================================== */

    function saveFolderCreate(
        tempId,
        folderName,
        parentId,
        parentLevel,
        parentTempId,
        bookmarkLevel
    ) {
        var creates = readJsonArray(
            "P925_FOLDER_CREATES"
        );

        var found = false;

        var normalizedParentId =
            parentId === null ||
            parentId === undefined ||
            parentId === ""
                ? null
                : Number(parentId);

        var normalizedParentTempId =
            parentTempId === null ||
            parentTempId === undefined ||
            parentTempId === ""
                ? null
                : String(parentTempId);

        var normalizedLevel =
            bookmarkLevel === null ||
            bookmarkLevel === undefined ||
            bookmarkLevel === ""
                ? Number(parentLevel) + 1
                : Number(bookmarkLevel);

        var i;

        for (i = 0; i < creates.length; i += 1) {
            if (
                String(creates[i].tempId) ===
                String(tempId)
            ) {
                creates[i].folderName =
                    folderName;

                creates[i].parentId =
                    normalizedParentId;

                creates[i].parentTempId =
                    normalizedParentTempId;

                creates[i].bookmarkLevel =
                    normalizedLevel;

                creates[i].bookmarkType = "F";

                found = true;
                break;
            }
        }

        if (!found) {
            creates.push({
                tempId: tempId,
                folderName: folderName,
                parentId: normalizedParentId,
                parentTempId:
                    normalizedParentTempId,
                bookmarkLevel:
                    normalizedLevel,
                bookmarkType: "F"
            });
        }

        return writeJsonArray(
            "P925_FOLDER_CREATES",
            creates
        );
    }


    function removeFolderCreate(tempId) {
        var creates = readJsonArray(
            "P925_FOLDER_CREATES"
        );

        creates = creates.filter(
            function (row) {
                return (
                    String(row.tempId) !==
                    String(tempId)
                );
            }
        );

        writeJsonArray(
            "P925_FOLDER_CREATES",
            creates
        );
    }


    /* =====================================================
     * 기존 폴더 변경 JSON
     * ===================================================== */

    function saveFolderChange(
        bookmarkId,
        folderName
    ) {
        var changes = readJsonArray(
            "P925_FOLDER_CHANGES"
        );

        var found = false;
        var i;

        for (i = 0; i < changes.length; i += 1) {
            if (
                String(changes[i].bookmarkId) ===
                String(bookmarkId)
            ) {
                changes[i].folderName =
                    folderName;

                found = true;
                break;
            }
        }

        if (!found) {
            changes.push({
                bookmarkId:
                    Number(bookmarkId),

                folderName:
                    folderName
            });
        }

        writeJsonArray(
            "P925_FOLDER_CHANGES",
            changes
        );
    }


    function removeFolderChange(bookmarkId) {
        var changes = readJsonArray(
            "P925_FOLDER_CHANGES"
        );

        changes = changes.filter(
            function (row) {
                return (
                    String(row.bookmarkId) !==
                    String(bookmarkId)
                );
            }
        );

        writeJsonArray(
            "P925_FOLDER_CHANGES",
            changes
        );
    }


    /* =====================================================
     * 삭제 JSON
     * ===================================================== */

    function addFolderDelete(bookmarkId) {
        var deletes = readJsonArray(
            "P925_FOLDER_DELETES"
        );

        var exists = deletes.some(
            function (id) {
                return (
                    String(id) ===
                    String(bookmarkId)
                );
            }
        );

        if (!exists) {
            deletes.push(
                Number(bookmarkId)
            );
        }

        writeJsonArray(
            "P925_FOLDER_DELETES",
            deletes
        );
    }


    /* =====================================================
     * Inline Edit
     * ===================================================== */

    function commitInlineEdit(
        contentElement,
        inputElement,
        oldName,
        nodeInfo
    ) {
        var newName = $.trim(
            inputElement.value
        );

        var label$ = $(contentElement)
            .find(LABEL_SELECTOR)
            .first();

        $(contentElement).attr(
            "data-folder-name",
            newName
        );

        label$
            .text(
                newName ||
                "(폴더명 없음)"
            )
            .toggleClass(
                "is-folder-name-empty",
                !newName
            )
            .show();

        $(inputElement).remove();

        $(contentElement)
            .removeClass(
                "is-inline-editing"
            )
            .addClass(
                "is-folder-name-changed"
            );

        /*
         * 신규 임시 폴더
         */
        if (nodeInfo.type === "TEMP") {
            saveFolderCreate(
                nodeInfo.tempId,
                newName,
                nodeInfo.parentId,
                nodeInfo.parentLevel,
                nodeInfo.parentTempId,
                nodeInfo.level
            );

            selectTempFolder(
                contentElement
            );
        }

        /*
         * 기존 DB 폴더
         */
        else if (nodeInfo.type === "F") {
            if (newName !== oldName) {
                saveFolderChange(
                    nodeInfo.bookmarkId,
                    newName
                );
            } else {
                removeFolderChange(
                    nodeInfo.bookmarkId
                );

                $(contentElement).removeClass(
                    "is-folder-name-changed"
                );
            }
        }

        return true;
    }


    function cancelInlineEdit(
        contentElement,
        inputElement,
        oldName
    ) {
        var label$ = $(contentElement)
            .find(LABEL_SELECTOR)
            .first();

        $(contentElement).attr(
            "data-folder-name",
            oldName
        );

        label$
            .text(
                oldName ||
                "(폴더명 없음)"
            )
            .toggleClass(
                "is-folder-name-empty",
                !oldName
            )
            .show();

        $(inputElement).remove();

        $(contentElement).removeClass(
            "is-inline-editing"
        );

        if (
            $(contentElement).hasClass(
                "p925-temp-folder-content"
            )
        ) {
            selectTempFolder(
                contentElement
            );
        }
    }


    function finishActiveInlineEdit() {
        var edit = activeInlineEdit;

        if (!edit) {
            return true;
        }

        if (
            !edit.inputElement ||
            !document.body.contains(
                edit.inputElement
            )
        ) {
            activeInlineEdit = null;
            return true;
        }

        if (edit.finished) {
            activeInlineEdit = null;
            return true;
        }

        edit.finished = true;

        commitInlineEdit(
            edit.contentElement,
            edit.inputElement,
            edit.oldName,
            edit.nodeInfo
        );

        activeInlineEdit = null;

        return true;
    }


    function beginInlineEdit(
        contentElement,
        nodeInfo
    ) {
        var label$;
        var oldName;
        var input$;

        if (
            !contentElement ||
            !nodeInfo
        ) {
            return;
        }

        if (nodeInfo.type === "D") {
            apex.message.alert(
                "즐겨찾기 루트는 편집할 수 없습니다."
            );

            return;
        }

        if (nodeInfo.type === "P") {
            return;
        }

        if (
            activeInlineEdit &&
            activeInlineEdit.contentElement !==
                contentElement
        ) {
            finishActiveInlineEdit();
        }

        input$ = $(contentElement).find(
            ".p925-folder-name-input"
        );

        if (input$.length) {
            input$.focus().select();
            return;
        }

        label$ = $(contentElement)
            .find(LABEL_SELECTOR)
            .first();

        oldName = getNodeLabel(
            contentElement
        );

        input$ = $("<input>", {
            type: "text",
            class:
                "p925-folder-name-input",
            value: oldName,
            maxlength: 100,
            autocomplete: "off",
            "aria-label":
                "폴더명 편집"
        });

        input$.on(
            "pointerdown mousedown click " +
            "dblclick contextmenu",
            function (event) {
                event.stopPropagation();
            }
        );

        label$.hide();

        $(contentElement)
            .addClass(
                "is-inline-editing"
            )
            .append(input$);

        activeInlineEdit = {
            contentElement:
                contentElement,

            inputElement:
                input$[0],

            oldName:
                oldName,

            nodeInfo:
                nodeInfo,

            finished:
                false
        };

        window.setTimeout(
            function () {
                input$.focus().select();
            },
            0
        );

        input$.on(
            "keydown",
            function (event) {
                if (event.key === "Enter") {
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();

                    finishActiveInlineEdit();

                    return false;
                }

                if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();

                    if (
                        activeInlineEdit &&
                        !activeInlineEdit.finished
                    ) {
                        activeInlineEdit.finished =
                            true;

                        cancelInlineEdit(
                            contentElement,
                            this,
                            oldName
                        );

                        activeInlineEdit = null;
                    }

                    return false;
                }
            }
        );

        input$.on(
            "blur",
            function () {
                var currentInput = this;

                window.setTimeout(
                    function () {
                        if (
                            activeInlineEdit &&
                            activeInlineEdit
                                .inputElement ===
                                currentInput &&
                            !activeInlineEdit
                                .finished &&
                            document.body.contains(
                                currentInput
                            )
                        ) {
                            finishActiveInlineEdit();
                        }
                    },
                    0
                );
            }
        );
    }


    function commitAllInlineEdits() {
        finishActiveInlineEdit();

        $(TREE_SELECTOR)
            .find(
                ".p925-folder-name-input"
            )
            .each(function () {
                $(this).trigger("blur");
            });
    }


    /* =====================================================
     * 신규 폴더 부모 및 컨테이너
     * ===================================================== */

    /*
     * Tree 전체 최상위 컨테이너
     */
    function getNodeContainer() {
        var treeView$ = $(TREE_SELECTOR)
            .find(".a-TreeView")
            .first();

        var firstNode$;
        var container$;

        if (!treeView$.length) {
            return $();
        }

        firstNode$ = treeView$
            .find(".a-TreeView-node")
            .first();

        if (firstNode$.length) {
            container$ = firstNode$.parent();

            if (container$.length) {
                return container$;
            }
        }

        return treeView$;
    }


    /*
     * 기존 APEX Tree 노드의 직접 하위 컨테이너
     */
    function getApexChildContainer(
        contentElement
    ) {
        var node$;
        var childContainer$;

        if (!contentElement) {
            return $();
        }

        node$ = $(contentElement).closest(
            ".a-TreeView-node"
        );

        if (!node$.length) {
            return $();
        }

        /*
         * APEX Tree의 실제 직접 자식 목록만 조회한다.
         */
        childContainer$ = node$
            .children(
                ".a-TreeView-nodeList"
            )
            .first();

        /*
         * 일부 APEX 구조에서 role=group만 존재하는 경우
         */
        if (!childContainer$.length) {
            childContainer$ = node$
                .children(
                    '[role="group"]'
                )
                .first();
        }

        /*
         * 실제 자식 컨테이너가 없는 경우에만 신규 생성한다.
         * APEX 내부 클래스는 중복 들여쓰기를 만들 수 있어 사용하지 않는다.
         */
        if (!childContainer$.length) {
            childContainer$ = $("<ul>", {
                class:
                    "p925-apex-folder-children",

                role:
                    "group"
            });

            childContainer$.appendTo(
                node$
            );
        }

        node$
            .addClass(
                "is-expanded"
            )
            .removeClass(
                "is-collapsed"
            )
            .attr(
                "aria-expanded",
                "true"
            );

        childContainer$
            .show()
            .removeAttr(
                "hidden"
            );

        return childContainer$;
    }


    /*
     * 신규 임시 폴더의 직접 하위 컨테이너
     */
    /*
 * 신규 임시 폴더의 직접 하위 컨테이너
 */
function getTempChildContainer(
        contentElement
    ) {
        var node$ = $(contentElement).closest(
            ".p925-temp-folder-node"
        );

        var childContainer$;

        if (!node$.length) {
            return $();
        }

        childContainer$ = node$
            .children(
                ".p925-temp-folder-children"
            )
            .first();

        if (!childContainer$.length) {
            childContainer$ = $("<ul>", {
                class:
                    "p925-temp-folder-children",

                role:
                    "group"
            });

            childContainer$.appendTo(
                node$
            );
        }

        childContainer$
            .show()
            .removeAttr(
                "hidden"
            );

        return childContainer$;
    }

    /*
     * 현재 선택 노드를 기준으로 신규 폴더의
     * 부모와 신규 Level을 계산
     */
    function getSelectedParentInfo() {
        var fallbackInfo;

        if (
            selectedParentNode &&
            selectedParentNode.contentElement &&
            document.body.contains(
                selectedParentNode.contentElement
            )
        ) {
            /*
             * 즐겨찾기 루트 하위는 Level 0
             */
            if (
                selectedParentNode.type === "D"
            ) {
                return {
                    type: "D",

                    bookmarkId:
                        selectedParentNode.bookmarkId,

                    tempId:
                        null,

                    level:
                        Number(
                            selectedParentNode.level
                        ),

                    childLevel:
                        0,

                    contentElement:
                        selectedParentNode
                            .contentElement
                };
            }

            /*
             * 기존 폴더 하위
             */
            if (
                selectedParentNode.type === "F"
            ) {
                return {
                    type: "F",

                    bookmarkId:
                        selectedParentNode.bookmarkId,

                    tempId:
                        null,

                    level:
                        Number(
                            selectedParentNode.level
                        ),

                    childLevel:
                        Number(
                            selectedParentNode.level
                        ) + 1,

                    contentElement:
                        selectedParentNode
                            .contentElement
                };
            }

            /*
             * 아직 저장되지 않은 신규 폴더 하위
             */
            if (
                selectedParentNode.type ===
                "TEMP"
            ) {
                return {
                    type: "TEMP",

                    bookmarkId:
                        null,

                    tempId:
                        selectedParentNode.tempId,

                    level:
                        Number(
                            selectedParentNode.level
                        ),

                    childLevel:
                        Number(
                            selectedParentNode.level
                        ) + 1,

                    contentElement:
                        selectedParentNode
                            .contentElement
                };
            }
        }

        /*
         * 사용자가 Tree 노드를 직접 클릭하지 않은 경우에는
         * 모달 호출 시 전달받은 부모 정보 사용
         */
        fallbackInfo = getParentInfo();

        if (!fallbackInfo) {
            return null;
        }

        /*
         * 전달받은 부모 Level이 -1이면
         * 즐겨찾기 루트 하위 Level 0으로 생성
         */
        if (fallbackInfo.level < 0) {
            return {
                type: "D",

                bookmarkId:
                    fallbackInfo.bookmarkId,

                tempId:
                    null,

                level:
                    fallbackInfo.level,

                childLevel:
                    0,

                contentElement:
                    null
            };
        }

        return {
            type: "F",

            bookmarkId:
                fallbackInfo.bookmarkId,

            tempId:
                null,

            level:
                fallbackInfo.level,

            childLevel:
                Number(
                    fallbackInfo.level
                ) + 1,

            contentElement:
                null
        };
    }
    /*
 * BOOKMARK_ID를 이용하여 실제 APEX Tree Content를 찾는다.
 *
 * NODE_VALUE 형식:
 * D_LEVEL_BOOKMARKID
 * F_LEVEL_BOOKMARKID
 * P_LEVEL_BOOKMARKID
 */
    function findApexTreeContentByBookmarkId(
        bookmarkId
    ) {
        var result$ = $();

        if (
            bookmarkId === null ||
            bookmarkId === undefined ||
            bookmarkId === ""
        ) {
            return result$;
        }

        $(TREE_SELECTOR)
            .find(".a-TreeView-content")
            .each(function () {
                var nodeInfo =
                    parseTreeNode(this);

                if (
                    nodeInfo &&
                    String(nodeInfo.bookmarkId) ===
                        String(bookmarkId)
                ) {
                    result$ = $(this);

                    /*
                    * 첫 번째 일치 항목을 찾으면 반복 종료
                    */
                    return false;
                }

                return true;
            });

        return result$;
    }

    function getSelectedChildContainer(
    parentInfo
    ) {
        var parentContent$;

        if (!parentInfo) {
            return $();
        }

        /*
        * 사용자가 실제 Tree 노드를 클릭한 경우
        */
        if (
            (
                parentInfo.type === "D" ||
                parentInfo.type === "F"
            ) &&
            parentInfo.contentElement
        ) {
            return getApexChildContainer(
                parentInfo.contentElement
            );
        }

        /*
        * 임시 신규 폴더가 부모인 경우
        */
        if (
            parentInfo.type === "TEMP" &&
            parentInfo.contentElement
        ) {
            return getTempChildContainer(
                parentInfo.contentElement
            );
        }

        /*
        * Page 925 팝업을 처음 열었을 때는
        * contentElement가 없으므로 BOOKMARK_ID를 이용해
        * 실제 부모 Tree 노드를 다시 찾는다.
        */
        if (
            parentInfo.type === "D" ||
            parentInfo.type === "F"
        ) {
            parentContent$ =
                findApexTreeContentByBookmarkId(
                    parentInfo.bookmarkId
                );

            if (parentContent$.length) {
                /*
                * 실제 부모 노드의 직접 하위 컨테이너 반환
                */
                return getApexChildContainer(
                    parentContent$[0]
                );
            }
        }

        console.error(
            "[P925] 신규 폴더의 부모 Tree 노드를 찾지 못했습니다.",
            parentInfo
        );

        return $();
    }

    /*
 * 신규 임시 폴더 정렬
 *
 * 기존 APEX DB 노드 아래에서는
 * .a-TreeView-nodeList가 계층 들여쓰기를 담당한다.
 *
 * 임시 폴더 아래에서는
 * .p925-temp-folder-children CSS가 계층 들여쓰기를 담당한다.
 *
 * 따라서 Content에 margin-left나 width 계산을 적용하지 않는다.
 */
function alignTempFolderWithApexChildren(
        container$,
        content$,
        parentInfo
    ) {
        var referenceContent$ = $();
        var parentContent$ = $();

        var containerLeft;
        var targetLeft;
        var offsetLeft;

        if (
            !container$ ||
            !container$.length ||
            !content$ ||
            !content$.length ||
            !parentInfo
        ) {
            return;
        }

        /*
         * 이전 코드에서 생성한 인라인 스타일 초기화
         */
        content$[0].style.removeProperty(
            "margin-left"
        );

        content$[0].style.removeProperty(
            "padding-left"
        );

        content$[0].style.removeProperty(
            "width"
        );

        content$[0].style.removeProperty(
            "max-width"
        );

        containerLeft =
            container$[0]
                .getBoundingClientRect()
                .left;

        /*
         * 같은 부모 아래 존재하는 기존 APEX 형제를 찾는다.
         */
        referenceContent$ = container$
            .children(".a-TreeView-node")
            .children(".a-TreeView-content")
            .first();

        if (!referenceContent$.length) {
            referenceContent$ = container$
                .children(".a-TreeView-node")
                .children(".a-TreeView-row")
                .find(".a-TreeView-content")
                .first();
        }

        /*
         * 같은 부모 아래 이미 생성된 임시 형제가 있다면 그 위치를 사용한다.
         */
        if (!referenceContent$.length) {
            referenceContent$ = container$
                .children(
                    ".p925-temp-folder-node"
                )
                .children(
                    ".p925-temp-folder-content"
                )
                .not(content$)
                .first();
        }

        if (referenceContent$.length) {
            targetLeft =
                referenceContent$[0]
                    .getBoundingClientRect()
                    .left;
        } else {
            /*
             * 같은 Level 형제가 없으면 부모 행보다 정확히 18px 안쪽으로 배치한다.
             */
            if (
                parentInfo.contentElement &&
                document.body.contains(
                    parentInfo.contentElement
                )
            ) {
                parentContent$ = $(
                    parentInfo.contentElement
                );
            } else if (
                parentInfo.bookmarkId !== null &&
                parentInfo.bookmarkId !== undefined
            ) {
                parentContent$ =
                    findApexTreeContentByBookmarkId(
                        parentInfo.bookmarkId
                    );
            }

            if (parentContent$.length) {
                targetLeft =
                    parentContent$[0]
                        .getBoundingClientRect()
                        .left +
                    18;
            } else {
                targetLeft =
                    containerLeft +
                    18 +
                    (
                        Math.max(
                            0,
                            Number(
                                parentInfo.childLevel
                            ) || 0
                        ) *
                        18
                    );
            }
        }

        offsetLeft =
            Math.max(
                0,
                Math.round(
                    targetLeft -
                    containerLeft
                )
            );

        content$[0].style.setProperty(
            "margin-left",
            offsetLeft + "px",
            "important"
        );

        content$[0].style.setProperty(
            "width",
            "calc(100% - " +
                offsetLeft +
                "px)",
            "important"
        );

        content$[0].style.setProperty(
            "max-width",
            "calc(100% - " +
                offsetLeft +
                "px)",
            "important"
        );
    }
    

    /* =====================================================
     * 신규 폴더 생성
     * ===================================================== */

    function addNewFolder() {
        var parentInfo =
            getSelectedParentInfo();

        var container$;
        var tempId;
        var node$;
        var content$;
        var label$;
        var childContainer$;
        var nodeInfo;

        var childLevel;
        var parentId;
        var parentTempId;

        finishActiveInlineEdit();
        closeContextMenu();

        if (!parentInfo) {
            apex.message.alert(
                "상위 북마크 정보를 확인할 수 없습니다."
            );

            return;
        }

        if (parentInfo.type === "P") {
            apex.message.alert(
                "페이지 아래에는 폴더를 추가할 수 없습니다."
            );

            return;
        }

        childLevel = Number(
            parentInfo.childLevel
        );

        if (
            Number.isNaN(childLevel) ||
            childLevel < 0
        ) {
            childLevel = 0;
        }

        if (childLevel > 3) {
            apex.message.alert(
                "Level 3 이후에는 하위 폴더를 추가할 수 없습니다."
            );

            return;
        }

        /*
         * 현재 선택된 폴더의 직접 하위 컨테이너
         */
        container$ =
            getSelectedChildContainer(
                parentInfo
            );

        if (!container$.length) {
            apex.message.alert(
                "선택한 폴더의 하위 영역을 찾을 수 없습니다."
            );

            return;
        }

        tempSequence += 1;

        tempId =
            "TMP_" +
            Date.now() +
            "_" +
            tempSequence;

        /*
         * 기존 DB 폴더가 부모
         */
        parentId =
            parentInfo.type === "TEMP"
                ? null
                : parentInfo.bookmarkId;

        /*
         * 아직 저장되지 않은 신규 폴더가 부모
         */
        parentTempId =
            parentInfo.type === "TEMP"
                ? parentInfo.tempId
                : null;

        node$ = $("<li>", {
            class:
                "p925-temp-folder-node " +
                "is-p925-temp-folder",

            "data-temp-id":
                tempId,

            "data-temp-level":
                childLevel,

            "data-parent-id":
                parentId === null
                    ? ""
                    : parentId,

            "data-parent-temp-id":
                parentTempId || "",

            role:
                "none"
        });

        content$ = $("<div>", {
            class:
                "p925-temp-folder-content " +
                "is-folder-name-changed",

            "data-temp-id":
                tempId,

            "data-folder-name":
                "",

            "data-folder-original-name":
                "",

            "data-temp-level":
                childLevel,

            "data-parent-id":
                parentId === null
                    ? ""
                    : parentId,

            "data-parent-temp-id":
                parentTempId || "",

            tabindex:
                "0",

            role:
                "treeitem",

            "aria-selected":
                "false",

            /*
             * 즐겨찾기 루트가 aria-level 1인 경우
             * DB Level 0 폴더는 aria-level 2
             */
            "aria-level":
                childLevel + 2
        });

        $("<span>", {
            class:
                "p925-temp-folder-icon " +
                "a-Icon fa fa-folder",

            "aria-hidden":
                "true"
        }).appendTo(content$);

        label$ = $("<span>", {
            class:
                "p925-temp-folder-label " +
                "is-folder-name-empty",

            text:
                "(폴더명 없음)"
        });

        label$.appendTo(content$);
        content$.appendTo(node$);

        /*
         * 신규 폴더 아래에 다시 신규 폴더 생성 가능
         */
        childContainer$ = $("<ul>", {
            class:
                "p925-temp-folder-children",

            role:
                "group"
        });

        childContainer$.appendTo(node$);

        /*
         * 핵심 수정:
         * 전체 Tree 마지막이 아니라 현재 선택된 폴더의
         * 직접 하위 컨테이너 마지막에 추가
         */
        node$.appendTo(container$);

        /*
         * 기존 DB 자식 폴더와 동일한 들여쓰기 적용
         */
        alignTempFolderWithApexChildren(
            container$,
            content$,
            parentInfo
        );

        /*
         * 폴더명 입력 전에도 생성 JSON 등록
         */
        saveFolderCreate(
            tempId,
            "",
            parentId,
            parentInfo.level,
            parentTempId,
            childLevel
        );

        nodeInfo = {
            type:
                "TEMP",

            tempId:
                tempId,

            bookmarkId:
                null,

            parentId:
                parentId,

            parentTempId:
                parentTempId,

            parentLevel:
                parentInfo.level,

            level:
                childLevel,

            contentElement:
                content$[0]
        };

        /*
         * 신규 폴더 좌클릭
         * 선택만 하고 편집 모드로 자동 전환하지 않음
         */
        content$.on(
            "click",
            function (event) {
                if (
                    $(event.target).closest(
                        ".p925-folder-name-input"
                    ).length
                ) {
                    return;
                }

                finishActiveInlineEdit();
                event.stopPropagation();

                selectTempFolder(this);

                setSelectedTempNode(
                    this,
                    tempId,
                    childLevel
                );

                if (
                    typeof this.focus ===
                    "function"
                ) {
                    this.focus();
                }
            }
        );

        /*
         * 키보드 선택
         */
        content$.on(
            "keydown",
            function (event) {
                if (
                    event.key === "Enter" ||
                    event.key === " "
                ) {
                    if (
                        $(event.target).hasClass(
                            "p925-folder-name-input"
                        )
                    ) {
                        return;
                    }

                    event.preventDefault();
                    event.stopPropagation();

                    selectTempFolder(this);

                    setSelectedTempNode(
                        this,
                        tempId,
                        childLevel
                    );
                }
            }
        );

        /*
         * 임시 폴더 우클릭
         */
        content$.on(
            "contextmenu",
            function (event) {
                if (
                    $(event.target).closest(
                        ".p925-folder-name-input"
                    ).length
                ) {
                    return;
                }

                selectTempFolder(this);

                setSelectedTempNode(
                    this,
                    tempId,
                    childLevel
                );
            }
        );

        /*
         * 최초 생성 직후에만 Inline Edit 시작
         */
        beginInlineEdit(
            content$[0],
            nodeInfo
        );
    }


    /* =====================================================
     * Context Menu
     * ===================================================== */

    function getContextMenu() {
        var menu$ = $("#" + MENU_ID);

        if (!menu$.length) {
            menu$ = $("<div>", {
                id:
                    MENU_ID,

                class:
                    "p925-folder-context-menu",

                role:
                    "presentation",

                "aria-hidden":
                    "true"
            });

            $("body").append(menu$);
        }

        return menu$;
    }


    function closeContextMenu() {
        getContextMenu()
            .hide()
            .attr(
                "aria-hidden",
                "true"
            );
    }


    function createMenuButton(
        label,
        danger,
        action
    ) {
        var button$ = $("<button>", {
            type:
                "button",

            class:
                "p925-folder-context-menu__item" +
                (
                    danger
                        ? " p925-folder-context-menu__item--danger"
                        : ""
                ),

            text:
                label
        });

        button$.on(
            "click",
            function (event) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();

                closeContextMenu();

                if (
                    typeof action === "function"
                ) {
                    action();
                }

                return false;
            }
        );

        return button$;
    }


    function buildContextMenu() {
        var menu$ = getContextMenu().empty();

        if (!contextNode) {
            return menu$;
        }

        if (
            contextNode.type === "D" ||
            contextNode.type === "P"
        ) {
            return menu$;
        }

        menu$.append(
            createMenuButton(
                "편집",
                false,
                function () {
                    beginInlineEdit(
                        contextNode.contentElement,
                        contextNode
                    );
                }
            )
        );

        menu$.append(
            createMenuButton(
                "삭제",
                true,
                function () {
                    stageFolderDelete();
                }
            )
        );

        return menu$;
    }


    function openContextMenu(event) {
        var menu$ = buildContextMenu();

        var left = event.clientX;
        var top = event.clientY;
        var menuWidth;
        var menuHeight;
        var edgeGap = 8;

        if (!menu$.children().length) {
            return;
        }

        menu$
            .css({
                display:
                    "block",

                visibility:
                    "hidden",

                left:
                    "0px",

                top:
                    "0px"
            })
            .attr(
                "aria-hidden",
                "false"
            );

        menuWidth =
            menu$.outerWidth() || 120;

        menuHeight =
            menu$.outerHeight() || 80;

        if (
            left + menuWidth >
            window.innerWidth - edgeGap
        ) {
            left =
                window.innerWidth -
                menuWidth -
                edgeGap;
        }

        if (
            top + menuHeight >
            window.innerHeight - edgeGap
        ) {
            top =
                window.innerHeight -
                menuHeight -
                edgeGap;
        }

        menu$.css({
            left:
                Math.max(edgeGap, left) +
                "px",

            top:
                Math.max(edgeGap, top) +
                "px",

            visibility:
                "visible"
        });
    }

            /*
 * 삭제된 폴더에 대응하는 버튼 및 Tree UI 제거
 */
function removeBookmarkUi(bookmarkId) {
    var bookmarkIdText;

    if (
        bookmarkId === null ||
        bookmarkId === undefined ||
        bookmarkId === ""
    ) {
        return;
    }

    bookmarkIdText =
        String(bookmarkId);

    /*
     * 현재 P925 페이지 내부에서 제거
     */
    $(
        '[data-bookmark-id="' +
        bookmarkIdText +
        '"]'
    ).remove();

    $(
        '[data-folder-id="' +
        bookmarkIdText +
        '"]'
    ).remove();

    $(
        '[data-node-id="' +
        bookmarkIdText +
        '"]'
    ).remove();

    /*
     * Dialog 부모 페이지의 북마크 버튼도 제거
     */
    try {
        if (
            window.parent &&
            window.parent !== window &&
            window.parent.document
        ) {
            window.parent.apex.jQuery(
                '[data-bookmark-id="' +
                bookmarkIdText +
                '"]'
            ).remove();

            window.parent.apex.jQuery(
                '[data-folder-id="' +
                bookmarkIdText +
                '"]'
            ).remove();

            window.parent.apex.jQuery(
                '[data-node-id="' +
                bookmarkIdText +
                '"]'
            ).remove();
        }
    } catch (error) {
        console.warn(
            "[P925] 부모 페이지 북마크 UI 제거 실패:",
            error
        );
    }
    }
    /* =====================================================
 * 삭제
 * ===================================================== */

/*
 * 삭제된 노드의 부모에 실제 자식이 남아 있는지 확인하고,
 * 자식이 없으면 빈 하위 컨테이너와 펼침/접힘 버튼을 제거한다.
 */
function cleanupEmptyParentNode(parentNodeElement) {
    var parentNode$;
    var childContainers$;
    var hasRemainingChildren;
    var row$;
    var content$;
    var toggle$;

    if (!parentNodeElement) {
        return;
    }

    parentNode$ = $(parentNodeElement);

    if (!parentNode$.length) {
        return;
    }

    /*
     * 부모 노드 바로 아래에 있는 하위 목록만 조회
     */
    childContainers$ = parentNode$
        .children(
            ".a-TreeView-nodeList, " +
            ".p925-temp-folder-children, " +
            '[role="group"]'
        );

    hasRemainingChildren = false;

    childContainers$.each(function () {
        var container$ = $(this);

        var remainingChildren$ = container$
            .children(
                ".a-TreeView-node, " +
                ".p925-temp-folder-node"
            )
            .filter(function () {
                var child$ = $(this);

                return (
                    !child$.hasClass(
                        "is-folder-pending-delete"
                    ) &&
                    child$.css("display") !== "none"
                );
            });

        if (remainingChildren$.length > 0) {
            hasRemainingChildren = true;

            /*
             * each 반복 종료
             */
            return false;
        }

        return true;
    });

    /*
     * 하위 폴더가 남아 있으면 토글 유지
     */
    if (hasRemainingChildren) {
        return;
    }

    /*
     * 비어 있는 하위 폴더 컨테이너 제거
     */
    childContainers$.remove();

    row$ = parentNode$
        .children(".a-TreeView-row")
        .first();

    content$ = parentNode$
        .children(".a-TreeView-content")
        .first();

    /*
     * APEX Tree 버전과 DOM 구조에 따라
     * 토글 버튼 위치가 다를 수 있으므로 모두 조회
     */
    toggle$ = parentNode$
        .children(".a-TreeView-toggle");

    toggle$ = toggle$.add(
        row$.children(".a-TreeView-toggle")
    );

    toggle$ = toggle$.add(
        row$.find("> .a-TreeView-toggle")
    );

    toggle$ = toggle$.add(
        content$.children(".a-TreeView-toggle")
    );

    /*
     * 부모 왼쪽의 펼침/접힘 버튼 제거
     */
    toggle$.remove();

    /*
     * 부모 노드를 자식이 없는 말단 폴더 상태로 변경
     */
    parentNode$
        .removeClass(
            "is-expanded " +
            "is-collapsed " +
            "is-expandable " +
            "is-collapsible"
        )
        .removeAttr("aria-expanded");

    row$
        .removeClass(
            "is-expanded " +
            "is-collapsed " +
            "is-expandable " +
            "is-collapsible"
        )
        .removeAttr("aria-expanded");

    content$
        .removeClass(
            "is-expanded " +
            "is-collapsed " +
            "is-expandable " +
            "is-collapsible"
        )
        .removeAttr("aria-expanded");
}


/*
 * 삭제 대상의 바로 위 부모 Tree 노드를 조회
 */
function getParentTreeNode(nodeElement) {
    var node$ = $(nodeElement);
    var parentContainer$;
    var parentNode$;

    if (!node$.length) {
        return null;
    }

    /*
     * 현재 노드가 들어 있는 하위 목록
     */
    parentContainer$ = node$.parent();

    /*
     * 하위 목록을 소유한 부모 Tree 노드
     */
    parentNode$ = parentContainer$
        .closest(
            ".a-TreeView-node, " +
            ".p925-temp-folder-node"
        );

    if (!parentNode$.length) {
        return null;
    }

    return parentNode$[0];
}


/*
 * 임시 폴더 자신과 하위 임시 폴더를
 * P925_FOLDER_CREATES 생성 JSON에서 제거
 */
function removeTempFolderTreeFromCreates(nodeElement) {
    var tempIds = [];

    /*
     * 자신을 포함한 하위 임시 폴더 Content 조회
     */
    $(nodeElement)
        .find(
            ".p925-temp-folder-content"
        )
        .each(function () {
            var tempId =
                $(this).attr(
                    "data-temp-id"
                );

            if (
                tempId &&
                tempIds.indexOf(tempId) === -1
            ) {
                tempIds.push(tempId);
            }
        });

    /*
     * 현재 임시 폴더의 직접 Content도 확인
     */
    $(nodeElement)
        .children(
            ".p925-temp-folder-content"
        )
        .each(function () {
            var tempId =
                $(this).attr(
                    "data-temp-id"
                );

            if (
                tempId &&
                tempIds.indexOf(tempId) === -1
            ) {
                tempIds.push(tempId);
            }
        });

    /*
     * 생성 JSON에서 모두 제거
     */
    tempIds.forEach(
        function (tempId) {
            removeFolderCreate(tempId);
        }
    );
}


function stageFolderDelete() {
    var selectedContext = contextNode;
    var contentElement;
    var node$;
    var parentNodeElement;
    var bookmarkId;

    if (!selectedContext) {
        return;
    }

    /*
     * 즐겨찾기 루트 삭제 불가
     */
    if (selectedContext.type === "D") {
        apex.message.alert(
            "즐겨찾기 루트는 삭제할 수 없습니다."
        );

        return;
    }

    /*
     * 페이지 노드 삭제 불가
     */
    if (selectedContext.type === "P") {
        return;
    }

    contentElement =
        selectedContext.contentElement;

    bookmarkId =
        selectedContext.bookmarkId;

    /*
     * 신규 임시 폴더
     */
    if (selectedContext.type === "TEMP") {
        node$ = $(contentElement).closest(
            ".p925-temp-folder-node"
        );
    }

    /*
     * DB에서 조회된 기존 폴더
     */
    else {
        node$ = $(contentElement).closest(
            ".a-TreeView-node"
        );
    }

    if (!node$.length) {
        apex.message.alert(
            "삭제할 폴더 노드를 찾을 수 없습니다."
        );

        return;
    }

    /*
     * 중요:
     * 노드를 삭제하기 전에 부모 노드를 저장해야 한다.
     */
    parentNodeElement =
        getParentTreeNode(node$[0]);

    apex.message.confirm(
        "'" +
        selectedContext.label +
        "' 폴더를 삭제 대상으로 지정하시겠습니까?",
        function (confirmed) {
            if (!confirmed) {
                return;
            }

            /*
             * 신규 임시 폴더 삭제
             */
            if (
                selectedContext.type ===
                "TEMP"
            ) {
                /*
                 * 자신과 하위 신규 폴더를
                 * 생성 JSON에서 제거
                 */
                removeTempFolderTreeFromCreates(
                    node$[0]
                );

                /*
                 * 화면 DOM에서 완전히 제거
                 */
                node$.remove();
            }

            /*
             * 기존 DB 폴더 삭제
             */
            else {
                /*
                 * 저장 시 실제 DELETE할 ID 등록
                 */
                addFolderDelete(
                    bookmarkId
                );

                /*
                 * 같은 폴더의 이름 변경 대상 제거
                 */
                removeFolderChange(
                    bookmarkId
                );

                /*
                 * 폴더와 모든 하위 Tree DOM 제거
                 */
                node$.remove();
            }

            /*
             * 마지막 자식이 삭제된 경우
             * 부모의 토글 버튼과 빈 하위 컨테이너 제거
             */
            cleanupEmptyParentNode(
                parentNodeElement
            );

            /*
             * 삭제한 폴더가 현재 선택 부모였다면 초기화
             */
            if (
                selectedParentNode &&
                selectedParentNode
                    .contentElement ===
                    contentElement
            ) {
                selectedParentNode = null;
            }

            contextNode = null;

            closeContextMenu();
        }
    );
}


    /* =====================================================
     * 저장
     * ===================================================== */

    function findEmptyFolder() {
        var creates = readJsonArray(
            "P925_FOLDER_CREATES"
        );

        var changes = readJsonArray(
            "P925_FOLDER_CHANGES"
        );

        var i;

        for (i = 0; i < creates.length; i += 1) {
            if (
                !$.trim(
                    creates[i].folderName || ""
                )
            ) {
                return {
                    type:
                        "TEMP",

                    id:
                        creates[i].tempId
                };
            }
        }

        for (i = 0; i < changes.length; i += 1) {
            if (
                !$.trim(
                    changes[i].folderName || ""
                )
            ) {
                return {
                    type:
                        "F",

                    id:
                        changes[i].bookmarkId
                };
            }
        }

        return null;
    }


    function saveFolders() {
        var emptyFolder;

        finishActiveInlineEdit();

        emptyFolder = findEmptyFolder();

        console.log(
            "[P925] 저장 직전 JSON:",
            {
                creates:
                    getItemValue(
                        "P925_FOLDER_CREATES"
                    ),

                changes:
                    getItemValue(
                        "P925_FOLDER_CHANGES"
                    ),

                deletes:
                    getItemValue(
                        "P925_FOLDER_DELETES"
                    ),

                parentId:
                    getItemValue(
                        "P925_PARENT_BOOKMARK_ID"
                    ),

                parentLevel:
                    getItemValue(
                        "P925_PARENT_LEVEL"
                    )
            }
        );

        if (emptyFolder) {
            apex.message.alert(
                "폴더명이 존재하지 않습니다."
            );

            return;
        }

        apex.submit({
            request:
                "P925_SAVE",

            showWait:
                true
        });
    }

    /* =====================================================
 * Page 925 모달 전체 브라우저 우클릭 차단
 *
 * - P925_FOLDER_TREE가 존재하는 페이지에서만 동작
 * - 브라우저 기본 Context Menu만 차단
 * - 이벤트 전파는 막지 않으므로 폴더의 커스텀
 *   contextmenu 이벤트는 계속 정상 실행됨
 * ===================================================== */
function registerModalContextMenuBlocker() {
    /*
     * 기존 등록 이벤트 제거
     */
    if (
        window.P925_MODAL_CONTEXTMENU_BLOCKER
    ) {
        document.removeEventListener(
            "contextmenu",
            window.P925_MODAL_CONTEXTMENU_BLOCKER,
            true
        );
    }

    window.P925_MODAL_CONTEXTMENU_BLOCKER =
        function (event) {
            /*
             * 현재 문서에 Page 925 Tree가 없으면
             * 다른 APEX 페이지의 우클릭에는 영향을 주지 않는다.
             */
            if (
                !document.getElementById(
                    TREE_REGION_ID
                )
            ) {
                return;
            }

            /*
             * 브라우저 기본 우클릭 메뉴 차단
             *
             * stopPropagation은 사용하지 않는다.
             * 그래야 폴더에 등록된 APEX 우클릭 이벤트가
             * 계속 실행된다.
             */
            event.preventDefault();
        };

    /*
     * capture 단계에서 실행하여
     * 버튼, 빈 공간, 입력 필드 등에서도 확실히 차단한다.
     */
    document.addEventListener(
        "contextmenu",
        window.P925_MODAL_CONTEXTMENU_BLOCKER,
        true
    );
    }

    /* =====================================================
     * 외부 클릭
     * ===================================================== */

    function registerOutsideEditHandler() {
        if (
            window.P925_FOLDER_OUTSIDE_EDIT_HANDLER
        ) {
            document.removeEventListener(
                "pointerdown",
                window.P925_FOLDER_OUTSIDE_EDIT_HANDLER,
                true
            );
        }

        window.P925_FOLDER_OUTSIDE_EDIT_HANDLER =
            function (event) {
                var edit = activeInlineEdit;

                if (
                    !edit ||
                    !edit.inputElement ||
                    edit.finished
                ) {
                    return;
                }

                if (
                    edit.inputElement ===
                        event.target ||
                    edit.inputElement.contains(
                        event.target
                    )
                ) {
                    return;
                }

                finishActiveInlineEdit();
            };

        document.addEventListener(
            "pointerdown",
            window.P925_FOLDER_OUTSIDE_EDIT_HANDLER,
            true
        );
    }


    /* =====================================================
     * 초기화
     * ===================================================== */

    function initializeFolderManager() {
        $(document).off(
            ".p925FolderManager"
        );

        $(window).off(
            ".p925FolderManager"
        );

        $(document).off(
            ".p925FolderManagerV2"
        );

        $(window).off(
            ".p925FolderManagerV2"
        );

        $(document).off(
            ".p925FolderManagerV3"
        );

        $(window).off(
            ".p925FolderManagerV3"
        );

        $(document).off(
            ".p925FolderManagerV4"
        );

        $(window).off(
            ".p925FolderManagerV4"
        );

        $(document).off(
            ".p925FolderManagerV5"
        );

        $(window).off(
            ".p925FolderManagerV5"
        );

        $(document).off(
            EVENT_NAMESPACE
        );

        $(window).off(
            EVENT_NAMESPACE
        );

        $("#" + MENU_ID).remove();
        getContextMenu();

        registerOutsideEditHandler();

        registerModalContextMenuBlocker();

        /*
         * 기존 APEX Tree 노드 클릭
         *
         * 이 노드를 다음 신규 폴더 생성의 부모로 사용
         */
        $(document).on(
            "click" +
                EVENT_NAMESPACE,

            TREE_SELECTOR +
                " .a-TreeView-content",

            function (event) {
                /*
                 * 임시 폴더 내부 클릭은 APEX 부모 선택 이벤트에서 제외한다.
                 */
                if (
                    $(event.target).closest(
                        ".p925-temp-folder-node"
                    ).length
                ) {
                    return;
                }

                finishActiveInlineEdit();
                clearTempFolderSelection();

                setSelectedApexNode(
                    this
                );
            }
        );

        /*
         * DB Tree 및 임시 폴더 우클릭
         */
        $(document).on(
            "contextmenu" +
                EVENT_NAMESPACE,

            CONTENT_SELECTOR,

            function (event) {
                var contentElement = this;

                var tempId = $(contentElement).attr(
                    "data-temp-id"
                );

                var nodeInfo;
                var tempLevel;
                var tempParentId;
                var tempParentTempId;

                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();

                finishActiveInlineEdit();

                /*
                 * 임시 신규 폴더
                 */
                if (tempId) {
                    tempLevel = Number(
                        $(contentElement).attr(
                            "data-temp-level"
                        )
                    );

                    tempParentId =
                        $(contentElement).attr(
                            "data-parent-id"
                        );

                    tempParentTempId =
                        $(contentElement).attr(
                            "data-parent-temp-id"
                        );

                    selectTempFolder(
                        contentElement
                    );

                    setSelectedTempNode(
                        contentElement,
                        tempId,
                        tempLevel
                    );

                    contextNode = {
                        type:
                            "TEMP",

                        tempId:
                            tempId,

                        bookmarkId:
                            null,

                        level:
                            tempLevel,

                        label:
                            getNodeLabel(
                                contentElement
                            ),

                        contentElement:
                            contentElement,

                        parentId:
                            tempParentId
                                ? Number(
                                    tempParentId
                                )
                                : null,

                        parentTempId:
                            tempParentTempId ||
                            null,

                        parentLevel:
                            tempLevel - 1
                    };
                }

                /*
                 * DB에서 조회된 실제 Tree 노드
                 */
                else {
                    clearTempFolderSelection();

                    nodeInfo =
                        parseTreeNode(
                            contentElement
                        );

                    if (!nodeInfo) {
                        return false;
                    }

                    contextNode = {
                        type:
                            nodeInfo.type,

                        bookmarkId:
                            nodeInfo.bookmarkId,

                        level:
                            Number(
                                nodeInfo.level
                            ),

                        label:
                            getNodeLabel(
                                contentElement
                            ),

                        contentElement:
                            contentElement
                    };

                    if (
                        nodeInfo.type !== "P"
                    ) {
                        selectedParentNode = {
                            type:
                                nodeInfo.type,

                            bookmarkId:
                                nodeInfo.bookmarkId,

                            tempId:
                                null,

                            level:
                                Number(
                                    nodeInfo.level
                                ),

                            contentElement:
                                contentElement
                        };
                    }
                }

                openContextMenu(
                    event.originalEvent ||
                    event
                );

                return false;
            }
        );

        /*
         * Context Menu 외부 클릭
         */
        $(document).on(
            "mousedown" +
                EVENT_NAMESPACE,

            function (event) {
                var menu =
                    document.getElementById(
                        MENU_ID
                    );

                if (
                    menu &&
                    (
                        menu === event.target ||
                        menu.contains(
                            event.target
                        )
                    )
                ) {
                    return;
                }

                closeContextMenu();
            }
        );

        /*
         * ESC
         */
        $(document).on(
            "keydown" +
                EVENT_NAMESPACE,

            function (event) {
                if (event.key === "Escape") {
                    closeContextMenu();
                }
            }
        );

        /*
         * 화면 크기 변경
         */
        $(window).on(
            "resize" +
                EVENT_NAMESPACE,

            closeContextMenu
        );

        console.log(
            "[P925] 폴더 선택 경로 기반 신규 폴더 생성 초기화 완료"
        );
    }


    /*
     * 최초 실행
     */
    $(function () {
        window.setTimeout(
            initializeFolderManager,
            100
        );
    });


    /*
     * Tree Refresh 후 재초기화
     */
    $(document).on(
        "apexafterrefresh" +
            EVENT_NAMESPACE,

        TREE_SELECTOR,

        function () {
            selectedParentNode = null;
            contextNode = null;

            window.setTimeout(
                initializeFolderManager,
                50
            );
        }
    );


    /*
     * Dynamic Action 호출용
     */
    window.p925AddNewFolder =
        addNewFolder;

    window.p925SaveFolders =
        saveFolders;

    window.initializeP925FolderManager =
        initializeFolderManager;


    /*
     * Console 테스트용
     */
    window.p925FinishActiveInlineEdit =
        finishActiveInlineEdit;

    window.p925CommitAllInlineEdits =
        commitAllInlineEdits;

})(apex.jQuery);

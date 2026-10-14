/* =========================================================
 * Global Bookmark Tree jQuery UI Drag & Drop
 *
 * Tree Static ID:
 * BookMarkTree
 *
 * CSS mapping:
 * - is-bookmark-draggable
 * - is-bookmark-dragging
 * - bookmark-drag-helper
 * - is-bookmark-folder
 * - is-bookmark-drop-target
 *
 * Drag:
 * - P page node
 *
 * Drop:
 * - D root
 * - F folder
 *
 * Ajax Callback:
 * - MOVE_BOOKMARK_NODE
 *
 * Important:
 * - Reinitialize after every Tree refresh.
 * - Do not remove the apexafterrefresh handler inside the
 *   initialization function.
 * - Prevent duplicate move requests.
 * ========================================================= */
(function ($) {
    "use strict";

    var TREE_REGION_ID = "BookMarkTree";
    var TREE_SELECTOR = "#" + TREE_REGION_ID;
    var EVENT_NAMESPACE = ".bookmarkDragDropV2";

    var dragInProgress = false;
    var moveRequestInProgress = false;
    var suppressClickUntil = 0;
    var initializeTimer = null;
    var treeObserver = null;


    /* =====================================================
     * Tree Widget
     * ===================================================== */
    function getTreeWidget() {
        var region;

        try {
            region = apex.region(
                TREE_REGION_ID
            );
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


    /* =====================================================
     * Tree Node
     * ===================================================== */
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
                "[Bookmark DnD] Tree node lookup failed:",
                error
            );

            return null;
        }

        return nodes && nodes.length
            ? nodes[0]
            : null;
    }


    /* =====================================================
     * Node Value
     * ===================================================== */
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
            node.node_value ||
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
                value = adapter.getIdentity(
                    node
                );
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


    /* =====================================================
     * Node information from Content DOM
     * ===================================================== */
    function getNodeInfo(contentElement) {
        var content$;
        var nodeValue;
        var treeNode;
        var nodeInfo;

        if (
            !contentElement ||
            !window.BookmarkNodeUtil ||
            typeof window.BookmarkNodeUtil.parse !==
                "function"
        ) {
            return null;
        }

        content$ = $(contentElement);

        nodeValue = content$.attr(
            "data-bookmark-node"
        );

        if (!nodeValue) {
            treeNode = getTreeNode(
                contentElement
            );

            nodeValue = getNodeValue(
                treeNode
            );
        }

        nodeInfo = window.BookmarkNodeUtil.parse(
            nodeValue
        );

        if (!nodeInfo) {
            return null;
        }

        content$.attr(
            "data-bookmark-node",
            nodeInfo.value
        );

        return nodeInfo;
    }


    function getNodeLabel(contentElement) {
        return $.trim(
            $(contentElement)
                .find(".a-TreeView-label")
                .first()
                .text()
        );
    }


    function clearDragState() {
        $(TREE_SELECTOR)
            .find(
                ".is-bookmark-dragging, " +
                ".is-bookmark-drop-target"
            )
            .removeClass(
                "is-bookmark-dragging " +
                "is-bookmark-drop-target"
            );
    }


    function refreshBookmarkTree() {
        var region;

        try {
            region = apex.region(
                TREE_REGION_ID
            );
        } catch (error) {
            region = null;
        }

        if (
            region &&
            typeof region.refresh === "function"
        ) {
            region.refresh();
            return true;
        }

        console.warn(
            "[Bookmark DnD] Tree Region cannot be refreshed."
        );

        return false;
    }


    function showMoveMessage(message) {
        if (
            typeof window.showGlobalSuccessMessage ===
                "function"
        ) {
            window.showGlobalSuccessMessage(
                message ||
                "북마크가 이동되었습니다.",
                3000
            );

            return;
        }

        apex.message.showPageSuccess(
            message ||
            "북마크가 이동되었습니다."
        );
    }


    /* =====================================================
     * Schedule initialization
     *
     * Multiple refresh/render events may occur together.
     * Only the last request is executed.
     * ===================================================== */
    function scheduleInitialize(delay) {
        if (initializeTimer) {
            window.clearTimeout(
                initializeTimer
            );
        }

        initializeTimer = window.setTimeout(
            function () {
                initializeTimer = null;
                initializeBookmarkDragDrop();
            },
            Number(delay) || 0
        );
    }


    /* =====================================================
     * MOVE_BOOKMARK_NODE
     * ===================================================== */
    function moveBookmarkNode(
        sourceBookmarkId,
        targetFolderId
    ) {
        if (moveRequestInProgress) {
            console.warn(
                "[Bookmark DnD] Move request already in progress."
            );
            return;
        }

        moveRequestInProgress = true;

        console.log(
            "[Bookmark DnD] MOVE_BOOKMARK_NODE:",
            {
                sourceBookmarkId:
                    sourceBookmarkId,
                targetFolderId:
                    targetFolderId,
                userId:
                    $v("P0_USER_ID"),
                applicationId:
                    $v("pFlowId")
            }
        );

        apex.server.process(
            "MOVE_BOOKMARK_NODE",
            {
                x01:
                    Number(
                        sourceBookmarkId
                    ),
                x02:
                    Number(
                        targetFolderId
                    ),
                x03:
                    $v("P0_USER_ID"),
                x04:
                    $v("pFlowId")
            },
            {
                dataType:
                    "json",

                loadingIndicator:
                    TREE_SELECTOR,

                loadingIndicatorPosition:
                    "centered",

                success:
                    function (data) {
                        if (
                            !data ||
                            data.SUCCESS !== true
                        ) {
                            apex.message.alert(
                                data && data.MSG
                                    ? data.MSG
                                    : "북마크를 이동하지 못했습니다."
                            );

                            return;
                        }

                        showMoveMessage(
                            data.MSG
                        );

                        /*
                         * Do not initialize immediately here.
                         * The apexafterrefresh event will initialize
                         * the newly created Tree DOM.
                         */
                        if (!refreshBookmarkTree()) {
                            scheduleInitialize(100);
                        }
                    },

                error:
                    function (
                        jqXHR,
                        textStatus,
                        errorThrown
                    ) {
                        console.error(
                            "[Bookmark DnD] Move error:",
                            {
                                textStatus:
                                    textStatus,
                                errorThrown:
                                    errorThrown,
                                responseText:
                                    jqXHR.responseText,
                                sourceBookmarkId:
                                    sourceBookmarkId,
                                targetFolderId:
                                    targetFolderId
                            }
                        );

                        apex.message.alert(
                            "북마크 이동 중 오류가 발생했습니다."
                        );
                    },

                complete:
                    function () {
                        moveRequestInProgress = false;
                        dragInProgress = false;
                        clearDragState();
                    }
            }
        );
    }


    /* =====================================================
     * Destroy only node widgets.
     * Do not remove document refresh handlers here.
     * ===================================================== */
    function destroyDragDrop() {
        $(TREE_SELECTOR)
            .find(".a-TreeView-content")
            .each(function () {
                var content$ = $(this);

                try {
                    if (
                        content$.hasClass(
                            "ui-draggable"
                        )
                    ) {
                        content$.draggable(
                            "destroy"
                        );
                    }
                } catch (error) {
                    console.warn(
                        "[Bookmark DnD] draggable destroy failed:",
                        error
                    );
                }

                try {
                    if (
                        content$.hasClass(
                            "ui-droppable"
                        )
                    ) {
                        content$.droppable(
                            "destroy"
                        );
                    }
                } catch (error) {
                    console.warn(
                        "[Bookmark DnD] droppable destroy failed:",
                        error
                    );
                }

                content$
                    .removeAttr("draggable")
                    .removeClass(
                        "is-bookmark-draggable " +
                        "is-bookmark-dragging " +
                        "is-bookmark-drop-target"
                    );
            });
    }


    function initializeDraggablePages() {
        var draggableCount = 0;

        $(TREE_SELECTOR)
            .find(".a-TreeView-content")
            .each(function () {
                var contentElement = this;
                var content$ = $(this);
                var nodeInfo = getNodeInfo(
                    contentElement
                );

                if (
                    !nodeInfo ||
                    nodeInfo.type !== "P"
                ) {
                    return;
                }

                content$
                    .addClass(
                        "is-bookmark-draggable"
                    )
                    .attr(
                        "data-bookmark-node",
                        nodeInfo.value
                    );

                content$
                    .find("a, img")
                    .attr(
                        "draggable",
                        "false"
                    );

                content$.draggable({
                    addClasses:
                        true,

                    appendTo:
                        "body",

                    containment:
                        "document",

                    cursor:
                        "grabbing",

                    distance:
                        4,

                    helper:
                        function () {
                            return $("<div>", {
                                class:
                                    "bookmark-drag-helper",
                                text:
                                    getNodeLabel(
                                        contentElement
                                    ) ||
                                    "북마크 페이지"
                            });
                        },

                    opacity:
                        0.9,

                    revert:
                        "invalid",

                    revertDuration:
                        150,

                    scroll:
                        true,

                    scrollSensitivity:
                        30,

                    scrollSpeed:
                        15,

                    zIndex:
                        50000,

                    start:
                        function (
                            event,
                            ui
                        ) {
                            if (moveRequestInProgress) {
                                return false;
                            }

                            dragInProgress = true;
                            suppressClickUntil =
                                Date.now() + 500;

                            clearDragState();

                            content$.addClass(
                                "is-bookmark-dragging"
                            );

                            ui.helper.css(
                                "z-index",
                                50000
                            );

                            console.log(
                                "[Bookmark DnD] Drag start:",
                                nodeInfo
                            );
                        },

                    stop:
                        function () {
                            dragInProgress = false;
                            suppressClickUntil =
                                Date.now() + 400;

                            content$.removeClass(
                                "is-bookmark-dragging"
                            );

                            window.setTimeout(
                                clearDragState,
                                0
                            );
                        }
                });

                draggableCount += 1;
            });

        console.log(
            "[Bookmark DnD] Draggable page count:",
            draggableCount
        );
    }


    function initializeDroppableFolders() {
        var droppableCount = 0;

        $(TREE_SELECTOR)
            .find(".a-TreeView-content")
            .each(function () {
                var targetElement = this;
                var target$ = $(this);
                var targetInfo = getNodeInfo(
                    targetElement
                );

                if (
                    !targetInfo ||
                    (
                        targetInfo.type !== "D" &&
                        targetInfo.type !== "F"
                    )
                ) {
                    return;
                }

                if (targetInfo.type === "F") {
                    target$.addClass(
                        "is-bookmark-folder"
                    );
                }

                target$.attr(
                    "data-bookmark-node",
                    targetInfo.value
                );

                target$.droppable({
                    accept:
                        TREE_SELECTOR +
                        " .a-TreeView-content" +
                        ".is-bookmark-draggable",

                    tolerance:
                        "pointer",

                    greedy:
                        true,

                    over:
                        function () {
                            if (
                                !dragInProgress ||
                                moveRequestInProgress
                            ) {
                                return;
                            }

                            clearDragState();

                            target$.addClass(
                                "is-bookmark-drop-target"
                            );
                        },

                    out:
                        function () {
                            target$.removeClass(
                                "is-bookmark-drop-target"
                            );
                        },

                    drop:
                        function (
                            event,
                            ui
                        ) {
                            var sourceElement;
                            var sourceInfo;
                            var dropTargetInfo;

                            event.preventDefault();
                            event.stopPropagation();

                            if (moveRequestInProgress) {
                                return;
                            }

                            sourceElement =
                                ui.draggable[0];

                            sourceInfo = getNodeInfo(
                                sourceElement
                            );

                            dropTargetInfo = getNodeInfo(
                                targetElement
                            );

                            target$.removeClass(
                                "is-bookmark-drop-target"
                            );

                            if (
                                !sourceInfo ||
                                sourceInfo.type !== "P"
                            ) {
                                apex.message.alert(
                                    "이동할 페이지 정보를 확인할 수 없습니다."
                                );

                                return;
                            }

                            if (
                                !dropTargetInfo ||
                                (
                                    dropTargetInfo.type !==
                                        "D" &&
                                    dropTargetInfo.type !==
                                        "F"
                                )
                            ) {
                                apex.message.alert(
                                    "페이지는 즐겨찾기 또는 폴더에만 이동할 수 있습니다."
                                );

                                return;
                            }

                            console.log(
                                "[Bookmark DnD] Drop:",
                                {
                                    source:
                                        sourceInfo,
                                    target:
                                        dropTargetInfo
                                }
                            );

                            moveBookmarkNode(
                                sourceInfo.bookmarkId,
                                dropTargetInfo.bookmarkId
                            );
                        }
                });

                droppableCount += 1;
            });

        console.log(
            "[Bookmark DnD] Droppable count:",
            droppableCount
        );
    }


    function initializeBookmarkDragDrop() {
        var tree$ = $(TREE_SELECTOR);
        var contentCount;

        if (!tree$.length) {
            return;
        }

        if (
            typeof $.fn.draggable !== "function" ||
            typeof $.fn.droppable !== "function"
        ) {
            console.error(
                "[Bookmark DnD] jQuery UI draggable/droppable is unavailable."
            );

            return;
        }

        contentCount = tree$
            .find(".a-TreeView-content")
            .length;

        if (!contentCount) {
            scheduleInitialize(100);
            return;
        }

        destroyDragDrop();
        clearDragState();

        initializeDraggablePages();
        initializeDroppableFolders();

        console.log(
            "[Bookmark DnD] Initialization complete:",
            {
                draggable:
                    tree$.find(
                        ".is-bookmark-draggable"
                    ).length,
                droppable:
                    tree$.find(
                        ".ui-droppable"
                    ).length
            }
        );
    }


    /* =====================================================
     * Click suppression after drag
     * ===================================================== */
    $(document)
        .off(
            "click" + EVENT_NAMESPACE
        )
        .on(
            "click" + EVENT_NAMESPACE,
            TREE_SELECTOR +
                " .is-bookmark-draggable a",
            function (event) {
                if (
                    dragInProgress ||
                    Date.now() < suppressClickUntil
                ) {
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();

                    return false;
                }
            }
        );


    /* =====================================================
     * Tree refresh handler
     *
     * Register once outside initializeBookmarkDragDrop.
     * ===================================================== */
    $(document)
        .off(
            "apexafterrefresh" +
                EVENT_NAMESPACE,
            TREE_SELECTOR
        )
        .on(
            "apexafterrefresh" +
                EVENT_NAMESPACE,
            TREE_SELECTOR,
            function () {
                dragInProgress = false;
                clearDragState();

                console.log(
                    "[Bookmark DnD] Tree refresh completed."
                );

                scheduleInitialize(200);
            }
        );


    /*
     * Fallback for APEX versions/templates where the delegated
     * apexafterrefresh target is an inner element instead of the
     * Region element.
     */
    $(document)
        .off(
            "apexafterrefresh" +
                EVENT_NAMESPACE +
                "Fallback"
        )
        .on(
            "apexafterrefresh" +
                EVENT_NAMESPACE +
                "Fallback",
            function (event) {
                var target$ = $(event.target);

                if (
                    target$.is(TREE_SELECTOR) ||
                    target$.closest(TREE_SELECTOR).length ||
                    target$.find(TREE_SELECTOR).length
                ) {
                    dragInProgress = false;
                    clearDragState();
                    scheduleInitialize(200);
                }
            }
        );


    /* =====================================================
     * MutationObserver fallback
     *
     * If the Tree DOM is replaced without apexafterrefresh,
     * reinitialize after the node list changes.
     * ===================================================== */
    function registerTreeObserver() {
        var treeElement = document.getElementById(
            TREE_REGION_ID
        );

        if (!treeElement) {
            return;
        }

        if (treeObserver) {
            treeObserver.disconnect();
        }

        treeObserver = new MutationObserver(
            function (mutations) {
                var shouldInitialize = mutations.some(
                    function (mutation) {
                        return (
                            mutation.type === "childList" &&
                            (
                                mutation.addedNodes.length > 0 ||
                                mutation.removedNodes.length > 0
                            )
                        );
                    }
                );

                if (shouldInitialize) {
                    scheduleInitialize(150);
                }
            }
        );

        treeObserver.observe(
            treeElement,
            {
                childList:
                    true,
                subtree:
                    true
            }
        );
    }


    $(function () {
        registerTreeObserver();
        scheduleInitialize(300);
    });


    window.initializeBookmarkDragDrop =
        function () {
            registerTreeObserver();
            scheduleInitialize(0);
        };

})(apex.jQuery);

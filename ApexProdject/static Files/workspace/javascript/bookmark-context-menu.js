/* =========================================================
 * Global Bookmark Tree Context Menu
 *
 * Tree Static ID:
 * BookMarkTree
 *
 * NODE_VALUE:
 * D_LEVEL_BOOKMARKID
 * F_LEVEL_BOOKMARKID
 * P_LEVEL_BOOKMARKID
 *
 * 메뉴 규칙
 * ---------------------------------------------------------
 * D 루트
 * - 폴더 추가
 * - 페이지 추가
 *
 * F Level 0~2
 * - 폴더 추가
 * - 페이지 추가
 * - 폴더 관리
 * - 폴더 삭제
 *
 * F Level 3
 * - 폴더 관리
 * - 폴더 삭제
 *
 * P 페이지
 * - 현재 창에서 열기
 * - 새 탭에서 열기
 * - 페이지 삭제
 * ========================================================= */
(function ($) {
    "use strict";

    var TREE_REGION_ID = "BookMarkTree";
    var TREE_SELECTOR = "#" + TREE_REGION_ID;
    var MENU_ID = "BookmarkContextMenu";

    var EVENT_NAMESPACE =
        ".bookmarkContextMenuLevelType";

    /*
     * 현재 우클릭한 Tree 노드
     */
    var selectedNode = null;


    /* =====================================================
     * Tree 관련 함수
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
                "[Bookmark Context] Tree 노드 조회 실패:",
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
                value =
                    adapter.getIdentity(node);
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


    function getNodeLabel(element) {
        return $.trim(
            $(element)
                .closest(".a-TreeView-node")
                .find(".a-TreeView-label")
                .first()
                .text()
        );
    }


    function getNodeUrl(element) {
        var url = $(element)
            .closest(".a-TreeView-node")
            .find("a")
            .first()
            .attr("href");

        if (
            !url ||
            url === "#" ||
            /^javascript:void/i.test(url)
        ) {
            return null;
        }

        return url;
    }


    /* =====================================================
     * Context Menu DOM
     * ===================================================== */

    function getContextMenu() {
        var menu$ = $("#" + MENU_ID);

        if (!menu$.length) {
            menu$ = $("<div>", {
                id:
                    MENU_ID,

                class:
                    "bookmark-context-menu",

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


    function createMenuItem(
        label,
        iconClass,
        action,
        danger
    ) {
        var button$ = $("<button>", {
            type:
                "button",

            class:
                "bookmark-context-menu__item" +
                (
                    danger
                        ? " bookmark-context-menu__item--danger"
                        : ""
                )
        });

        $("<span>", {
            class:
                "bookmark-context-menu__icon " +
                iconClass,

            "aria-hidden":
                "true"
        }).appendTo(button$);

        $("<span>", {
            class:
                "bookmark-context-menu__label",

            text:
                label
        }).appendTo(button$);

        button$.on(
            "click",
            function (event) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();

                closeContextMenu();

                if (
                    typeof action ===
                    "function"
                ) {
                    action();
                }

                return false;
            }
        );

        return button$;
    }


    function createSeparator() {
        return $("<div>", {
            class:
                "bookmark-context-menu__separator",

            role:
                "separator"
        });
    }


    /* =====================================================
     * 북마크 Tree Refresh
     * ===================================================== */

    function refreshBookmarkTree() {
        var region;

        try {
            region = apex.region(
                TREE_REGION_ID
            );
        } catch (error) {
            region = null;

            console.error(
                "[Bookmark] Tree Region 조회 실패:",
                error
            );
        }

        if (
            region &&
            typeof region.refresh ===
                "function"
        ) {
            region.refresh();

            return true;
        }

        console.warn(
            "[Bookmark] Tree Region을 Refresh할 수 없습니다:",
            TREE_REGION_ID
        );

        return false;
    }


    /* =====================================================
     * 새 폴더 Modal 호출
     * ===================================================== */

    function openFolderDialog(
        parentBookmarkId,
        parentLevel
    ) {
        if (
            !window.BookmarkNodeUtil ||
            typeof window.BookmarkNodeUtil
                .canAddChild !== "function" ||
            !window.BookmarkNodeUtil.canAddChild(
                selectedNode
            )
        ) {
            return;
        }

        apex.server.process(
            "GET_BOOKMARK_FOLDER_URL",
            {
                x01:
                    parentBookmarkId,

                x02:
                    parentLevel
            },
            {
                dataType:
                    "json",

                success:
                    function (data) {
                        var triggerElement;

                        if (
                            !data ||
                            data.SUCCESS !== true ||
                            !data.URL
                        ) {
                            apex.message.alert(
                                data && data.MSG
                                    ? data.MSG
                                    : "새 폴더 화면을 열 수 없습니다."
                            );

                            return;
                        }

                        triggerElement =
                            document.querySelector(
                                'a[href*="showBookmark"]'
                            ) || document.body;

                        apex.navigation.dialog(
                            data.URL,
                            {
                                title:
                                    "새 폴더",

                                width:
                                    500,

                                height:
                                    450,

                                maxWidth:
                                    520,

                                modal:
                                    true,

                                resizable:
                                    false
                            },
                            "a-Dialog--uiDialog",
                            triggerElement
                        );
                    },

                error:
                    function (
                        jqXHR,
                        textStatus,
                        errorThrown
                    ) {
                        console.error(
                            "[Bookmark Folder] Modal 호출 오류:",
                            {
                                textStatus:
                                    textStatus,

                                errorThrown:
                                    errorThrown,

                                responseText:
                                    jqXHR.responseText,

                                parentBookmarkId:
                                    parentBookmarkId,

                                parentLevel:
                                    parentLevel
                            }
                        );

                        apex.message.alert(
                            "새 폴더 화면 호출 중 오류가 발생했습니다."
                        );
                    }
            }
        );
    }


    /* =====================================================
     * 현재 페이지 직접 추가
     *
     * Application Process:
     * ADD_CURRENT_BOOKMARK_PAGE
     *
     * x01: UPPER_BOOKMARK_ID
     * x02: 부모 BOOKMARK_LEVEL
     * x03: 현재 APPLICATION_ID
     * x04: 현재 PAGE_ID
     * ===================================================== */

    function addCurrentPageBookmark(
        upperBookmarkId,
        parentLevel
    ) {
        var currentApplicationId;
        var currentPageId;

        /*
         * APEX 24.2 환경에서는 apex.env에 APP_ID,
         * APP_PAGE_ID가 없을 수 있으므로
         * pFlowId, pFlowStepId를 기본값으로 사용한다.
         */
        currentApplicationId =
            Number(
                $v("pFlowId") ||
                (
                    apex.env
                        ? apex.env.APP_ID
                        : null
                )
            );

        currentPageId =
            Number(
                $v("pFlowStepId") ||
                (
                    apex.env
                        ? apex.env.APP_PAGE_ID
                        : null
                )
            );

        /*
         * UPPER_BOOKMARK_ID 검사
         */
        if (
            upperBookmarkId === null ||
            upperBookmarkId === undefined ||
            upperBookmarkId === "" ||
            Number.isNaN(
                Number(upperBookmarkId)
            )
        ) {
            apex.message.alert(
                "상위 북마크 ID를 확인할 수 없습니다."
            );

            return;
        }

        /*
         * 부모 BOOKMARK_LEVEL 검사
         *
         * 즐겨찾기 루트 Level -1도 정상값이므로
         * 음수 여부로 오류 처리하지 않는다.
         */
        if (
            parentLevel === null ||
            parentLevel === undefined ||
            parentLevel === "" ||
            Number.isNaN(
                Number(parentLevel)
            )
        ) {
            apex.message.alert(
                "상위 북마크 LEVEL을 확인할 수 없습니다."
            );

            return;
        }

        if (
            Number.isNaN(
                currentApplicationId
            ) ||
            currentApplicationId <= 0
        ) {
            apex.message.alert(
                "현재 애플리케이션 정보를 확인할 수 없습니다."
            );

            return;
        }

        if (
            Number.isNaN(currentPageId) ||
            currentPageId < 0
        ) {
            apex.message.alert(
                "현재 페이지 정보를 확인할 수 없습니다."
            );

            return;
        }

        /*
         * Global Page와 폴더 관리 페이지 제외
         */
        if (
            currentPageId === 0 ||
            currentPageId === 925
        ) {
            apex.message.alert(
                "현재 페이지는 북마크로 추가할 수 없습니다."
            );

            return;
        }

        /*
         * D 또는 F 노드 아래에서만 페이지 추가 가능
         */
        if (
            !selectedNode ||
            !window.BookmarkNodeUtil ||
            typeof window.BookmarkNodeUtil
                .canAddChild !== "function" ||
            !window.BookmarkNodeUtil.canAddChild(
                selectedNode
            )
        ) {
            apex.message.alert(
                "페이지를 추가할 즐겨찾기 또는 폴더를 선택해 주세요."
            );

            return;
        }

        closeContextMenu();

        apex.server.process(
            "ADD_CURRENT_BOOKMARK_PAGE",
            {
                /*
                 * HRM_BOOKMARK.UPPER_BOOKMARK_ID
                 */
                x01:
                    Number(
                        upperBookmarkId
                    ),

                /*
                 * 선택한 부모의 BOOKMARK_LEVEL
                 */
                x02:
                    Number(
                        parentLevel
                    ),

                /*
                 * 현재 APPLICATION_ID
                 */
                x03:
                    currentApplicationId,

                /*
                 * 현재 PAGE_ID
                 */
                x04:
                    currentPageId
            },
            {
                dataType:
                    "json",

                loadingIndicator:
                    "body",

                loadingIndicatorPosition:
                    "page",

                success:
                    function (data) {
                        if (
                            !data ||
                            data.SUCCESS !== true
                        ) {
                            apex.message.alert(
                                data && data.MSG
                                    ? data.MSG
                                    : "현재 페이지를 추가하지 못했습니다."
                            );

                            return;
                        }

                        console.log(
                            "[Bookmark] 현재 페이지 추가 완료:",
                            {
                                bookmarkId:
                                    data.BOOKMARK_ID,

                                upperBookmarkId:
                                    data.UPPER_BOOKMARK_ID,

                                bookmarkLevel:
                                    data.BOOKMARK_LEVEL,

                                applicationId:
                                    data.APPLICATION_ID,

                                pageId:
                                    data.PAGE_ID
                            }
                        );

                        /*
                         * INSERT 후 Tree를 DB 기준으로 갱신
                         */
                        refreshBookmarkTree();

                        window.showGlobalSuccessMessage(
                            data.MSG ||
                            "현재 페이지가 추가되었습니다."
                        );
                    },

                error:
                    function (
                        jqXHR,
                        textStatus,
                        errorThrown
                    ) {
                        console.error(
                            "[Bookmark] 현재 페이지 추가 오류:",
                            {
                                textStatus:
                                    textStatus,

                                errorThrown:
                                    errorThrown,

                                responseText:
                                    jqXHR.responseText,

                                upperBookmarkId:
                                    upperBookmarkId,

                                parentLevel:
                                    parentLevel,

                                applicationId:
                                    currentApplicationId,

                                pageId:
                                    currentPageId
                            }
                        );

                        apex.message.alert(
                            "현재 페이지를 추가하는 중 오류가 발생했습니다."
                        );
                    }
            }
        );
    }


    /* =====================================================
     * 삭제
     * ===================================================== */

    function deleteSelectedNode() {
        var targetNode;
        var targetName;
        var targetType;
        var targetBookmarkId;

        if (!selectedNode) {
            apex.message.alert(
                "삭제할 항목을 확인할 수 없습니다."
            );

            return;
        }

        if (selectedNode.type === "D") {
            apex.message.alert(
                "즐겨찾기 루트는 삭제할 수 없습니다."
            );

            return;
        }

        /*
         * confirm이 열린 뒤 selectedNode 값이 바뀌는 것을
         * 방지하기 위해 현재 값을 복사한다.
         */
        targetNode = {
            type:
                selectedNode.type,

            level:
                selectedNode.level,

            bookmarkId:
                selectedNode.bookmarkId,

            label:
                selectedNode.label,

            contentElement:
                selectedNode.contentElement
        };

        targetType =
            targetNode.type;

        targetBookmarkId =
            targetNode.bookmarkId;

        targetName =
            targetType === "F"
                ? "폴더"
                : "페이지";

        apex.message.confirm(
            "'" +
            targetNode.label +
            "' " +
            targetName +
            "를 삭제하시겠습니까?",

            function (confirmed) {
                if (!confirmed) {
                    return;
                }
            console.log(
            "[Bookmark Delete] 서버 전송값:",
            {
                type:
                    targetType,

                bookmarkId:
                    targetBookmarkId,

                userId:
                    $v("P0_USER_ID"),

                applicationId:
                    $v("pFlowId")
            }
        );
                apex.server.process(
                    "DELETE_BOOKMARK_NODE",
                    {
                        x01:
                            targetType,

                        x02:
                            targetBookmarkId,

                        x03:
                            $v("P0_USER_ID"),

                        x04:
                            $v("pFlowId")
                    },
                    {
                        dataType:
                            "json",

                        success:
                            function (data) {
                                if (
                                    !data ||
                                    data.SUCCESS !== true
                                ) {
                                    apex.message.alert(
                                        data && data.MSG
                                            ? data.MSG
                                            : "삭제하지 못했습니다."
                                    );

                                    return;
                                }

                                window.showGlobalSuccessMessage(
                                        data.MSG ||
                                        "삭제되었습니다."
                                    );
                                refreshBookmarkTree();

                                selectedNode = null;
                            },

                        error:
                            function (
                                jqXHR,
                                textStatus,
                                errorThrown
                            ) {
                                console.error(
                                    "[Bookmark Delete] 오류:",
                                    {
                                        textStatus:
                                            textStatus,

                                        errorThrown:
                                            errorThrown,

                                        responseText:
                                            jqXHR.responseText,

                                        bookmarkType:
                                            targetType,

                                        bookmarkId:
                                            targetBookmarkId
                                    }
                                );

                                apex.message.alert(
                                    "삭제 처리 중 오류가 발생했습니다."
                                );
                            }
                    }
                );
            }
        );
    }


    /* =====================================================
     * 메뉴 구성
     * ===================================================== */

    function buildContextMenu() {
        var menu$ = getContextMenu();

        menu$.empty();

        if (!selectedNode) {
            return menu$;
        }

        /* -------------------------------------------------
         * D: 즐겨찾기 루트
         * ------------------------------------------------- */
        if (selectedNode.type === "D") {
            menu$.append(
                createMenuItem(
                    "폴더 추가",
                    "fa fa-folder-plus-o",

                    function () {
                        openFolderDialog(
                            selectedNode.bookmarkId,
                            selectedNode.level
                        );
                    },

                    false
                )
            );

            menu$.append(
                createMenuItem(
                    "페이지 추가",
                    "fa fa-file-plus-o",

                    function () {
                        addCurrentPageBookmark(
                            selectedNode.bookmarkId,
                            selectedNode.level
                        );
                    },

                    false
                )
            );

            return menu$;
        }

        /* -------------------------------------------------
         * F: 폴더
         * ------------------------------------------------- */
        if (selectedNode.type === "F") {
            /*
             * Level 3 미만일 때만 하위 생성 허용
             */
            if (
                Number(selectedNode.level) < 3
            ) {
                menu$.append(
                    createMenuItem(
                        "폴더 추가",
                        "fa fa-folder-plus-o",

                        function () {
                            openFolderDialog(
                                selectedNode.bookmarkId,
                                selectedNode.level
                            );
                        },

                        false
                    )
                );

                menu$.append(
                    createMenuItem(
                        "페이지 추가",
                        "fa fa-file-plus-o",

                        function () {
                            addCurrentPageBookmark(
                                selectedNode.bookmarkId,
                                selectedNode.level
                            );
                        },

                        false
                    )
                );

                menu$.append(
                    createSeparator()
                );
            }

            // menu$.append(
            //     createMenuItem(
            //         "폴더 관리",
            //         "fa fa-pencil",

            //         function () {
            //             openFolderDialog(
            //                 selectedNode.bookmarkId,
            //                 selectedNode.level
            //             );
            //         },

            //         false
            //     )
            // );

            menu$.append(
                createMenuItem(
                    "폴더 삭제",
                    "fa fa-trash",
                    deleteSelectedNode,
                    true
                )
            );

            return menu$;
        }

        /* -------------------------------------------------
         * P: 페이지
         * ------------------------------------------------- */
        if (selectedNode.type === "P") {
            menu$.append(
                createMenuItem(
                    "현재 창에서 열기",
                    "fa fa-external-link",

                    function () {
                        if (
                            selectedNode.url
                        ) {
                            apex.navigation.redirect(
                                selectedNode.url
                            );
                        } else {
                            apex.message.alert(
                                "이동할 페이지 URL이 없습니다."
                            );
                        }
                    },

                    false
                )
            );

            menu$.append(
                createMenuItem(
                    "새 탭에서 열기",
                    "fa fa-window-restore",

                    function () {
                        if (
                            selectedNode.url
                        ) {
                            window.open(
                                selectedNode.url,
                                "_blank",
                                "noopener"
                            );
                        } else {
                            apex.message.alert(
                                "이동할 페이지 URL이 없습니다."
                            );
                        }
                    },

                    false
                )
            );

            menu$.append(
                createSeparator()
            );

            menu$.append(
                createMenuItem(
                    "페이지 삭제",
                    "fa fa-trash",
                    deleteSelectedNode,
                    true
                )
            );
        }

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
            menu$.outerWidth() || 210;

        menuHeight =
            menu$.outerHeight() || 100;

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
                Math.max(
                    edgeGap,
                    Math.round(left)
                ) + "px",

            top:
                Math.max(
                    edgeGap,
                    Math.round(top)
                ) + "px",

            visibility:
                "visible"
        });
    }


    /* =====================================================
     * Tree 노드 분류
     * ===================================================== */

    function classifyTreeNodes() {
        if (
            !window.BookmarkNodeUtil ||
            typeof window.BookmarkNodeUtil
                .parse !== "function"
        ) {
            console.warn(
                "[Bookmark Context] BookmarkNodeUtil을 찾을 수 없습니다."
            );

            return;
        }

        $(TREE_SELECTOR)
            .find(".a-TreeView-content")
            .each(function () {
                var node =
                    getTreeNode(this);

                var value =
                    getNodeValue(node);

                var nodeInfo =
                    window.BookmarkNodeUtil
                        .parse(value);

                $(this)
                    .removeAttr(
                        "data-bookmark-node"
                    )
                    .removeClass(
                        "is-bookmark-root " +
                        "is-bookmark-folder " +
                        "is-bookmark-page"
                    );

                if (!nodeInfo) {
                    return;
                }

                $(this).attr(
                    "data-bookmark-node",
                    nodeInfo.value
                );

                if (
                    nodeInfo.type === "D"
                ) {
                    $(this).addClass(
                        "is-bookmark-root"
                    );
                }

                if (
                    nodeInfo.type === "F"
                ) {
                    $(this).addClass(
                        "is-bookmark-folder"
                    );
                }

                if (
                    nodeInfo.type === "P"
                ) {
                    $(this).addClass(
                        "is-bookmark-page"
                    );
                }
            });
    }


    /* =====================================================
     * 초기화
     * ===================================================== */

    function initializeContextMenu() {
        /*
         * 이전 버전 이벤트 제거
         */
        $(document).off(
            ".bookmarkContextMenu"
        );

        $(window).off(
            ".bookmarkContextMenu"
        );

        $(document).off(
            EVENT_NAMESPACE
        );

        $(window).off(
            EVENT_NAMESPACE
        );

        /*
         * 기존 Context Menu 제거 후 재생성
         */
        $("#" + MENU_ID).remove();

        getContextMenu();
        classifyTreeNodes();

        /*
         * Tree 내부에서는 브라우저 기본 우클릭 메뉴를 차단한다.
         *
         * 노드 사이의 빈 영역을 우클릭한 경우에는
         * 커스텀 메뉴를 열지 않고 기본 메뉴만 차단한다.
         */
        $(document).on(
            "contextmenu" +
                EVENT_NAMESPACE,

            TREE_SELECTOR,

            function (event) {
                event.preventDefault();
            }
        );

        /*
         * D/F/P Tree 노드 전체 영역 우클릭
         *
         * Content, Label, Icon뿐 아니라 Row의 빈 영역에서도
         * 가장 가까운 Tree Node를 찾아 커스텀 메뉴를 표시한다.
         */
        $(document).on(
            "contextmenu" +
                EVENT_NAMESPACE,

            TREE_SELECTOR +
                " .a-TreeView-node",

            function (event) {
                var node$;
                var content$;
                var treeNode;
                var nodeValue;
                var nodeInfo;

                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();

                /*
                 * 이벤트가 발생한 위치에서 가장 가까운 노드를 사용한다.
                 * this를 바로 사용하면 하위 노드 이벤트가 상위 노드까지
                 * 전달될 때 잘못된 부모 노드를 선택할 수 있다.
                 */
                node$ = $(event.target).closest(
                    ".a-TreeView-node"
                );

                if (!node$.length) {
                    return false;
                }

                /*
                 * 현재 노드의 직접 Content를 우선 조회한다.
                 */
                content$ = node$
                    .children(
                        ".a-TreeView-content"
                    )
                    .first();

                /*
                 * APEX Tree DOM 구조에 따라 Content가 Row 내부에
                 * 존재하는 경우를 처리한다.
                 */
                if (!content$.length) {
                    content$ = node$
                        .children(
                            ".a-TreeView-row"
                        )
                        .find(
                            ".a-TreeView-content"
                        )
                        .first();
                }

                if (!content$.length) {
                    return false;
                }

                nodeValue = content$.attr(
                    "data-bookmark-node"
                );

                /*
                 * Tree Refresh 직후 classifyTreeNodes()가 아직 끝나지 않아
                 * data-bookmark-node가 없다면 Tree 모델에서 직접 조회한다.
                 */
                if (!nodeValue) {
                    treeNode = getTreeNode(
                        content$[0]
                    );

                    nodeValue = getNodeValue(
                        treeNode
                    );
                }

                if (
                    !window.BookmarkNodeUtil ||
                    typeof window.BookmarkNodeUtil
                        .parse !== "function"
                ) {
                    console.error(
                        "[Bookmark Context] BookmarkNodeUtil을 찾을 수 없습니다."
                    );

                    return false;
                }

                nodeInfo =
                    window.BookmarkNodeUtil
                        .parse(nodeValue);

                if (!nodeInfo) {
                    console.warn(
                        "[Bookmark Context] 노드 정보를 분석할 수 없습니다:",
                        nodeValue
                    );

                    return false;
                }

                /*
                 * Refresh 직후 누락됐던 속성을 다시 보정한다.
                 */
                content$.attr(
                    "data-bookmark-node",
                    nodeInfo.value
                );

                selectedNode = {
                    type:
                        nodeInfo.type,

                    level:
                        Number(
                            nodeInfo.level
                        ),

                    bookmarkId:
                        Number(
                            nodeInfo.bookmarkId
                        ),

                    label:
                        getNodeLabel(
                            content$[0]
                        ),

                    url:
                        nodeInfo.type === "P"
                            ? getNodeUrl(
                                content$[0]
                            )
                            : null,

                    contentElement:
                        content$[0]
                };

                openContextMenu(
                    event.originalEvent ||
                    event
                );

                return false;
            }
        );

        /*
         * 메뉴 외부 클릭 시 닫기
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
                if (
                    event.key === "Escape"
                ) {
                    closeContextMenu();
                }
            }
        );

        /*
         * Resize 또는 Scroll 시 메뉴 닫기
         */
        $(window).on(
            "resize" +
                EVENT_NAMESPACE +
                " scroll" +
                EVENT_NAMESPACE,

            function () {
                closeContextMenu();
            }
        );

        console.log(
            "[Bookmark Context] D/F/P 메뉴 초기화 완료"
        );
    }


    /*
     * 최초 초기화
     */
    $(function () {
        window.setTimeout(
            initializeContextMenu,
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
            selectedNode = null;
            closeContextMenu();

            window.setTimeout(
                initializeContextMenu,
                50
            );
        }
    );


    /*
     * 외부 호출용
     */
    window.initializeBookmarkContextMenu =
        initializeContextMenu;

    window.openBookmarkFolderDialog =
        openFolderDialog;

    window.addCurrentPageBookmark =
        addCurrentPageBookmark;

    /*
     * 기존 코드에서
     * window.openBookmarkPageDialog()을 호출하는 경우를 위한 호환
     */
    window.openBookmarkPageDialog =
        addCurrentPageBookmark;

})(apex.jQuery);

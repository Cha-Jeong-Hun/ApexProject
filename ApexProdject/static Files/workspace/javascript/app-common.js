/* =========================================================
 * Interactive Grid 선택 적용 Rows Per Page
 *
 * 적용 조건:
 * - Region CSS Class: use-global-page-size
 *
 * Pagination 위치 Template Option:
 * - ig-pagination-center
 * - ig-pagination-right
 *
 * 주요 기능:
 * - 대상 Region의 Rows Per Page Select 생성 및 동기화
 * - Pagination 바로 뒤에 Select 배치
 * - IG Footer 재렌더링 후 Select 복원
 * - 최초 자동 표시 행 수 계산
 * - Region Refresh / View 변경 시 재초기화
 *
 * 중요:
 * - actions.set()은 사용자가 Select를 변경할 때만 실행한다.
 * - 일반 초기화 이벤트에서는 Action 값을 읽기만 한다.
 * ========================================================= */
(function ($) {
    "use strict";

    /* =====================================================
     * 설정
     * ===================================================== */
    var CONFIG = {
        targetSelector: ".use-global-page-size",
        interactiveGridSelector: ".a-IG",
        paginationSelector: ".a-GV-pagination, .a-IG-pagination",

        pageSizeWrapperSelector: ".global-ig-page-size",
        pageSizeSelectSelector: ".global-ig-page-size__select",
        temporaryOptionSelector: ".global-ig-page-size__initial-option",

        actionName: "change-rows-per-page",
        eventNamespace: ".globalIgPageSize",

        lazyInitDelay: 200,
        refreshInitDelay: 80,

        /*
         * APEX가 Rows Per Page 변경 후
         * pagination DOM을 여러 번 다시 그릴 수 있으므로
         * 충분한 시간 동안 안정화 여부를 검사한다.
         */
        restoreRetryDelay: 100,
        restoreMaxRetryCount: 20,
        restoreStableCount: 3,

        /*
         * Auto Rows Per Page는 데이터가 없을 때 pageInfo가 null일 수 있다.
         * Master-Detail Refresh 등으로 데이터가 나중에 생성되는 경우까지
         * 실제 pageSize가 확인될 때까지 짧게 재확인한다.
         */
        autoRetryDelay: 100,
        autoRetryMaxCount: 30,
        autoRetryTimerDataKey: "globalIgAutoPageSizeTimer",

        timerDataKey: "globalIgPageSizeTimer",
        savedPageSizeDataKey: "globalIgCurrentPageSize",
        userChangedDataKey: "globalIgPageSizeUserChanged",
        observerDataKey: "globalIgPageSizeObserver"
    };

    (function ($) {

    /* =========================================================
       1. P927 Dialog 종료
       ========================================================= */
    apex.gPageContext$
        .off("apexafterclosedialog.corpSelect")
        .on(
            "apexafterclosedialog.corpSelect",
            function (event, data) {

                /* P927 Dialog만 처리 */
                if (!data || String(data.dialogPageId) !== "927") {
                    return;
                }

                var corpId   = data.P927_W_CORP_ID;
                var corpName = data.P927_W_CORP_NAME;

                console.log("Dialog Return CORP_ID   =", corpId);
                console.log("Dialog Return CORP_NAME =", corpName);

                /* 반환값이 없으면 종료 */
                if (!corpId) {
                    console.log("CORP_ID가 없습니다.");
                    return;
                }

                /*
                 * Page 0 Item 변경
                 * 현재 브라우저의 Item 값 변경
                 */
                apex.item("P0_CORP_ID").setValue(corpId);
                apex.item("P0_CORP_NAME").setValue(corpName);


                /*
                 * 서버 Session State / Application Item 변경
                 *
                 * Application Process:
                 * SET_CORP_CONTEXT
                 */
                apex.server.process(
                    "SET_CORP_CONTEXT",
                    {
                        x01: corpId,
                        x02: corpName
                    },
                    {
                        dataType: "text",

                        success: function (pData) {

                            console.log("Session 저장 완료");
                            console.log("CORP_ID   =", corpId);
                            console.log("CORP_NAME =", corpName);
                            console.log("SERVER    =", pData);

                            /*
                             * 현재 Navigation Bar 메뉴가 이미
                             * DOM에 존재하는 경우 즉시 변경
                             */
                            refreshCorpMenuLabel();
                        },

                        error: function (
                            jqXHR,
                            textStatus,
                            errorThrown
                        ) {

                            console.error(
                                "Session 저장 실패 =",
                                textStatus,
                                errorThrown
                            );

                            console.error(
                                jqXHR.responseText
                            );
                        }
                    }
                );
            }
        );
    /* =========================================================
 * 모든 IG의 ig-lov-output-readonly 컬럼
 * 사용자 직접 수정 방지
 *
 * - 특정 IG Static ID 사용하지 않음
 * - 모든 IG 공통 적용
 * - APEX 이벤트보다 먼저 Capture 단계에서 차단
 * - LOV Additional Outputs의 Model 변경은 허용
 * ========================================================= */
(function () {
    "use strict";

    function isLovOutputReadonlyCell(target) {
        if (!target || !target.closest) {
            return false;
        }

        return !!target.closest(
            ".a-GV-cell.ig-lov-output-readonly"
        );
    }


    /* ---------------------------------------------------------
     * 마우스 / 포인터 입력 차단
     * --------------------------------------------------------- */
    [
        // "pointerdown",
        // "mousedown",
        // "click",
        "dblclick"
    ].forEach(function (eventName) {

        document.addEventListener(
            eventName,
            function (event) {

                if (!isLovOutputReadonlyCell(event.target)) {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
            },
            true    // Capture 단계
        );

    });


    /* ---------------------------------------------------------
     * 키보드 입력 차단
     * --------------------------------------------------------- */
    document.addEventListener(
        "keydown",
        function (event) {

            if (!isLovOutputReadonlyCell(event.target)) {
                return;
            }

            /*
             * Space / Enter
             * Checkbox, Radio 등의 값 변경 방지
             */
            if (
                event.key === " " ||
                event.key === "Enter"
            ) {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
            }
        },
        true
    );

    })();

    /* =========================================================
       2. 현재 생성되어 있는 Navigation DOM 표시값 변경
       ========================================================= */
    function refreshCorpMenuLabel() {

        var corpName =
            apex.item("P0_CORP_NAME").getValue();

        if (!corpName) {
            return;
        }

        var $marker =
            $(".t-NavigationBar-menu .corp_selector_marker");

        console.log(
            "refreshCorpMenuLabel / marker count =",
            $marker.length
        );

        $marker
            .closest(".a-Menu-item")
            .find(".a-Menu-label")
            .text(corpName);
    }


    /* =========================================================
       3. Navigation Bar 메뉴가 열리기 직전
          Menu Model의 Label 자체를 변경
       ========================================================= */
    $(document)
        .off("menubeforeopen.corpMenu")
        .on(
            "menubeforeopen.corpMenu",
            ".t-NavigationBar-menu",
            function (event, ui) {

                var corpName =
                    apex.item("P0_CORP_NAME").getValue();

                if (!corpName) {
                    return;
                }

                console.log(
                    "Navigation beforeOpen / CORP_NAME =",
                    corpName
                );

                /*
                 * APEX Menu Item 데이터가 존재하면
                 * corp_selector_marker가 있는 Item의 label 변경
                 */
                if (
                    ui &&
                    ui.menu &&
                    ui.menu.items
                ) {

                    $.each(
                        ui.menu.items,
                        function (index, item) {

                            if (
                                item.icon &&
                                String(item.icon)
                                    .indexOf(
                                        "corp_selector_marker"
                                    ) >= 0
                            ) {

                                item.label = corpName;

                                console.log(
                                    "Navigation Label 변경 =",
                                    item.label
                                );
                            }
                        }
                    );
                }

                /*
                 * APEX 버전/템플릿에 따라 메뉴 DOM이
                 * 이미 만들어진 경우도 있으므로
                 * DOM도 한번 동기화
                 */
                setTimeout(
                    function () {
                        refreshCorpMenuLabel();
                    },
                    0
                );
            }
        );


})(apex.jQuery);
    

    /* APEX 성공 메시지 3초후 종료. */
    $(document)
    .off("apexafterclosedialog.autoHideSuccess")
    .on(
        "apexafterclosedialog.autoHideSuccess",
        function () {

            setTimeout(function () {
                apex.message.hidePageSuccess();
            }, 10000);

        }
    );

    /* 네비게이션 클릭 이벤트 */
    $(document).on(
    "click",
    "#t_TreeNav .a-TreeView-node.is-expandable > .a-TreeView-content, " +
    "#t_TreeNav .a-TreeView-node.is-collapsible > .a-TreeView-content",
    function (e) {

            e.preventDefault();
            e.stopImmediatePropagation();

            var $toggle = $(this)
                .parent(".a-TreeView-node")
                .children(".a-TreeView-toggle");

            if ($toggle.length) {
                $toggle[0].click();
            }
        }
    );
    /* Navigation Tooltip */
    $(document).on(
        "mouseenter",
        "#t_TreeNav .a-TreeView-content",
        function (e) {

            var label = $(this)
                .find(".a-TreeView-label")
                .text()
                .trim();

            if (!label) {
                return;
            }

            if ($("#navMenuTooltip").length === 0) {
                $("body").append(
                    '<div id="navMenuTooltip" class="nav-menu-tooltip"></div>'
                );
            }

            $("#navMenuTooltip")
                .text(label)
                .css({
                    left: e.pageX + 10,
                    top:  e.pageY + 15
                })
                .show();
        }
    );


    /* 마우스 이동 시 Tooltip 위치 이동 */
    $(document).on(
        "mousemove",
        "#t_TreeNav .a-TreeView-content",
        function (e) {

            $("#navMenuTooltip").css({
                left: e.pageX + 10,
                top:  e.pageY + 15
            });
        }
    );


    /* 메뉴에서 마우스가 벗어나면 숨김 */
    $(document).on(
        "mouseleave",
        "#t_TreeNav .a-TreeView-content",
        function () {

            $("#navMenuTooltip").hide();
        }
    );

    var PAGE_SIZE_OPTIONS = [
        { label: "1", value: 1 },
        { label: "5", value: 5 },
        { label: "10", value: 10 },
        { label: "15", value: 15 },
        { label: "20", value: 20 },
        { label: "30", value: 30 },
        { label: "50", value: 50 },
        { label: "100", value: 100 }
    ];


    /* =====================================================
     * 공통 아이템 처리
     * ===================================================== */
    /**
     * item-readonly Template Option이 적용된
     * Text/서술형 아이템을 HTML readonly 상태로 변경한다.
     */
    function applyReadOnlyItems(root) {
        var root$ = $(root || document);
        var containers$ = $();

        if (root$.is(".item-readonly")) {
            containers$ = containers$.add(root$);
        }

        containers$ = containers$
            .add(root$.closest(".item-readonly"))
            .add(root$.find(".item-readonly"));
        /* Text/ Textarea */
        containers$
            .find(
                "input.apex-item-text, " +
                "textarea.apex-item-textarea"
            )
            .prop("readonly", true);


        /* Date Picker */
        containers$
        .find("input.apex-item-datepicker")
        .prop("readonly", true);

        containers$
        .find(".a-Button--calendar")
        .prop("disabled", true)
        .attr("aria-disabled", "true")
        .attr("tabindex", "-1");        

        /* Check Box */
         /* Checkbox */
        containers$
            .find('input[type="checkbox"]')
            .attr("aria-disabled", "true")
            .attr("tabindex", "-1");    
    }
/* =========================================================
 * item-readonly Date Picker Popup 차단
 * ========================================================= */
    (function () {
        "use strict";
            function isReadOnlyDatePicker(target) {
                if (!target || !target.closest) {
                    return false;
                }
                return !!target.closest(
                    ".item-readonly input.apex-item-datepicker, " +
                    ".item-readonly .a-Button--calendar"
                );
            }

    /*
     * Date Picker를 여는 마우스 이벤트 차단
     */
        ["pointerdown",
         "mousedown",
         "click",
         "dblclick"
        ].forEach(function (eventName) {
            document.addEventListener(
            eventName,
            function (event) {

                if (!isReadOnlyDatePicker(event.target)) {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
            },
            true
        );

        });


    /*
     * 키보드로 Date Picker 여는 것도 차단
     */
    document.addEventListener(
        "keydown",
        function (event) {

            if (!isReadOnlyDatePicker(event.target)) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
        },
        true
    );

    })();
    /* =========================================================
    * item-readonly Checkbox 수정 차단
    * - 기존 체크값은 유지
    * - 마우스 클릭 차단
    * - Space / Enter 차단
    * - disabled는 사용하지 않음
    * ========================================================= */
    (function () {
        "use strict";

        function isReadOnlyCheckbox(target) {

            if (!target || !target.closest) {
                return false;
            }

            var container = target.closest(".item-readonly");

            if (!container) {
                return false;
            }

            return !!container.querySelector(
                'input[type="checkbox"]'
            );
        }


        /*
        * 마우스 체크/해제 방지
        */
        [
            "pointerdown",
            "mousedown",
            "click",
            "dblclick"
        ].forEach(function (eventName) {

            document.addEventListener(
                eventName,
                function (event) {

                    if (!isReadOnlyCheckbox(event.target)) {
                        return;
                    }

                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                },
                true
            );

        });


        /*
        * Space / Enter에 의한 체크 변경 방지
        */
        document.addEventListener(
            "keydown",
            function (event) {

                if (!isReadOnlyCheckbox(event.target)) {
                    return;
                }

                if (
                    event.key === " " ||
                    event.key === "Enter"
                ) {
                    event.preventDefault();
                    event.stopPropagation();
                    event.stopImmediatePropagation();
                }
            },
            true
        );

    })();
    
    /* Save 버튼 삭제 추가 */
    function hideInteractiveGridSaveButtons(root) {
        var root$ = $(root || document);

        if (root$.is(".a-IG")) {
            root$
                .find(
                    'button[data-action="save"], ' +
                    '.a-Toolbar-item[data-action="save"]'
                )
                .hide();
        }

        root$
            .find(".a-IG")
            .find(
                'button[data-action="save"], ' +
                '.a-Toolbar-item[data-action="save"]'
            )
            .hide();
    }

    /* =====================================================
     * Page Size 값 유틸리티
     * ===================================================== */

    function isEmptyPageSize(value) {
        var normalizedValue;

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return true;
        }

        normalizedValue = String(value)
            .trim()
            .toLowerCase();

        return (
            normalizedValue === "null" ||
            normalizedValue === "undefined" ||
            normalizedValue === "nan"
        );
    }


    function isValidPageSize(value) {
        var numericValue;

        if (isEmptyPageSize(value)) {
            return false;
        }

        numericValue = Number(value);

        return (
            Number.isFinite(numericValue) &&
            numericValue > 0
        );
    }


    function isAutoPageSize(value) {
        var normalizedValue;

        if (
            value === null ||
            value === undefined ||
            value === ""
        ) {
            return true;
        }

        normalizedValue = String(value)
            .trim()
            .toLowerCase();

        return (
            normalizedValue === "0" ||
            normalizedValue === "auto" ||
            normalizedValue === "automatic"
        );
    }


    function isStandardPageSize(value) {
        return PAGE_SIZE_OPTIONS.some(function (option) {
            return String(option.value) === String(value);
        });
    }


    /* =====================================================
     * 대상 Region 탐색
     * ===================================================== */

    /**
     * 전달받은 요소 자체 / 부모 / 자식에서
     * .use-global-page-size Region을 찾는다.
     */
    function getTargetRegions(root) {
        var root$ = $(root || document);
        var regions$ = $();

        if (root$.is(CONFIG.targetSelector)) {
            regions$ = regions$.add(root$);
        }

        regions$ = regions$
            .add(root$.closest(CONFIG.targetSelector))
            .add(root$.find(CONFIG.targetSelector));

        return regions$;
    }


    function getInteractiveGrid(region$) {
        return region$
            .filter(CONFIG.interactiveGridSelector)
            .add(region$.find(CONFIG.interactiveGridSelector))
            .first();
    }


    function findPagination(region$) {
        return region$
            .find(CONFIG.paginationSelector)
            .first();
    }


    /* =====================================================
     * 현재 Page Size 결정
     * ===================================================== */

    /**
     * Pagination 문구로부터 현재 화면에 표시된 건수를 구한다.
     *
     * 단, "현재 화면에 보이는 건수"와
     * "Rows Per Page 설정값"은 동일하지 않을 수 있다.
     *
     * 따라서 이 값은 최초 로딩 시 fallback 용도로만 사용한다.
     */
    function getRenderedPageSize(region$) {
        var ig$;
        var gridView;
        var pageInfo;
        var pageSize;
        var pagination$;
        var paginationText;
        var match;
        var startRow;
        var endRow;


        /*
         * 1. APEX Grid API에서 실제 pageSize 조회
         *
         * Rows Per Page가 Auto이면 rowsPerPage 옵션 자체는 null/0 성격일 수 있지만,
         * 데이터가 존재하는 시점의 getPageInfo().pageSize에는
         * 현재 Grid가 한 페이지에 요청/렌더링하는 실제 건수가 들어온다.
         *
         * No data 상태에서는 getPageInfo()가 null일 수 있으므로
         * 아래 Footer fallback 및 recoverAutoPageSize 재시도로 보완한다.
         */
        try {
            ig$ = getInteractiveGrid(region$);

            if (ig$.length) {
                gridView = ig$.interactiveGrid(
                    "getViews",
                    "grid"
                );

                if (
                    gridView &&
                    gridView.view$ &&
                    gridView.view$.length
                ) {
                    pageInfo = gridView.view$.grid(
                        "getPageInfo"
                    );

                    if (pageInfo) {
                        pageSize = Number(
                            pageInfo.pageSize
                        );

                        if (
                            Number.isFinite(pageSize) &&
                            pageSize > 0
                        ) {
                            return String(pageSize);
                        }
                    }
                }
            }
        } catch (error) {
            console.warn(
                "[Rows Per Page] getPageInfo 조회 실패:",
                error
            );
        }


        /*
         * 2. Footer 문자열 fallback
         *
         * 예:
         * 1 - 17 of 22
         * 1 - 5 of 6
         *
         * 첫 페이지에서만 사용한다.
         */
        pagination$ =
            findPagination(region$);

        if (!pagination$.length) {
            return null;
        }

        paginationText = pagination$
            .text()
            .replace(/\s+/g, " ")
            .trim();

        match = paginationText.match(
            /(\d[\d,]*)\s*-\s*(\d[\d,]*)/
        );

        if (!match) {
            return null;
        }

        startRow = parseInt(
            match[1].replace(/,/g, ""),
            10
        );

        endRow = parseInt(
            match[2].replace(/,/g, ""),
            10
        );

        if (
            Number.isNaN(startRow) ||
            Number.isNaN(endRow) ||
            endRow < startRow
        ) {
            return null;
        }

        if (startRow !== 1) {
            return null;
        }

        return String(
            endRow - startRow + 1
        );
    }


    function saveCurrentPageSize(region$, value) {
        if (!isValidPageSize(value)) {
            return;
        }

        region$.data(
            CONFIG.savedPageSizeDataKey,
            String(value)
        );
    }


    function getSavedPageSize(region$) {
        return region$.data(
            CONFIG.savedPageSizeDataKey
        );
    }


    function setUserChangedPageSize(region$, changed) {
        region$.data(
            CONFIG.userChangedDataKey,
            changed === true
        );
    }


    function hasUserChangedPageSize(region$) {
        return (
            region$.data(
                CONFIG.userChangedDataKey
            ) === true
        );
    }


    function getActionPageSize(actions) {
        try {
            return actions.get(CONFIG.actionName);
        } catch (error) {
            return null;
        }
    }


    /**
     * Select에 표시할 Rows Per Page 값 결정
     *
     * 우선순위
     * 1. 강제 전달값
     * 2. APEX Action 실제값
     * 3. Region에 저장해 둔 사용자 선택값
     * 4. 최초 화면의 pagination 문구
     * 5. 알 수 없으면 0
     */
    function resolveCurrentPageSize(
        region$,
        actions,
        forcedPageSize
    ) {
        var actionPageSize;
        var savedPageSize;
        var renderedPageSize;
        var userChanged =
            hasUserChangedPageSize(region$);


        /*
         * 1. 사용자가 방금 Select에서 선택한 값
         */
        if (isValidPageSize(forcedPageSize)) {
            return {
                value: String(forcedPageSize),
                isInitialTemporary: false
            };
        }


        /*
         * 2. APEX Action 실제값
         *
         * Auto인 경우 0 / null / auto 성격의 값일 수 있으므로
         * 고정 Page Size일 때만 그대로 사용한다.
         */
        actionPageSize =
            getActionPageSize(actions);

        if (
            !isAutoPageSize(actionPageSize) &&
            isValidPageSize(actionPageSize)
        ) {
            return {
                value: String(actionPageSize),
                isInitialTemporary: false
            };
        }


        /*
         * 3. 사용자가 이전에 직접 변경한 값
         */
        savedPageSize =
            getSavedPageSize(region$);

        if (
            userChanged &&
            isValidPageSize(savedPageSize)
        ) {
            return {
                value: String(savedPageSize),
                isInitialTemporary: false
            };
        }


        /*
         * 4. Auto 상태의 실제 렌더링 Page Size
         *
         * pageInfo.pageSize를 우선 사용하고,
         * 불가능하면 Footer 문자열을 fallback으로 사용한다.
         */
        renderedPageSize =
            getRenderedPageSize(region$);

        if (isValidPageSize(renderedPageSize)) {
            return {
                value: String(renderedPageSize),
                isInitialTemporary:
                    !isStandardPageSize(
                        renderedPageSize
                    )
            };
        }


        /*
         * 5. 아직 No data / 렌더링 전이면 임시 Auto 상태
         */
        return {
            value: "0",
            isInitialTemporary: true
        };
    }


    /* =====================================================
     * Select 옵션 및 레이아웃
     * ===================================================== */

    function applyPageSizeLayout(
        pagination$,
        pageSize$
    ) {
        if (
            !pagination$ ||
            !pagination$.length ||
            !pageSize$ ||
            !pageSize$.length
        ) {
            return;
        }

        /*
         * 이미 올바른 위치이면 이동하지 않는다.
         */
        if (
            pagination$.next()[0] ===
            pageSize$[0]
        ) {
            return;
        }

        pageSize$.insertAfter(pagination$);
    }


    function ensurePageSizeOption(
        select$,
        pageSize,
        initialTemporary
    ) {
        var option$;

        if (
            !select$ ||
            !select$.length ||
            !isValidPageSize(pageSize)
        ) {
            return;
        }

        option$ = select$
            .find("option")
            .filter(function () {
                return (
                    String(this.value) ===
                    String(pageSize)
                );
            })
            .first();

        /*
         * 이미 존재하는 옵션
         */
        if (option$.length) {
            if (initialTemporary) {
                option$.addClass(
                    CONFIG
                        .temporaryOptionSelector
                        .substring(1)
                );
            }

            return;
        }

        /*
         * PAGE_SIZE_OPTIONS에 없는 초기값
         * 예: APEX 기본 7 rows
         */
        option$ = $("<option>", {
            value: String(pageSize),
            text: String(pageSize)
        });

        if (initialTemporary) {
            option$.addClass(
                CONFIG
                    .temporaryOptionSelector
                    .substring(1)
            );
        }

        option$.prependTo(select$);
    }


    function removeInitialTemporaryOptions(
        select$,
        keepValue
    ) {
        select$
            .find(
                CONFIG.temporaryOptionSelector
            )
            .filter(function () {
                return (
                    String(this.value) !==
                    String(keepValue)
                );
            })
            .remove();
    }


    function syncPageSizeSelect(
        region$,
        actions,
        forcedPageSize
    ) {
        var select$ = region$
            .find(
                CONFIG.pageSizeSelectSelector
            )
            .first();

        var resolved;
        var currentPageSize;

        if (!select$.length) {
            return;
        }

        resolved = resolveCurrentPageSize(
            region$,
            actions,
            forcedPageSize
        );

        currentPageSize = resolved.value;

        /*
         * 사용자가 값을 직접 변경했거나
         * 정규 옵션 중 하나이면 초기 임시 옵션 제거
         */
        if (
            hasUserChangedPageSize(region$) ||
            isStandardPageSize(currentPageSize)
        ) {
            select$
                .find(
                    CONFIG
                        .temporaryOptionSelector
                )
                .remove();
        }

        ensurePageSizeOption(
            select$,
            currentPageSize,
            resolved.isInitialTemporary
        );

        select$.val(
            String(currentPageSize)
        );

        if (!resolved.isInitialTemporary) {
            saveCurrentPageSize(
                region$,
                currentPageSize
            );
        }
    }


    /* =====================================================
     * Rows Per Page UI 생성
     * ===================================================== */

    function createPageSizeSelect(
        regionElement,
        region$,
        actions,
        currentPageSize,
        isInitialTemporary
    ) {
        var wrapper$ = $("<div>", {
            class:
                CONFIG
                    .pageSizeWrapperSelector
                    .substring(1)
        });

        var select$ = $("<select>", {
            class:
                CONFIG
                    .pageSizeSelectSelector
                    .substring(1),

            title:
                "한 페이지에 표시할 행 수",

            "aria-label":
                "한 페이지 표시 건수"
        });


        /*
         * 기본 Rows Per Page 옵션
         */
        PAGE_SIZE_OPTIONS.forEach(
            function (option) {
                $("<option>", {
                    value:
                        String(option.value),
                    text:
                        option.label
                }).appendTo(select$);
            }
        );


        /*
         * APEX의 초기 page size가
         * 7, 25 등 사용자 정의 옵션에 없다면
         * 임시 옵션을 만든다.
         */
        if (
            isInitialTemporary &&
            isValidPageSize(currentPageSize)
        ) {
            ensurePageSizeOption(
                select$,
                currentPageSize,
                true
            );
        }


        /*
         * 현재값을 전혀 알아낼 수 없을 때
         */
        if (currentPageSize === "0") {
            $("<option>", {
                value: "0",
                text: "Auto",
                disabled: true,
                class:
                    CONFIG
                        .temporaryOptionSelector
                        .substring(1)
            }).prependTo(select$);
        }


        select$.val(
            String(currentPageSize)
        );


        /*
         * 사용자가 Rows Per Page 변경
         */
        select$.on(
            "change" +
                CONFIG.eventNamespace,

            function () {
                var selectedValue =
                    String(this.value);

                if (
                    !isValidPageSize(
                        selectedValue
                    )
                ) {
                    return;
                }

                /*
                 * 사용자가 선택했다는 상태 저장
                 */
                setUserChangedPageSize(
                    region$,
                    true
                );

                saveCurrentPageSize(
                    region$,
                    selectedValue
                );

                select$.val(selectedValue);

                removeInitialTemporaryOptions(
                    select$,
                    selectedValue
                );


                try {
                    /*
                     * APEX 공식 IG Action 호출
                     */
                    actions.set(
                        CONFIG.actionName,
                        selectedValue
                    );

                    console.log(
                        "[Rows Per Page] 변경 완료:",
                        selectedValue
                    );

                    /*
                     * APEX가 pagination DOM을
                     * 재생성할 수 있으므로 복구 감시
                     */
                    restorePageSizeControl(
                        regionElement,
                        selectedValue
                    );

                } catch (error) {
                    console.error(
                        "[Rows Per Page] 변경 실패:",
                        error
                    );

                    syncPageSizeSelect(
                        region$,
                        actions
                    );
                }
            }
        );


        select$.appendTo(wrapper$);

        return wrapper$;
    }


    /**
     * 하나의 대상 Region에
     * Rows Per Page UI 생성 또는 동기화
     */
    function initializeRegion(
        regionElement,
        forcedPageSize
    ) {
        var region$ =
            $(regionElement);

        var ig$ =
            getInteractiveGrid(region$);

        var pagination$;
        var actions;
        var rowsPerPageAction;
        var wrapper$;
        var resolved;
        var currentPageSize;


        if (!ig$.length) {
            return;
        }


        pagination$ =
            findPagination(region$);

        /*
         * 아직 IG pagination이 만들어지지 않았다면
         * 다음 이벤트/재시도에서 처리
         */
        if (!pagination$.length) {
            return;
        }


        try {
            actions =
                ig$.interactiveGrid(
                    "getActions"
                );

            rowsPerPageAction =
                actions.lookup(
                    CONFIG.actionName
                );

        } catch (error) {
            console.error(
                "[Rows Per Page] " +
                "Actions 조회 실패:",
                error
            );

            return;
        }


        if (!rowsPerPageAction) {
            console.warn(
                "[Rows Per Page] " +
                CONFIG.actionName +
                " Action을 찾지 못했습니다."
            );

            return;
        }


        /*
         * 기존 UI 존재 여부 확인
         */
        wrapper$ = region$
            .find(
                CONFIG
                    .pageSizeWrapperSelector
            )
            .first();


        /*
         * 이미 존재하면 위치만 재확인하고 값 동기화
         */
        if (wrapper$.length) {
            applyPageSizeLayout(
                pagination$,
                wrapper$
            );

            syncPageSizeSelect(
                region$,
                actions,
                forcedPageSize
            );

            ensureRegionObserver(
                regionElement
            );

            return;
        }


        /*
         * 현재 page size 결정
         */
        resolved =
            resolveCurrentPageSize(
                region$,
                actions,
                forcedPageSize
            );

        currentPageSize =
            resolved.value;


        if (!resolved.isInitialTemporary) {
            saveCurrentPageSize(
                region$,
                currentPageSize
            );
        }


        /*
         * UI 생성
         */
        wrapper$ =
            createPageSizeSelect(
                regionElement,
                region$,
                actions,
                currentPageSize,
                resolved.isInitialTemporary
            );


        /*
         * Pagination 바로 뒤에 삽입
         */
        applyPageSizeLayout(
            pagination$,
            wrapper$
        );


        /*
         * APEX DOM 재렌더링 감시 시작
         */
        ensureRegionObserver(
            regionElement
        );


        console.log(
            "[Rows Per Page] UI 생성 완료:",
            currentPageSize,
            resolved.isInitialTemporary
                ? "(초기 임시값)"
                : ""
        );
    }


    /* =====================================================
     * APEX 재렌더링 후 Rows Per Page 복구
     * ===================================================== */

    /**
     * APEX가 Rows Per Page 변경 후
     * pagination DOM을 여러 번 다시 그릴 수 있다.
     *
     * pagination DOM이 일정 횟수 안정될 때까지
     * 반복 확인하여 Select가 삭제되면 재생성한다.
     */
    function restorePageSizeControl(
        regionElement,
        selectedValue
    ) {
        var region$ =
            $(regionElement);

        var retryCount = 0;
        var stableCount = 0;
        var lastPaginationElement = null;


        function retry() {
            var pagination$;
            var pageSize$;
            var ig$;
            var actions;
            var currentPaginationElement;


            retryCount += 1;

            pagination$ =
                findPagination(region$);


            /*
             * pagination이 아직 없다면 계속 대기
             */
            if (!pagination$.length) {
                stableCount = 0;
                lastPaginationElement = null;

                if (
                    retryCount <
                    CONFIG.restoreMaxRetryCount
                ) {
                    window.setTimeout(
                        retry,
                        CONFIG.restoreRetryDelay
                    );
                }

                return;
            }


            currentPaginationElement =
                pagination$[0];


            /*
             * 동일 pagination DOM이
             * 연속해서 유지되는지 검사
             */
            if (
                lastPaginationElement ===
                currentPaginationElement
            ) {
                stableCount += 1;
            } else {
                lastPaginationElement =
                    currentPaginationElement;

                stableCount = 0;
            }


            pageSize$ = region$
                .find(
                    CONFIG
                        .pageSizeWrapperSelector
                )
                .first();


            /*
             * APEX 렌더링에 의해
             * Rows Per Page UI가 삭제됐으면 재생성
             */
            if (!pageSize$.length) {
                initializeRegion(
                    regionElement,
                    selectedValue
                );

                /*
                 * 방금 새로 생성했으므로
                 * 안정성 체크를 다시 시작한다.
                 */
                stableCount = 0;

            } else {

                /*
                 * 존재하면 pagination 뒤 위치 보정
                 */
                applyPageSizeLayout(
                    pagination$,
                    pageSize$
                );


                ig$ =
                    getInteractiveGrid(region$);


                try {
                    actions =
                        ig$.interactiveGrid(
                            "getActions"
                        );
                } catch (error) {
                    actions = null;
                }


                if (actions) {
                    syncPageSizeSelect(
                        region$,
                        actions,
                        selectedValue
                    );
                }
            }


            /*
             * pagination DOM이 일정 횟수
             * 안정될 때까지 확인
             */
            if (
                retryCount <
                    CONFIG.restoreMaxRetryCount &&
                stableCount <
                    CONFIG.restoreStableCount
            ) {
                window.setTimeout(
                    retry,
                    CONFIG.restoreRetryDelay
                );
            }
        }


        window.setTimeout(
            retry,
            CONFIG.restoreRetryDelay
        );
    }


    /* =====================================================
     * Auto Rows Per Page 복구
     * ===================================================== */

    /**
     * 최초 No data 상태이거나 Refresh 직후 Grid 내부 렌더링이
     * 아직 끝나지 않은 경우 getPageInfo()가 null일 수 있다.
     *
     * 데이터가 나중에 생성되는 Master-Detail IG까지 대응하기 위해
     * 실제 Page Size가 확인될 때까지 짧은 간격으로 재확인한다.
     *
     * 사용자가 커스텀 Select에서 고정값을 직접 선택한 경우에는
     * Auto 복구를 즉시 중단한다.
     */
    function recoverAutoPageSize(
        regionElement
    ) {
        var region$ =
            $(regionElement);

        var oldTimer =
            region$.data(
                CONFIG.autoRetryTimerDataKey
            );

        var retryCount = 0;


        if (oldTimer) {
            window.clearTimeout(
                oldTimer
            );

            region$.removeData(
                CONFIG.autoRetryTimerDataKey
            );
        }


        function finish() {
            region$.removeData(
                CONFIG.autoRetryTimerDataKey
            );
        }


        function scheduleNext() {
            var timer;

            if (
                retryCount >=
                    CONFIG.autoRetryMaxCount
            ) {
                finish();
                return;
            }

            timer = window.setTimeout(
                retry,
                CONFIG.autoRetryDelay
            );

            region$.data(
                CONFIG.autoRetryTimerDataKey,
                timer
            );
        }


        function retry() {
            var renderedPageSize;
            var select$;
            var isTemporary;

            retryCount += 1;


            /*
             * 사용자가 5/10/15/... 중 하나를 직접 선택했다면
             * Auto 계산값으로 덮어쓰지 않는다.
             */
            if (
                hasUserChangedPageSize(region$)
            ) {
                finish();
                return;
            }


            renderedPageSize =
                getRenderedPageSize(region$);


            if (
                !isValidPageSize(
                    renderedPageSize
                )
            ) {
                scheduleNext();
                return;
            }


            select$ = region$
                .find(
                    CONFIG.pageSizeSelectSelector
                )
                .first();


            /*
             * Select가 아직 생성되지 않았다면 먼저 초기화하고
             * 다음 Retry에서 실제 값을 반영한다.
             */
            if (!select$.length) {
                initializeRegion(
                    regionElement
                );

                scheduleNext();
                return;
            }


            /*
             * 기존 Auto/이전 임시값 제거
             */
            removeInitialTemporaryOptions(
                select$,
                renderedPageSize
            );

            select$
                .find('option[value="0"]')
                .remove();


            isTemporary =
                !isStandardPageSize(
                    renderedPageSize
                );


            ensurePageSizeOption(
                select$,
                renderedPageSize,
                isTemporary
            );


            select$.val(
                String(renderedPageSize)
            );


            console.log(
                "[Rows Per Page] Auto Page Size 확인:",
                renderedPageSize
            );


            finish();
        }


        scheduleNext();
    }


    /* =====================================================
     * MutationObserver
     * ===================================================== */

    /**
     * APEX가 pagination을 예상보다 늦게 다시 그리는 경우까지
     * 대응하기 위해 Region DOM 변경을 감시한다.
     *
     * observer callback에서 직접 initializeRegion을
     * 즉시 반복 호출하지 않고 scheduleInitialize로 debounce한다.
     */
    function ensureRegionObserver(
        regionElement
    ) {
        var region$ =
            $(regionElement);

        var oldObserver =
            region$.data(
                CONFIG.observerDataKey
            );

        var observer;


        /*
         * 이미 Observer가 있으면 중복 생성하지 않는다.
         */
        if (oldObserver) {
            return;
        }


        /*
         * 구형 브라우저 방어
         */
        if (
            typeof MutationObserver ===
            "undefined"
        ) {
            return;
        }


        observer =
            new MutationObserver(
                function (mutations) {
                    var relevantChange = false;
                    var pagination$;
                    var pageSize$;
                    var pageSizeSelect$;
                    var currentSelectValue;
                    var renderedPageSize;


                    mutations.some(
                        function (mutation) {
                            var target$ =
                                $(mutation.target);


                            /*
                             * pagination / Grid Body / Footer가 변경된 경우
                             */
                            if (
                                target$.closest(
                                    ".a-GV, .a-IG"
                                ).length
                            ) {
                                relevantChange = true;
                                return true;
                            }

                            return false;
                        }
                    );


                    if (!relevantChange) {
                        return;
                    }


                    pagination$ =
                        findPagination(region$);

                    pageSize$ = region$
                        .find(
                            CONFIG.pageSizeWrapperSelector
                        )
                        .first();

                    pageSizeSelect$ = region$
                        .find(
                            CONFIG.pageSizeSelectSelector
                        )
                        .first();

                    currentSelectValue =
                        pageSizeSelect$.length
                            ? String(
                                pageSizeSelect$.val() || ""
                              )
                            : "";


                    /*
                     * 사용자가 직접 값을 선택하지 않은 Auto 상태에서만
                     * 실제 렌더링 Page Size와 Select 값을 비교한다.
                     */
                    renderedPageSize =
                        hasUserChangedPageSize(region$)
                            ? null
                            : getRenderedPageSize(
                                region$
                              );


                    if (
                        pagination$.length &&
                        (
                            !pageSize$.length ||
                            pagination$.next()[0] !==
                                pageSize$[0] ||
                            currentSelectValue === "0" ||
                            (
                                isValidPageSize(
                                    renderedPageSize
                                ) &&
                                String(renderedPageSize) !==
                                    currentSelectValue
                            )
                        )
                    ) {
                        scheduleInitialize(
                            regionElement,
                            CONFIG.refreshInitDelay
                        );
                    }
                }
            );


        observer.observe(
            regionElement,
            {
                childList: true,
                subtree: true,
                characterData: true
            }
        );


        region$.data(
            CONFIG.observerDataKey,
            observer
        );
    }


    /* =====================================================
     * 재초기화 및 지연 초기화
     * ===================================================== */

    /**
     * 전달 범위 내 모든 대상 Region 초기화
     */
    function initializeRegions(root) {
        getTargetRegions(root)
            .each(function () {
                initializeRegion(this);
            });
    }


    /**
     * 동일 Region에 연속해서 발생하는
     * 초기화 요청을 하나로 합친다.
     */
    function scheduleInitialize(
        root,
        delay
    ) {
        getTargetRegions(root)
            .each(function () {
                var regionElement =
                    this;

                var region$ =
                    $(regionElement);

                var oldTimer =
                    region$.data(
                        CONFIG.timerDataKey
                    );

                var actualDelay =
                    (
                        delay === undefined ||
                        delay === null
                    )
                        ? CONFIG.refreshInitDelay
                        : Number(delay);


                if (oldTimer) {
                    window.clearTimeout(
                        oldTimer
                    );
                }


                region$.data(
                    CONFIG.timerDataKey,

                    window.setTimeout(
                        function () {
                            region$.removeData(
                                CONFIG.timerDataKey
                            );

                            initializeRegion(
                                regionElement
                            );

                            /*
                             * No data -> Data 존재 상태 또는
                             * Refresh 직후 늦은 Grid 렌더링까지 대응
                             */
                            recoverAutoPageSize(
                                regionElement
                            );
                        },
                        actualDelay
                    )
                );
            });
    }


    /* =====================================================
     * 초기 실행
     * ===================================================== */

    function initializeOnPageLoad() {
        console.log(
            "[Rows Per Page] 초기화 시작"
        );


        applyReadOnlyItems(document);

        // 모든 IG Save 버튼 숨김
        hideInteractiveGridSaveButtons(document);

        initializeRegions(document);


        /*
         * 최초 Auto Page Size 확인
         */
        getTargetRegions(document)
            .each(function () {
                recoverAutoPageSize(
                    this
                );
            });


        /*
         * APEX IG가 늦게 초기화되는 경우 대응
         */
        window.setTimeout(
            function () {
                applyReadOnlyItems(document);

                // 늦게 생성된 Toolbar까지 처리
                hideInteractiveGridSaveButtons(document);

                initializeRegions(document);

                getTargetRegions(document)
                    .each(function () {
                        recoverAutoPageSize(
                            this
                        );
                    });
            },
            CONFIG.lazyInitDelay
        );
    }


    /* =====================================================
     * APEX 이벤트
     * ===================================================== */

    function registerEvents() {

        $(document)
            .off(CONFIG.eventNamespace)


            /*
             * Region Refresh 이후
             */
            .on(
                "apexafterrefresh" +
                    CONFIG.eventNamespace,

                function (event) {

                    applyReadOnlyItems(
                        event.target
                    );

                    // Refresh 후 다시 생성된 IG Save 버튼 숨김
                    hideInteractiveGridSaveButtons(
                        event.target
                    );
                    
                    scheduleInitialize(
                        event.target,
                        CONFIG.refreshInitDelay
                    );
                }
            )


            /*
             * IG Grid / Chart 등의 View 변경
             */
            .on(
                "interactivegridviewchange" +
                    CONFIG.eventNamespace,

                function (event) {

                    scheduleInitialize(
                        event.target,
                        CONFIG.refreshInitDelay
                    );
                }
            );


        /*
         * 브라우저 높이 변경 시 Auto Page Size가 달라질 수 있으므로 재확인
         */
        $(window)
            .off(
                "resize" +
                    CONFIG.eventNamespace
            )
            .on(
                "resize" +
                    CONFIG.eventNamespace,
                function () {
                    scheduleInitialize(
                        document,
                        CONFIG.refreshInitDelay
                    );
                }
            );


        /*
         * 중요:
         *
         * interactivegridselectionchange 이벤트는
         * Rows Per Page와 무관하므로 사용하지 않는다.
         *
         * 행을 체크하거나 선택할 때마다
         * initializeRegion이 호출되는 문제 방지.
         */
    }


    /* =====================================================
     * 시작점
     * ===================================================== */

    function init() {
        registerEvents();

        $(initializeOnPageLoad);
    }


    init();

})(apex.jQuery);

/* =========================================================
 * Global Bookmark Tree Popup
 *
 * 적용 대상
 * ---------------------------------------------------------
 * Tree Region Static ID:
 * BookMarkTree
 *
 * Navigation Bar URL Target:
 * javascript:showBookmark();
 *
 * 주요 기능
 * ---------------------------------------------------------
 * 1. 최초 페이지 로드 시 북마크 Tree 숨김
 * 2. Book Mark List 클릭 시 Tree 표시
 * 3. Book Mark List 버튼 바로 아래에 위치
 * 4. 다시 클릭하면 닫기
 * 5. Tree가 열릴 때 Region Refresh
 * 6. 외부 영역 클릭 시 닫기
 * 7. ESC 입력 시 닫기
 * 8. 브라우저 크기 변경 시 위치 재계산
 * 9. Tree Refresh 이후 위치 재계산
 * ========================================================= */
(function ($) {
    "use strict";

    /*
     * Tree Region의 Static ID
     */
    var TREE_REGION_ID = "BookMarkTree";

    /*
     * Tree Region jQuery Selector
     */
    var TREE_SELECTOR = "#" + TREE_REGION_ID;

    /*
     * 이벤트 중복 등록 방지용 Namespace
     */
    var EVENT_NAMESPACE = ".globalBookmarkTree";


    /* =====================================================
     * Navigation Bar의 Book Mark 버튼 조회
     * ===================================================== */
    function getBookmarkTrigger() {
        var directTrigger;
        var links;
        var i;
        var label;
        var title;
        var ariaLabel;

        /*
         * Navigation Bar의 URL Target이
         * javascript:showBookmark();이면 가장 먼저 검색된다.
         */
        directTrigger = document.querySelector(
            'a[href*="showBookmark"]'
        );

        if (directTrigger) {
            return directTrigger;
        }

        /*
         * href 기준으로 찾지 못한 경우
         * Navigation Bar의 문구를 기준으로 찾는다.
         */
        links = document.querySelectorAll(
            ".t-NavigationBar a, " +
            ".t-NavigationBar-item a, " +
            "a"
        );

        for (i = 0; i < links.length; i += 1) {
            label = String(
                links[i].textContent || ""
            )
                .replace(/\s+/g, " ")
                .trim();

            title = String(
                links[i].getAttribute("title") || ""
            ).trim();

            ariaLabel = String(
                links[i].getAttribute("aria-label") || ""
            ).trim();

            if (
                label === "Book Mark List" ||
                label === "Book Mark" ||
                title === "Book Mark List" ||
                title === "Book Mark" ||
                ariaLabel === "Book Mark List" ||
                ariaLabel === "Book Mark"
            ) {
                return links[i];
            }
        }

        return null;
    }


    /* =====================================================
     * Tree Region DOM 반환
     * ===================================================== */
    function getBookmarkTreeElement() {
        return document.getElementById(
            TREE_REGION_ID
        );
    }


    /* =====================================================
     * Tree Region 표시 여부
     * ===================================================== */
    function isBookmarkTreeVisible() {
        var treeElement =
            getBookmarkTreeElement();

        return (
            treeElement !== null &&
            $(treeElement).is(":visible")
        );
    }


    /* =====================================================
     * Tree Region을 Book Mark 버튼 하단으로 이동
     *
     * 위치 기준
     * -----------------------------------------------------
     * Tree 오른쪽 끝과 Book Mark 버튼 오른쪽 끝을 맞춘다.
     * ===================================================== */
     /**
     * 북마크 Tree를 Book Mark List 버튼 바로 아래에 배치한다.
     */
/**
 * BookMarkTree를 Navigation Bar 버튼 바로 아래에 배치한다.
 */
function positionBookmarkTree() {
        var treeElement =
            document.getElementById("BookMarkTree");

        var triggerElement =
            getBookmarkTrigger();

        var triggerRect;
        var treeWidth;
        var left;
        var top;
        var viewportWidth;
        var edgeGap = 8;
        var verticalGap = 2;

        if (!treeElement) {
            console.error(
                "[Bookmark] BookMarkTree Region을 찾을 수 없습니다."
            );
            return;
        }

        if (!triggerElement) {
            console.error(
                "[Bookmark] Book Mark List 버튼을 찾을 수 없습니다."
            );
            return;
        }

        /*
        * 반드시 실제 클릭 대상인 a 태그를 기준으로 계산한다.
        */
        if (
            triggerElement.tagName &&
            triggerElement.tagName.toLowerCase() !== "a"
        ) {
            triggerElement =
                triggerElement.closest("a") ||
                triggerElement;
        }

        /*
        * 중요:
        * Breadcrumb Bar나 Grid 컨테이너의 영향을 받지 않도록
        * Tree Region을 body 바로 아래로 이동한다.
        */
        if (treeElement.parentElement !== document.body) {
            document.body.appendChild(treeElement);
        }

        triggerRect =
            triggerElement.getBoundingClientRect();

        treeWidth =
            treeElement.getBoundingClientRect().width ||
            treeElement.offsetWidth ||
            300;

        viewportWidth =
            window.innerWidth ||
            document.documentElement.clientWidth;

        /*
        * 버튼 오른쪽과 Tree 왼쪽으로 맞춘다.
        */
        left =
            triggerRect.left

        /*
        * 실제 Book Mark List 버튼 바로 아래
        */
        top =
            triggerRect.bottom +
            verticalGap;

        /*
        * 화면 좌우 영역 보정
        */
        left = Math.max(
            edgeGap,
            left
        );

        left = Math.min(
            left,
            viewportWidth -
            treeWidth -
            edgeGap
        );

        /*
        * 최종 위치 적용
        */
        treeElement.style.setProperty(
            "position",
            "fixed",
            "important"
        );

        treeElement.style.setProperty(
            "left",
            Math.round(left) + "px",
            "important"
        );

        treeElement.style.setProperty(
            "top",
            Math.round(top) + "px",
            "important"
        );

        treeElement.style.setProperty(
            "right",
            "auto",
            "important"
        );

        treeElement.style.setProperty(
            "bottom",
            "auto",
            "important"
        );

        treeElement.style.setProperty(
            "margin",
            "0",
            "important"
        );

        treeElement.style.setProperty(
            "transform",
            "none",
            "important"
        );

        treeElement.style.setProperty(
            "z-index",
            "10000",
            "important"
        );
    }


    /* =====================================================
     * 북마크 Tree 닫기
     *
     * 다른 코드 또는 닫기 버튼에서도 호출할 수 있도록
     * window 전역 함수로 등록한다.
     * ===================================================== */
    window.hideBookmark = function () {
        $(TREE_SELECTOR).hide();

        return false;
    };


    /* =====================================================
     * 북마크 Tree 표시 또는 닫기
     *
     * Navigation Bar 설정:
     * URL Target = javascript:showBookmark();
     * ===================================================== */
    window.showBookmark = function () {
        var treeElement =
            getBookmarkTreeElement();

        var treeRegion;

        if (!treeElement) {
            console.error(
                "[Bookmark] Tree Region을 찾을 수 없습니다:",
                TREE_SELECTOR
            );

            return false;
        }

        /*
         * 이미 열려 있으면 다시 클릭할 때 닫는다.
         */
        if ($(treeElement).is(":visible")) {
            window.hideBookmark();

            return false;
        }

        /*
         * Tree 너비를 계산하려면 먼저 표시되어야 한다.
         */
        $(treeElement).show();

        /*
         * Navigation Bar Book Mark 버튼 하단으로 이동
         */
        positionBookmarkTree();

        /*
         * 최신 북마크 데이터 조회
         */
        try {
            treeRegion = apex.region(
                TREE_REGION_ID
            );
        } catch (error) {
            treeRegion = null;

            console.error(
                "[Bookmark] Region 객체 조회 실패:",
                error
            );
        }

        /*
         * Tree Region이 Refresh를 지원하면 갱신
         */
        if (
            treeRegion &&
            typeof treeRegion.refresh === "function"
        ) {
            treeRegion.refresh();
        }

        return false;
    };


    /* =====================================================
     * 공통 이벤트 초기화
     * ===================================================== */
    function initializeBookmarkTree() {
        /*
         * 최초 페이지 로드 시 Tree 숨김
         */
        $(TREE_SELECTOR).hide();

        /*
         * 공용 JS가 중복 로드되거나
         * 초기화가 다시 실행되는 경우를 대비해
         * 기존 이벤트 제거
         */
        $(window).off(
            EVENT_NAMESPACE
        );

        $(document).off(
            EVENT_NAMESPACE
        );

        $(TREE_SELECTOR).off(
            EVENT_NAMESPACE
        );


        /* -------------------------------------------------
         * 브라우저 크기 변경 시 위치 재계산
         * ------------------------------------------------- */
        $(window).on(
            "resize" + EVENT_NAMESPACE,
            function () {
                if (isBookmarkTreeVisible()) {
                    positionBookmarkTree();
                }
            }
        );


        /* -------------------------------------------------
         * Tree Region Refresh 이후 위치 재계산
         * ------------------------------------------------- */
        $(document).on(
            "apexafterrefresh" + EVENT_NAMESPACE,
            TREE_SELECTOR,
            function () {
                if (isBookmarkTreeVisible()) {
                    window.requestAnimationFrame(
                        function () {
                            positionBookmarkTree();
                        }
                    );
                }
            }
        );


        /* -------------------------------------------------
         * Tree와 Navigation Bar 버튼 외부 클릭 시 닫기
         * ------------------------------------------------- */
        $(document).on(
            "mousedown" + EVENT_NAMESPACE,
            function (event) {
                var treeElement =
                    getBookmarkTreeElement();

                var triggerElement =
                    getBookmarkTrigger();

                /*
                 * Tree가 없거나 닫힌 상태이면 처리하지 않는다.
                 */
                if (
                    !treeElement ||
                    !$(treeElement).is(":visible")
                ) {
                    return;
                }

                /*
                 * Tree 내부 클릭이면 닫지 않는다.
                 */
                if (
                    treeElement === event.target ||
                    treeElement.contains(
                        event.target
                    )
                ) {
                    return;
                }

                /*
                 * Navigation Bar의 Book Mark 버튼을 클릭한 경우
                 * showBookmark에서 열기/닫기를 처리하므로
                 * 여기서는 닫지 않는다.
                 */
                if (
                    triggerElement &&
                    (
                        triggerElement === event.target ||
                        triggerElement.contains(
                            event.target
                        )
                    )
                ) {
                    return;
                }

                window.hideBookmark();
            }
        );


        /* -------------------------------------------------
         * ESC 키 입력 시 닫기
         * ------------------------------------------------- */
        $(document).on(
            "keydown" + EVENT_NAMESPACE,
            function (event) {
                if (event.key === "Escape") {
                    window.hideBookmark();
                }
            }
        );
    }


    /* =====================================================
     * 최초 페이지 로드
     * ===================================================== */
    $(function () {
        initializeBookmarkTree();

        console.log(
            "[Bookmark] Global Bookmark Tree 초기화 완료"
        );
    });

})(apex.jQuery);
/* =========================================================
 * Bookmark 공통 노드 유틸리티
 *
 * Tree SQL NODE_VALUE 규칙:
 * D_0_60
 * F_1_61
 * P_2_62
 *
 * D : 즐겨찾기 루트
 * F : 폴더
 * P : 페이지
 * ========================================================= */
(function ($) {
    "use strict";

    /**
     * D_0_60 형식의 NODE_VALUE를 분석한다.
     */
    function parseNodeValue(value) {
        var parts = String(value || "").split("_");
        var level;
        var bookmarkId;

        if (
            parts.length !== 3 ||
            ["D", "F", "P"].indexOf(parts[0]) < 0
        ) {
            return null;
        }

        level = Number(parts[1]);
        bookmarkId = Number(parts[2]);

        if (
            Number.isNaN(level) ||
            Number.isNaN(bookmarkId)
        ) {
            return null;
        }

        return {
            type: parts[0],
            level: level,
            bookmarkId: bookmarkId,
            value: String(value)
        };
    }

    /**
     * 선택한 노드 아래에 자식 생성 가능 여부를 검사한다.
     */
    function canAddChild(nodeInfo) {
        if (!nodeInfo) {
            apex.message.alert(
                "선택한 북마크 정보를 확인할 수 없습니다."
            );

            return false;
        }

        /*
         * 페이지에는 하위 항목 생성 불가
         */
        if (nodeInfo.type === "P") {
            apex.message.alert(
                "페이지 하위에는 폴더 또는 페이지를 추가할 수 없습니다."
            );

            return false;
        }

        /*
         * Level 3 노드 아래에는 Level 4가 생성되므로 차단
         */
        if (Number(nodeInfo.level) >= 3) {
            apex.message.alert(
                "Level 3 이후에는 하위 폴더 또는 페이지를 추가할 수 없습니다."
            );

            return false;
        }

        return true;
    }

    window.BookmarkNodeUtil = {
        parse: parseNodeValue,
        canAddChild: canAddChild
    };

})(apex.jQuery);

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

/* =========================================================
 * APEX 전역 성공 메시지
 *
 * 사용 예:
 * showGlobalSuccessMessage("폴더가 삭제되었습니다.");
 * showGlobalSuccessMessage("현재 페이지가 추가되었습니다.", 3000);
 * ========================================================= */
(function () {
    "use strict";

    window.showGlobalSuccessMessage =
        function (message, duration) {
            var displayDuration =
                Number(duration) || 3000;

            /*
             * 이전 자동 닫기 타이머 제거
             */
            if (
                window.GLOBAL_SUCCESS_MESSAGE_TIMER
            ) {
                window.clearTimeout(
                    window.GLOBAL_SUCCESS_MESSAGE_TIMER
                );

                window.GLOBAL_SUCCESS_MESSAGE_TIMER =
                    null;
            }

            /*
             * 기존 성공 메시지가 남아 있으면 먼저 제거
             */
            apex.message.hidePageSuccess();

            /*
             * 새 성공 메시지 표시
             */
            apex.message.showPageSuccess(
                message || "처리되었습니다."
            );

            /*
             * 지정 시간 후 자동 닫기
             */
            window.GLOBAL_SUCCESS_MESSAGE_TIMER =
                window.setTimeout(
                    function () {
                        apex.message.hidePageSuccess();

                        window.GLOBAL_SUCCESS_MESSAGE_TIMER =
                            null;
                    },
                    displayDuration
                );
        };
})();

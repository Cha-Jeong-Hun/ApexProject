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

    var PAGE_SIZE_OPTIONS = [
        { label: "1", value: 1 },
        { label: "5", value: 5 },
        { label: "10", value: 10 },
        { label: "15", value: 15 },
        { label: "20", value: 20 },
        { label: "30", value: 30 },
        { label: "50", value: 50 },
        { label: "100", value: 100 },
        { label: "1000", value: 1000 }
    ];

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

        initializeRegions(document);

        /* 최초 Auto Page Size 확인 */
        getTargetRegions(document)
            .each(function () {
                recoverAutoPageSize(this);
            });

        /* APEX IG가 늦게 초기화되는 경우 대응 */
        window.setTimeout(
            function () {
                initializeRegions(document);

                getTargetRegions(document)
                    .each(function () {
                        recoverAutoPageSize(this);
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

            /* Region Refresh 이후 */
            .on(
                "apexafterrefresh" +
                    CONFIG.eventNamespace,
                function (event) {
                    scheduleInitialize(
                        event.target,
                        CONFIG.refreshInitDelay
                    );
                }
            )

            /* IG Grid / Chart 등의 View 변경 */
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

        /* 브라우저 높이 변경 시 Auto Page Size 재확인 */
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

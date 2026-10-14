(function () {

    "use strict";


    /* =========================================================
       기본 설정
       ========================================================= */

    const PANE_SELECTOR =
        ".splitPane";

    const BAR_SELECTOR =
        ".splitBar";


    /*
     * 모든 Pane의 최소 Width
     *
     * 기존에는
     * Left  = 300
     * Right = 350
     *
     * Multi Splitter에서는 가운데 Pane이
     * Left / Right 역할을 동시에 하므로
     * 공통 최소 Width를 사용
     */
    const MIN_PANE_WIDTH = 300;


    /*
     * Splitter Width
     *
     * CSS의 splitter-col Width와
     * 동일해야 함
     */
    const SPLITTER_WIDTH = 10;


    /*
     * 기존 2분할 화면의 기본값 유지
     *
     * 2 Pane일 경우:
     *
     * 45% | 55%
     *
     * 3개 이상이면 동일 비율로 초기화
     */
    const DEFAULT_TWO_PANE_PERCENT = 45;


    /*
     * Resize Delay
     */
    const WINDOW_RESIZE_DELAY = 100;


    /* =========================================================
       Application / Page 식별자
       ========================================================= */

    const STORAGE_PREFIX =
        "APEX_SPLITTER_" +
        "&APP_ID." +
        "_" +
        "&APP_PAGE_ID.";


    /* =========================================================
       Splitter 대상 찾기
       ========================================================= */

    const paneRegions =
        Array.from(
            document.querySelectorAll(
                PANE_SELECTOR
            )
        );


    const barRegions =
        Array.from(
            document.querySelectorAll(
                BAR_SELECTOR
            )
        );


    /*
     * Splitter가 없는 화면이면 종료
     */
    if (
        paneRegions.length === 0 ||
        barRegions.length === 0
    ) {

        return;
    }


    /* =========================================================
       APEX Row별로 Pane / Bar 그룹화
       ========================================================= */

    const rowMap =
        new Map();


    /*
     * 지정된 Region이 포함된
     * APEX Grid Row 찾기
     */
    function getRowInfo(region) {

        if (!region) {
            return null;
        }


        const col =
            region.closest(".col");


        if (!col) {

            console.warn(
                "Splitter APEX Grid Column을 찾을 수 없습니다.",
                region
            );

            return null;
        }


        const row =
            col.parentElement;


        if (!row) {
            return null;
        }


        return {
            region: region,
            col: col,
            row: row
        };
    }


    /*
     * Pane 등록
     */
    paneRegions.forEach(
        function (region) {

            const info =
                getRowInfo(region);


            if (!info) {
                return;
            }


            if (!rowMap.has(info.row)) {

                rowMap.set(
                    info.row,
                    {
                        panes: [],
                        bars: []
                    }
                );
            }


            rowMap
                .get(info.row)
                .panes
                .push(info);
        }
    );


    /*
     * Splitter 등록
     */
    barRegions.forEach(
        function (region) {

            const info =
                getRowInfo(region);


            if (!info) {
                return;
            }


            if (!rowMap.has(info.row)) {

                rowMap.set(
                    info.row,
                    {
                        panes: [],
                        bars: []
                    }
                );
            }


            rowMap
                .get(info.row)
                .bars
                .push(info);
        }
    );


    /* =========================================================
       기본 Percentage 생성
       ========================================================= */

    function getDefaultPercents(
        paneCount
    ) {

        /*
         * 기존 2분할 화면은
         * 45 / 55 유지
         */
        if (paneCount === 2) {

            return [
                DEFAULT_TWO_PANE_PERCENT,
                100 -
                    DEFAULT_TWO_PANE_PERCENT
            ];
        }


        /*
         * 3개 이상:
         * 동일한 Width
         */
        const percent =
            100 / paneCount;


        return Array(
            paneCount
        ).fill(
            percent
        );
    }


    /* =========================================================
       Percentage 정규화
       ========================================================= */

    function normalizePercents(
        percents,
        paneCount
    ) {

        if (
            !Array.isArray(percents) ||
            percents.length !== paneCount
        ) {

            return getDefaultPercents(
                paneCount
            );
        }


        const values =
            percents.map(
                function (value) {

                    return Number(value);
                }
            );


        if (
            values.some(
                function (value) {

                    return (
                        Number.isNaN(value) ||
                        value <= 0
                    );
                }
            )
        ) {

            return getDefaultPercents(
                paneCount
            );
        }


        const total =
            values.reduce(
                function (sum, value) {

                    return sum + value;
                },
                0
            );


        if (total <= 0) {

            return getDefaultPercents(
                paneCount
            );
        }


        return values.map(
            function (value) {

                return (
                    value /
                    total *
                    100
                );
            }
        );
    }


    /* =========================================================
       Percentage → Pixel Width 변환
       ========================================================= */

    function percentsToWidths(
        percents,
        totalWidth
    ) {

        const count =
            percents.length;


        /*
         * 화면이 너무 작은 경우
         *
         * 최소 Width를 강제하면
         * Row 전체가 넘칠 수 있으므로
         * 균등 분배
         */
        if (
            totalWidth <
            MIN_PANE_WIDTH * count
        ) {

            const width =
                totalWidth / count;


            return Array(
                count
            ).fill(
                width
            );
        }


        const widths =
            new Array(count)
                .fill(0);


        const fixed =
            new Array(count)
                .fill(false);


        let remainingWidth =
            totalWidth;


        let remainingPercent =
            percents.reduce(
                function (sum, value) {

                    return sum + value;
                },
                0
            );


        let changed = true;


        /*
         * Minimum Width 적용
         */
        while (changed) {

            changed = false;


            for (
                let i = 0;
                i < count;
                i++
            ) {

                if (fixed[i]) {
                    continue;
                }


                const width =
                    remainingPercent > 0
                        ? remainingWidth *
                          (
                              percents[i] /
                              remainingPercent
                          )
                        : 0;


                if (
                    width <
                    MIN_PANE_WIDTH
                ) {

                    widths[i] =
                        MIN_PANE_WIDTH;


                    fixed[i] =
                        true;


                    remainingWidth -=
                        MIN_PANE_WIDTH;


                    remainingPercent -=
                        percents[i];


                    changed = true;
                }
            }
        }


        /*
         * 나머지 Pane 분배
         */
        for (
            let i = 0;
            i < count;
            i++
        ) {

            if (fixed[i]) {
                continue;
            }


            widths[i] =
                remainingPercent > 0
                    ? remainingWidth *
                      (
                          percents[i] /
                          remainingPercent
                      )
                    : remainingWidth;
        }


        /*
         * 소수점 계산 오차 보정
         */
        const calculatedTotal =
            widths.reduce(
                function (sum, width) {

                    return sum + width;
                },
                0
            );


        if (count > 0) {

            widths[count - 1] +=
                totalWidth -
                calculatedTotal;
        }


        return widths;
    }


    /* =========================================================
       Row 초기화
       ========================================================= */

    let rowSequence = 0;


    rowMap.forEach(
        function (
            rowData,
            splitRow
        ) {

            /*
             * Splitter Bar가 없는 Row는 제외
             */
            if (
                rowData.bars.length === 0
            ) {

                return;
            }


            rowSequence++;


            /* =================================================
               DOM 순서로 Pane / Bar 다시 구성
               ================================================= */

            const orderedItems = [];


            Array.from(
                splitRow.children
            ).forEach(
                function (col) {

                    /*
                     * 이 Column에 속한
                     * Pane Region 확인
                     */
                    const pane =
                        Array.from(
                            col.querySelectorAll(
                                PANE_SELECTOR
                            )
                        ).find(
                            function (element) {

                                return (
                                    element.closest(
                                        ".col"
                                    ) === col
                                );
                            }
                        );


                    if (pane) {

                        orderedItems.push({
                            type: "pane",
                            region: pane,
                            col: col
                        });

                        return;
                    }


                    /*
                     * Splitter Region 확인
                     */
                    const bar =
                        Array.from(
                            col.querySelectorAll(
                                BAR_SELECTOR
                            )
                        ).find(
                            function (element) {

                                return (
                                    element.closest(
                                        ".col"
                                    ) === col
                                );
                            }
                        );


                    if (bar) {

                        orderedItems.push({
                            type: "bar",
                            region: bar,
                            col: col
                        });
                    }
                }
            );


            const panes =
                orderedItems.filter(
                    function (item) {

                        return (
                            item.type ===
                            "pane"
                        );
                    }
                );


            const bars =
                orderedItems.filter(
                    function (item) {

                        return (
                            item.type ===
                            "bar"
                        );
                    }
                );


            /* =================================================
               구조 검증
               ================================================= */

            if (
                panes.length < 2 ||
                bars.length !==
                    panes.length - 1
            ) {

                console.warn(
                    "Splitter 구조가 올바르지 않습니다.",
                    {
                        row: splitRow,
                        paneCount:
                            panes.length,
                        barCount:
                            bars.length
                    }
                );

                return;
            }


            /*
             * 아래 패턴이어야 함
             *
             * pane
             * bar
             * pane
             * bar
             * pane
             */
            let validStructure = true;


            orderedItems.forEach(
                function (
                    item,
                    index
                ) {

                    const expectedType =
                        index % 2 === 0
                            ? "pane"
                            : "bar";


                    if (
                        item.type !==
                        expectedType
                    ) {

                        validStructure =
                            false;
                    }
                }
            );


            if (!validStructure) {

                console.warn(
                    "Splitter Region 순서를 확인하세요. " +
                    "splitPane | splitBar | splitPane 형태여야 합니다.",
                    splitRow
                );

                return;
            }


            /* =================================================
               CSS Class 적용
               ================================================= */

            splitRow
                .classList
                .add(
                    "apex-split-row"
                );


            panes.forEach(
                function (item) {

                    item.col
                        .classList
                        .add(
                            "split-pane-col"
                        );
                }
            );


            bars.forEach(
                function (item) {

                    item.col
                        .classList
                        .add(
                            "splitter-col"
                        );


                    /*
                     * splitBar Region 자체를
                     * Handle로 사용
                     */
                    item.region
                        .classList
                        .add(
                            "app-split-handle"
                        );
                }
            );


            /* =================================================
               Storage
               ================================================= */

            const STORAGE_KEY =
                STORAGE_PREFIX +
                "_ROW_" +
                rowSequence;


            /* =================================================
               Row 상태
               ================================================= */

            const state = {

                currentPercents:
                    getDefaultPercents(
                        panes.length
                    ),

                resizeFrame: null,

                windowResizeTimer: null,

                dragging: false,

                activeBar: null,

                activePointerId: null,

                startX: 0,

                startLeftWidth: 0,

                startRightWidth: 0,

                pairTotalWidth: 0

            };


            /* =================================================
               APEX / IG Resize
               ================================================= */

            function notifyApexResize() {

                if (
                    state.resizeFrame
                ) {

                    cancelAnimationFrame(
                        state.resizeFrame
                    );
                }


                state.resizeFrame =
                    requestAnimationFrame(
                        function () {

                            /*
                             * Window Resize
                             */
                            try {

                                apex
                                    .jQuery(
                                        window
                                    )
                                    .trigger(
                                        "resize"
                                    );

                            }
                            catch (e) {

                                console.warn(
                                    "APEX Window Resize 처리 실패",
                                    e
                                );
                            }


                            /*
                             * Pane 내부 Region Resize
                             *
                             * Static ID가 없어도 동작하도록
                             * DOM 기준으로 Resize Event 전달
                             */
                            panes.forEach(
                                function (
                                    item
                                ) {

                                    try {

                                        apex
                                            .jQuery(
                                                item.region
                                            )
                                            .trigger(
                                                "resize"
                                            );


                                        apex
                                            .jQuery(
                                                item.region
                                            )
                                            .find(
                                                ".a-IG"
                                            )
                                            .trigger(
                                                "resize"
                                            );

                                    }
                                    catch (e) {

                                        console.warn(
                                            "Pane Resize 처리 실패",
                                            e
                                        );
                                    }
                                }
                            );
                        }
                    );
            }


            /* =================================================
               현재 Pane Width → Percent
               ================================================= */

            function updateCurrentPercents() {

                const widths =
                    panes.map(
                        function (item) {

                            return item.col
                                .getBoundingClientRect()
                                .width;
                        }
                    );


                const total =
                    widths.reduce(
                        function (
                            sum,
                            width
                        ) {

                            return (
                                sum +
                                width
                            );
                        },
                        0
                    );


                if (total <= 0) {
                    return;
                }


                state.currentPercents =
                    widths.map(
                        function (width) {

                            return (
                                width /
                                total *
                                100
                            );
                        }
                    );
            }


            /* =================================================
               Percentage 적용
               ================================================= */

            function applyPercents(
                percents
            ) {

                const rowRect =
                    splitRow
                        .getBoundingClientRect();


                if (
                    rowRect.width <= 0
                ) {

                    return;
                }


                /*
                 * Splitter Width 제외
                 */
                const availableWidth =
                    rowRect.width -
                    (
                        bars.length *
                        SPLITTER_WIDTH
                    );


                if (
                    availableWidth <= 0
                ) {

                    return;
                }


                const normalized =
                    normalizePercents(
                        percents,
                        panes.length
                    );


                const widths =
                    percentsToWidths(
                        normalized,
                        availableWidth
                    );


                panes.forEach(
                    function (
                        item,
                        index
                    ) {

                        const width =
                            widths[index];


                        item.col.style.flex =
                            "0 0 " +
                            width +
                            "px";


                        item.col.style.width =
                            width +
                            "px";
                    }
                );


                state.currentPercents =
                    normalized;


                notifyApexResize();
            }


            /* =================================================
               위치 저장
               ================================================= */

            function savePosition() {

                updateCurrentPercents();


                try {

                    localStorage.setItem(
                        STORAGE_KEY,
                        JSON.stringify(
                            state.currentPercents
                        )
                    );

                }
                catch (e) {

                    console.warn(
                        "Splitter 위치 저장 실패",
                        e
                    );
                }
            }


            /* =================================================
               저장 위치 불러오기
               ================================================= */

            function loadPosition() {

                let percents =
                    getDefaultPercents(
                        panes.length
                    );


                try {

                    const saved =
                        localStorage
                            .getItem(
                                STORAGE_KEY
                            );


                    if (saved !== null) {

                        const parsed =
                            JSON.parse(
                                saved
                            );


                        percents =
                            normalizePercents(
                                parsed,
                                panes.length
                            );
                    }

                }
                catch (e) {

                    console.warn(
                        "Splitter 위치 불러오기 실패",
                        e
                    );
                }


                applyPercents(
                    percents
                );
            }


            /* =================================================
               각 Splitter Drag Event 연결
               ================================================= */

            bars.forEach(
                function (
                    barItem,
                    barIndex
                ) {

                    /*
                     * DOM 구조상
                     *
                     * Pane0 | Bar0 | Pane1
                     * Pane1 | Bar1 | Pane2
                     *
                     * 형태로 연결
                     */
                    const leftPane =
                        panes[barIndex];


                    const rightPane =
                        panes[
                            barIndex + 1
                        ];


                    const handle =
                        barItem.region;


                    /* -----------------------------------------
                       Drag 시작
                       ----------------------------------------- */

                    handle.addEventListener(
                        "pointerdown",
                        function (event) {

                            /*
                             * 마우스 왼쪽 버튼만
                             */
                            if (
                                event.button !== 0
                            ) {

                                return;
                            }


                            state.dragging =
                                true;


                            state.activeBar =
                                barItem;


                            state.activePointerId =
                                event.pointerId;


                            state.startX =
                                event.clientX;


                            state.startLeftWidth =
                                leftPane.col
                                    .getBoundingClientRect()
                                    .width;


                            state.startRightWidth =
                                rightPane.col
                                    .getBoundingClientRect()
                                    .width;


                            /*
                             * 이 Splitter가 조절하는
                             * 두 Pane의 전체 Width는
                             * 유지
                             */
                            state.pairTotalWidth =
                                state.startLeftWidth +
                                state.startRightWidth;


                            document.body
                                .classList
                                .add(
                                    "apex-split-resizing"
                                );


                            try {

                                handle
                                    .setPointerCapture(
                                        event.pointerId
                                    );

                            }
                            catch (e) {
                                // 무시
                            }


                            event.preventDefault();
                        }
                    );


                    /* -----------------------------------------
                       Drag 중
                       ----------------------------------------- */

                    document.addEventListener(
                        "pointermove",
                        function (event) {

                            if (
                                !state.dragging ||
                                state.activeBar !==
                                    barItem
                            ) {

                                return;
                            }


                            const delta =
                                event.clientX -
                                state.startX;


                            let newLeftWidth =
                                state.startLeftWidth +
                                delta;


                            /*
                             * 최소 Left Width
                             */
                            newLeftWidth =
                                Math.max(
                                    MIN_PANE_WIDTH,
                                    newLeftWidth
                                );


                            /*
                             * 최소 Right Width
                             */
                            newLeftWidth =
                                Math.min(
                                    state.pairTotalWidth -
                                    MIN_PANE_WIDTH,
                                    newLeftWidth
                                );


                            /*
                             * 화면이 너무 작아
                             * 최소 Width를 만족할 수 없는 경우
                             */
                            if (
                                state.pairTotalWidth <
                                MIN_PANE_WIDTH * 2
                            ) {

                                newLeftWidth =
                                    Math.max(
                                        50,
                                        Math.min(
                                            state.pairTotalWidth -
                                            50,
                                            state.startLeftWidth +
                                            delta
                                        )
                                    );
                            }


                            const newRightWidth =
                                state.pairTotalWidth -
                                newLeftWidth;


                            /*
                             * Left Pane
                             */
                            leftPane.col.style.flex =
                                "0 0 " +
                                newLeftWidth +
                                "px";


                            leftPane.col.style.width =
                                newLeftWidth +
                                "px";


                            /*
                             * Right Pane
                             */
                            rightPane.col.style.flex =
                                "0 0 " +
                                newRightWidth +
                                "px";


                            rightPane.col.style.width =
                                newRightWidth +
                                "px";


                            /*
                             * 현재 비율 갱신
                             */
                            updateCurrentPercents();


                            notifyApexResize();
                        }
                    );


                    /* -----------------------------------------
                       Drag 종료
                       ----------------------------------------- */

                    document.addEventListener(
                        "pointerup",
                        function (event) {

                            if (
                                !state.dragging ||
                                state.activeBar !==
                                    barItem
                            ) {

                                return;
                            }


                            state.dragging =
                                false;


                            state.activeBar =
                                null;


                            state.activePointerId =
                                null;


                            document.body
                                .classList
                                .remove(
                                    "apex-split-resizing"
                                );


                            /*
                             * 사용자 위치 저장
                             */
                            savePosition();


                            /*
                             * 마지막 Resize
                             */
                            notifyApexResize();
                        }
                    );


                    /* -----------------------------------------
                       Double Click

                       전체 Row를 기본 위치로 복원

                       2 Pane:
                       45 / 55

                       3 Pane 이상:
                       균등 분배
                       ----------------------------------------- */

                    handle.addEventListener(
                        "dblclick",
                        function () {

                            state.currentPercents =
                                getDefaultPercents(
                                    panes.length
                                );


                            applyPercents(
                                state.currentPercents
                            );


                            savePosition();
                        }
                    );

                }
            );


            /* =================================================
               Browser Resize
               ================================================= */

            window.addEventListener(
                "resize",
                function () {

                    clearTimeout(
                        state.windowResizeTimer
                    );


                    state.windowResizeTimer =
                        setTimeout(
                            function () {

                                /*
                                 * 현재 비율 기준으로
                                 * 변경된 화면 Width에 재계산
                                 */
                                applyPercents(
                                    state.currentPercents
                                );

                            },
                            WINDOW_RESIZE_DELAY
                        );
                }
            );


            /* =================================================
               초기 실행
               ================================================= */

            /*
             * APEX Layout 완료 후 Width 계산
             */
            requestAnimationFrame(
                function () {

                    loadPosition();
                }
            );

        }
    );


})();
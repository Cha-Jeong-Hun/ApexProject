window.AppIgFocus = (function () {

    "use strict";


    var target = null;
    var position = null;
    var positionRequested = false;

    var observedModel = null;
    var subscriptionId = null;
    var fetchedModel = null;

    var requestToken = 0;


    /* =========================================================
       Page Item 값 반환
       ========================================================= */
    function getValue(itemName) {

        var item = apex.item(itemName);

        if (!item || !item.node) {
            return "";
        }

        return item.getValue() || "";
    }


    /* =========================================================
       현재 Page ID
       ========================================================= */
    function getCurrentPageId() {

        if (
            apex.env &&
            apex.env.APP_PAGE_ID
        ) {
            return String(apex.env.APP_PAGE_ID);
        }

        return String($v("pFlowStepId") || "");
    }


    /* =========================================================
       Focus 정보 반환
       ========================================================= */
    function getTarget() {

        return {

            regionId:
                getValue("P0_FOCUS_REGION_H"),

            pkColumn:
                getValue("P0_FOCUS_PK_COLUMN_H"),

            pkValue:
                getValue("P0_FOCUS_ID_H"),

            focusColumn:
                getValue("P0_FOCUS_COLUMN_H")

        };
    }


    /* =========================================================
       Focus 정보 확인
       ========================================================= */
    function hasTarget(t) {

        return !!(
            t &&
            t.regionId &&
            t.pkColumn &&
            t.pkValue &&
            t.focusColumn
        );
    }


    /* =========================================================
       Grid View 반환
       ========================================================= */
    function getGridView(regionId) {

        var region = apex.region(regionId);

        if (!region) {
            return null;
        }

        try {

            var view = region
                .widget()
                .interactiveGrid(
                    "getViews",
                    "grid"
                );

            return view && view.model
                ? view
                : null;

        } catch (e) {

            console.log(
                "[IG Focus] Grid 오류:",
                e
            );

            return null;
        }
    }


    /* =========================================================
       Object 값 변환
       ========================================================= */
    function normalizeValue(value) {

        if (
            value !== null &&
            typeof value === "object"
        ) {

            if (
                Object.prototype.hasOwnProperty.call(
                    value,
                    "v"
                )
            ) {
                return value.v;
            }

            if (
                Object.prototype.hasOwnProperty.call(
                    value,
                    "r"
                )
            ) {
                return value.r;
            }
        }

        return value;
    }


    /* =========================================================
       현재 Model에서 PK 검색
       ========================================================= */
    function findRecord(view, t) {

        var model = view.model;
        var record = model.getRecord(
            String(t.pkValue)
        );

        if (record) {

            var value = normalizeValue(
                model.getValue(
                    record,
                    t.pkColumn
                )
            );

            if (
                String(value) === String(t.pkValue)
            ) {
                return record;
            }
        }


        var found = null;

        model.forEach(function (row) {

            if (found) {
                return;
            }

            var value = normalizeValue(
                model.getValue(
                    row,
                    t.pkColumn
                )
            );

            if (
                String(value) === String(t.pkValue)
            ) {
                found = row;
            }

        });

        return found;
    }


    /* =========================================================
       Model 구독 해제
       ========================================================= */
    function detachModel() {

        if (
            observedModel &&
            subscriptionId
        ) {

            try {

                observedModel.unSubscribe(
                    subscriptionId
                );

            } catch (e) {

                console.log(
                    "[IG Focus] 구독 해제 오류:",
                    e
                );
            }
        }

        observedModel = null;
        subscriptionId = null;
        fetchedModel = null;
    }


    /* =========================================================
       Focus 정보 초기화
       ========================================================= */
    function clearItems() {

        requestToken++;

        target = null;
        position = null;
        positionRequested = false;

        detachModel();


        [
            "P0_FOCUS_PAGE_ID",
            "P0_FOCUS_REGION_H",
            "P0_FOCUS_PK_COLUMN_H",
            "P0_FOCUS_ID_H",
            "P0_FOCUS_COLUMN_H"

        ].forEach(function (itemName) {

            var item = apex.item(itemName);

            if (item && item.node) {

                item.setValue(
                    "",
                    null,
                    true
                );
            }

        });


        /*
         * 서버 Session State도 초기화
         */
        apex.server.process(
            "IG_FOCUS_POSITION",
            {
                x04: "CLEAR"
            },
            {
                dataType: "json"
            }
        ).fail(function () {

            console.log(
                "[IG Focus] 서버 초기화 실패"
            );

        });


        console.log(
            "[IG Focus] Focus 정보 초기화 완료"
        );
    }


    /* =========================================================
       실제 ROW / COLUMN Focus
       ========================================================= */
    function moveFocus(view, record, t) {

        try {

            var recordId = view.model.getRecordId(
                record
            );


            /*
             * ROW 선택
             */
            view.setSelectedRecords(
                [record],
                false
            );


            /*
             * 대상 CELL 이동
             */
            view.view$.grid(
                "gotoCell",
                recordId,
                t.focusColumn
            );


            console.log(
                "[IG Focus] Focus 완료:",
                t.regionId,
                t.pkColumn,
                t.pkValue,
                t.focusColumn
            );


            clearItems();

            return true;

        } catch (e) {

            console.log(
                "[IG Focus] gotoCell 오류:",
                e
            );

            return false;
        }
    }


    /* =========================================================
       서버에서 반환한 위치의 데이터 Fetch
       ========================================================= */
    function fetchPosition(view, t, offset) {

        var model = view.model;
        var token = requestToken;

        if (fetchedModel === model) {
            return;
        }

        fetchedModel = model;


        console.log(
            "[IG Focus] 대상 OFFSET:",
            offset
        );


        model.forEachInPage(
            offset,
            1,
            function (
                record,
                index,
                recordId,
                error
            ) {

                if (
                    token !== requestToken ||
                    !target
                ) {
                    return;
                }


                if (error) {

                    console.log(
                        "[IG Focus] Fetch 오류:",
                        error
                    );

                    fetchedModel = null;
                    return;
                }


                if (!record) {
                    return;
                }


                var value = normalizeValue(
                    model.getValue(
                        record,
                        t.pkColumn
                    )
                );


                /*
                 * 서버 위치와 실제 PK 검증
                 */
                if (
                    String(value) !== String(t.pkValue)
                ) {

                    console.log(
                        "[IG Focus] PK 불일치:",
                        "대상 =", t.pkValue,
                        "실제 =", value,
                        "정렬/필터 확인 필요"
                    );

                    return;
                }


                /*
                 * 화면 반영 후 Focus
                 */
                window.setTimeout(function () {

                    if (
                        token !== requestToken ||
                        !target
                    ) {
                        return;
                    }

                    var currentView = getGridView(
                        t.regionId
                    );


                    if (
                        !currentView ||
                        currentView.model !== model
                    ) {
                        return;
                    }


                    moveFocus(
                        currentView,
                        record,
                        t
                    );

                }, 0);

            }
        );
    }


    /* =========================================================
       공통 서버 위치 조회
       ========================================================= */
    function findPosition(t) {

        if (positionRequested) {
            return;
        }

        positionRequested = true;

        var token = requestToken;


        console.log(
            "[IG Focus] 서버 위치 검색:",
            t.regionId,
            t.pkColumn,
            t.pkValue
        );


        apex.server.process(
            "IG_FOCUS_POSITION",
            {
                x01: String(t.pkValue),
                x02: t.regionId,
                x03: t.pkColumn,
                x04: "FIND"
            },
            {
                dataType: "json"
            }
        ).done(function (data) {

            if (
                token !== requestToken ||
                !target
            ) {
                return;
            }


            if (!data || !data.found) {

                console.log(
                    "[IG Focus] 위치 조회 실패:",
                    data
                );

                return;
            }


            var offset = Number(
                data.offset
            );


            if (
                !Number.isSafeInteger(offset) ||
                offset < 0
            ) {

                console.log(
                    "[IG Focus] OFFSET 오류:",
                    data.offset
                );

                return;
            }


            position = offset;


            console.log(
                "[IG Focus] 위치 조회 완료:",
                t.pkValue,
                "OFFSET =", offset
            );


            tryFocus();

        }).fail(function (
            jqXHR,
            textStatus,
            errorThrown
        ) {

            console.log(
                "[IG Focus] Ajax 오류:",
                textStatus,
                errorThrown
            );

        });
    }


    /* =========================================================
       실제 Focus 시작
       ========================================================= */
    function tryFocus() {

        if (!target) {
            return;
        }

        var t = target;

        var view = getGridView(
            t.regionId
        );

        if (!view) {
            return;
        }


        attachModel(view.model);


        /*
         * 1. 현재 Model에서 먼저 PK 검색
         */
        var record = findRecord(
            view,
            t
        );


        if (record) {

            moveFocus(
                view,
                record,
                t
            );

            return;
        }


        /*
         * 2. 위치를 모르면 서버에서 확인
         */
        if (position === null) {

            findPosition(t);

            return;
        }


        /*
         * 3. 위치를 알고 있으면 해당 데이터 Fetch
         */
        fetchPosition(
            view,
            t,
            position
        );
    }


    /* =========================================================
       Model 데이터 로딩 이벤트
       ========================================================= */
    function attachModel(model) {

        if (!model) {
            return;
        }

        if (observedModel === model) {
            return;
        }


        detachModel();

        observedModel = model;


        subscriptionId = model.subscribe({

            onChange: function (changeType) {

                if (
                    changeType === "addData" ||
                    changeType === "refresh"
                ) {

                    window.setTimeout(
                        tryFocus,
                        0
                    );
                }
            }
        });

    }


    /* =========================================================
       Focus 등록
       ========================================================= */
    function focusRow(t) {

        if (!hasTarget(t)) {
            return false;
        }


        requestToken++;

        target = t;
        position = null;
        positionRequested = false;

        detachModel();


        var regionElement = document.getElementById(
            t.regionId
        );


        if (!regionElement) {

            console.log(
                "[IG Focus] REGION 없음:",
                t.regionId
            );

            return false;
        }


        /*
         * Lazy Loading 대응
         */
        apex.jQuery(regionElement)
            .off(
                "interactivegridviewmodelcreate.appIgFocus " +
                "apexafterrefresh.appIgFocus"
            )
            .on(
                "interactivegridviewmodelcreate.appIgFocus " +
                "apexafterrefresh.appIgFocus",
                function () {

                    window.setTimeout(
                        tryFocus,
                        0
                    );
                }
            );


        tryFocus();

        return true;
    }


    /* =========================================================
       Page Load
       ========================================================= */
    function init() {

        var focusPageId = getValue(
            "P0_FOCUS_PAGE_ID"
        );


        if (!focusPageId) {
            return;
        }


        if (
            String(focusPageId) !==
            getCurrentPageId()
        ) {

            console.log(
                "[IG Focus] 다른 Page:",
                focusPageId,
                getCurrentPageId()
            );

            return;
        }


        var t = getTarget();


        if (!hasTarget(t)) {

            console.log(
                "[IG Focus] Focus 정보 부족:",
                t
            );

            return;
        }


        console.log(
            "[IG Focus] Target:",
            t
        );


        focusRow(t);
    }


    /* =========================================================
       Public
       ========================================================= */
    return {

        init: init,

        focusRow: focusRow,

        clear: clearItems

    };

})();
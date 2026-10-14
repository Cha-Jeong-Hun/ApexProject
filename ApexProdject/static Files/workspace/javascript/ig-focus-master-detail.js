window.AppIgFocus = (function ($) {

    "use strict";


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
            return String(
                apex.env.APP_PAGE_ID
            );
        }

        return String(
            $v("pFlowStepId") || ""
        );
    }


    /* =========================================================
       H / L Focus 정보
       ========================================================= */
    function getTarget(type) {

        return {

            regionId:
                getValue(
                    "P0_FOCUS_REGION_" + type
                ),

            pkColumn:
                getValue(
                    "P0_FOCUS_PK_COLUMN_" + type
                ),

            pkValue:
                getValue(
                    "P0_FOCUS_ID_" + type
                ),

            focusColumn:
                getValue(
                    "P0_FOCUS_COLUMN_" + type
                )
        };
    }


    /* =========================================================
       Target 존재 여부
       ========================================================= */
    function hasTarget(target) {

        return !!(
            target &&
            target.regionId &&
            target.pkColumn &&
            target.pkValue &&
            target.focusColumn
        );
    }


    /* =========================================================
       IG Context 반환
       ========================================================= */
    function getGridContext(regionId) {

        var region =
            apex.region(regionId);

        if (!region) {

            console.log(
                "[IG Focus] Region 없음:",
                regionId
            );

            return null;
        }


        var ig$;

        try {

            ig$ = region.widget();

        } catch (e) {

            console.log(
                "[IG Focus] Widget 오류:",
                regionId,
                e
            );

            return null;
        }


        if (
            !ig$ ||
            !ig$.length
        ) {

            console.log(
                "[IG Focus] Widget 없음:",
                regionId
            );

            return null;
        }


        var gridView;

        try {

            gridView =
                ig$.interactiveGrid(
                    "getViews",
                    "grid"
                );

        } catch (e) {

            console.log(
                "[IG Focus] Grid View 오류:",
                regionId,
                e
            );

            return null;
        }


        if (
            !gridView ||
            !gridView.model
        ) {

            console.log(
                "[IG Focus] Model 없음:",
                regionId
            );

            return null;
        }


        return {
            region: region,
            ig$: ig$,
            gridView: gridView,
            model: gridView.model
        };
    }


    /* =========================================================
       Object 형태 값 변환
       ========================================================= */
    function normalizeValue(value) {

        if (
            value &&
            typeof value === "object"
        ) {

            value =
                value.v ||
                value.r ||
                "";
        }

        return value;
    }


    /* =========================================================
       PK로 Record 검색
       ========================================================= */
    function findRecord(
        gridView,
        pkColumn,
        pkValue
    ) {

        var model =
            gridView.model;

        var targetRecord =
            null;


        model.forEach(function (record) {

            if (targetRecord) {
                return;
            }


            var value =
                model.getValue(
                    record,
                    pkColumn
                );


            value =
                normalizeValue(
                    value
                );


            if (
                String(value) ===
                String(pkValue)
            ) {

                targetRecord =
                    record;
            }

        });


        return targetRecord;
    }


    /* =========================================================
       Header / Master Row 선택

       반환값
       {
           context : Master IG Context,
           record  : 선택한 Master Record
       }
       ========================================================= */
    function selectRow(target) {

        if (!hasTarget(target)) {
            return null;
        }


        var context =
            getGridContext(
                target.regionId
            );

        if (!context) {
            return null;
        }


        var targetRecord =
            findRecord(
                context.gridView,
                target.pkColumn,
                target.pkValue
            );


        if (!targetRecord) {

            console.log(
                "[IG Focus] Master Row 없음:",
                target.regionId,
                target.pkColumn,
                target.pkValue
            );

            return null;
        }


        /*
         * Master Row 선택
         *
         * pFocus    = false
         * pNoNotify = false
         *
         * Selection Change는 발생시키고,
         * 실제 최종 Cell Focus는 Detail에 준다.
         */
        try {

            context.ig$.interactiveGrid(
                "setSelectedRecords",
                [targetRecord],
                false,
                false
            );

        } catch (e) {

            console.log(
                "[IG Focus] Master 선택 오류:",
                target.regionId,
                e
            );

            return null;
        }


        console.log(
            "[IG Focus] Master 선택 완료:",
            target.regionId,
            target.pkColumn,
            target.pkValue
        );


        return {
            context: context,
            record: targetRecord
        };
    }


    /* =========================================================
       Row 선택 + 실제 Cell Focus
       ========================================================= */
    function focusRow(target) {

        if (!hasTarget(target)) {
            return false;
        }


        var context =
            getGridContext(
                target.regionId
            );

        if (!context) {
            return false;
        }


        var targetRecord =
            findRecord(
                context.gridView,
                target.pkColumn,
                target.pkValue
            );


        if (!targetRecord) {

            console.log(
                "[IG Focus] Row 없음:",
                target.regionId,
                target.pkColumn,
                target.pkValue
            );

            return false;
        }


        /*
         * 대상 Row 선택
         */
        try {

            context.ig$.interactiveGrid(
                "setSelectedRecords",
                [targetRecord],
                true,
                false
            );

        } catch (e) {

            console.log(
                "[IG Focus] Row 선택 오류:",
                target.regionId,
                e
            );

            return false;
        }


        /*
         * 지정 Column으로 이동
         */
        try {

            context.gridView.view$.grid(
                "gotoCell",
                context.model.getRecordId(
                    targetRecord
                ),
                target.focusColumn
            );

        } catch (e) {

            console.log(
                "[IG Focus] gotoCell 오류:",
                target.regionId,
                target.focusColumn,
                e
            );

            return false;
        }


        console.log(
            "[IG Focus] Focus 완료:",
            target.regionId,
            target.pkColumn,
            target.pkValue,
            target.focusColumn
        );


        return true;
    }


    /* =========================================================
       Focus 정보 초기화
       ========================================================= */
    function clearItems() {

        [
            "P0_FOCUS_PAGE_ID",

            "P0_FOCUS_REGION_H",
            "P0_FOCUS_PK_COLUMN_H",
            "P0_FOCUS_ID_H",
            "P0_FOCUS_COLUMN_H",

            "P0_FOCUS_REGION_L",
            "P0_FOCUS_PK_COLUMN_L",
            "P0_FOCUS_ID_L",
            "P0_FOCUS_COLUMN_L"

        ].forEach(function (itemName) {

            var item =
                apex.item(itemName);

            if (
                item &&
                item.node
            ) {

                item.setValue(
                    "",
                    null,
                    true
                );
            }

        });


        console.log(
            "[IG Focus] Focus 정보 초기화 완료"
        );
    }


    /* =========================================================
       Detail Focus 재시도
       ========================================================= */
    function focusDetailRetry(
        detailTarget,
        attempt
    ) {

        attempt =
            attempt || 0;


        /*
         * Detail Row가 Model에 존재하면
         * 즉시 Focus
         */
        if (
            focusRow(
                detailTarget
            )
        ) {

            console.log(
                "[IG Focus] Detail Focus 완료:",
                detailTarget.pkValue
            );


            clearItems();

            return true;
        }


        /*
         * 최대 30회
         * 100ms * 30 = 약 3초
         */
        if (attempt >= 30) {

            console.log(
                "[IG Focus] Detail Focus 실패:",
                detailTarget.regionId,
                detailTarget.pkColumn,
                detailTarget.pkValue
            );

            return false;
        }


        setTimeout(
            function () {

                focusDetailRetry(
                    detailTarget,
                    attempt + 1
                );

            },
            100
        );


        return false;
    }


    /* =========================================================
       Master - Detail 처리

       1. Master Row 검색
       2. Master Row 선택
       3. Detail IG에 Master Record 직접 지정
       4. Detail 데이터 로딩 후 Line Focus
       ========================================================= */
    function processMasterDetail(
        headerTarget,
        detailTarget
    ) {

        /* =========================================
           1. Master 선택
           ========================================= */
        var master =
            selectRow(
                headerTarget
            );


        if (!master) {

            console.log(
                "[IG Focus] Master 선택 실패"
            );

            return;
        }


        /* =========================================
           2. Detail Context
           ========================================= */
        var detailContext =
            getGridContext(
                detailTarget.regionId
            );


        if (!detailContext) {

            console.log(
                "[IG Focus] Detail Context 없음:",
                detailTarget.regionId
            );

            return;
        }


        /* =========================================
           3. Detail Master Record 직접 지정
           ========================================= */
        try {

            detailContext.ig$.interactiveGrid(
                "setMasterRecord",
                master.context.model,
                master.record
            );


            console.log(
                "[IG Focus] Detail Master 설정 완료:",
                headerTarget.pkValue
            );

        } catch (e) {

            console.log(
                "[IG Focus] setMasterRecord 오류:",
                detailTarget.regionId,
                e
            );

            return;
        }


        /* =========================================
           4. Detail Row Focus
           ========================================= */
        setTimeout(
            function () {

                focusDetailRetry(
                    detailTarget,
                    0
                );

            },
            100
        );
    }


    /* =========================================================
       Page Load 실행
       ========================================================= */
    function init() {

        var focusPageId =
            getValue(
                "P0_FOCUS_PAGE_ID"
            );


        /*
         * Focus 대상 없음
         */
        if (!focusPageId) {
            return;
        }


        /*
         * 저장한 Page와 현재 Page가 다르면 실행하지 않음
         */
        if (
            String(focusPageId) !==
            String(getCurrentPageId())
        ) {

            console.log(
                "[IG Focus] 다른 Page Focus 정보:",
                focusPageId,
                getCurrentPageId()
            );

            return;
        }


        var headerTarget =
            getTarget("H");


        var detailTarget =
            getTarget("L");


        console.log(
            "[IG Focus] Header Target:",
            headerTarget
        );


        console.log(
            "[IG Focus] Detail Target:",
            detailTarget
        );


        /* =====================================================
           1. Header + Detail
           ===================================================== */
        if (
            hasTarget(headerTarget) &&
            hasTarget(detailTarget)
        ) {

            processMasterDetail(
                headerTarget,
                detailTarget
            );

            return;
        }


        /* =====================================================
           2. Header만 존재
           ===================================================== */
        if (
            hasTarget(headerTarget)
        ) {

            if (
                focusRow(
                    headerTarget
                )
            ) {

                clearItems();
            }

            return;
        }


        /* =====================================================
           3. Detail만 존재
           ===================================================== */
        if (
            hasTarget(detailTarget)
        ) {

            if (
                focusRow(
                    detailTarget
                )
            ) {

                clearItems();
            }

            return;
        }


        console.log(
            "[IG Focus] 유효한 Focus Target 없음"
        );
    }


    /* =========================================================
       Public
       ========================================================= */
    return {

        init:
            init,

        focusRow:
            focusRow,

        selectRow:
            selectRow,

        clear:
            clearItems

    };


})(apex.jQuery);
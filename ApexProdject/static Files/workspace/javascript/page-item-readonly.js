/* =========================================================
 * APEX Page Item / IG Readonly Manager
 *
 * 적용 CSS Class
 * ---------------------------------------------------------
 * item-readonly
 *
 * 지원
 * ---------------------------------------------------------
 * - Text
 * - Textarea
 * - Date Picker
 * - Popup LOV
 * - Select List
 * - Checkbox
 * - Interactive Grid Cell
 *
 * ========================================================= */
(function ($) {

    "use strict";


    /* =====================================================
     * 중복 초기화 방지
     * ===================================================== */
    if (window.__APP_READONLY_MANAGER__) {
        return;
    }

    window.__APP_READONLY_MANAGER__ = true;


    /* =====================================================
     * Item Type 정의
     * ===================================================== */
    var TYPES = {


        /* -------------------------------------------------
         * Text / Textarea
         * ------------------------------------------------- */
        text: {

            selector:
                "input.apex-item-text, " +
                "textarea.apex-item-textarea",

            apply: function ($items) {

                $items
                    .prop("readonly", true)
                    .attr("aria-readonly", "true");

            }

        },


        /* -------------------------------------------------
         * Date Picker
         * ------------------------------------------------- */
        datePicker: {

            selector:
                "input.apex-item-datepicker",

            apply: function ($items) {

                $items
                    .prop("readonly", true)
                    .attr("aria-readonly", "true");

            },


            /*
             * 사용자 입력 차단 대상
             */
            blockSelector:
                ".item-readonly input.apex-item-datepicker, " +
                ".item-readonly .a-Button--calendar",


            /*
             * Calendar Button 처리
             */
            afterApply: function ($container) {

                $container
                    .find(".a-Button--calendar")
                    .prop("disabled", true)
                    .attr("aria-disabled", "true")
                    .attr("tabindex", "-1");

            }

        },


        /* -------------------------------------------------
         * Popup LOV
         * ------------------------------------------------- */
        popupLov: {

            /*
             * Popup LOV Wrapper 기준
             */
            containerSelector:
                ".apex-item-wrapper--popup-lov",


            applyContainer: function ($container) {

                /*
                 * Display Input
                 */
                $container
                    .find(
                        'input:not([type="hidden"])'
                    )
                    .prop("readonly", true)
                    .attr(
                        "aria-readonly",
                        "true"
                    )
                    .attr(
                        "tabindex",
                        "-1"
                    );


                /*
                 * LOV Button
                 */
                $container
                    .find("button")
                    .attr(
                        "aria-disabled",
                        "true"
                    )
                    .attr(
                        "tabindex",
                        "-1"
                    );

            },


            blockSelector:
                ".item-readonly.apex-item-wrapper--popup-lov, " +
                ".item-readonly .apex-item-wrapper--popup-lov"

        },


        /* -------------------------------------------------
         * Select List
         * ------------------------------------------------- */
        selectList: {

            selector:
                "select.apex-item-select, select",

            apply: function ($items) {

                /*
                 * disabled 사용하지 않음
                 *
                 * disabled 사용 시 Submit 값이
                 * 전달되지 않을 수 있으므로
                 * 이벤트만 차단
                 */
                $items
                    .attr(
                        "aria-disabled",
                        "true"
                    )
                    .attr(
                        "tabindex",
                        "-1"
                    );

            },


            blockSelector:
                ".item-readonly select"

        },


        /* -------------------------------------------------
         * Checkbox
         * ------------------------------------------------- */
        checkbox: {

            /*
             * 일반 Page Item Checkbox
             * +
             * APEX IG Single Checkbox
             */
            selector:
                'input[type="checkbox"], ' +
                '.apex-item-single-checkbox',


            apply: function ($items) {

                /*
                 * disabled 사용하지 않음
                 *
                 * 현재 값을 Submit 해야 하므로
                 * 실제 disabled 속성은 사용하지 않음
                 */
                $items
                    .attr(
                        "aria-disabled",
                        "true"
                    )
                    .attr(
                        "tabindex",
                        "-1"
                    );

            },


            /*
             * 일반 Page Item Checkbox 판단
             *
             * IG Checkbox는 shouldBlock()에서
             * Cell 자체를 먼저 차단하므로
             * 여기서는 Page Item 중심으로 처리
             */
            customBlock: function (target) {

                if (
                    !target ||
                    !target.closest
                ) {

                    return false;

                }


                var container =
                    target.closest(
                        ".item-readonly"
                    );


                if (!container) {

                    return false;

                }


                /*
                 * container 자체가 Checkbox인 경우
                 */
                if (
                    container.matches &&
                    container.matches(
                        'input[type="checkbox"], ' +
                        '.apex-item-single-checkbox'
                    )
                ) {

                    return true;

                }


                /*
                 * container 내부 Checkbox 확인
                 */
                return !!container.querySelector(
                    'input[type="checkbox"], ' +
                    '.apex-item-single-checkbox'
                );

            }

        }

    };



    /* =====================================================
     * Readonly Container 조회
     * ===================================================== */
    function getContainers(root) {

        var $root =
            $(root || document);


        var $containers =
            $();


        /* -------------------------------------------------
         * root 자체
         * ------------------------------------------------- */
        if (
            $root.is(
                ".item-readonly"
            )
        ) {

            $containers =
                $containers.add(
                    $root
                );

        }


        /* -------------------------------------------------
         * 상위
         * ------------------------------------------------- */
        $containers =
            $containers.add(
                $root.closest(
                    ".item-readonly"
                )
            );


        /* -------------------------------------------------
         * 하위
         * ------------------------------------------------- */
        $containers =
            $containers.add(
                $root.find(
                    ".item-readonly"
                )
            );


        return $containers;

    }



    /* =====================================================
     * 단일 Container 처리
     * ===================================================== */
    function applyContainer(
        $container
    ) {

        Object
            .keys(TYPES)
            .forEach(
                function (
                    typeName
                ) {

                    var type =
                        TYPES[typeName];


                    /* -------------------------------------
                     * 일반 Selector 방식
                     * ------------------------------------- */
                    if (
                        type.selector
                    ) {

                        /*
                         * container 내부뿐만 아니라
                         * container 자체도 검사
                         */
                        var $items =
                            $container
                                .filter(
                                    type.selector
                                )
                                .add(
                                    $container.find(
                                        type.selector
                                    )
                                );


                        if (
                            $items.length &&
                            type.apply
                        ) {

                            type.apply(
                                $items,
                                $container
                            );

                        }

                    }


                    /* -------------------------------------
                     * Container 기반 Item
                     *
                     * Popup LOV 등
                     * ------------------------------------- */
                    if (
                        type.containerSelector
                    ) {

                        var $targetContainers =
                            $container
                                .filter(
                                    type.containerSelector
                                )
                                .add(
                                    $container.find(
                                        type.containerSelector
                                    )
                                );


                        $targetContainers.each(
                            function () {

                                if (
                                    type.applyContainer
                                ) {

                                    type.applyContainer(
                                        $(this)
                                    );

                                }

                            }
                        );

                    }


                    /* -------------------------------------
                     * 추가 후처리
                     * ------------------------------------- */
                    if (
                        type.afterApply
                    ) {

                        type.afterApply(
                            $container
                        );

                    }

                }
            );

    }



    /* =====================================================
     * 전체 Readonly 적용
     * ===================================================== */
    function apply(root) {

        var $containers =
            getContainers(
                root
            );


        $containers.each(
            function () {

                applyContainer(
                    $(this)
                );

            }
        );

    }



    /* =====================================================
     * IG Readonly Cell 판단
     * ===================================================== */
    function isReadonlyGridCell(
        target
    ) {

        if (
            !target ||
            !target.closest
        ) {

            return false;

        }


        var cell =
            target.closest(
                ".a-GV-cell"
            );


        if (!cell) {

            return false;

        }


        /*
         * Case 1
         *
         * <td class="
         *     a-GV-cell
         *     item-readonly
         * ">
         */
        if (
            cell.classList.contains(
                "ig-readonly"
            )
        ) {

            return true;

        }


        /*
         * Case 2
         *
         * item-readonly가
         * Cell 내부 Element에 들어간 경우
         */
        if (
            cell.querySelector(
                ".item-readonly"
            )
        ) {

            return true;

        }


        return false;

    }



    /* =====================================================
     * Event 차단 여부 판단
     * ===================================================== */
    function shouldBlock(target) {

        if (
            !target ||
            !target.closest
        ) {

            return false;

        }


        /* =================================================
         * 1. Interactive Grid
         *
         * 중요:
         *
         * Checkbox Editor가 생성되어 있는지
         * 검사하지 않음.
         *
         * Cell 자체가 item-readonly이면
         * 첫 클릭부터 무조건 차단.
         * ================================================= */
        if (
            isReadonlyGridCell(
                target
            )
        ) {

            return true;

        }


        /* =================================================
         * 2. 일반 Page Item
         * ================================================= */
        var result =
            false;


        Object
            .keys(TYPES)
            .some(
                function (
                    typeName
                ) {

                    var type =
                        TYPES[typeName];


                    /* -------------------------------------
                     * Selector 기반
                     * ------------------------------------- */
                    if (
                        type.blockSelector &&
                        target.closest(
                            type.blockSelector
                        )
                    ) {

                        result =
                            true;


                        return true;

                    }


                    /* -------------------------------------
                     * Custom 판단
                     * ------------------------------------- */
                    if (
                        type.customBlock &&
                        type.customBlock(
                            target
                        )
                    ) {

                        result =
                            true;


                        return true;

                    }


                    return false;

                }
            );


        return result;

    }



    /* =====================================================
     * Mouse / Pointer Event 차단
     *  "click",
     * window Capture 단계에서 차단하여
     * APEX IG 이벤트보다 먼저 처리
     * ===================================================== */
    [
        "pointerdown",
        "pointerup",
        "mousedown",
        "mouseup"
    ].forEach(
        function (
            eventName
        ) {

            window.addEventListener(
                eventName,
                function (event) {

                    if (
                        !shouldBlock(
                            event.target
                        )
                    ) {

                        return;

                    }


                    /*
                     * Browser 기본 동작 차단
                     */
                    event.preventDefault();


                    /*
                     * 이후 Event 전파 차단
                     */
                    event.stopPropagation();


                    /*
                     * 동일 Element에 등록된
                     * 이후 Listener까지 차단
                     */
                    event.stopImmediatePropagation();

                },

                /*
                 * Capture Phase
                 */
                true
            );

        }
    );



    /* =====================================================
     * Keyboard Event 차단
     * ===================================================== */
    window.addEventListener(
        "keydown",
        function (event) {

            if (
                !shouldBlock(
                    event.target
                )
            ) {

                return;

            }


            event.preventDefault();

            event.stopPropagation();

            event.stopImmediatePropagation();

        },

        true
    );



    /* =====================================================
     * 초기화
     * ===================================================== */
    function initialize(root) {

        apply(
            root ||
            document
        );

    }



    /* =====================================================
     * Page Load
     * ===================================================== */
    $(function () {

        initialize(
            document
        );


        /*
         * APEX Widget가
         * 늦게 Render 되는 경우 대응
         */
        window.setTimeout(
            function () {

                initialize(
                    document
                );

            },
            200
        );


        /*
         * IG 등 일부 Widget의
         * 후속 Rendering 대응
         */
        window.setTimeout(
            function () {

                initialize(
                    document
                );

            },
            500
        );

    });



    /* =====================================================
     * Region Refresh
     * ===================================================== */
    $(document)
        .off(
            "apexafterrefresh.itemReadonly"
        )
        .on(
            "apexafterrefresh.itemReadonly",
            function (event) {

                initialize(
                    event.target
                );


                /*
                 * Refresh 직후 Widget 내부가
                 * 다시 Render되는 경우 대응
                 */
                window.setTimeout(
                    function () {

                        initialize(
                            event.target
                        );

                    },
                    100
                );

            }
        );



    /* =====================================================
     * 외부 공개 객체
     *
     * Console / 다른 JS에서 사용 가능
     * ===================================================== */
    window.appReadOnly = {

        apply:
            initialize,

        types:
            TYPES,

        shouldBlock:
            shouldBlock,

        isReadonlyGridCell:
            isReadonlyGridCell

    };


})(apex.jQuery);
/* =========================================================
 * 모든 IG의 ig-readonly 컬럼
 * 사용자 직접 수정 방지
 *
 * - 특정 IG Static ID 사용하지 않음
 * - 모든 IG 공통 적용
 * - 기존 행 / 신규 행 모두 적용
 * - 사용자 직접 수정만 차단
 * - LOV Additional Outputs의 Model 변경은 허용
 * - Double Click Event 허용
 * ========================================================= */
(function () {
    "use strict";


    var READONLY_CELL_SELECTOR =
        ".a-GV-cell.ig-readonly";


    /* ---------------------------------------------------------
     * readonly 대상 Cell 확인
     * --------------------------------------------------------- */
    function getReadonlyCell(target) {

        if (!target) {
            return null;
        }


        /*
         * Text Node 대응
         */
        if (target.nodeType === 3) {
            target = target.parentElement;
        }


        if (!target || !target.closest) {
            return null;
        }


        return target.closest(
            READONLY_CELL_SELECTOR
        );
    }


    function isLovOutputReadonlyCell(target) {

        return !!getReadonlyCell(target);
    }


    /* ---------------------------------------------------------
     * 실제 편집 Item readonly 적용
     *
     * DOM readonly만 적용하므로
     * model.setValue(), Additional Outputs 등의
     * 프로그램 변경은 가능
     * --------------------------------------------------------- */
    function setCellReadonly(cell) {

        if (!cell) {
            return;
        }


        /* =====================================================
           Text / Number / Date / Textarea
           ===================================================== */
        cell.querySelectorAll(
            'input:not([type="checkbox"])' +
            ':not([type="radio"])' +
            ':not([type="button"])' +
            ':not([type="submit"])' +
            ':not([type="reset"]), ' +
            'textarea'
        ).forEach(function (item) {

            item.readOnly = true;

            item.setAttribute(
                "aria-readonly",
                "true"
            );

        });


        /* =====================================================
           Date Picker / Popup LOV 등의 Button

           중요:
           disabled = true 사용하지 않음.

           Button 자체 Mouse 조작만 막고
           Mouse Event는 상위 Cell에서 받을 수 있도록 함.
           ===================================================== */
        cell.querySelectorAll(
            'button, ' +
            '.a-Button, ' +
            '[role="button"]'
        ).forEach(function (button) {

            /*
             * 기존 disabled 상태가
             * 공통 JS에 의해 지정됐을 가능성 대응
             */
            if (
                button.hasAttribute(
                    "data-ig-readonly-disabled"
                )
            ) {
                button.disabled = false;

                button.removeAttribute(
                    "data-ig-readonly-disabled"
                );
            }


            button.setAttribute(
                "aria-disabled",
                "true"
            );


            button.setAttribute(
                "tabindex",
                "-1"
            );


            /*
             * 직접 Button 클릭은 안 되지만
             * Cell의 Double Click Event는 받을 수 있도록
             * Pointer Event를 Cell 쪽으로 통과
             */
            button.style.pointerEvents =
                "none";

        });


        /* =====================================================
           Checkbox / Radio
           ===================================================== */
        cell.querySelectorAll(
            'input[type="checkbox"], ' +
            'input[type="radio"]'
        ).forEach(function (item) {

            item.setAttribute(
                "aria-readonly",
                "true"
            );


            item.setAttribute(
                "tabindex",
                "-1"
            );


            /*
             * Checkbox / Radio 직접 클릭 차단
             * Event는 Cell로 전달
             */
            item.style.pointerEvents =
                "none";

        });


        /* =====================================================
           Select
           ===================================================== */
        cell.querySelectorAll(
            "select"
        ).forEach(function (item) {

            item.setAttribute(
                "aria-readonly",
                "true"
            );


            item.setAttribute(
                "tabindex",
                "-1"
            );


            /*
             * Select DropDown 직접 Open 방지
             * Double Click은 Cell에서 받을 수 있음
             */
            item.style.pointerEvents =
                "none";

        });


        /* =====================================================
           contenteditable
           ===================================================== */
        cell.querySelectorAll(
            '[contenteditable="true"]'
        ).forEach(function (item) {

            item.setAttribute(
                "contenteditable",
                "false"
            );


            item.setAttribute(
                "aria-readonly",
                "true"
            );

        });

    }


    /* ---------------------------------------------------------
     * 현재 화면의 모든 readonly Cell 적용
     * --------------------------------------------------------- */
    function applyReadonlyCells(root) {

        root = root || document;


        /*
         * root 자체가 대상 Cell인 경우
         */
        if (
            root.matches &&
            root.matches(
                READONLY_CELL_SELECTOR
            )
        ) {

            setCellReadonly(root);
        }


        /*
         * root 하위 Cell
         */
        if (root.querySelectorAll) {

            root.querySelectorAll(
                READONLY_CELL_SELECTOR
            ).forEach(function (cell) {

                setCellReadonly(cell);

            });
        }
    }


    /* =========================================================
       중요

       pointerdown / mousedown / click
       차단 Event는 사용하지 않음.

       기존 방식의
       preventDefault()
       stopPropagation()
       stopImmediatePropagation()

       때문에 dblclick Event까지
       다른 Handler로 전달되지 않을 수 있음.

       각 Control 자체를 readonly /
       pointer-events:none 으로 제어함.
       ========================================================= */


    /* =========================================================
       중요

       dblclick Event 역시 차단하지 않음.

       따라서 개별 페이지에서:

       document.addEventListener("dblclick", ...)
       또는
       apex.jQuery(document).on("dblclick", ...)

       정상 사용 가능.
       ========================================================= */


    /* ---------------------------------------------------------
     * Focus 진입 시 readonly 강제 적용
     *
     * 신규 행 추가 직후 이미 Edit Mode인 경우 대응
     * --------------------------------------------------------- */
    document.addEventListener(
        "focusin",
        function (event) {

            var cell =
                getReadonlyCell(
                    event.target
                );


            if (!cell) {
                return;
            }


            setCellReadonly(cell);

        },
        true
    );


    /* ---------------------------------------------------------
     * Keyboard 입력 차단
     *
     * 기존 행뿐 아니라 신규 행의
     * Navigation Mode -> Edit Mode 진입도 차단
     * --------------------------------------------------------- */
    document.addEventListener(
        "keydown",
        function (event) {

            var cell =
                getReadonlyCell(
                    event.target
                );


            if (!cell) {
                return;
            }


            setCellReadonly(cell);


            var key = event.key;


            /*
             * 복사 / 전체 선택 허용
             */
            if (
                (event.ctrlKey ||
                 event.metaKey) &&
                (
                    key.toLowerCase() === "c" ||
                    key.toLowerCase() === "a"
                )
            ) {
                return;
            }


            /*
             * Cell 이동 허용
             */
            if (
                key === "Tab"       ||
                key === "Escape"    ||
                key === "ArrowUp"   ||
                key === "ArrowDown" ||
                key === "ArrowLeft" ||
                key === "ArrowRight"||
                key === "Home"      ||
                key === "End"       ||
                key === "PageUp"    ||
                key === "PageDown"
            ) {
                return;
            }


            /*
             * 편집 시작 키 차단
             */
            if (
                key === "Enter"     ||
                key === "F2"        ||
                key === " "         ||
                key === "Backspace" ||
                key === "Delete"    ||

                /*
                 * 일반 문자 입력
                 */
                (
                    key &&
                    key.length === 1 &&
                    !event.ctrlKey &&
                    !event.metaKey &&
                    !event.altKey
                )
            ) {

                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation();
            }

        },
        true
    );


    /* ---------------------------------------------------------
     * Paste / Cut / Drop 직접 변경 차단
     * --------------------------------------------------------- */
    [
        "paste",
        "cut",
        "drop"
    ].forEach(function (eventName) {

        document.addEventListener(
            eventName,
            function (event) {

                if (
                    !isLovOutputReadonlyCell(
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

    });


    /* ---------------------------------------------------------
     * beforeinput 차단
     *
     * 이미 Edit Mode에 들어간 신규 행에서
     * 실제 값 입력이 발생하는 경우 최종 방어
     * --------------------------------------------------------- */
    document.addEventListener(
        "beforeinput",
        function (event) {

            if (
                !isLovOutputReadonlyCell(
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


    /* ---------------------------------------------------------
     * IG Row Edit 시작 시 적용
     *
     * Add Row 이후 APEX가 Column Item을
     * Cell 안으로 이동한 뒤 readonly 적용
     * --------------------------------------------------------- */
    if (
        window.apex &&
        apex.jQuery
    ) {

        apex.jQuery(document).on(
            "apexbeginrecordedit",
            function () {

                /*
                 * APEX Column Item 배치 완료 후 적용
                 */
                window.requestAnimationFrame(
                    function () {

                        applyReadonlyCells(
                            document
                        );

                    }
                );

            }
        );

    }


    /* ---------------------------------------------------------
     * 동적으로 생성되는 신규 Row / Editor 감시
     *
     * Add Row
     * Refresh
     * Pagination
     * Edit Mode
     * 모두 대응
     * --------------------------------------------------------- */
    var observer =
        new MutationObserver(
            function (mutations) {

                mutations.forEach(
                    function (mutation) {

                        mutation
                            .addedNodes
                            .forEach(
                                function (node) {

                                    if (
                                        node.nodeType !== 1
                                    ) {
                                        return;
                                    }


                                    /*
                                     * 새로 추가된 Editor가
                                     * readonly Cell 내부인 경우
                                     */
                                    if (node.closest) {

                                        var cell =
                                            node.closest(
                                                READONLY_CELL_SELECTOR
                                            );


                                        if (cell) {

                                            setCellReadonly(
                                                cell
                                            );
                                        }
                                    }


                                    /*
                                     * 새 Row 자체가 추가된 경우
                                     */
                                    applyReadonlyCells(
                                        node
                                    );

                                }
                            );

                    }
                );

            }
        );


    observer.observe(
        document.body,
        {
            childList: true,
            subtree: true
        }
    );


    /* ---------------------------------------------------------
     * 최초 Page Load
     * --------------------------------------------------------- */
    applyReadonlyCells(
        document
    );


})();
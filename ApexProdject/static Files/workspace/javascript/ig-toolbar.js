/* =========================================================
 * Interactive Grid 공통 Toolbar 처리
 * - 기본 Save 버튼 숨김
 * ========================================================= */
(function ($) {
    "use strict";

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

    $(function () {
        hideInteractiveGridSaveButtons(document);

        window.setTimeout(function () {
            hideInteractiveGridSaveButtons(document);
        }, 200);
    });

    $(document)
        .off("apexafterrefresh.igToolbarCommon")
        .on(
            "apexafterrefresh.igToolbarCommon",
            function (event) {
                hideInteractiveGridSaveButtons(event.target);
            }
        );

})(apex.jQuery);

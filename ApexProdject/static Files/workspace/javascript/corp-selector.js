/* =========================================================
 * P927 업체 선택 / Navigation Bar 업체명 동기화
 *
 * - P927 Dialog 반환값 처리
 * - P0_CORP_ID / P0_CORP_NAME 갱신
 * - SET_CORP_CONTEXT 호출
 * - Navigation Bar 업체명 갱신
 * ========================================================= */
(function ($) {
    "use strict";

    function refreshCorpMenuLabel() {
        var corpName = apex.item("P0_CORP_NAME").getValue();

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

    /* P927 Dialog 종료 */
    apex.gPageContext$
        .off("apexafterclosedialog.corpSelect")
        .on(
            "apexafterclosedialog.corpSelect",
            function (event, data) {
                if (!data || String(data.dialogPageId) !== "927") {
                    return;
                }

                var corpId   = data.P927_W_CORP_ID;
                var corpName = data.P927_W_CORP_NAME;

                console.log("Dialog Return CORP_ID   =", corpId);
                console.log("Dialog Return CORP_NAME =", corpName);

                if (!corpId) {
                    console.log("CORP_ID가 없습니다.");
                    return;
                }

                apex.item("P0_CORP_ID").setValue(corpId);
                apex.item("P0_CORP_NAME").setValue(corpName);

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

                            console.error(jqXHR.responseText);
                        }
                    }
                );
            }
        );

    /* Navigation Bar 메뉴가 열리기 직전 Menu Model Label 동기화 */
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

                if (ui && ui.menu && ui.menu.items) {
                    $.each(
                        ui.menu.items,
                        function (index, item) {
                            if (
                                item.icon &&
                                String(item.icon).indexOf(
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

                window.setTimeout(
                    function () {
                        refreshCorpMenuLabel();
                    },
                    0
                );
            }
        );

})(apex.jQuery);

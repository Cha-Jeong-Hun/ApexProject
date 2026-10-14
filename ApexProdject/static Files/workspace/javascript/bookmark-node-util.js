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

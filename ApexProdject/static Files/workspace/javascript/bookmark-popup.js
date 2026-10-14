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

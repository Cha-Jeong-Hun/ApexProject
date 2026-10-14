$(document).on(
    "click",
    "#t_TreeNav .a-TreeView-node.is-expandable > .a-TreeView-content, " +
    "#t_TreeNav .a-TreeView-node.is-collapsible > .a-TreeView-content",
    function (e) {

        e.preventDefault();
        e.stopImmediatePropagation();

        var $toggle = $(this)
            .parent(".a-TreeView-node")
            .children(".a-TreeView-toggle");

        if ($toggle.length) {
            $toggle[0].click();
        }
    }
    
);
/* Navigation Tooltip */
    $(document).on(
        "mouseenter",
        "#t_TreeNav .a-TreeView-content",
        function (e) {

            var label = $(this)
                .find(".a-TreeView-label")
                .text()
                .trim();

            if (!label) {
                return;
            }

            if ($("#navMenuTooltip").length === 0) {
                $("body").append(
                    '<div id="navMenuTooltip" class="nav-menu-tooltip"></div>'
                );
            }

            $("#navMenuTooltip")
                .text(label)
                .css({
                    left: e.pageX + 10,
                    top:  e.pageY + 15
                })
                .show();
        }
    );


    /* 마우스 이동 시 Tooltip 위치 이동 */
    $(document).on(
        "mousemove",
        "#t_TreeNav .a-TreeView-content",
        function (e) {

            $("#navMenuTooltip").css({
                left: e.pageX + 10,
                top:  e.pageY + 15
            });
        }
    );


    /* 메뉴에서 마우스가 벗어나면 숨김 */
    $(document).on(
        "mouseleave",
        "#t_TreeNav .a-TreeView-content",
        function () {

            $("#navMenuTooltip").hide();
        }
    );
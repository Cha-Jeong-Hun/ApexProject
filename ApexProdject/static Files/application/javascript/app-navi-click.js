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
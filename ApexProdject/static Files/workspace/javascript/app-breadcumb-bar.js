function setNavigationPath() {

    var $ = apex.jQuery;
    var $tree = $("#t_TreeNav");
    var $path = $("#APP_NAV_PATH");


    /* =========================================
       로그인 페이지 제외
       ========================================= */

    if (String(apex.env.APP_PAGE_ID) === "9999") {
        return;
    }


    /* =========================================
       Modal Dialog 제외
       ========================================= */

    if (window.self !== window.top) {
        return;
    }


    if (!$tree.length || !$path.length) {
        return;
    }

    var $currentNode = $();

    /* 1. 현재 메뉴 Node 찾기 */
    var $currentContent = $tree
        .find(
            ".a-TreeView-content.is-current," +
            ".a-TreeView-content.is-selected," +
            '.a-TreeView-content[aria-selected="true"],' +
            'a[aria-current="page"]'
        )
        .last();

    if ($currentContent.length) {
        $currentNode = $currentContent.closest(".a-TreeView-node");
    }

    /* 2. Node 자체에 current/selected가 있는 경우 */
    if (!$currentNode.length) {
        $currentNode = $tree
            .find(
                ".a-TreeView-node.is-current," +
                ".a-TreeView-node.is-selected"
            )
            .last();
    }

    /* 현재 페이지 메뉴를 못 찾은 경우 */
    if (!$currentNode.length) {
        $path.empty();
        return;
    }

    var pathNames = [];

    /* 3. 부모 Node들을 위에서부터 수집 */
    var parentNodes = $currentNode
        .parents(".a-TreeView-node")
        .get()
        .reverse();

    parentNodes.forEach(function (node) {

        var name = $(node)
            .children(".a-TreeView-content")
            .first()
            .find(".a-TreeView-label")
            .first()
            .text()
            .trim();

        if (name) {
            pathNames.push(name);
        }
    });

    /* 4. 현재 Leaf Node도 반드시 추가 */
    var currentName = $currentNode
        .children(".a-TreeView-content")
        .first()
        .find(".a-TreeView-label")
        .first()
        .text()
        .trim();

    if (currentName) {
        pathNames.push(currentName);
    }

    /* 5. 출력 */
    $path.text("  [ " + pathNames.join(" > ") + " ]");
}
(function () {

    var SUCCESS_MESSAGE_TIME = 3000;
    var successTimer = null;


    function autoHideSuccessMessage() {

        if (successTimer) {
            clearTimeout(successTimer);
        }

        successTimer = setTimeout(function () {

            apex.message.hidePageSuccess();

        }, SUCCESS_MESSAGE_TIME);
    }


    /*
     * Submit 이후 서버에서 출력된 Success Message
     */
    apex.jQuery(function () {

        if (
            apex.jQuery(
                ".t-Alert--success"
            ).length > 0
        ) {
            autoHideSuccessMessage();
        }

    });


    /*
     * Ajax / JavaScript에서 출력하는 Success Message
     */
    if (
        apex.message &&
        apex.message.showPageSuccess
    ) {

        var originalShowPageSuccess =
            apex.message.showPageSuccess;


        apex.message.showPageSuccess =
            function (message) {

                originalShowPageSuccess.call(
                    apex.message,
                    message
                );

                autoHideSuccessMessage();
            };

    }

})();
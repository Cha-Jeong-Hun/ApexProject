(function (window, apex) {
    "use strict";

    const appMessage = {

        /**
         * 처리 중 발생한 오류 표시
         */
        processingError: function (pMessage) {

            apex.message.alert(
                pMessage,
                function () {
                    // 확인 버튼 클릭 후 필요한 작업이 있으면 여기에 작성
                },
                {
                    title: "처리 중 오류",
                    style: "danger",
                    okLabel: "확인"
                }
            );

        },

        /**
         * 일반 경고가 필요한 경우
         */
        warning: function (pMessage) {

            apex.message.alert(
                pMessage,
                null,
                {
                    title: "확인",
                    style: "warning",
                    okLabel: "확인"
                }
            );

        },

        /**
         * 단순 정보
         */
        info: function (pMessage) {

            apex.message.alert(
                pMessage,
                null,
                {
                    title: "알림",
                    style: "information",
                    okLabel: "확인"
                }
            );

        }

    };


    /*
     * Application 전체에서 호출 가능하도록 공개
     */
    window.appMessage = appMessage;


    /*
     * ======================================================
     * APEX Page-level Error를 가로챈다.
     * ======================================================
     */
    apex.message.setThemeHooks({

        beforeShow: function (pMsgType, pElement$) {

            /*
             * Success Message 등은 기존 APEX 방식 그대로 사용
             */
            if (pMsgType !== apex.message.TYPE.ERROR) {
                return;
            }


            let messages = [];


            /*
             * 여러 오류가 있을 경우 li 단위로 수집
             */
            pElement$.find("li").each(function () {

                const text = apex.jQuery(this)
                    .text()
                    .trim();

                if (text) {
                    messages.push(text);
                }

            });


            /*
             * li가 없는 일반 Notification
             */
            if (messages.length === 0) {

                let body$ = pElement$.find(".t-Alert-body");

                let text = body$.length
                    ? body$.text().trim()
                    : pElement$.text().trim();

                if (text) {
                    messages.push(text);
                }

            }


            /*
             * 중복 메시지 제거
             */
            messages = [...new Set(messages)];


            /*
             * 하나의 문자열로 구성
             */
            const message =
                messages.join("\n\n");


            /*
             * 공통 Modal 표시
             */
            appMessage.processingError(
                message || "처리 중 오류가 발생했습니다."
            );


            /*
             * 중요:
             * APEX 기본 Notification은 표시하지 않음
             */
            return false;

        }

    });

})(window, apex);
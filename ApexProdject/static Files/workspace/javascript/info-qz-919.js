/* ========================================================================
 * 919 인쇄관리 페이지 - QZ Tray 공통 코드
 *
 * 필수 APEX 구성
 * 1. qz-tray.js는 한 번만 로드
 * 2. 페이지 아이템
 *    - P919_PDF_URL
 *    - P919_PRINT_MODE    : SELECT / DEFAULT / DIRECT
 *    - P919_JOB_NAME
 *    - P919_COPIES
 *    - P919_PRINTER_NAME  : Select List
 * 3. 선택 아이템(없어도 됨)
 *    - P919_ORIENTATION
 *    - P919_PAPER_SIZE
 *    - P919_DUPLEX
 *    - P919_COLOR_TYPE
 *    - P919_SCALE_CONTENT
 * 4. Static ID
 *    - 인쇄 버튼: BTN_PRINT
 *    - 프린터 조회 버튼: BTN_PRINTER_REFRESH
 *    - 설치 안내 Region: QZ_INSTALL_GUIDE
 *    - 연결 상태 Region: QZ_CONNECT_STATUS
 * 5. Execute when Page Loads
 *    initializeQz919Page();
 * ====================================================================== */

const INFO_QZ_CONFIG = Object.freeze({
    certificateUrl: "http://192.168.201.206:8088/qz/certificate",
    signUrl: "http://192.168.201.206:8088/qz/sign",
    installerUrl: "http://192.168.201.206:8088/qz/installer",
    signatureAlgorithm: "SHA512",
    printerStorageKey: "INFO_QZ_PRINTER_NAME"
});
let infoQzSecurityConfigured = false;
let infoQzConnectPromise = null;
let infoQzPrinterListPromise = null;
let infoQzPrintRunning = false;

const INFO_QZ_MAX_CONNECT_ATTEMPTS = 2;
const INFO_QZ_CONNECT_DELAY_MS = 1000;

/* ------------------------------------------------------------------------
 * 공통 보조 함수
 * --------------------------------------------------------------------- */

function infoQzErrorMessage(error) {
    if (error && error.message) {
        return error.message;
    }
    return String(error || "알 수 없는 오류");
}

function infoQzSleep(milliseconds) {
    return new Promise(function (resolve) {
        window.setTimeout(resolve, milliseconds);
    });
}

function infoQzHasItem(itemName) {
    return Boolean(document.getElementById(itemName));
}

function infoQzGetItemValue(itemName, defaultValue) {
    if (!infoQzHasItem(itemName)) {
        return defaultValue;
    }

    const value = apex.item(itemName).getValue();

    if (value === null || value === undefined || value === "") {
        return defaultValue;
    }

    return value;
}

function infoQzSetItemValue(itemName, value) {
    if (infoQzHasItem(itemName)) {
        apex.item(itemName).setValue(value);
    }
}

function infoQzNormalizeCopies(value) {
    const copies = Number(value || 1);

    if (!Number.isInteger(copies) || copies < 1 || copies > 100) {
        throw new Error("인쇄 매수는 1~100 사이의 정수여야 합니다.");
    }

    return copies;
}


/* ------------------------------------------------------------------------
 * 인증서 및 서버 서명 설정
 * --------------------------------------------------------------------- */
function configureQzSecurity() {
    if (infoQzSecurityConfigured) {
        return;
    }

    if (typeof qz === "undefined") {
        throw new Error("qz-tray.js가 로드되지 않았습니다.");
    }

    qz.security.setCertificatePromise(function (resolve, reject) {
        fetch(INFO_QZ_CONFIG.certificateUrl, {
            method: "GET",
            cache: "no-store",
            headers: {
                "Accept": "text/plain"
            }
        })
        .then(function (response) {
            if (!response.ok) {
                throw new Error(
                    "QZ 인증서 조회 실패: HTTP " + response.status
                );
            }
            return response.text();
        })
        .then(function (certificate) {
            const value = String(certificate || "").trim();

            if (!value.includes("BEGIN CERTIFICATE")) {
                throw new Error(
                    "/qz/certificate 응답이 올바른 인증서 형식이 아닙니다."
                );
            }

            resolve(value);
        })
        .catch(function (error) {
            console.error("[QZ] 인증서 조회 실패:", error);
            reject(error);
        });
    });

    qz.security.setSignatureAlgorithm(
        INFO_QZ_CONFIG.signatureAlgorithm
    );

    qz.security.setSignaturePromise(function (toSign) {
        return function (resolve, reject) {
            fetch(INFO_QZ_CONFIG.signUrl, {
                method: "POST",
                cache: "no-store",
                headers: {
                    "Content-Type": "text/plain; charset=UTF-8",
                    "Accept": "text/plain"
                },
                body: toSign
            })
            .then(async function (response) {
                const responseText = await response.text();

                if (!response.ok) {
                    throw new Error(
                        "/qz/sign 실패: HTTP " + response.status +
                        "\n" + responseText
                    );
                }

                const signature = String(responseText || "").trim();

                if (!signature) {
                    throw new Error("/qz/sign에서 빈 서명이 반환되었습니다.");
                }

                if (!/^[A-Za-z0-9+/=\r\n]+$/.test(signature)) {
                    throw new Error(
                        "/qz/sign 응답이 Base64 형식이 아닙니다."
                    );
                }

                resolve(signature);
            })
            .catch(function (error) {
                console.error("[QZ] 서명 처리 실패:", error);
                reject(error);
            });
        };
    });

    infoQzSecurityConfigured = true;
}

/* ------------------------------------------------------------------------
 * QZ Tray 연결
 * --------------------------------------------------------------------- */
async function connectQzTray() {

    if (typeof qz === "undefined") {
        throw new Error(
            "qz-tray.js가 로드되지 않았습니다."
        );
    }

    configureQzSecurity();

    /*
     * 이미 정상 연결돼 있으면 추가 연결하지 않습니다.
     */
    if (qz.websocket.isActive()) {
        hideQzConnectingMessage();
        return true;
    }

    /*
     * 다른 함수가 현재 연결 중이면
     * 동일한 Promise를 기다립니다.
     */
    if (infoQzConnectPromise) {
        return infoQzConnectPromise;
    }

    infoQzConnectPromise =
        (async function () {

            const usingSecure =
                window.location.protocol ===
                "https:";

            /*
             * 기본값처럼 여러 포트를 순회하지 않고
             * 현재 페이지 프로토콜에 맞는 포트 하나만 사용합니다.
             */
            const connectionOptions = {
                host: usingSecure
                    ? "localhost.qz.io"
                    : "localhost",

                port: {
                    secure: [8181],
                    insecure: [8182]
                },

                usingSecure: usingSecure,

                /*
                 * QZ 내부 재시도는 사용하지 않습니다.
                 * 아래 for 문에서 정확히 2회만 제어합니다.
                 */
                retries: 0,
                delay: 0
            };

            let lastError = null;

            for (
                let attempt = 1;
                attempt <=
                    INFO_QZ_MAX_CONNECT_ATTEMPTS;
                attempt++
            ) {
                showQzConnectingMessage(
                    attempt,
                    INFO_QZ_MAX_CONNECT_ATTEMPTS
                );

                try {

                    /*
                     * 다른 경로에서 연결됐을 가능성 확인
                     */
                    if (
                        qz.websocket.isActive()
                    ) {
                        hideQzConnectingMessage();
                        return true;
                    }

                    console.log(
                        "[QZ] 연결 시도 " +
                        attempt +
                        "/" +
                        INFO_QZ_MAX_CONNECT_ATTEMPTS,
                        connectionOptions
                    );

                    await qz.websocket.connect(
                        connectionOptions
                    );

                    if (
                        !qz.websocket.isActive()
                    ) {
                        throw new Error(
                            "QZ Tray WebSocket 연결이 활성화되지 않았습니다."
                        );
                    }
                    
                    /*
                    console.log(
                        "[QZ] WebSocket 연결 성공:",
                        qz.websocket
                            .getConnectionInfo()
                    );
                    */

                    hideQzConnectingMessage();
                    hideQzInstallGuide();

                    return true;

                } catch (error) {

                    lastError = error;

                    console.warn(
                        "[QZ] 연결 시도 실패 " +
                        attempt +
                        "/" +
                        INFO_QZ_MAX_CONNECT_ATTEMPTS,
                        error
                    );

                    /*
                     * 마지막 시도가 아니면 잠시 기다렸다가
                     * 두 번째 시도를 수행합니다.
                     */
                    if (
                        attempt <
                        INFO_QZ_MAX_CONNECT_ATTEMPTS
                    ) {
                        await infoQzSleep(
                            INFO_QZ_CONNECT_DELAY_MS
                        );
                    }
                }
            }

            throw (
                lastError ||
                new Error(
                    "QZ Tray에 연결하지 못했습니다."
                )
            );

        })()
        .finally(function () {

            hideQzConnectingMessage();

            /*
             * 연결 작업 Promise만 초기화합니다.
             * 성공한 WebSocket 연결은 유지됩니다.
             */
            infoQzConnectPromise = null;
        });

    return infoQzConnectPromise;
}

async function disconnectQzTray() {
    infoQzConnectPromise = null;
    infoQzPrinterListPromise = null;

    if (
        typeof qz !== "undefined" &&
        qz.websocket.isActive()
    ) {
        await qz.websocket.disconnect();
    }
}


/* ------------------------------------------------------------------------
 * 설치 안내 Region 및 버튼 상태
 * --------------------------------------------------------------------- */
function setPrintButtonEnabled(enabled) {
    const button = document.getElementById("BTN_PRINT");

    if (button) {
        button.disabled = !enabled;
    }
}

/**
 * 프린터 조회 버튼 활성화/비활성화 
 * 프린터 조회 버튼 Static ID:
 * BTN_PRINTER_REFRESH
 */
function setPrinterRefreshButtonEnabled(enabled) {

    const button =
        document.getElementById(
            "BTN_PRINTER_REFRESH"
        );

    if (!button) {
        console.warn(
            "[QZ] BTN_PRINTER_REFRESH 버튼을 찾지 못했습니다."
        );
        return;
    }

    button.disabled = !enabled;

    $(button)
        .attr(
            "aria-disabled",
            enabled ? "false" : "true"
        )
        .toggleClass(
            "is-disabled",
            !enabled
        );
}
 
function setQzInstallGuideVisible(
    visible,
    error
) {
    const region$ =
        $("#QZ_INSTALL_GUIDE");

    if (!region$.length) {
        console.warn(
            "[QZ] Static ID가 QZ_INSTALL_GUIDE인 " +
            "Region을 찾지 못했습니다."
        );
    }

    if (visible) {

        /*
         * 연결 실패 안내 표시
         */
        region$
            .removeClass("u-hidden")
            .show();

        /*
         * 연결되지 않았으므로 인쇄는 막습니다.
         */
        setPrintButtonEnabled(false);

        /*
         * 사용자가 다시 연결을 시도할 수 있도록
         * 프린터 조회 버튼은 활성화합니다.
         */
        setPrinterRefreshButtonEnabled(true);

        if (error) {
            console.error(
                "[QZ] 연결 실패:",
                error
            );
        }

    } else {

        /*
         * 연결 성공 시 설치 안내 숨김
         */
        region$
            .addClass("u-hidden")
            .hide();

        setPrintButtonEnabled(true);
        setPrinterRefreshButtonEnabled(true);
    }
}

function showQzInstallGuide(error) {
    setQzInstallGuideVisible(true, error);
}

function hideQzInstallGuide() {
    setQzInstallGuideVisible(false);
}

async function ensureQzTrayAvailable() {

    if (typeof qz === "undefined") {

        const error = new Error(
            "qz-tray.js가 로드되지 않았습니다."
        );

        console.error(
            "[QZ] 라이브러리 로드 실패:",
            error
        );

        showQzConnectionErrorMessage(error);
        showQzInstallGuide(error);

        return false;
    }

    try {

        await connectQzTray();

        /*
         * 연결 성공 시 상태 안내와 설치 안내를 숨깁니다.
         */
        hideQzConnectingMessage();
        hideQzInstallGuide();

        return true;

    } catch (error) {

        console.error(
            "[QZ] 연결 확인 실패:",
            error
        );

        /*
         * 팝업 대신 화면 Region에 오류를 표시합니다.
         */
        showQzConnectionErrorMessage(error);

        /*
         * 설치 및 실행 안내도 표시합니다.
         */
        showQzInstallGuide(error);

        setPrinterRefreshButtonEnabled(true);

        return false;
    }
}

/* ------------------------------------------------------------------------
 * 프린터 목록 조회 및 기본 프린터 선택
 * --------------------------------------------------------------------- */
function infoQzNormalizePrinterList(result) {
    const values = Array.isArray(result)
        ? result
        : (result ? [result] : []);

    return Array.from(
        new Set(
            values
                .map(function (printerName) {
                    return String(printerName || "").trim();
                })
                .filter(Boolean)
        )
    ).sort(function (a, b) {
        return a.localeCompare(b, "ko");
    });
}

function infoQzBindPrinterSave(selectElement) {
    $(selectElement)
        .off("change.infoQzPrinter")
        .on("change.infoQzPrinter", function () {
            const printerName = String(this.value || "").trim();

            if (printerName) {
                localStorage.setItem(
                    INFO_QZ_CONFIG.printerStorageKey,
                    printerName
                );
            } else {
                localStorage.removeItem(
                    INFO_QZ_CONFIG.printerStorageKey
                );
            }
        });
}

function infoQzFillPrinterSelect(
    printerList,
    defaultPrinter
) {
    const selectElement = document.getElementById(
        "P919_PRINTER_NAME"
    );

    if (!selectElement) {
        throw new Error(
            "P919_PRINTER_NAME 아이템을 찾을 수 없습니다."
        );
    }

    if (selectElement.tagName.toUpperCase() !== "SELECT") {
        throw new Error(
            "P919_PRINTER_NAME을 Select List로 설정하세요. " +
            "현재 태그: " + selectElement.tagName
        );
    }

    selectElement.options.length = 0;
    selectElement.appendChild(
        new Option("- 프린터 선택 -", "")
    );

    printerList.forEach(function (printerName) {
        selectElement.appendChild(
            new Option(printerName, printerName)
        );
    });

    const savedPrinter = String(
        localStorage.getItem(
            INFO_QZ_CONFIG.printerStorageKey
        ) || ""
    ).trim();

    let selectedPrinter = "";

    /*
     * 요구사항: Windows 기본 프린터를 가장 먼저 선택합니다.
     * 기본 프린터가 없을 때만 이전 선택값과 첫 번째 프린터를 사용합니다.
     */
    if (
        defaultPrinter &&
        printerList.includes(defaultPrinter)
    ) {
        selectedPrinter = defaultPrinter;
    } else if (
        savedPrinter &&
        printerList.includes(savedPrinter)
    ) {
        selectedPrinter = savedPrinter;
    } else if (printerList.length > 0) {
        selectedPrinter = printerList[0];
    }

    selectElement.value = selectedPrinter;
    infoQzBindPrinterSave(selectElement);

    if (selectedPrinter) {
        localStorage.setItem(
            INFO_QZ_CONFIG.printerStorageKey,
            selectedPrinter
        );
    }

    $(selectElement).trigger("change");

    return selectedPrinter;
}

async function loadQzPrinterList() {

    if (infoQzPrinterListPromise) {
        return infoQzPrinterListPromise;
    }

    infoQzPrinterListPromise =
        (async function () {

            await connectQzTray();

            const selectElement =
                document.getElementById(
                    "P919_PRINTER_NAME"
                );

            if (!selectElement) {
                throw new Error(
                    "P919_PRINTER_NAME 아이템을 찾을 수 없습니다."
                );
            }

            if (
                selectElement.tagName
                    .toUpperCase() !== "SELECT"
            ) {
                throw new Error(
                    "P919_PRINTER_NAME을 Select List로 설정하세요. " +
                    "현재 태그: " +
                    selectElement.tagName
                );
            }

            /*
             * 전체 프린터 조회
             */
            const printerResult =
                await qz.printers.find();

            const printerList =
                infoQzNormalizePrinterList(
                    printerResult
                );

            /*
             * Windows 기본 프린터 조회
             */
            let defaultPrinter = "";

            try {

                defaultPrinter =
                    String(
                        await qz.printers
                            .getDefault() || ""
                    ).trim();

            } catch (error) {

                console.warn(
                    "[QZ] Windows 기본 프린터 조회 실패:",
                    error
                );
            }

            /*
             * 기본 프린터가 목록에 없으면 추가합니다.
             */
            if (
                defaultPrinter &&
                !printerList.includes(
                    defaultPrinter
                )
            ) {
                printerList.push(
                    defaultPrinter
                );

                printerList.sort(
                    function (a, b) {
                        return a.localeCompare(
                            b,
                            "ko"
                        );
                    }
                );
            }

            const selectedPrinter =
                infoQzFillPrinterSelect(
                    printerList,
                    defaultPrinter
                );
            /*
            console.log(
                "[QZ] 조회된 프린터:",
                printerList
            );

            console.log(
                "[QZ] Windows 기본 프린터:",
                defaultPrinter
            );

            console.log(
                "[QZ] 화면 선택 프린터:",
                selectedPrinter
            );
            */
            return printerList;

        })();

    try {

        return await
            infoQzPrinterListPromise;

    } finally {

        infoQzPrinterListPromise = null;
    }
}

/**
 * 프린터 조회 버튼에서 호출합니다.
 * 성공 또는 실패 여부와 관계없이 조회 버튼을 다시 활성화합니다.
 */
async function refreshQzPrinterList(triggeringElement) {
    try {
        setPrinterRefreshButtonEnabled(false);

        const printerList =
            await loadQzPrinterList();

        if (!printerList.length) {
            throw new Error(
                "사용자 PC에 등록된 프린터가 없습니다."
            );
        }

        hideQzConnectingMessage();
        hideQzInstallGuide();

        return printerList;

    } catch (error) {

        console.error(
            "[QZ] 프린터 목록 조회 실패:",
            error
        );

        showQzConnectionErrorMessage(error);

        if (
            typeof qz === "undefined" ||
            !qz.websocket.isActive()
        ) {
            showQzInstallGuide(error);
        }

        return [];

    } finally {

        setPrinterRefreshButtonEnabled(true);
    }
}

/* ------------------------------------------------------------------------
 * 인쇄 요청 및 옵션
 * --------------------------------------------------------------------- */
function infoQzGetPrintMode() {
    const value = String(
        infoQzGetItemValue("P919_PRINT_MODE", "SELECT")
    ).trim().toUpperCase();

    if (["SELECT", "DEFAULT", "DIRECT"].includes(value)) {
        return value;
    }

    return "SELECT";
}

function infoQzApplyPrintModeUi(printMode) {
    if (!infoQzHasItem("P919_PRINTER_NAME")) {
        return;
    }

    if (printMode === "DEFAULT") {
        apex.item("P919_PRINTER_NAME").disable();
    } else {
        apex.item("P919_PRINTER_NAME").enable();
    }
}

function infoQzBuildPrinterOptions(options) {
    const settings = options || {};
    const config = {
        copies: infoQzNormalizeCopies(settings.copies),
        scaleContent: settings.scaleContent !== false,
        margins: settings.margins !== undefined
            ? settings.margins
            : 0,
        jobName: String(
            settings.jobName || "APEX PDF Print"
        ).trim()
    };

    const orientation = String(
        settings.orientation || ""
    ).trim();

    if (orientation && orientation.toUpperCase() !== "AUTO") {
        config.orientation = orientation;
    }

    const duplex = String(
        settings.duplex || ""
    ).trim();

    if (
        duplex &&
        duplex.toUpperCase() !== "DEFAULT"
    ) {
        config.duplex = duplex;
    }

    const colorType = String(
        settings.colorType || ""
    ).trim();

    if (
        colorType &&
        colorType.toUpperCase() !== "DEFAULT"
    ) {
        config.colorType = colorType;
    }

    const paperSize = String(
        settings.paperSize || ""
    ).trim().toUpperCase();

    if (paperSize === "A4") {
        config.units = "mm";
        config.size = { width: 210, height: 297 };
    } else if (paperSize === "A3") {
        config.units = "mm";
        config.size = { width: 297, height: 420 };
    } else if (paperSize === "LETTER") {
        config.units = "mm";
        config.size = { width: 215.9, height: 279.4 };
    }

    return config;
}

async function infoQzResolvePrinterName(preferredPrinterName) {
    const preferred = String(
        preferredPrinterName || ""
    ).trim();

    if (preferred) {
        return preferred;
    }

    const defaultPrinter = String(
        await qz.printers.getDefault() || ""
    ).trim();

    if (!defaultPrinter) {
        throw new Error("Windows 기본 프린터가 설정되어 있지 않습니다.");
    }

    return defaultPrinter;
}

/* ------------------------------------------------------------------------
 * PDF 인쇄
 * --------------------------------------------------------------------- */
async function printPdfFromUrl(pdfUrl, options) {
    const settings = options || {};
    const value = String(pdfUrl || "").trim();

    if (!value) {
        throw new Error("인쇄할 PDF URL이 없습니다.");
    }

    const absolutePdfUrl = new URL(
        value,
        window.location.href
    ).href;

    await connectQzTray();

    const printerName = await infoQzResolvePrinterName(
        settings.printerName
    );

    const config = qz.configs.create(
        printerName,
        infoQzBuildPrinterOptions(settings)
    );

    const pdfData = [{
        type: "pixel",
        format: "pdf",
        flavor: "file",
        data: absolutePdfUrl,
        options: {
            pageRanges: settings.pageRanges || null,
            ignoreTransparency:
                settings.ignoreTransparency === true,
            altFontRendering:
                settings.altFontRendering === true
        }
    }];
    
    /*
    console.log("[QZ] PDF 인쇄 요청:", {
        printerName: printerName,
        pdfUrl: absolutePdfUrl,
        copies: settings.copies || 1
    });
    */
    await qz.print(config, pdfData);

    return {
        printerName: printerName,
        pdfUrl: absolutePdfUrl
    };
}

function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = "";

    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        const chunk = bytes.subarray(
            offset,
            Math.min(offset + chunkSize, bytes.length)
        );
        binary += String.fromCharCode.apply(null, chunk);
    }

    return window.btoa(binary);
}

async function printAuthenticatedPdfFromUrl(pdfUrl, options) {
    const settings = options || {};
    const absolutePdfUrl = new URL(
        String(pdfUrl || "").trim(),
        window.location.href
    ).href;

    const response = await fetch(absolutePdfUrl, {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: {
            "Accept": "application/pdf"
        }
    });

    if (!response.ok) {
        throw new Error("PDF 조회 실패: HTTP " + response.status);
    }

    const contentType = String(
        response.headers.get("Content-Type") || ""
    ).toLowerCase();

    if (contentType && !contentType.includes("application/pdf")) {
        throw new Error(
            "서버가 PDF가 아닌 데이터를 반환했습니다.\n" +
            "Content-Type: " + contentType
        );
    }

    const pdfBuffer = await response.arrayBuffer();

    if (!pdfBuffer.byteLength) {
        throw new Error("PDF 파일이 비어 있습니다.");
    }

    const pdfBase64 = arrayBufferToBase64(pdfBuffer);

    await connectQzTray();

    const printerName = await infoQzResolvePrinterName(
        settings.printerName
    );

    const config = qz.configs.create(
        printerName,
        infoQzBuildPrinterOptions(settings)
    );

    await qz.print(config, [{
        type: "pixel",
        format: "pdf",
        flavor: "base64",
        data: pdfBase64,
        options: {
            pageRanges: settings.pageRanges || null,
            ignoreTransparency:
                settings.ignoreTransparency === true,
            altFontRendering:
                settings.altFontRendering === true
        }
    }]);

    return {
        printerName: printerName,
        size: pdfBuffer.byteLength
    };
}

async function printCurrent919Request(triggeringElement) {
    if (infoQzPrintRunning) {
        return;
    }

    infoQzPrintRunning = true;

    try {
        if (triggeringElement) {
            $(triggeringElement).prop("disabled", true);
        }

        const pdfUrl = String(
            infoQzGetItemValue("P919_PDF_URL", "")
        ).trim();
        
        const printMode = String(
            infoQzGetItemValue("P919_PRINT_MODE", "")
        ).trim();

        const printerName = String(
            infoQzGetItemValue("P919_PRINTER_NAME", "")
        ).trim();

        const copies = infoQzNormalizeCopies(
            infoQzGetItemValue("P919_COPIES", 1)
        );

        let delayTime = 3000;
        if (printMode === "DIRECT"){
            delayTime = 500;
        }

        const result = await printPdfFromUrl(pdfUrl, {
            printerName: printerName,
            copies: copies,
            jobName: infoQzGetItemValue(
                "P919_JOB_NAME",
                "APEX PDF Print"
            ),
            orientation: infoQzGetItemValue(
                "P919_ORIENTATION",
                "AUTO"
            ),
            paperSize: infoQzGetItemValue(
                "P919_PAPER_SIZE",
                "DEFAULT"
            ),
            duplex: infoQzGetItemValue(
                "P919_DUPLEX",
                "DEFAULT"
            ),
            colorType: infoQzGetItemValue(
                "P919_COLOR_TYPE",
                "DEFAULT"
            ), 
            margins: 0
        });

        apex.message.showPageSuccess(
            "PDF를 프린터로 전송했습니다. 프린터: " +
            result.printerName
        );

        window.setTimeout(function () {
            apex.navigation.dialog.close(true);
        }, delayTime);

    } catch (error) {
        console.error("[QZ] PDF 인쇄 실패:", error);
        apex.message.alert(
            "PDF 인쇄에 실패했습니다.\n\n" +
            infoQzErrorMessage(error)
        );
    } finally {
        infoQzPrintRunning = false;

        if (triggeringElement) {
            $(triggeringElement).prop("disabled", false);
        }
    }
}

/* ------------------------------------------------------------------------
 * 설치파일 다운로드 및 QZ Tray 실행
 * --------------------------------------------------------------------- */
function downloadQzTrayInstaller() {
    const anchor = document.createElement("a");
    anchor.href = INFO_QZ_CONFIG.installerUrl;
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    apex.message.showPageSuccess(
        "QZ Tray 설치파일 다운로드를 시작했습니다."
    );
}

function launchQzTray() {
    window.location.href = "qz:launch";

    window.setTimeout(function () {
        retryQzTrayConnection();
    }, 3000);
}

async function retryQzTrayConnection() {
    apex.message.clearErrors();

    const connected =
        await ensureQzTrayAvailable();

    if (!connected) {
        return false;
    }

    await loadQzPrinterList();

    apex.message.showPageSuccess(
        "QZ Tray 연결에 성공했습니다."
    );

    return true;
}
 
/* ------------------------------------------------------------------------
 * 919 페이지 초기화
 * --------------------------------------------------------------------- */
async function initializeQz919Page() {
    hideQzInstallGuide();

    try {
        const connected = await ensureQzTrayAvailable();

        if (!connected) {
            return;
        }

        const printerList = await loadQzPrinterList();

        if (!printerList.length) {
            throw new Error(
                "사용자 PC에 등록된 프린터가 없습니다."
            );
        }

        const printMode = infoQzGetPrintMode();
        infoQzApplyPrintModeUi(printMode);
        /*
        console.log("[QZ] 919 페이지 초기화 완료", {
            printMode: printMode,
            selectedPrinter: infoQzGetItemValue(
                "P919_PRINTER_NAME",
                ""
            ),
            printerCount: printerList.length
        });
        */
        if (printMode === "DIRECT") {
            await printCurrent919Request(null);
        }
    } catch (error) {
        console.error("[QZ] 919 페이지 초기화 실패:", error);

        /*
        * 팝업을 띄우지 않고 화면 상태 Region에 표시합니다.
        */
        showQzConnectionErrorMessage(error);

        /*
        * QZ Tray 설치 또는 실행 안내 표시
        */
        showQzInstallGuide(error);

        /*
        * 사용자가 다시 시도할 수 있도록 조회 버튼 활성화
        */
        setPrinterRefreshButtonEnabled(true);
    }
}

/**
 * QZ Tray 연결 실패 내용을 팝업이 아닌
 * QZ_CONNECT_STATUS Region에 표시합니다.
 */
function showQzConnectionErrorMessage(error) {

    const region$ =
        $("#QZ_CONNECT_STATUS");

    const message =
        "QZ Tray에 연결하지 못했습니다. " +
        infoQzErrorMessage(error);

    $("#QZ_CONNECT_STATUS_TEXT")
        .text(message);

    if (region$.length) {
        region$
            .removeClass("u-hidden")
            .show();
    }

    /*
     * 연결 실패 후 다시 조회할 수 있도록
     * 프린터 조회 버튼은 활성화합니다.
     */
    setPrinterRefreshButtonEnabled(true);

    /*
     * 연결되지 않았으므로 인쇄 버튼은 비활성화합니다.
     */
    setPrintButtonEnabled(false);
}

/**
 * QZ Tray 연결 중 메시지를 표시합니다.
 */
function showQzConnectingMessage(
    attempt,
    maxAttempts
) {
    const region$ =
        $("#QZ_CONNECT_STATUS");

    const message =
        "QZ Tray 연결 중입니다. (" +
        attempt +
        "/" +
        maxAttempts +
        ")";

    $("#QZ_CONNECT_STATUS_TEXT")
        .text(message);

    if (region$.length) {
        region$
            .removeClass("u-hidden")
            .show();
    }

    /*
     * 연결 중에만 조회 버튼을 비활성화합니다.
     */
    if (
        typeof setPrinterRefreshButtonEnabled ===
        "function"
    ) {
        setPrinterRefreshButtonEnabled(false);
    }
}

/**
 * QZ Tray 연결 중 메시지를 숨깁니다.
 */
function hideQzConnectingMessage() {

    const region$ =
        $("#QZ_CONNECT_STATUS");

    if (region$.length) {
        region$
            .addClass("u-hidden")
            .hide();
    }

    /*
     * 성공·실패와 관계없이 다시 조회할 수 있게 합니다.
     */
    if (
        typeof setPrinterRefreshButtonEnabled ===
        "function"
    ) {
        setPrinterRefreshButtonEnabled(true);
    }
}
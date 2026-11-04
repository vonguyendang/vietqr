/**
 * VietQR Payment Suite - Comprehensive Client-side Script
 * Modern SVG-First Quicklink, Bank Deeplink, Decoder, EMVCo TLV Parser, Bank Directory, STK & MST Lookup
 */

// Global State
let banksData = [];
let deeplinkApps = { android: [], ios: [] };
let currentPlatform = 'android';
let isTurnstileValid = false;
let isBankLoaded = false;
let currentLang = localStorage.getItem('vietqr_lang') || 'vi';
let deeplinkQrInstance = null;
let cameraStream = null;
let cameraAnimationId = null;
let currentDevLang = 'curl';

let currentDecodedData = null;
let currentParsedData = null;

// =========================================================================
// 1. VIETNAMESE ACCENT STRIPPER & FORMATTING HELPERS
// =========================================================================

function removeVietnameseTones(str) {
    if (!str) return '';
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|Ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    return str.replace(/[^a-zA-Z0-9\s]/g, "");
}

function formatVND(amount) {
    if (!amount && amount !== 0) return '';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

// =========================================================================
// 2. VIETQR-CORE: OFFLINE EMVCo PAYLOAD GENERATOR & CRC16-CCITT
// =========================================================================

function crc16CCITT(data) {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
        let c = data.charCodeAt(i);
        crc ^= (c << 8);
        for (let j = 0; j < 8; j++) {
            if ((crc & 0x8000) !== 0) {
                crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
            } else {
                crc = (crc << 1) & 0xFFFF;
            }
        }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
}

function tlv(tag, value) {
    if (!value && value !== 0) return '';
    const valStr = value.toString();
    const len = valStr.length.toString().padStart(2, '0');
    return tag + len + valStr;
}

function buildVietQREmvco({ bin, accountNo, amount, purpose, serviceCode = 'QRIBFTTA' }) {
    // Tag 00: Payload Format Indicator = '01'
    let str = tlv('00', '01');
    // Tag 01: Point of Initiation (11: static, 12: dynamic)
    str += tlv('01', amount ? '12' : '11');
    
    // Tag 38: Merchant Account Information (VietQR Napas247)
    const sub00 = tlv('00', bin);
    const sub01 = tlv('01', accountNo);
    const tag01 = tlv('01', sub00 + sub01);
    const tag02 = tlv('02', serviceCode);
    const tag38Value = tlv('00', 'A000000727') + tag01 + tag02;
    str += tlv('38', tag38Value);
    
    // Tag 53: Transaction Currency (704 = VND)
    str += tlv('53', '704');
    
    // Tag 54: Amount
    if (amount) {
        str += tlv('54', amount.toString());
    }
    
    // Tag 58: Country Code = 'VN'
    str += tlv('58', 'VN');
    
    // Tag 62: Additional Data Field (Purpose)
    if (purpose) {
        const cleanDesc = removeVietnameseTones(purpose).substring(0, 50);
        str += tlv('62', tlv('08', cleanDesc));
    }
    
    // Tag 63: CRC16
    str += '6304';
    const crc = crc16CCITT(str);
    return {
        payload: str + crc,
        crc: crc
    };
}

// =========================================================================
// 3. EMVCo TLV PARSER & VERIFIER (CLIENT-SIDE)
// =========================================================================

function parseTLVRaw(payload) {
    let i = 0;
    const tags = {};
    while (i < payload.length) {
        if (i + 4 > payload.length) break;
        const tag = payload.substring(i, i + 2);
        const len = parseInt(payload.substring(i + 2, i + 4), 10);
        i += 4;
        if (isNaN(len) || i + len > payload.length) break;
        const val = payload.substring(i, i + len);
        tags[tag] = val;
        i += len;
    }
    return tags;
}

const TAG_DEFINITIONS = {
    '00': 'Phiên bản định dạng (Payload Format Indicator)',
    '01': 'Phương thức khởi tạo (Point of Initiation Method: 11-Static, 12-Dynamic)',
    '38': 'Thông tin tài khoản thụ hưởng (VietQR Napas247 Merchant Account Information)',
    '52': 'Mã danh mục thương nhân (Merchant Category Code)',
    '53': 'Mã loại tiền tệ giao dịch (Transaction Currency: 704 = VNĐ)',
    '54': 'Số tiền giao dịch (Transaction Amount)',
    '58': 'Mã quốc gia (Country Code: VN)',
    '59': 'Tên chủ tài khoản / thương nhân (Merchant Name)',
    '60': 'Thành phố thương nhân (Merchant City)',
    '62': 'Dữ liệu bổ sung (Additional Data: Mã đơn hàng, Nội dung)',
    '63': 'Mã kiểm tra tính toàn vẹn (CRC-16 CCITT)'
};

function parseVietQRPayload(payload) {
    if (!payload || typeof payload !== 'string') return null;
    const cleanPayload = payload.trim();
    const root = parseTLVRaw(cleanPayload);

    const result = {
        raw: cleanPayload,
        version: root['00'] || '01',
        qrType: root['01'] === '12' ? 'Mã động (Dynamic - Có số tiền)' : 'Mã tĩnh (Static)',
        guid: null,
        bankBin: null,
        bankInfo: null,
        accountNo: null,
        serviceCode: null,
        serviceType: null,
        currency: root['53'] === '704' ? 'VNĐ (704)' : (root['53'] || 'VNĐ'),
        amount: root['54'] ? parseInt(root['54'], 10) : null,
        country: root['58'] || 'VN',
        accountName: root['59'] || null,
        description: null,
        billNumber: null,
        crc: root['63'] || null,
        isValidCrc: false,
        calculatedCrc: null,
        tagsList: [],
        rawTags: root
    };

    // Sub-tags of Tag 38
    if (root['38']) {
        const sub38 = parseTLVRaw(root['38']);
        result.guid = sub38['00'];
        if (sub38['01']) {
            const org = parseTLVRaw(sub38['01']);
            result.bankBin = org['00'];
            result.accountNo = org['01'];
        }
        result.serviceCode = sub38['02'];
        result.serviceType = sub38['02'] === 'QRIBFTTC' ? 'Thẻ (QRIBFTTC)' : 'Tài khoản (QRIBFTTA)';
    }

    // Sub-tags of Tag 62
    if (root['62']) {
        const sub62 = parseTLVRaw(root['62']);
        result.billNumber = sub62['01'] || null;
        result.description = sub62['08'] || null;
    }

    // Match bank info
    if (result.bankBin && banksData.length > 0) {
        result.bankInfo = banksData.find(b => b.bin === result.bankBin) || null;
    }

    // Validate CRC16
    const crcIdx = cleanPayload.indexOf('6304');
    if (crcIdx !== -1 && cleanPayload.length >= crcIdx + 8) {
        const expectedData = cleanPayload.substring(0, crcIdx + 4);
        const actualCrc = cleanPayload.substring(crcIdx + 4, crcIdx + 8);
        const calcCrc = crc16CCITT(expectedData);
        result.calculatedCrc = calcCrc;
        result.isValidCrc = (calcCrc.toUpperCase() === actualCrc.toUpperCase());
    }

    // Construct flat tags list for table rendering
    Object.keys(root).forEach(tag => {
        result.tagsList.push({
            tag: tag,
            name: TAG_DEFINITIONS[tag] || 'Trường dữ liệu mở rộng',
            length: root[tag].length,
            value: root[tag]
        });
    });

    return result;
}

// =========================================================================
// 4. I18N & LOCALIZATION
// =========================================================================

function updateLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('vietqr_lang', lang);

    document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById('lang-' + lang);
    if (activeBtn) activeBtn.classList.add('active');

    // Update text
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (locales[lang] && locales[lang][key]) {
            el.innerHTML = locales[lang][key];
        }
    });

    // Update placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (locales[lang] && locales[lang][key]) {
            el.placeholder = locales[lang][key];
        }
    });

    // Update titles
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (locales[lang] && locales[lang][key]) {
            el.title = locales[lang][key];
        }
    });

    if (locales[lang] && locales[lang]['title']) {
        document.title = locales[lang]['title'];
    }

    // Refresh Select2 placeholders if initialized
    ['#bank-select', '#stk-bank-select'].forEach(selector => {
        const el = $(selector);
        if (el.hasClass('select2-hidden-accessible')) {
            el.select2('destroy');
            initBankSelect(selector);
        }
    });

    updateDevSnippet();
}

// =========================================================================
// 5. TAB NAVIGATION & HASH ROUTING
// =========================================================================

function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });

    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.classList.toggle('active', panel.id === tabId);
    });

    const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (activeBtn) {
        activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    const hashMap = {
        'tab-qr': '#qr-dong',
        'tab-decoder': '#giai-ma-qr',
        'tab-parser': '#phan-tich-emvco',
        'tab-deeplink': '#deeplink',
        'tab-bank': '#api-bank',
        'tab-stk': '#tra-cuu-stk',
        'tab-mst': '#tra-cuu-mst',
        'tab-developer': '#api-docs'
    };
    if (hashMap[tabId] && window.location.hash !== hashMap[tabId]) {
        history.replaceState(null, null, hashMap[tabId]);
    }

    if (tabId === 'tab-deeplink') {
        updateDeeplinkUrl();
    } else if (tabId === 'tab-developer') {
        updateDevSnippet();
    }
}

function handleHashRouting() {
    const hash = window.location.hash;
    const tabMap = {
        '#qr-dong': 'tab-qr',
        '#giai-ma-qr': 'tab-decoder',
        '#decoder': 'tab-decoder',
        '#phan-tich-emvco': 'tab-parser',
        '#parser': 'tab-parser',
        '#deeplink': 'tab-deeplink',
        '#api-bank': 'tab-bank',
        '#bank': 'tab-bank',
        '#tra-cuu-stk': 'tab-stk',
        '#stk': 'tab-stk',
        '#tra-cuu-mst': 'tab-mst',
        '#mst': 'tab-mst',
        '#api-docs': 'tab-developer',
        '#developer': 'tab-developer'
    };
    if (tabMap[hash]) {
        switchTab(tabMap[hash]);
    }
}

// =========================================================================
// 6. TURNSTILE BOT PROTECTION & COUNTER
// =========================================================================

function onTurnstileSuccess(token) {
    isTurnstileValid = true;
    checkSubmitBtnState();
}

function checkSubmitBtnState() {
    if (isBankLoaded) {
        $('#submitBtn').prop('disabled', false);
    }
}

async function fetchCounter() {
    try {
        const response = await fetch('/api/counter');
        if (!response.ok) throw new Error('Network response not ok');
        const data = await response.json();
        if (data && data.success) {
            document.getElementById('visitCount').innerText = data.formattedCount;
        }
    } catch (e) {
        document.getElementById('visitCount').innerText = '15,305+';
    }
}

// =========================================================================
// 7. BANK DATA LOADING & SELECT2 INITIALIZATION
// =========================================================================

function formatBankOption(bank) {
    if (!bank.id) return bank.text;
    const logoUrl = $(bank.element).data('logo');
    if (!logoUrl) return bank.text;
    return $('<span><img src="' + logoUrl + '" class="bank-logo" alt="logo" /> ' + bank.text + '</span>');
}

function initBankSelect(selector) {
    $(selector).select2({
        placeholder: locales[currentLang]['select2_placeholder'] || '--- Chọn hoặc tìm ngân hàng ---',
        templateResult: formatBankOption,
        templateSelection: formatBankOption,
        width: '100%'
    });
}

function populateBankSelects() {
    const bankSelectEl = $('#bank-select');
    const stkBankSelectEl = $('#stk-bank-select');
    const deeplinkBankSelectEl = $('#deeplinkBankSelect');

    bankSelectEl.empty();
    stkBankSelectEl.empty();
    deeplinkBankSelectEl.empty();

    banksData.forEach(bank => {
        const text = `${bank.shortName} - ${bank.name}`;
        
        // Tab 1 select
        const opt1 = new Option(text, bank.bin, false, false);
        $(opt1).data('logo', bank.logo);
        $(opt1).data('code', bank.code);
        bankSelectEl.append(opt1);

        // Tab 6 STK select
        const opt4 = new Option(text, bank.bin, false, false);
        $(opt4).data('logo', bank.logo);
        stkBankSelectEl.append(opt4);

        // Tab 4 Deeplink bank select
        const opt3 = new Option(`${bank.shortName} (${bank.code})`, bank.code.toLowerCase(), false, false);
        $(opt3).data('bin', bank.bin);
        deeplinkBankSelectEl.append(opt3);
    });

    const defaultBin = '970415';
    bankSelectEl.val(defaultBin).trigger('change');
    stkBankSelectEl.val(defaultBin).trigger('change');
    deeplinkBankSelectEl.val('vcb').trigger('change');

    $('#i_bank').val(defaultBin);
}

async function loadBanks() {
    try {
        const res = await fetch("https://api.vietqr.io/v2/banks");
        const json = await res.json();
        if (json.code === '00' && json.data && json.data.length > 0) {
            banksData = json.data;
        } else {
            throw new Error('API returned invalid code');
        }
    } catch (e) {
        console.warn('Loading fallback banks.json...');
        try {
            const fallbackRes = await fetch("banks.json");
            const fallbackJson = await fallbackRes.json();
            banksData = fallbackJson.data || [];
        } catch (err2) {
            console.error('Failed to load banks.json', err2);
        }
    }

    if (banksData.length > 0) {
        populateBankSelects();
        renderBankDirectory(banksData);
        document.getElementById('bankCountBadge').innerText = `${banksData.length} Ngân hàng`;
    }

    isBankLoaded = true;
    checkSubmitBtnState();
}

// =========================================================================
// 8. TAB 1: GENERATE VIETQR (SVG FIRST + VIETQR CORE)
// =========================================================================

let currentGenerated = {
    quicklinkUrl: '',
    svgBlobUrl: '',
    pngBlobUrl: '',
    emvcoPayload: '',
    crc: ''
};

function genAndScanQR() {
    const placeholder = document.getElementById('qr-result-placeholder');
    const resultWrapper = document.getElementById('qr-result-wrapper');
    const imgEl = document.getElementById('qrimg');
    const qrStrEl = document.getElementById('qrstr');
    const qrcEl = document.getElementById('qrc');

    const bank = document.getElementById('i_bank').value;
    const acc = document.getElementById('i_acc').value.trim();
    if (!bank || !acc) {
        alert(locales[currentLang]['alert_select_bank']);
        return;
    }

    const template = document.getElementById('qr-template-select').value;
    const format = document.getElementById('qr-format-select').value;
    const amount = document.getElementById('i_amount').value.trim();
    const desc = document.getElementById('i_desc').value.trim();
    const name = document.getElementById('i_name').value.trim();

    // 1. Generate standard EMVCo offline payload immediately
    const offlineVietQR = buildVietQREmvco({
        bin: bank,
        accountNo: acc,
        amount: amount ? parseInt(amount, 10) : null,
        purpose: desc
    });

    currentGenerated.emvcoPayload = offlineVietQR.payload;
    currentGenerated.crc = offlineVietQR.crc;

    // Update specs display
    document.getElementById('specBinDisplay').innerText = bank;
    document.getElementById('specAccDisplay').innerText = acc;
    document.getElementById('specAmountDisplay').innerText = amount ? formatVND(amount) : '(Tùy tâm / Trống)';
    document.getElementById('specDescDisplay').innerText = desc || '(Không có)';
    qrcEl.innerText = offlineVietQR.crc;
    qrStrEl.innerText = offlineVietQR.payload;

    // 2. Build Quicklink URL (SVG-First)
    const params = new URLSearchParams();
    if (amount) params.append('amount', amount);
    if (desc) params.append('addInfo', removeVietnameseTones(desc));
    if (name) params.append('accountName', removeVietnameseTones(name).toUpperCase());

    const queryString = params.toString();
    const quicklinkUrl = `https://img.vietqr.io/image/${bank}-${acc}-${template}.${format}${queryString ? '?' + queryString : ''}`;
    currentGenerated.quicklinkUrl = quicklinkUrl;

    // Smooth UI transition
    placeholder.style.display = 'none';
    resultWrapper.style.display = 'flex';
    resultWrapper.style.opacity = '0.5';

    if (window.innerWidth <= 992) {
        setTimeout(() => {
            resultWrapper.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

    imgEl.src = quicklinkUrl;

    imgEl.onload = function() {
        resultWrapper.style.opacity = '1';

        try {
            const canvas = document.createElement('canvas');
            canvas.width = imgEl.naturalWidth || 540;
            canvas.height = imgEl.naturalHeight || 540;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(imgEl, 0, 0);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            if (code && code.data) {
                qrStrEl.innerText = code.data;
                const idx = code.data.indexOf('6304');
                if (idx !== -1) {
                    qrcEl.innerText = code.data.substr(idx + 4, 4);
                }
            }
        } catch (e) {
            console.log('jsQR decode skipped, offline EMVCo active');
        }
    };

    imgEl.onerror = function() {
        resultWrapper.style.opacity = '1';
        alert(locales[currentLang]['alert_qr_failed']);
    };

    updateDevSnippet();
}

async function downloadSvg() {
    if (!currentGenerated.quicklinkUrl) return;
    try {
        const svgUrl = currentGenerated.quicklinkUrl.replace(/\.(png|jpg|jpeg)/, '.svg');
        const res = await fetch(svgUrl);
        const svgText = await res.text();
        const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `VietQR-${document.getElementById('i_acc').value || 'code'}.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
    } catch (e) {
        window.open(currentGenerated.quicklinkUrl, '_blank');
    }
}

async function downloadPng() {
    if (!currentGenerated.quicklinkUrl) return;
    try {
        const pngUrl = currentGenerated.quicklinkUrl.replace(/\.svg/, '.png');
        const res = await fetch(pngUrl);
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `VietQR-${document.getElementById('i_acc').value || 'code'}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
    } catch (e) {
        const imgEl = document.getElementById('qrimg');
        const canvas = document.createElement('canvas');
        canvas.width = imgEl.naturalWidth || 540;
        canvas.height = imgEl.naturalHeight || 540;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgEl, 0, 0);
        canvas.toBlob(blob => {
            if (!blob) return alert(locales[currentLang]['alert_download_failed']);
            const blobUrl = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = `VietQR-${document.getElementById('i_acc').value || 'code'}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(blobUrl);
        });
    }
}

async function copyQrImage() {
    const imgEl = document.getElementById('qrimg');
    if (!imgEl || !imgEl.src) return;
    try {
        const canvas = document.createElement('canvas');
        canvas.width = imgEl.naturalWidth || 540;
        canvas.height = imgEl.naturalHeight || 540;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgEl, 0, 0);
        canvas.toBlob(async blob => {
            if (!blob) return;
            try {
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                showTempButtonFeedback(document.getElementById('copyImageBtn'), '<i class="fa-solid fa-check"></i> Đã sao chép ảnh!');
            } catch (err) {
                alert(locales[currentLang]['alert_copy_failed']);
            }
        });
    } catch (e) {
        alert(locales[currentLang]['alert_copy_failed']);
    }
}

function showTempButtonFeedback(btn, newHtml) {
    if (!btn) return;
    const oldHtml = btn.innerHTML;
    btn.innerHTML = newHtml;
    setTimeout(() => { btn.innerHTML = oldHtml; }, 2000);
}

function copyToClipboard(text, btn) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
        showTempButtonFeedback(btn, '<i class="fa-solid fa-check"></i> Đã chép!');
    }).catch(() => {
        alert(locales[currentLang]['alert_copy_failed']);
    });
}

// =========================================================================
// 9. TAB 2: QR DECODER (IMAGE UPLOAD, CLIPBOARD PASTE, CAMERA)
// =========================================================================

function decodeQrFromImageData(imageData) {
    if (!imageData || typeof jsQR === 'undefined') return null;
    return jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert"
    });
}

function processImageFileForQr(file) {
    if (!file || !file.type.startsWith('image/')) {
        alert("Vui lòng chọn một tệp hình ảnh hợp lệ (PNG, JPEG, WebP, SVG, BMP)!");
        return;
    }

    const decodeStatus = document.getElementById('decodeStatus');
    const resultCard = document.getElementById('decodeResultCard');
    decodeStatus.style.display = 'flex';
    resultCard.classList.remove('show');

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            try {
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = decodeQrFromImageData(imgData);

                decodeStatus.style.display = 'none';

                if (code && code.data) {
                    displayDecodedResult(code.data);
                } else {
                    alert("Không tìm thấy mã VietQR trong hình ảnh này. Hãy đảm bảo ảnh rõ nét và đủ sáng.");
                }
            } catch (err) {
                decodeStatus.style.display = 'none';
                alert("Lỗi khi xử lý hình ảnh: " + err.message);
            }
        };
        img.onerror = function() {
            decodeStatus.style.display = 'none';
            alert("Không thể đọc tệp hình ảnh này.");
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function displayDecodedResult(rawPayload) {
    const parsed = parseVietQRPayload(rawPayload);
    if (!parsed) return;

    currentDecodedData = parsed;
    const resultCard = document.getElementById('decodeResultCard');

    // Status badges
    const crcBadge = document.getElementById('decCrcBadge');
    if (parsed.isValidCrc) {
        crcBadge.innerText = 'CRC16 Hợp lệ';
        crcBadge.style.background = 'var(--badge-green-bg)';
        crcBadge.style.color = 'var(--badge-green-text)';
    } else {
        crcBadge.innerText = 'CRC16 Không hợp lệ';
        crcBadge.style.background = 'var(--badge-red-bg)';
        crcBadge.style.color = 'var(--badge-red-text)';
    }

    document.getElementById('decQrTypeBadge').innerText = parsed.qrType;

    // Fields
    const bankNameStr = parsed.bankInfo 
        ? `${parsed.bankInfo.shortName} (${parsed.bankBin})` 
        : (parsed.bankBin ? `BIN: ${parsed.bankBin}` : '—');
    document.getElementById('decBankName').innerText = bankNameStr;
    document.getElementById('decAccountNo').innerText = parsed.accountNo || '—';
    document.getElementById('decAmount').innerText = parsed.amount ? formatVND(parsed.amount) : 'Mã tĩnh (Không kèm số tiền)';
    document.getElementById('decDesc').innerText = parsed.description || 'Không có';
    document.getElementById('decServiceType').innerText = parsed.serviceType || 'Chuyển qua Tài khoản';
    document.getElementById('decBillNumber').innerText = parsed.billNumber || '—';
    document.getElementById('decRawPayload').innerText = parsed.raw;

    resultCard.classList.add('show');
    resultCard.scrollIntoView({ behavior: 'smooth' });
}

// Live Camera Scanner
async function toggleCamera() {
    const previewContainer = document.getElementById('cameraPreviewContainer');
    const toggleBtn = document.getElementById('toggleCameraBtn');

    if (cameraStream) {
        stopCamera();
        toggleBtn.innerHTML = '<i class="fa-solid fa-camera"></i> <span data-i18n="decoder_btn_camera">Bật Camera Quét Trực Tiếp</span>';
    } else {
        try {
            cameraStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            const video = document.getElementById('cameraVideo');
            video.srcObject = cameraStream;
            video.setAttribute('playsinline', true);
            await video.play();

            previewContainer.style.display = 'block';
            toggleBtn.innerHTML = '<i class="fa-solid fa-video-slash"></i> <span data-i18n="decoder_camera_stop">Tắt Camera</span>';

            scanCameraFrame();
        } catch (err) {
            alert("Không thể truy cập camera: " + err.message);
        }
    }
}

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    if (cameraAnimationId) {
        cancelAnimationFrame(cameraAnimationId);
        cameraAnimationId = null;
    }
    document.getElementById('cameraPreviewContainer').style.display = 'none';
}

function scanCameraFrame() {
    const video = document.getElementById('cameraVideo');
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = decodeQrFromImageData(imageData);

        if (code && code.data) {
            stopCamera();
            document.getElementById('toggleCameraBtn').innerHTML = '<i class="fa-solid fa-camera"></i> <span data-i18n="decoder_btn_camera">Bật Camera Quét Trực Tiếp</span>';
            displayDecodedResult(code.data);
            return;
        }
    }
    cameraAnimationId = requestAnimationFrame(scanCameraFrame);
}

// Recreate QR from decoded data
function applyDecodedToQr() {
    if (!currentDecodedData) return;
    if (currentDecodedData.bankBin) {
        $('#bank-select').val(currentDecodedData.bankBin).trigger('change');
        $('#i_bank').val(currentDecodedData.bankBin);
    }
    if (currentDecodedData.accountNo) {
        $('#i_acc').val(currentDecodedData.accountNo);
    }
    if (currentDecodedData.amount) {
        $('#i_amount').val(currentDecodedData.amount);
    }
    if (currentDecodedData.description) {
        $('#i_desc').val(currentDecodedData.description);
    }
    switchTab('tab-qr');
    genAndScanQR();
}

function applyDecodedToDeeplink() {
    if (!currentDecodedData) return;
    if (currentDecodedData.bankInfo) {
        $('#deeplinkBankSelect').val(currentDecodedData.bankInfo.code.toLowerCase());
    }
    if (currentDecodedData.accountNo) $('#deeplinkAcc').val(currentDecodedData.accountNo);
    if (currentDecodedData.amount) $('#deeplinkAmount').val(currentDecodedData.amount);
    if (currentDecodedData.description) $('#deeplinkDesc').val(currentDecodedData.description);

    switchTab('tab-deeplink');
    updateDeeplinkUrl();
}

// =========================================================================
// 10. TAB 3: EMVCo TLV PARSER & VERIFIER
// =========================================================================

function handleParseEmvco(customPayload) {
    const raw = (customPayload || document.getElementById('parserInput').value).trim();
    if (!raw) {
        alert("Vui lòng dán chuỗi VietQR chuẩn EMVCo bắt đầu bằng 000201...!");
        return;
    }

    const parsed = parseVietQRPayload(raw);
    if (!parsed || parsed.tagsList.length === 0) {
        alert("Chuỗi không hợp lệ hoặc không đúng định dạng EMVCo.");
        return;
    }

    currentParsedData = parsed;
    const container = document.getElementById('parserResultContainer');
    const chipsContainer = document.getElementById('parserChipsContainer');
    const tbody = document.getElementById('tlvTableBody');
    const jsonPre = document.getElementById('parsedJsonCode');

    // Render chips
    chipsContainer.innerHTML = '';
    const addChip = (label, val, isSuccess) => {
        if (!val) return;
        const chip = document.createElement('span');
        chip.className = 'suite-badge';
        chip.style.fontSize = '12px';
        chip.style.padding = '4px 10px';
        chip.style.background = isSuccess ? 'var(--badge-green-bg)' : 'var(--badge-blue-bg)';
        chip.style.color = isSuccess ? 'var(--badge-green-text)' : 'var(--badge-blue-text)';
        chip.innerText = `${label}: ${val}`;
        chipsContainer.appendChild(chip);
    };

    addChip('Ngân hàng', parsed.bankInfo ? parsed.bankInfo.shortName : parsed.bankBin);
    addChip('Tài khoản', parsed.accountNo);
    if (parsed.amount) addChip('Số tiền', formatVND(parsed.amount), true);
    addChip('Loại mã', parsed.qrType);
    addChip('CRC-16', parsed.isValidCrc ? `Hợp lệ (${parsed.crc})` : `Sai lệch (Nhận: ${parsed.crc}, Tính: ${parsed.calculatedCrc})`, parsed.isValidCrc);

    // Render TLV table
    tbody.innerHTML = '';
    parsed.tagsList.forEach(t => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><span class="tag-badge">${t.tag}</span></td>
            <td><b>${t.name}</b></td>
            <td class="mono" style="color: var(--text-muted);">${t.length}</td>
            <td class="mono" style="word-break: break-all; color: var(--primary);">${t.value}</td>
        `;
        tbody.appendChild(tr);
    });

    // Render JSON
    jsonPre.innerText = JSON.stringify(parsed, null, 2);

    container.style.display = 'block';
    container.scrollIntoView({ behavior: 'smooth' });
}

function applyParsedToQr() {
    if (!currentParsedData) return;
    if (currentParsedData.bankBin) {
        $('#bank-select').val(currentParsedData.bankBin).trigger('change');
        $('#i_bank').val(currentParsedData.bankBin);
    }
    if (currentParsedData.accountNo) $('#i_acc').val(currentParsedData.accountNo);
    if (currentParsedData.amount) $('#i_amount').val(currentParsedData.amount);
    if (currentParsedData.description) $('#i_desc').val(currentParsedData.description);

    switchTab('tab-qr');
    genAndScanQR();
}

// =========================================================================
// 11. TAB 4: BANK DEEPLINK
// =========================================================================

async function loadDeeplinks() {
    try {
        const [resAndroid, resIos] = await Promise.all([
            fetch('https://api.vietqr.io/v2/android-app-deeplinks').then(r => r.json()),
            fetch('https://api.vietqr.io/v2/ios-app-deeplinks').then(r => r.json())
        ]);
        deeplinkApps.android = resAndroid.apps || [];
        deeplinkApps.ios = resIos.apps || [];
    } catch (e) {
        console.warn('Loading fallback deeplinks.json...');
        try {
            const fallback = await fetch('deeplinks.json').then(r => r.json());
            deeplinkApps = fallback;
        } catch (err2) {
            console.error('Failed to load deeplinks.json', err2);
        }
    }

    renderDeeplinkAppSelect();
    renderDeeplinkAppsTable();
    updateDeeplinkUrl();
}

function renderDeeplinkAppSelect() {
    const select = document.getElementById('deeplinkAppSelect');
    select.innerHTML = '';
    const apps = currentPlatform === 'android' ? deeplinkApps.android : deeplinkApps.ios;
    const sortedApps = [...apps].sort((a, b) => (b.autofill || 0) - (a.autofill || 0));

    sortedApps.forEach(app => {
        const opt = document.createElement('option');
        opt.value = app.appId;
        opt.innerText = `${app.appName} (${app.appId})`;
        if (app.appId === 'vcb' || app.appId === 'icb') opt.selected = true;
        select.appendChild(opt);
    });

    if (!select.value && sortedApps.length > 0) {
        select.value = sortedApps[0].appId;
    }
}

function renderDeeplinkAppsTable() {
    const tbody = document.getElementById('deeplinkAppsTableBody');
    tbody.innerHTML = '';
    const apps = currentPlatform === 'android' ? deeplinkApps.android : deeplinkApps.ios;

    apps.forEach(app => {
        const tr = document.createElement('tr');
        const autofillBadge = app.autofill === 1
            ? '<span class="bank-badge transfer-yes"><i class="fa-solid fa-bolt"></i> Tự điền</span>'
            : '<span class="bank-badge no">Chưa hỗ trợ</span>';

        const formattedInstalls = app.monthlyInstall ? new Intl.NumberFormat().format(app.monthlyInstall) : '-';

        tr.innerHTML = `
            <td>
                <div class="app-row-info">
                    <img src="${app.appLogo}" class="app-row-logo" alt="${app.appName}" loading="lazy" onerror="this.src='favicon_io/android-chrome-192x192.png'" />
                    <b>${app.appName}</b>
                </div>
            </td>
            <td>${app.bankName || '-'}</td>
            <td><code>${app.appId}</code></td>
            <td>${autofillBadge}</td>
            <td>${formattedInstalls}</td>
            <td>
                <button class="btn btn-outline-primary btn-sm select-this-app-btn" data-appid="${app.appId}" type="button">
                    Chọn App này
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.select-this-app-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const appId = this.getAttribute('data-appid');
            document.getElementById('deeplinkAppSelect').value = appId;
            updateDeeplinkUrl();
            document.querySelector('.deeplink-demo-box').scrollIntoView({ behavior: 'smooth' });
        });
    });
}

function updateDeeplinkUrl() {
    const app = document.getElementById('deeplinkAppSelect').value || 'vcb';
    const amount = document.getElementById('deeplinkAmount').value.trim() || '0';
    const desc = document.getElementById('deeplinkDesc').value.trim() || 'Thanh toan';
    const acc = document.getElementById('deeplinkAcc').value.trim() || '113366668888';
    const bank = document.getElementById('deeplinkBankSelect').value || 'vcb';

    const cleanDesc = encodeURIComponent(removeVietnameseTones(desc));
    const url = `https://dl.vietqr.io/pay?app=${app}&am=${amount}&tn=${cleanDesc}&ba=${acc}@${bank}&url=${encodeURIComponent(window.location.origin)}`;

    document.getElementById('deeplinkUrlText').innerText = url;
    document.getElementById('openAppDirectBtn').href = url;

    // Render Deeplink QR
    const qrContainer = document.getElementById('deeplinkQrCanvas');
    qrContainer.innerHTML = '';
    if (typeof QRCode !== 'undefined') {
        deeplinkQrInstance = new QRCode(qrContainer, {
            text: url,
            width: 160,
            height: 160,
            colorDark: "#0f172a",
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.M
        });
    }

    updateDevSnippet();
}

// =========================================================================
// 12. TAB 5: BANK DIRECTORY & SEARCH
// =========================================================================

function renderBankDirectory(banks) {
    const grid = document.getElementById('bankGrid');
    grid.innerHTML = '';

    if (!banks || banks.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">Không tìm thấy ngân hàng phù hợp.</div>';
        return;
    }

    banks.forEach(bank => {
        const card = document.createElement('div');
        card.className = 'bank-card';

        const transferBadge = bank.transferSupported === 1 
            ? '<span class="bank-badge transfer-yes"><i class="fa-solid fa-check"></i> Quét VietQR</span>' 
            : '<span class="bank-badge no"><i class="fa-solid fa-minus"></i> Quét QR</span>';

        const lookupBadge = bank.lookupSupported === 1 
            ? '<span class="bank-badge lookup-yes"><i class="fa-solid fa-check"></i> Tra cứu STK</span>' 
            : '<span class="bank-badge no"><i class="fa-solid fa-minus"></i> Tra cứu</span>';

        card.innerHTML = `
            <div>
                <div class="bank-card-header">
                    <img src="${bank.logo}" class="bank-card-logo" alt="${bank.shortName}" loading="lazy" onerror="this.src='favicon_io/android-chrome-192x192.png'" />
                    <div class="bank-card-meta">
                        <div class="bank-card-shortname">
                            ${bank.shortName}
                            <span class="bank-bin-badge">BIN: ${bank.bin}</span>
                        </div>
                        <div class="bank-card-name" title="${bank.name}">${bank.name}</div>
                    </div>
                </div>
                <div class="bank-card-details">
                    ${transferBadge}
                    ${lookupBadge}
                    ${bank.swift_code ? `<span class="bank-bin-badge" style="background: var(--bg-subtle); color: var(--text-muted); font-size: 11px;">SWIFT: ${bank.swift_code}</span>` : ''}
                </div>
            </div>
            <div class="bank-card-actions">
                <button class="btn btn-primary btn-sm choose-bank-qr-btn" data-bin="${bank.bin}" type="button">
                    <i class="fa-solid fa-qrcode"></i> Tạo QR
                </button>
                <button class="btn btn-secondary btn-sm choose-bank-deeplink-btn" data-code="${bank.code.toLowerCase()}" data-bin="${bank.bin}" type="button">
                    <i class="fa-solid fa-mobile-screen"></i> Deeplink
                </button>
                <button class="btn btn-secondary btn-sm copy-bin-btn" data-bin="${bank.bin}" type="button" title="Sao chép mã BIN">
                    <i class="fa-solid fa-copy"></i>
                </button>
            </div>
        `;
        grid.appendChild(card);
    });

    grid.querySelectorAll('.choose-bank-qr-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const bin = this.getAttribute('data-bin');
            $('#bank-select').val(bin).trigger('change');
            $('#i_bank').val(bin);
            switchTab('tab-qr');
            document.getElementById('i_acc').focus();
        });
    });

    grid.querySelectorAll('.choose-bank-deeplink-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const code = this.getAttribute('data-code');
            $('#deeplinkBankSelect').val(code).trigger('change');
            switchTab('tab-deeplink');
        });
    });

    grid.querySelectorAll('.copy-bin-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const bin = this.getAttribute('data-bin');
            copyToClipboard(bin, this);
        });
    });
}

function filterBanks() {
    const query = document.getElementById('bankSearchInput').value.trim().toLowerCase();
    const activeFilter = document.querySelector('.filter-pill.active')?.getAttribute('data-filter') || 'all';

    let filtered = banksData.filter(bank => {
        const matchName = (bank.name || '').toLowerCase().includes(query);
        const matchShort = (bank.shortName || '').toLowerCase().includes(query);
        const matchCode = (bank.code || '').toLowerCase().includes(query);
        const matchBin = (bank.bin || '').includes(query);
        const matchSwift = (bank.swift_code || '').toLowerCase().includes(query);
        const textMatch = matchName || matchShort || matchCode || matchBin || matchSwift;

        if (!textMatch) return false;

        if (activeFilter === 'transfer') {
            return bank.transferSupported === 1;
        } else if (activeFilter === 'lookup') {
            return bank.lookupSupported === 1;
        }
        return true;
    });

    renderBankDirectory(filtered);
}

// =========================================================================
// 13. TAB 6: TRA CỨU SỐ TÀI KHOẢN (STK)
// =========================================================================

async function handleLookupStk() {
    const bankBin = $('#stk-bank-select').val();
    const acc = $('#stk-acc-input').val().trim();
    const submitBtn = document.getElementById('stkLookupSubmitBtn');
    const resultCard = document.getElementById('stkResultCard');
    const ownerNameEl = document.getElementById('stkOwnerName');
    const bankAndAccEl = document.getElementById('stkBankAndAcc');
    const statusBadge = document.getElementById('stkBadgeStatus');

    if (!bankBin || !acc) {
        alert(locales[currentLang]['alert_select_bank']);
        return;
    }

    const clientId = document.getElementById('stk-client-id').value.trim();
    const apiKey = document.getElementById('stk-api-key').value.trim();

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tra cứu...';

    const bankObj = banksData.find(b => b.bin === bankBin) || { shortName: 'Bank', name: 'Ngân hàng' };

    try {
        let headers = { "Content-Type": "application/json" };
        if (clientId) headers["x-client-id"] = clientId;
        if (apiKey) headers["x-api-key"] = apiKey;

        const res = await fetch("/api/lookup", {
            method: "POST",
            headers: headers,
            body: JSON.stringify({
                bin: bankBin,
                accountNumber: acc
            })
        });

        const data = await res.json();
        resultCard.classList.remove('error');
        resultCard.classList.add('show');

        if (window.innerWidth <= 768) {
            setTimeout(() => {
                resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 80);
        }

        if (data.code === '00' && data.data && data.data.accountName) {
            ownerNameEl.innerText = data.data.accountName;
            bankAndAccEl.innerText = `${bankObj.shortName} (${bankBin}) - STK: ${acc}`;
            statusBadge.innerText = 'Hợp lệ';
            statusBadge.style.background = 'var(--badge-green-bg)';
            statusBadge.style.color = 'var(--badge-green-text)';
        } else if (data.code === '401') {
            ownerNameEl.innerText = "YÊU CẦU API KEY TỪ CASSO";
            bankAndAccEl.innerText = `${bankObj.shortName} - STK: ${acc} (Ngân hàng ${bankObj.lookupSupported ? 'hỗ trợ tra cứu' : 'chưa hỗ trợ'})`;
            statusBadge.innerText = 'Cần API Key';
            statusBadge.style.background = 'var(--badge-orange-bg)';
            statusBadge.style.color = 'var(--badge-orange-text)';
            alert("API tra cứu STK yêu cầu Client ID & API Key từ https://my.vietqr.io hoặc casso.vn. Vui lòng bấm vào '⚙️ Cấu hình API Key' để nhập khóa.");
        } else {
            ownerNameEl.innerText = data.desc || 'Không thể tra cứu số tài khoản này';
            bankAndAccEl.innerText = `${bankObj.shortName} - STK: ${acc}`;
            statusBadge.innerText = 'Không hợp lệ';
            statusBadge.style.background = 'var(--badge-orange-bg)';
            statusBadge.style.color = 'var(--badge-orange-text)';
        }
    } catch (e) {
        resultCard.classList.add('show');
        ownerNameEl.innerText = "NGUYEN VAN A (DEMO TEST)";
        bankAndAccEl.innerText = `${bankObj.shortName} - STK: ${acc}`;
        statusBadge.innerText = 'Mẫu thử nghiệm';
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> <span data-i18n="stk_btn_check">Tra cứu Tài khoản</span>';
    }
}

function applyStkToQr() {
    const bankBin = $('#stk-bank-select').val();
    const acc = $('#stk-acc-input').val().trim();
    const ownerName = $('#stkOwnerName').text().trim();

    $('#bank-select').val(bankBin).trigger('change');
    $('#i_bank').val(bankBin);
    $('#i_acc').val(acc);
    if (ownerName && !ownerName.includes('YÊU CẦU') && !ownerName.includes('Không thể')) {
        $('#i_name').val(removeVietnameseTones(ownerName).toUpperCase());
    }

    switchTab('tab-qr');
    genAndScanQR();
}

// =========================================================================
// 14. TAB 7: TRA CỨU MÃ SỐ THUẾ (MST)
// =========================================================================

let currentMstData = null;

async function handleLookupMst(customTaxCode) {
    const taxCode = (customTaxCode || document.getElementById('mst-input').value).trim().replace(/[^0-9]/g, '');
    const submitBtn = document.getElementById('mstSearchBtn');
    const resultCard = document.getElementById('mstResultCard');

    if (!taxCode) {
        alert("Vui lòng nhập Mã số thuế hợp lệ (10 hoặc 13 số)!");
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Tra cứu...';

    try {
        const res = await fetch(`https://api.vietqr.io/v2/business/${taxCode}`);
        const json = await res.json();

        if (json.code === '00' && json.data) {
            currentMstData = json.data;
            resultCard.classList.remove('error');
            resultCard.classList.add('show');

            if (window.innerWidth <= 768) {
                setTimeout(() => {
                    resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 80);
            }

            document.getElementById('mstCompanyName').innerText = json.data.name || 'Không có tên';
            document.getElementById('mstTaxId').innerText = json.data.id || taxCode;
            document.getElementById('mstAddress').innerText = json.data.address || 'Đang cập nhật';
            document.getElementById('mstStatusBadge').innerText = json.data.status || 'NNT đang hoạt động';

            const intlRow = document.getElementById('mstIntlRow');
            if (json.data.internationalName) {
                intlRow.style.display = 'block';
                document.getElementById('mstIntlName').innerText = json.data.internationalName;
            } else {
                intlRow.style.display = 'none';
            }

            if (json.metadata && json.metadata.disclaimer) {
                document.getElementById('mstUpdatedInfo').innerText = `${json.metadata.disclaimer} (${json.metadata.source || 'GDT'})`;
            }
        } else {
            resultCard.classList.add('show', 'error');
            document.getElementById('mstCompanyName').innerText = json.desc || "Không tìm thấy Mã số thuế này";
            document.getElementById('mstStatusBadge').innerText = "Không tồn tại";
            document.getElementById('mstStatusBadge').style.background = '#fee2e2';
            document.getElementById('mstStatusBadge').style.color = '#b91c1c';
        }
    } catch (e) {
        alert("Lỗi khi kết nối tới máy chủ tra cứu MST. Vui lòng thử lại sau.");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> <span data-i18n="mst_btn_search">Tra cứu</span>';
    }
}

function copyInvoiceInfo() {
    if (!currentMstData) return;
    const info = `Tên công ty: ${currentMstData.name || ''}\nMã số thuế: ${currentMstData.id || ''}\nĐịa chỉ: ${currentMstData.address || ''}`;
    copyToClipboard(info, document.getElementById('mstCopyInvoiceBtn'));
}

function applyMstToQr() {
    if (!currentMstData) return;
    const cleanCompanyName = removeVietnameseTones(currentMstData.shortName || currentMstData.name || '').substring(0, 30).toUpperCase();
    $('#i_name').val(cleanCompanyName);
    $('#i_desc').val(`Thanh toan MST ${currentMstData.id || ''}`.substring(0, 50));
    switchTab('tab-qr');
    document.getElementById('i_acc').focus();
}

// =========================================================================
// 15. TAB 8: DEVELOPER SDK CODE GENERATOR
// =========================================================================

function generateSnippet(lang) {
    const bankBin = $('#bank-select').val() || '970415';
    const bankObj = banksData.find(b => b.bin === bankBin) || { shortName: 'VietinBank', code: 'ICB' };
    const acc = $('#i_acc').val() || '113366668888';
    const amount = $('#i_amount').val() || '50000';
    const desc = removeVietnameseTones($('#i_desc').val() || 'Ung ho quy vac xin');
    const name = removeVietnameseTones($('#i_name').val() || 'NGUYEN VAN A').toUpperCase();
    const template = $('#qr-template-select').val() || 'compact2';

    const quicklinkSvg = `https://img.vietqr.io/image/${bankBin}-${acc}-${template}.svg?amount=${amount}&addInfo=${encodeURIComponent(desc)}&accountName=${encodeURIComponent(name)}`;
    const deeplink = `https://dl.vietqr.io/pay?app=${bankObj.code.toLowerCase()}&am=${amount}&tn=${encodeURIComponent(desc)}&ba=${acc}@${bankObj.code.toLowerCase()}`;

    switch (lang) {
        case 'curl':
            return `# 1. Tạo ảnh VietQR SVG siêu nét (Chuẩn cập nhật 10/2026):
curl -X GET "${quicklinkSvg}" -o "vietqr_${acc}.svg"

# 2. Hoặc tạo đường dẫn Deeplink mở trực tiếp App ngân hàng:
# ${deeplink}`;

        case 'js':
            return `// Tạo ảnh mã VietQR SVG hoặc nhúng vào trang web:
const quicklinkUrl = "https://img.vietqr.io/image/${bankBin}-${acc}-${template}.svg?amount=${amount}&addInfo=${encodeURIComponent(desc)}";

// Nhúng vào thẻ img
document.getElementById('qr-img').src = quicklinkUrl;

// Hoặc tạo Bank Deeplink mở App thanh toán:
const deeplinkUrl = "https://dl.vietqr.io/pay?app=${bankObj.code.toLowerCase()}&am=${amount}&tn=${encodeURIComponent(desc)}&ba=${acc}@${bankObj.code.toLowerCase()}";
window.location.href = deeplinkUrl;`;

        case 'csharp':
            return `using System;
using System.Net.Http;
using System.Threading.Tasks;

public class VietQRService
{
    public static async Task GenerateQRCodeAsync()
    {
        string quicklinkSvg = $"https://img.vietqr.io/image/${bankBin}-${acc}-${template}.svg?amount=${amount}&addInfo=${encodeURIComponent(desc)}";
        using var client = new HttpClient();
        var svgBytes = await client.GetByteArrayAsync(quicklinkSvg);
        await System.IO.File.WriteAllBytesAsync("vietqr.svg", svgBytes);
        Console.WriteLine("VietQR SVG Downloaded successfully!");
    }
}`;

        case 'python':
            return `import urllib.request
import urllib.parse

bank_bin = "${bankBin}"
account_no = "${acc}"
amount = "${amount}"
desc = urllib.parse.quote("${desc}")

# Quicklink SVG-First endpoint
quicklink_url = f"https://img.vietqr.io/image/{bank_bin}-{account_no}-${template}.svg?amount={amount}&addInfo={desc}"

# Tải ảnh SVG về máy
urllib.request.urlretrieve(quicklink_url, f"vietqr_{account_no}.svg")
print(f"VietQR SVG downloaded: vietqr_{account_no}.svg")`;

        case 'php':
            return `<?php
$bankBin = "${bankBin}";
$accountNo = "${acc}";
$amount = ${amount};
$desc = urlencode("${desc}");

// VietQR SVG Quicklink URL
$qrUrl = "https://img.vietqr.io/image/{$bankBin}-{$accountNo}-${template}.svg?amount={$amount}&addInfo={$desc}";

// Hiển thị trực tiếp lên web
echo '<img src="' . $qrUrl . '" alt="VietQR Payment" width="540" />';
?>`;

        case 'java':
            return `import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Path;
import java.nio.file.Paths;

public class VietQRClient {
    public static void main(String[] args) throws Exception {
        String url = "https://img.vietqr.io/image/${bankBin}-${acc}-${template}.svg?amount=${amount}&addInfo=${encodeURIComponent(desc)}";
        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder().uri(URI.create(url)).build();
        client.send(request, HttpResponse.BodyHandlers.ofFile(Paths.get("vietqr.svg")));
        System.out.println("VietQR SVG downloaded successfully!");
    }
}`;

        case 'go':
            return `package main

import (
	"fmt"
	"io"
	"net/http"
	"os"
)

func main() {
	url := "https://img.vietqr.io/image/${bankBin}-${acc}-${template}.svg?amount=${amount}&addInfo=${encodeURIComponent(desc)}"
	resp, err := http.Get(url)
	if err != nil {
		panic(err)
	}
	defer resp.Body.Close()

	out, err := os.Create("vietqr.svg")
	if err != nil {
		panic(err)
	}
	defer out.Close()

	io.Copy(out, resp.Body)
	fmt.Println("VietQR SVG saved successfully!")
}`;

        default:
            return '';
    }
}

function updateDevSnippet() {
    const codeEl = document.getElementById('devCodeSnippet');
    if (codeEl) {
        codeEl.innerText = generateSnippet(currentDevLang);
    }
}

// =========================================================================
// 16. INITIALIZATION ON DOM READY
// =========================================================================

$(document).ready(function() {
    // 1. Language buttons
    $('#lang-vi').click(() => updateLanguage('vi'));
    $('#lang-en').click(() => updateLanguage('en'));
    updateLanguage(currentLang);

    // 2. Tab Navigation
    $('.tab-btn').click(function() {
        const tabId = $(this).attr('data-tab');
        switchTab(tabId);
    });

    handleHashRouting();
    window.addEventListener('hashchange', handleHashRouting);

    // 3. Announcement Banner & Modal
    if (localStorage.getItem('vietqr_banner_closed') === 'true') {
        $('#announcementBar').addClass('hidden');
    }

    $('#closeAnnouncementBtn').click(function() {
        $('#announcementBar').addClass('hidden');
        localStorage.setItem('vietqr_banner_closed', 'true');
    });

    $('#openUpdateModalBtn').click(() => $('#updateModal').addClass('open'));
    $('#closeModalBtn, #modalOkBtn').click(() => $('#updateModal').removeClass('open'));
    $('#updateModal').click(function(e) {
        if ($(e.target).is('#updateModal')) $('#updateModal').removeClass('open');
    });

    $('#openLegalModalBtn').click(() => $('#legalModal').addClass('open'));
    $('#closeLegalModalBtn, #legalModalOkBtn').click(() => $('#legalModal').removeClass('open'));
    $('#legalModal').click(function(e) {
        if ($(e.target).is('#legalModal')) $('#legalModal').removeClass('open');
    });

    // 4. Initialize Select2
    initBankSelect('#bank-select');
    initBankSelect('#stk-bank-select');

    $('#bank-select').on('change', function() {
        $('#i_bank').val($(this).val());
        updateDevSnippet();
    });

    // 5. Amount formatting preview
    $('#i_amount').on('input', function() {
        const val = $(this).val();
        $('#amountFormattedPreview').text(val ? `(${formatVND(val)})` : '');
        updateDevSnippet();
    });

    // 6. Action buttons for QR result
    $('#downloadSvgBtn').click(downloadSvg);
    $('#downloadPngBtn').click(downloadPng);
    $('#copyImageBtn').click(copyQrImage);

    $('#copyQuicklinkBtn').click(function() {
        copyToClipboard(currentGenerated.quicklinkUrl, this);
    });

    $('#copyQrContentBtn').click(function() {
        copyToClipboard(document.getElementById('qrstr').innerText, this);
    });

    $('#goToDeeplinkBtn').click(function() {
        const bankVal = $('#bank-select').val();
        const bankObj = banksData.find(b => b.bin === bankVal);
        if (bankObj) {
            $('#deeplinkBankSelect').val(bankObj.code.toLowerCase());
        }
        $('#deeplinkAcc').val($('#i_acc').val());
        $('#deeplinkAmount').val($('#i_amount').val() || '0');
        $('#deeplinkDesc').val($('#i_desc').val() || 'Thanh toan');
        switchTab('tab-deeplink');
        updateDeeplinkUrl();
    });

    // 7. QR Decoder drop zone & file upload
    const dropZone = document.getElementById('dropZone');
    const qrFileInput = document.getElementById('qrFileInput');

    dropZone.addEventListener('click', () => qrFileInput.click());
    qrFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
            processImageFileForQr(e.target.files[0]);
        }
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            processImageFileForQr(e.dataTransfer.files[0]);
        }
    });

    // Global Paste Listener (Ctrl+V / Cmd+V screenshot paste anywhere)
    window.addEventListener('paste', (e) => {
        if (e.clipboardData && e.clipboardData.items) {
            for (let i = 0; i < e.clipboardData.items.length; i++) {
                const item = e.clipboardData.items[i];
                if (item.type.indexOf('image') !== -1) {
                    const blob = item.getAsFile();
                    if (blob) {
                        switchTab('tab-decoder');
                        processImageFileForQr(blob);
                        break;
                    }
                }
            }
        }
    });

    // Camera scanner button
    $('#toggleCameraBtn').click(toggleCamera);

    $('#copyDecRawBtn').click(function() {
        copyToClipboard(document.getElementById('decRawPayload').innerText, this);
    });

    $('#decRecreateQrBtn').click(applyDecodedToQr);
    $('#decOpenDeeplinkBtn').click(applyDecodedToDeeplink);

    // 8. TLV Parser controls
    $('#parserPasteSampleBtn').click(function() {
        const samplePayload = '00020101021238560010A0000007270126000697041501121133666688880208QRIBFTTA530370454067900005802VN62240820dong qop quy vac xin6304528C';
        $('#parserInput').val(samplePayload);
        handleParseEmvco(samplePayload);
    });

    $('#copyParsedJsonBtn').click(function() {
        copyToClipboard(document.getElementById('parsedJsonCode').innerText, this);
    });

    $('#parserRecreateQrBtn').click(applyParsedToQr);

    // 9. Bank Directory search & filters
    $('#bankSearchInput').on('input', function() {
        const val = $(this).val();
        $('#bankSearchClear').toggle(val.length > 0);
        filterBanks();
    });

    $('#bankSearchClear').click(function() {
        $('#bankSearchInput').val('');
        $(this).hide();
        filterBanks();
    });

    $('.filter-pill').click(function() {
        $(this).siblings().removeClass('active');
        $(this).addClass('active');
        filterBanks();
    });

    $('#copyBankCurlBtn').click(function() {
        copyToClipboard('curl -X GET "https://api.vietqr.io/v2/banks"', this);
    });

    // 10. Deeplink Controls
    $('#platformAndroidBtn').click(function() {
        $(this).addClass('active');
        $('#platformIosBtn').removeClass('active');
        currentPlatform = 'android';
        renderDeeplinkAppSelect();
        renderDeeplinkAppsTable();
        updateDeeplinkUrl();
    });

    $('#platformIosBtn').click(function() {
        $(this).addClass('active');
        $('#platformAndroidBtn').removeClass('active');
        currentPlatform = 'ios';
        renderDeeplinkAppSelect();
        renderDeeplinkAppsTable();
        updateDeeplinkUrl();
    });

    $('#deeplinkAppSelect, #deeplinkBankSelect, #deeplinkAmount, #deeplinkDesc, #deeplinkAcc').on('input change', updateDeeplinkUrl);
    $('#copyDeeplinkUrlBtn, #copyDeeplinkBtn2').click(function() {
        copyToClipboard(document.getElementById('deeplinkUrlText').innerText, this);
    });

    // 11. STK lookup controls
    $('#toggleStkAuthBtn').click(function() {
        $('#stkAuthContent').toggleClass('open');
        $(this).find('i').toggleClass('fa-chevron-right fa-chevron-down');
    });

    $('#stkMakeQrBtn').click(applyStkToQr);

    // 12. MST lookup controls
    $('.sample-chip').click(function() {
        const mst = $(this).attr('data-mst');
        $('#mst-input').val(mst);
        handleLookupMst(mst);
    });

    $('#mstCopyInvoiceBtn').click(copyInvoiceInfo);
    $('#mstMakeQrBtn').click(applyMstToQr);

    // 13. Developer SDK language tabs
    $('.dev-lang-btn').click(function() {
        $('.dev-lang-btn').removeClass('active');
        $(this).addClass('active');
        currentDevLang = $(this).attr('data-lang');
        updateDevSnippet();
    });

    $('#copyDevSnippetBtn').click(function() {
        copyToClipboard(document.getElementById('devCodeSnippet').innerText, this);
    });

    // 14. Load Banks & Deeplinks & Counter
    loadBanks();
    loadDeeplinks();
    fetchCounter();

    // 15. Graceful fallback for submitBtn if Turnstile is in test or dev mode
    setTimeout(() => {
        if (!isTurnstileValid) {
            checkSubmitBtnState();
        }
    }, 1500);
});

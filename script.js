let isTurnstileValid = false;
let isBankLoaded = false;
let currentLang = localStorage.getItem('vietqr_lang') || 'vi';

function onTurnstileSuccess(token) {
    isTurnstileValid = true;
    checkSubmitBtnState();
}

function checkSubmitBtnState() {
    if (isTurnstileValid && isBankLoaded) {
        $('#submitBtn').prop('disabled', false);
    }
}

function updateLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('vietqr_lang', lang);
    
    // Update language switcher UI
    document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('lang-' + lang).classList.add('active');
    
    // Update text content
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        if (locales[lang][key]) {
            el.innerHTML = locales[lang][key];
        }
    });

    // Update placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        if (locales[lang][key]) {
            el.placeholder = locales[lang][key];
        }
    });
    
    // Update titles
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        if (locales[lang][key]) {
            el.title = locales[lang][key];
        }
    });
    
    // Update document title
    document.title = locales[lang]['title'];

    // Update select2 placeholder if it's already initialized
    const bankSelectEl = $('#bank-select');
    if (bankSelectEl.hasClass("select2-hidden-accessible")) {
        bankSelectEl.select2('destroy');
        initSelect2();
    }
}

function initSelect2() {
    $('#bank-select').select2({
        placeholder: locales[currentLang]['select2_placeholder'],
        templateResult: formatBankOption,
        templateSelection: formatBankOption
    });
}

function formatBankOption(bank) {
    if (!bank.id) return bank.text;
    const logoUrl = $(bank.element).data('logo');
    if (!logoUrl) return bank.text;
    return $('<span><img src="' + logoUrl + '" class="bank-logo" /> ' + bank.text + '</span>');
};

$(document).ready(function() {
    const bankSelectEl = $('#bank-select');
    const hiddenBankInput = $('#i_bank');
    $('#lang-vi').click(() => updateLanguage('vi'));
    $('#lang-en').click(() => updateLanguage('en'));

    // Khởi tạo ngôn ngữ ban đầu
    updateLanguage(currentLang);
    initSelect2();

    $.ajax({
        url: "https://api.vietqr.io/v2/banks",
        dataType: "json",
        success: function(response) {
            if (response.code === '00' && response.data.length > 0) {
                bankSelectEl.empty();
                response.data.forEach(function(bank) {
                    const option = new Option(`${bank.shortName} - ${bank.name}`, bank.bin, false, false);
                    $(option).data('logo', bank.logo);
                    bankSelectEl.append(option);
                });
                const vietinbankBin = '970415';
                bankSelectEl.val(vietinbankBin).trigger('change');
            } else {
                bankSelectEl.append(new Option(locales[currentLang]['select2_load_error'], "", true, true));
            }
        },
        error: function() {
            bankSelectEl.append(new Option(locales[currentLang]['select2_net_error'], "", true, true));
        },
        complete: function() {
             isBankLoaded = true;
             checkSubmitBtnState();
        }
    });

    bankSelectEl.on('change', function() {
        hiddenBankInput.val($(this).val());
    });
    
    fetchCounter();
});

async function fetchCounter() {
    try {
        const response = await fetch('/api/counter');
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        if (data && data.success) {
            document.getElementById('visitCount').innerText = data.formattedCount;
        }
    } catch (e) {
        console.error('Lỗi khi tải bộ đếm:', e);
        document.getElementById('visitCount').innerText = '15,305+';
    }
}

function genAndScanQR() {
    const placeholder = document.getElementById('qr-result-placeholder');
    const resultWrapper = document.getElementById('qr-result-wrapper');
    const imgEl = document.getElementById('qrimg');
    const qrStrEl = document.getElementById('qrstr');
    const qrcEl = document.getElementById('qrc');
    
    resultWrapper.style.display = 'none';
    placeholder.style.display = 'block';
    
    const bank = document.getElementById('i_bank').value;
    const acc = document.getElementById('i_acc').value;
    if (!bank || !acc) {
        alert(locales[currentLang]['alert_select_bank']);
        return;
    }
  
    const template = document.getElementById('qr-template-select').value;
    const amount = document.getElementById('i_amount').value;
    const desc = document.getElementById('i_desc').value;
    const name = document.getElementById('i_name').value;
  
    const params = new URLSearchParams();
    if (amount) params.append('amount', amount);
    if (desc) params.append('addInfo', desc);
    if (name) params.append('accountName', name);
  
    const queryString = params.toString();
    const url = `https://img.vietqr.io/image/${bank}-${acc}-${template}.png${queryString ? '?' + queryString : ''}`;
  
    imgEl.src = url;

    imgEl.onload = function() {
        placeholder.style.display = 'none';
        resultWrapper.style.opacity = '0';
        resultWrapper.style.display = 'flex';
        setTimeout(() => { resultWrapper.style.opacity = '1'; }, 50);

        const canvas = document.createElement('canvas');
        canvas.width = imgEl.naturalWidth;
        canvas.height = imgEl.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imgEl, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code) {
            qrStrEl.innerText = code.data;
            const idx = code.data.indexOf('6304');
            qrcEl.innerText = (idx != -1) ? code.data.substr(idx + 4, 4) : '[N/A]';
        } else {
            qrStrEl.innerText = locales[currentLang]['qr_error_read'];
            qrcEl.innerText = '[N/A]';
        }
    }

    imgEl.onerror = function() {
        alert(locales[currentLang]['alert_qr_failed']);
    }
}

/**
 * Hàm sao chép văn bản và cung cấp phản hồi trên nút
 * @param {string} textToCopy - Nội dung cần sao chép
 * @param {HTMLElement} buttonElement - Nút bấm để hiển thị phản hồi
 */
function copyToClipboard(textToCopy, buttonElement) {
    if (!textToCopy || textToCopy.startsWith('[')) {
        return; // Không làm gì nếu không có nội dung hợp lệ
    }
    
    navigator.clipboard.writeText(textToCopy).then(() => {
        const originalIconHTML = buttonElement.innerHTML;
        buttonElement.innerHTML = '<i class="fa-solid fa-check"></i>';
        
        setTimeout(() => {
            buttonElement.innerHTML = originalIconHTML;
        }, 2000);
    }).catch(err => {
        console.error('Không thể sao chép: ', err);
        alert(locales[currentLang]['alert_copy_failed']);
    });
}

async function downloadQR() {
    const imgSrc = document.getElementById('qrimg').src;
    if (!imgSrc) return;
    try {
        const response = await fetch(imgSrc);
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = `VietQR-${document.getElementById('i_acc').value}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
    } catch (error) {
        alert(locales[currentLang]['alert_download_failed']);
    }
}

// --- CẬP NHẬT: Gán sự kiện cho cả nút và văn bản ---

// Sao chép Nội dung QR
document.getElementById('copyQrContentBtn').addEventListener('click', function() {
    copyToClipboard(document.getElementById('qrstr').innerText, this);
});
document.getElementById('qrstr').addEventListener('click', function() {
    const button = document.getElementById('copyQrContentBtn');
    copyToClipboard(this.innerText, button);
});

// Sao chép Hash CRC
document.getElementById('copyCrcBtn').addEventListener('click', function() {
    copyToClipboard(document.getElementById('qrc').innerText, this);
});
document.getElementById('qrc').addEventListener('click', function() {
    const button = document.getElementById('copyCrcBtn');
    copyToClipboard(this.innerText, button);
});

// Tải xuống
document.getElementById('downloadBtn').addEventListener('click', downloadQR);
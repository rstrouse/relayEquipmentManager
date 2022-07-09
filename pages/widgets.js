var _uniqueId = 1;
var _screenLayer = 100;

if (typeof String.prototype.startsWith !== 'function') {
    String.prototype.startsWith = function (str) {
        return this.slice(0, str.length) === str;
    };
}
if (typeof String.prototype.endsWith !== 'function') {
    String.prototype.endsWith = function (str) {
        return this.slice(-str.length) === str;
    };
}
window.console = window.console || (function () { var c = {}; c.log = c.warn = c.debug = c.info = c.error = c.time = c.dir = c.profile = c.clear = c.exception = c.trace = c.assert = function (s) { }; return c; })();
window.console.error = window.console.error || (function () { })();
if (!Date.parseISO) {
    Date.parseISO = function (sDate) {
        var s = sDate.split(/[^0-9]/);
        return new Date(s[0], s[1] - 1, s[2], s[3], s[4], s[5]);
    };
}

if (!String.prototype.padStart) {
    String.prototype.padStart = function padStart(targetLength, padString) {
        targetLength = targetLength >> 0; //truncate if number, or convert non-number to 0;
        padString = String(typeof padString !== 'undefined' ? padString : ' ');
        if (this.length >= targetLength) {
            return String(this);
        } else {
            targetLength = targetLength - this.length;
            if (targetLength > padString.length) {
                padString += padString.repeat(targetLength / padString.length); //append to original to ensure we are longer than needed
            }
            return padString.slice(0, targetLength) + String(this);
        }
    };
}
function formatType() { }
formatType.MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'
];
formatType.DAYS = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday',
    'Thursday', 'Friday', 'Saturday'
];
formatType.SUFFIXES = [
    'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th', 'th',
    'th', 'th', 'th', 'th', 'th', 'th', 'th', 'th', 'th', 'th',
    'st', 'nd', 'rd', 'th', 'th', 'th', 'th', 'th', 'th', 'th',
    'st'
];
Number.prototype.round = function (dec) { return Number(Math.round(this + 'e' + dec) + 'e-' + dec); };
Number.prototype.format = function (format, empty) {
    if (isNaN(this)) return empty;
    if (typeof format !== 'string') return this.toString();
    let isNegative = this < 0;
    let tok = ['#', '0'];
    let pfx = '', sfx = '', fmt = format.replace(/[^#\.0\,]/g, '');
    let dec = fmt.lastIndexOf('.') > 0 ? fmt.length - (fmt.lastIndexOf('.') + 1) : 0, fw = '', fd = '', vw = '', vd = '', rw = '', rd = '';
    let val = String(Math.abs(this).round(dec));
    let ret = '', commaChar = ',', decChar = '.';
    for (var i = 0; i < format.length; i++) {
        let c = format.charAt(i);
        if (c === '#' || c === '0' || c === '.' || c === ',')
            break;
        pfx += c;
    }
    for (let i = format.length - 1; i >= 0; i--) {
        let c = format.charAt(i);
        if (c === '#' || c === '0' || c === '.' || c === ',')
            break;
        sfx = c + sfx;
    }
    if (dec > 0) {
        let dp = val.lastIndexOf('.');
        if (dp === -1) {
            val += '.'; dp = 0;
        }
        else
            dp = val.length - (dp + 1);
        while (dp < dec) {
            val += '0';
            dp++;
        }
        fw = fmt.substring(0, fmt.lastIndexOf('.'));
        fd = fmt.substring(fmt.lastIndexOf('.') + 1);
        vw = val.substring(0, val.lastIndexOf('.'));
        vd = val.substring(val.lastIndexOf('.') + 1);
        let ds = val.substring(val.lastIndexOf('.'), val.length);
        for (let i = 0; i < fd.length; i++) {
            if (fd.charAt(i) === '#' && vd.charAt(i) !== '0') {
                rd += vd.charAt(i);
                continue;
            } else if (fd.charAt(i) === '#' && vd.charAt(i) === '0') {
                var np = vd.substring(i);
                if (np.match('[1-9]')) {
                    rd += vd.charAt(i);
                    continue;
                }
                else
                    break;
            }
            else if (fd.charAt(i) === '0' || fd.charAt(i) === '#')
                rd += vd.charAt(i);
        }
        if (rd.length > 0) rd = decChar + rd;
    }
    else {
        fw = fmt;
        vw = val;
    }
    var cg = fw.lastIndexOf(',') >= 0 ? fw.length - fw.lastIndexOf(',') - 1 : 0;
    var nw = Math.abs(Math.floor(this.round(dec)));
    if (!(nw === 0 && fw.substr(fw.length - 1) === '#') || fw.substr(fw.length - 1) === '0') {
        var gc = 0;
        for (let i = vw.length - 1; i >= 0; i--) {
            rw = vw.charAt(i) + rw;
            gc++;
            if (gc === cg && i !== 0) {
                rw = commaChar + rw;
                gc = 0;
            }
        }
        if (fw.length > rw.length) {
            var pstart = fw.indexOf('0');
            if (pstart > 0) {
                var plen = fw.length - pstart;
                var pos = fw.length - rw.length - 1;
                while (rw.length < plen) {
                    let pc = fw.charAt(pos);
                    if (pc === ',') pc = commaChar;
                    rw = pc + rw;
                    pos--;
                }
            }
        }
    }
    if (isNegative) rw = '-' + rw;
    if (rd.length === 0 && rw.length === 0) return '';
    return pfx + rw + rd + sfx;
};
Number.prototype.formatTime = function (format, empty) {
    // Formats the time in minutes from midnight.
    if (isNaN(this) || this <= 0) return empty;
    var hrs = Math.floor(this / 60);
    var mins = this - (hrs * 60);
    var secs = 0;
    var tok = {
        'hh': (hrs > 12 ? hrs - 12 : hrs).toString().padStart(2, '0'),
        'h': (hrs > 12 ? hrs - 12 : hrs).toString(),
        'HH': hrs.toString().padStart(2, '0'),
        'H': hrs.toString(),
        'mm': mins.toString().padStart(2, '0'),
        'm': mins.toString(),
        'ss': secs.toString().padStart(2, '0'),
        's': secs.toString(),
        'tt': hrs >= 12 ? 'pm' : 'am',
        't': hrs >= 12 ? 'p' : 'a',
        'TT': hrs >= 12 ? 'PM' : 'AM',
        'T': hrs >= 12 ? 'P' : 'A'
    };
    //console.log(tok);
    var formatted = format;
    for (var t in tok) {
        formatted = formatted.replace(t, tok[t]);
    }
    return formatted;
};
Date.prototype.isDateEmpty = function () {
    return (isNaN(this.getTime()) || this.getFullYear() < 1970 || this.getFullYear() > 9999);
}
Date.prototype.isDateTimeEmpty = function () {
    return (isNaN(this.getTime()) || this.getFullYear() < 1970 || this.getFullYear() > 9999);
};
Date.prototype.format = function (fmtMask, emptyMask) {
    if (fmtMask.match(/[hHmt]/g) !== null) {
        if (this.isDateTimeEmpty()) return typeof (emptyMask) !== 'undefined' ? emptyMask : '';
    }
    if (fmtMask.match(/[Mdy]/g) !== null) {
        if (this.isDateEmpty()) return typeof (emptyMask) !== 'undefined' ? emptyMask : '';
    }
    let formatted = (typeof (fmtMask) !== 'undefined' && fmtMask !== null) ? fmtMask : 'MM-dd-yyyy HH:mm:ss';
    let letters = 'dMyHhmst'.split('');
    let temp = [];
    let count = 0;
    let regexA;
    let regexB = /\[(\d+)\]/;
    let year = this.getFullYear().toString();
    let formats = {
        d: this.getDate().toString(),
        dd: this.getDate().toString().padStart(2, '00'),
        ddd: this.getDay() >= 0 ? formatType.DAYS[this.getDay()].substring(0, 3) : '',
        dddd: this.getDay() >= 0 ? formatType.DAYS[this.getDay()] : '',
        M: (this.getMonth() + 1).toString(),
        MM: (this.getMonth() + 1).toString().padStart(2, '00'),
        MMM: this.getMonth() >= 0 ? formatType.MONTHS[this.getMonth()].substring(0, 3) : '',
        MMMM: this.getMonth() >= 0 ? formatType.MONTHS[this.getMonth()] : '',
        y: year.charAt(2) === '0' ? year.charAt(4) : year.substring(2, 4),
        yy: year.substring(2, 4),
        yyyy: year,
        H: this.getHours().toString(),
        HH: this.getHours().toString().padStart(2, '00'),
        h: this.getHours() === 0 ? '12' : (this.getHours() > 12) ? Math.abs(this.getHours() - 12).toString() : this.getHours().toString(),
        hh: this.getHours() === 0 ? '12' : (this.getHours() > 12) ? Math.abs(this.getHours() - 12).toString().padStart(2, '00') : this.getHours().toString().padStart(2, '00'),
        m: this.getMinutes().toString(),
        mm: this.getMinutes().toString().padStart(2, '00'),
        s: this.getSeconds().toString(),
        ss: this.getSeconds().toString().padStart(2, '00'),
        t: (this.getHours() < 12 || this.getHours() === 24) ? 'a' : 'p',
        tt: (this.getHours() < 12 || this.getHours() === 24) ? 'am' : 'pm'
    };
    for (let i = 0; i < letters.length; i++) {
        regexA = new RegExp('(' + letters[i] + '+)');
        while (regexA.test(formatted)) {
            temp[count] = RegExp.$1;
            formatted = formatted.replace(RegExp.$1, '[' + count + ']');
            count++;
        }
    }
    while (regexB.test(formatted))
        formatted = formatted.replace(regexB, formats[temp[RegExp.$1]]);
    //console.log({ formatted: formatted, fmtMask: fmtMask });
    return formatted;
};
Date.prototype.addMinutes = function (nMins) {
    this.setTime(this.getTime() + (nMins * 60000));
    return this;
};
Date.format = function (date, fmtMask, emptyMask) {
    var dt;
    if (typeof date === 'string') {
        if (date.indexOf('T') !== -1)
            dt = Date.parseISO(date);
        else
            dt = new Date(date);
    }
    else if (typeof date === 'number') dt = new Date(date);
    else if (typeof date.format === 'function') dt = date;
    if (typeof dt.format !== 'function' || isNaN(dt.getTime())) return emptyMask;
    return dt.format(fmtMask, emptyMask);
};
function makeBool(val) {
    if (typeof (val) === 'boolean') return val;
    if (typeof (val) === 'undefined') return false;
    if (typeof (val) === 'number') return val >= 1;
    if (typeof (val) === 'string') {
        if (val === '') return false;
        switch (val.toLowerCase().trim()) {
            case 'on':
            case 'true':
            case 'yes':
            case 'y':
                return true;
            case 'off':
            case 'false':
            case 'no':
            case 'n':
                return false;
        }
        if (!isNaN(parseInt(val, 10))) return parseInt(val, 10) >= 1;
    }
    return false;
}
// PUT and Delete for ReST calls.
jQuery.each(["put", "delete"], function (i, method) {
    jQuery[method] = function (url, data, callback, type) {
        if (jQuery.isFunction(data) || (jQuery.isArray(data) && jQuery.isFunction(data[0]))) {
            type = type || callback;
            callback = data;
            data = undefined;
        }
        if (typeof (data) === 'object') {
            for (var v in data) {
                if (typeof (data[v]) === 'function') continue;
                url.indexOf('?') === -1 ? url += '?' : url += '&';
                if (data[v] instanceof Date && !isNaN(data[v].getTime()))
                    url += (v + '=' + encodeURIComponent(data[v].format('yyyy-mm-ddTHH:MM:ss')));
                else if (typeof (data[v]) === 'object')
                    url += (v + '=' + encodeURIComponent(JSON.stringify(data[v])));
                url += (v + '=' + encodeURIComponent(data[v].toString()));
            }
        }
        //console.log({ method: method, url: url, type: typeof (data), data: typeof (data) === 'string' && !data.startsWith('=') ? '=' + data : data });
        return $.ajax({
            url: url,
            type: method,
            dataType: type,
            data: typeof (data) === 'string' && !data.startsWith('=') ? '=' + data : data,
            success: callback
        });
    };
});
jQuery.each(['get', 'put', 'delete', 'post', 'search'], function (i, method) {
    jQuery[method + 'LocalService'] = function (url, data, message, successCallback, errorCallback, completeCallback) {
        if (jQuery.isFunction(data) || (jQuery.isArray(data) && jQuery.isFunction(data[0]))) {
            method = method || successCallback;
            completeCallback = errorCallback;
            errorCallback = successCallback;
            successCallback = data;
            data = undefined;
        }
        if (typeof message === 'function') {
            // Shift all the parameters because we aren't calling the service with a status message.
            completeCallback = errorCallback;
            errorCallback = successCallback;
            successCallback = message;
            message = undefined;
        }
        var msg;
        var overlay;
        if (typeof message !== 'undefined') {
            // We are displaying a message while the service is underway.
            msg = $('<div style="visibility:hidden;z-index:501;"></div>').addClass('picServiceStatusMsg').appendTo(document.body);
            overlay = $('<div style="background-color:lavender;opacity:.15;z-index:500"></div>').addClass('ui-widget-overlay').addClass('ui-front').appendTo(document.body);
            if (message instanceof jQuery) message.appendTo(msg);
            else
                $('<div></div>').html(message).appendTo(msg);
            msg.css({
                visibility: '',
                left: ($(document).width() - msg.width()) / 2,
                top: ($(document).height() - msg.height()) / 2
            });
        }
        // Set up the callbacks.
        var cbComplete = function (jqXHR, status) {
            if (typeof msg !== 'undefined') {
                msg.fadeOut(300, function () {
                    msg.remove();
                    if (typeof overlay !== 'undefined') overlay.remove();
                });
            }
        };
        var cbShowError = function (jqXHR, status, error) {
            var err = { httpCode: jqXHR.status, status: status, error: jqXHR.responseJSON || error };
            if (err.httpCode >= 299) {
                console.log(err);
                $.pic.modalDialog.createApiError($.extend(true, { url: serviceUrl, data: data }, err));
            }
        };
        var cbShowSuccess = function (data, status, jqXHR) { };
        var serviceUrl = url;

        // Set up the callbacks.
        successCallback = $.mergeCallbacks(successCallback, cbShowSuccess);
        errorCallback = $.mergeCallbacks(errorCallback, cbShowError);
        completeCallback = $.mergeCallbacks(completeCallback, cbComplete);
        console.log({ method: method, url: url, data: typeof data === 'string' ? data : JSON.stringify(data) });
        return jQuery.ajax({
            url: serviceUrl,
            type: method,
            dataType: 'json',
            contentType: 'application/json; charset=utf-8',
            data: typeof data === 'string' ? data : JSON.stringify(data),
            error: errorCallback,
            success: successCallback,
            complete: completeCallback
        });
    };
});
jQuery.mergeCallbacks = function (target, source) {
    if (typeof (target) === 'undefined') return source;
    else if (typeof (target) === 'function') {
        if (typeof (source) === 'undefined') return target;
        else if (typeof (source) === 'function') return [source, target];
        else if (Array.isArray(source)) return source.concat([target]);
        else return target;
    }
    else if (Array.isArray(target)) {
        if (typeof (source) === 'undefined') return target;
        else if (typeof (source) === 'function') return [source].concat(target);
        else if (Array.isArray(source)) return source.concat(target);
        else return target;
    }
};
jQuery.each(['get', 'put', 'delete', 'post'], function (i, method) {
    jQuery[method + 'ApiService'] = function (url, data, message, successCallback, errorCallback, completeCallback) {
        if (jQuery.isFunction(data) || (jQuery.isArray(data) && jQuery.isFunction(data[0]))) {
            method = method || successCallback;
            completeCallback = errorCallback;
            errorCallback = successCallback;
            successCallback = data;
            data = undefined;
        }
        if (typeof message === 'function') {
            // Shift all the parameters because we aren't calling the service with a status message.
            completeCallback = errorCallback;
            errorCallback = successCallback;
            successCallback = message;
            message = undefined;
        }
        var msg;
        var overlay;
        if (typeof message !== 'undefined') {
            console.log('Showing message: ' + message);
            // We are displaying a message while the service is underway.
            msg = $('<div style="visibility:hidden;"></div>').addClass('picServiceStatusMsg').appendTo(document.body);
            overlay = $('<div style="background-color:lavender;opacity:.15"></div>').addClass('ui-widget-overlay').addClass('ui-front').appendTo(document.body);
            if (message instanceof jQuery) message.appendTo(msg);
            else
                $('<div></div>').html(message).appendTo(msg);
            msg.css({
                visibility: '',
                left: ($(document).width() - msg.width()) / 2,
                top: ($(document).height() - msg.height()) / 2
            });

        }
        // Set up the callbacks.
        var cbComplete = function (jqXHR, status) {
            if (typeof msg !== 'undefined') {
                msg.fadeOut(300, function () {
                    msg.remove();
                    if (typeof overlay !== 'undefined') overlay.remove();
                });
            }
        };
        var cbShowError = function (jqXHR, status, error) {
            var err = { httpCode: jqXHR.status, status: status, error: jqXHR.responseJSON };
            if (err.httpCode >= 299) {
                $.pic.modalDialog.createApiError($.extend(true, { url: serviceUrl, data: data }, err));
            }
        };
        var cbShowSuccess = function (data, status, jqXHR) { };
        var serviceUrl = $('body').attr('data-apiserviceurl') + (!url.startsWith('/') ? '/' : '') + url;


        // Set up the callbacks.
        successCallback = $.mergeCallbacks(successCallback, cbShowSuccess);
        errorCallback = $.mergeCallbacks(errorCallback, cbShowError);
        completeCallback = $.mergeCallbacks(completeCallback, cbComplete);
        console.log({ method: method, url: url, data: typeof data === 'string' ? data : JSON.stringify(data) });
        return jQuery.ajax({
            url: serviceUrl,
            type: method,
            dataType: 'json',
            contentType: 'application/json; charset=utf-8',
            data: typeof data === 'string' ? data : JSON.stringify(data),
            error: errorCallback,
            success: successCallback,
            complete: completeCallback
        });
    };
});
function getCookie(name, def) {
    var cooks = document.cookie.split(';');
    for (var i = 0; i < cooks.length; i++) {
        var cook = cooks[i];
        while (cook.charAt(0) === ' ') cook = cook.substring(1, cook.length);
        if (cook.indexOf(name + '=') === 0) return cook.substring(name.length + 1, cook.length);
    }
    return def;
}
function setCookie(name, value, days) {
    var expires = '';
    if (typeof days === 'number' && data !== 0) {
        var date = new Date();
        date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
        expires = '; expires=' + date.toGMTString();
    }
    else if (typeof days === 'undefined')
        document.cookie = name + '=' + value + ';expires=' + expires + '; path=/';
}
var dataBinder = {
    checkRequired: function (el, show) {
        var isValid = true;
        el.find('*[data-required=true]').each(function () {
            var val = null;
            if (typeof this.isEmpty === 'function') {
                if (this.isEmpty()) {
                    isValid = false;
                    if (typeof this.label === 'function')
                        $('<div></div>').appendTo($(this)).fieldTip({ message: this.label().text() + ' is Required' });
                    else
                        $('<div></div>').appendTo($(this)).fieldTip({ message: 'Value is Required' });
                }
            }
            else if (typeof this.val === 'function') {
                val = this.val();
                if (typeof val === 'undefined') {
                    isValid = false;
                    if (typeof this.label === 'function')
                        $('<div></div>').appendTo($(this)).fieldTip({ message: this.label().text() + ' is Required' });
                    else
                        $('<div></div>').appendTo($(this)).fieldTip({ message: 'Value is Required' });
                }
            }
        });
        return isValid;
    },
    createValue: function (val, binding, fmtType, fmtMask, fmtEmpty) {
        let arr = binding.split('.');
        let tval = val;
        for (let i = 0; i < arr.length; i++) {
            var s = arr[i];
            if (typeof s === 'undefined' || !s) continue;
            let ndx = s.indexOf('[');
            if (ndx !== -1) {
                ndx = parseInt(s.substring(ndx + 1, s.indexOf(']') - 1), 10);
                s = s.substring(0, ndx - 1);
            }
            tval = tval[s];
            if (typeof tval === 'undefined') break;
            if (ndx >= 0) tval = tval[ndx];
        }
        if (typeof tval !== 'undefined') {
            switch (fmtType) {
                case 'time':
                    {
                        var dt = new Date();
                        dt.setHours(0, 0, 0);
                        dt.addMinutes(tval);
                        tval = dt.format(fmtMask, fmtEmpty || '');
                    }
                    break;
                case 'date':
                case 'datetime':
                    {
                        let dt = new Date(tval);
                        tval = dt.format(fmtMask, fmtEmpty || '');
                    }
                    break;
                case 'int':
                    if (typeof tval !== 'number') tval = this.parseNumber(tval);
                    tval = tval.format(fmtMask, fmtEmpty || '');
                    break;
                case 'number':
                    if (typeof tval !== 'number') tval = parseFloat(tval);
                    tval = tval.format(fmtMask, fmtEmpty || '');
                    break;
                case 'duration':
                    tval = dataBinder.formatDuration(tval);
                    break;
            }
            return tval;
        }
    },
    bind: function (el, val) {
        el.find('*[data-bind]').each(function () {
            $this = $(this);
            let prop = $this.attr('data-bind');
            let arr = prop.split('.');
            let tval = val;
            for (let i = 0; i < arr.length; i++) {
                var s = arr[i];
                if (typeof s === 'undefined' || !s) continue;
                let ndxStart = s.indexOf('[');
                var ndx = -1;
                if (ndxStart !== -1) {
                    var ndxEnd = s.indexOf(']');
                    ndx = parseInt(s.substring(ndxStart + 1, s.indexOf(']')), 10);
                    s = s.substring(0, ndxStart);
                }
                tval = tval[s];
                if (typeof tval === 'undefined') break;
                if (ndx >= 0) tval = tval[ndx];
                if (typeof tval === 'undefined') break;
            }
            if (typeof tval !== 'undefined') {
                if (typeof this.val === 'function') this.val(tval);
                else {
                    switch ($this.attr('data-fmttype')) {
                        case 'time':
                            {
                                var dt = new Date();
                                dt.setHours(0, 0, 0);
                                dt.addMinutes(tval);
                                tval = dt.format($this.attr('data-fmtmask'), $this.attr('data-fmtempty') || '');
                            }
                            break;
                        case 'date':
                        case 'datetime':
                            {
                                let dt = new Date(tval);
                                tval = dt.format($this.attr('data-fmtmask'), $this.attr('data-fmtempty') || '');
                            }
                            break;
                        case 'int':
                            if (typeof tval !== 'number') tval = this.parseNumber(tval);
                            tval = tval.format($this.attr('data-fmtmask'), $this.attr('data-fmtempty') || '');
                            break;
                        case 'number':
                            if (typeof tval !== 'number') tval = parseFloat(tval);
                            tval = tval.format($this.attr('data-fmtmask'), $this.attr('data-fmtempty') || '');
                            break;
                        case 'duration':
                            tval = dataBinder.formatDuration(tval);
                            break;
                    }
                    if ($this.is('input')) {
                        if (this.type === 'checkbox') $this.prop('checked', makeBool(tval));
                        else { $this.val(tval); }
                    }
                    else if ($this.is('select')) $this.val(tval);
                    else $this.text(tval);
                }
            }
        });
    },
    parseNumber: function (val) {
        if (typeof val === 'number') return val;
        else if (typeof val === 'undefined' || val === null) return;
        else if (typeof val.getTime === 'function') return val.getTime();
        var tval = val.replace(/[^0-9\.\-]+/g, '');
        var v;
        if (tval.indexOf('.') !== -1) {
            v = parseFloat(tval);
            v = v.round(tval.length - tval.indexOf('.'));
        }
        else v = parseInt(tval, 10);
        return v;
    },
    formatDuration: function (dur) {
        var fmt = '';
        let hrs = Math.floor(dur / 3600);
        let min = Math.floor((dur - (hrs * 3600)) / 60);
        let sec = dur - ((hrs * 3600) + (min * 60));
        if (hrs > 1) fmt += (hrs + 'hrs');
        else if (hrs > 0) fmt += (hrs + 'hr');

        if (min > 0) fmt += ' ' + (min + 'min');
        if (sec > 0) fmt += ' ' + (sec + 'sec');
        return fmt.trim();
    },
    fromBaseElement: function (el, binding) {
        if (typeof arrayRef === 'undefined' || arrayRef === null) arrayRef = [];
        if (typeof obj === 'undefined' || obj === null) obj = {};
        var self = this;
        if (el.is(':input')) {
            if (el[0].type === 'checkbox') self._bindValue(obj, el, el.is(':checked'), arrayRef);
            else self._bindValue(obj, el, el.val(), arrayRef, binding);
        }
        else if (el.is('select'))
            self._bindValue(obj, el, el.val(), arrayRef, binding);
        else {
            if (typeof el.attr('data-bind') !== 'undefined') {
                if (typeof el[0].val === 'function')
                    self._bindValue(obj, el, el[0].val(), arrayRef);
                else {
                    self._bindValue(obj, el, el.text(), arrayRef);
                    el.find('*[data-bind^="' + binding + '"]').each(function () {
                        $this = $(this);
                        if (typeof this.val === 'function')
                            self._bindValue(obj, $this, this.val(), arrayRef);
                        else if ($this.is('input')) {
                            if (this.type === 'checkbox') self._bindValue(obj, $this, $this.is(':checked'), arrayRef);
                            else self._bindValue(obj, $this, $this.val(), arrayRef, binding);
                        }
                        else if ($this.is('select'))
                            self._bindValue(obj, $this, $this.val(), arrayRef, binding);
                        else
                            self._bindValue(obj, $this, $this.text(), arrayRef, binding);
                    });
                }
            }
        }
        return obj;
    },
    fromElement: function (el, obj, arrayRef, baseBinding) {
        if (typeof arrayRef === 'undefined' || arrayRef === null) arrayRef = [];
        if (typeof obj === 'undefined' || obj === null) obj = {};
        var self = this;
        if (el.is(':input')) {
            if (el[0].type === 'checkbox') self._bindValue(obj, el, el.is(':checked'), arrayRef);
            else self._bindValue(obj, el, el.val(), arrayRef, baseBinding);
        }
        else if (el.is('select'))
            self._bindValue(obj, el, el.val(), arrayRef, baseBinding);
        else {
            if (typeof el.attr('data-bind') !== 'undefined') {
                if (typeof el[0].val === 'function') {
                    self._bindValue(obj, el, el[0].val(), arrayRef, baseBinding);
                }
                else
                    self._bindValue(obj, el, el.text(), arrayRef, baseBinding);
            }
            el.find('*[data-bind]').each(function () {
                $this = $(this);
                if (typeof this.val === 'function') {
                    if ($this.attr('data-bind').endsWith(']')) console.log({ msg: 'This should be the object', binding: $this.attr('data-bind'), val: this.val() });
                    self._bindValue(obj, $this, this.val(), arrayRef, baseBinding);
                }
                else if ($this.is('input')) {
                    if (this.type === 'checkbox') self._bindValue(obj, $this, $this.is(':checked'), arrayRef, baseBinding);
                    else self._bindValue(obj, $this, $this.val(), arrayRef, baseBinding);
                }
                else if ($this.is('select'))
                    self._bindValue(obj, $this, $this.val(), arrayRef, baseBinding);
                else
                    self._bindValue(obj, $this, $this.text(), arrayRef, baseBinding);
            });
        }
        return obj;
    },
    _bindValue: function (obj, el, val, arrayRef, baseBinding) {
        var binding = el.attr('data-bind');
        if (typeof baseBinding !== 'undefined' && baseBinding) {
            if (!binding.startsWith(baseBinding)) return;
            else binding = binding.substring(baseBinding.length);
        }
        else {
            if (el.parents('*[data-bind]:first') > 0) return;
        }
        var dataType = el.attr('data-datatype');
        if (binding && binding.length > 0) {
            var sRef = '';
            var arr = binding.split('.');
            var t = obj;
            for (var i = 0; i < arr.length - 1; i++) {
                s = arr[i];
                if (typeof s === 'undefined' || s.length === 0) continue;
                sRef += ('.' + s);
                var ndx = s.lastIndexOf('[');
                if (ndx !== -1) {
                    var v = s.substring(0, ndx);
                    var ndxEnd = s.lastIndexOf(']');
                    var ord = parseInt(s.substring(ndx + 1, ndxEnd), 10);
                    if (isNaN(ord)) ord = 0;
                    if (typeof arrayRef[sRef] === 'undefined') {
                        if (typeof t[v] === 'undefined') {
                            t[v] = [];
                            t[v][ord] = {};
                            t = t[v][ord];
                            arrayRef[sRef] = ord;
                        }
                        else {
                            k = arrayRef[sRef];
                            if (typeof k === 'undefined') {
                                a = t[v];
                                k = a.length;
                                arrayRef[sRef] = ord;
                                if (typeof a[ord] === 'undefined') a[ord] = {};
                                t = a[ord];
                            }
                            else
                                t = t[v][ord];
                        }
                    }
                    else {
                        k = arrayRef[sRef];
                        if (typeof k === 'undefined') {
                            a = t[v];
                            k = a.length;
                            arrayRef[sRef] = ord;
                            if (typeof a[ord] === 'undefined') a[ord] = {};
                            t = a[ord];
                        }
                        else
                            t = t[v][ord];
                    }
                    if (typeof t === 'undefined') {
                        console.log({ ord: ord, arrayRef: arrayRef, obj: obj, sRef: sRef });
                    }

                }
                else if (typeof t[s] === 'undefined') {
                    t[s] = new Object();
                    t = t[s];
                }
                else
                    t = t[s];
            }
            if (typeof dataType === 'undefined') dataType = 'string';
            switch (dataType) {
                case 'number':
                case 'int':
                case 'float':
                    t[arr[arr.length - 1]] = this.parseNumber(val);
                    break;
                case 'datetime':
                    t[arr[arr.length - 1]] = Date.parse(val);
                    break;
                case 'phone':
                    var ph = val.replace(/[^\d.,]+/g, '');
                    ph = ph.replace(/^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/, "($1)$2-$3");
                    if (!/^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/.test(val))
                        t[arr[arr.length - 1]] = '';
                    else
                        t[arr[arr.length - 1]] = ph;
                    break;
                case 'bool':
                case 'boolean':
                    t[arr[arr.length - 1]] = makeBool(val);
                    break;
                default:
                    t[arr[arr.length - 1]] = val;
                    if (binding.endsWith(']')) console.log({ binding: binding, val: val });
                    break;
            }
        }
    },
    parseValue: function (val, dataType) {
        switch (dataType) {
            case 'bool':
            case 'boolean':
                return makeBool(val);
            case 'int':
                return Math.floor(this.parseNumber(val));
            case 'uint':
                return Math.abs(this.parseNumber(val));
            case 'float':
            case 'real':
            case 'double':
            case 'decimal':
            case 'number':
                return this.parseNumber(val);
            case 'date':
                if (typeof val === 'string') return Date.parseISO(val);
                else if (typeof val === 'number') return new Date(number);
                else if (typeof val.getMonth === 'function') return val;
                return undefined;
            case 'time':
                var dt = new Date();
                if (typeof val === 'number') {
                    dt.setHours(0, 0, 0);
                    dt.addMinutes(tval);
                    return dt;
                }
                else if (typeof val === 'string' && val.indexOf(':') !== -1) {
                    var n = val.lastIndexOf(':');
                    var min = this.parseNumber(val.substring(n));
                    var nsp = val.substring(0, n).lastIndexOf(' ') + 1;
                    var hrs = this.parseNumber(val.substring(nsp, n));
                    dt.setHours(0, 0, 0);
                    if (hrs <= 12 && val.substring(n).indexOf('p')) hrs += 12;
                    dt.addMinutes(hrs * 60 + min);
                    return dt;
                }
                break;
            case 'duration':
                if (typeof val === 'number') return val;
                return Math.floor(this.parseNumber(val));
            default:
                return val;
        }
    },
    formatValue: function (val, dataType, fmtMask, emptyMask) {
        var v = this.parseValue(val, dataType);
        if (typeof v === 'undefined') return emptyMask || '';
        switch (dataType) {
            case 'boolean':
            case 'bool':
                return v ? 'True' : 'False';
            case 'int':
            case 'uint':
            case 'float':
            case 'real':
            case 'double':
            case 'decimal':
            case 'number':
                return v.format(fmtMask, emptyMask || '');
            case 'time':
            case 'date':
            case 'dateTime':
                return v.format(fmtMask, emptyMask || '');
            case 'duration':
                return this.formatDuration(dur);
        }
        return v;
    }
};
var templateBuilder = {
    createControlOptions: function (pnl, opt, binding) {
        var self = this;
        var fld = null;
        var prop = '';
        if (typeof binding === 'undefined') binding = '';
        switch (opt.field.type) {
            case 'hidden':
                fld = $('<input type="hidden"></input>');
                if (binding) fld.attr('data-bind', binding + prop);
                fld.attr('data-datatype', opt.dataType).appendTo(pnl);
                if (typeof opt.default !== 'undefined') fld.val(opt.default);
                break;
            case 'pickList':
                fld = $('<div></div>').appendTo(pnl).attr('data-bind', binding + prop).pickList(opt.field);
                if (typeof opt.default !== 'undefined') fld[0].val(opt.default);
                break;
            case 'valueSpinner':
                fld = $('<div></div>').appendTo(pnl).attr('data-bind', binding + prop).valueSpinner(opt.field);
                if (typeof opt.default !== 'undefined') fld[0].val(opt.default);
                break;
            case 'timeSpinner':
                fld = $('<div></div>').appendTo(pnl).attr('data-bind', binding + prop).timeSpinner(opt.field);
                if (typeof opt.default !== 'undefined') fld[0].val(opt.default);
                break;
            case 'inputField':
                fld = $('<div></div>').appendTo(pnl).attr('data-bind', binding + prop).inputField(opt.field);
                if (typeof opt.default !== 'undefined') fld[0].val(opt.default);
                break;
            case 'dateField':
                fld = $('<div></div>').appendTo(pnl).attr('data-bind', binding + prop).dateField(opt.field);
                if (typeof opt.default !== 'undefined') fld[0].val(opt.default);
                break;
            case 'optionButton':
                fld = $('<div></div>').appendTo(pnl).attr('data-bind', binding + prop).optionButton(opt.field);
                if (typeof opt.default !== 'undefined') fld[0].val(opt.default);
                break;
            case 'staticField':
                fld = $('<div></div>').appendTo(pnl).attr('data-bind', binding + prop).staticField(opt.field);
                if (typeof opt.default !== 'undefined') fld[0].val(opt.default);
                break;
            case 'checkbox':
                fld = $('<div></div>').appendTo(pnl).attr('data-bind', binding + prop).checkbox(opt.field);
                if (typeof opt.default !== 'undefined') fld[0].val(opt.default);
                break;
            case 'actionButton':
                fld = $('<div></div>').appendTo(pnl);
                if (binding) fld.attr('data-bind', binding + prop);
                fld.actionButton(opt.field);
                if (typeof opt.default !== 'undefined') fld[0].val(opt.default);
                break;
            case 'toggleButton':
                fld = $('<div></div>').appendTo(pnl).attr('data-bind', binding + prop).toggleButton(opt.field);
                if (typeof opt.default !== 'undefined') fld[0].val(opt.default);
                break;
            case 'colorPicker':
                fld = $('<div></div>').appendTo(pnl).attr('data-bind', binding + prop).colorPicker(opt.field);
                if (typeof opt.default !== 'undefined') fld[0].val(opt.default);
                break;
            case 'chemTank':
                fld = $('<div></div>').appendTo(pnl).chemTank(opt.field);
                if (binding) fld.attr('data-bind', binding + prop);
                break;
            case 'fieldset':
                fld = $(`<${opt.field.type}></${opt.field.type}>`).appendTo(pnl);
                if (typeof opt.field.legend !== 'undefined') $('<legend></legend>').appendTo(fld).html(opt.field.legend);
                if (typeof opt.field.style !== 'undefined') fld.css(opt.field.style);
                if (typeof opt.binding !== 'undefined') fld.attr('data-bind', opt.binding);
                if (typeof opt.field.cssClass !== 'undefined') fld.addClass(opt.field.cssClass);
                if (typeof opt.field.attrs !== 'undefined') {
                    for (var attr in opt.field.attrs) fld.attr(attr.toLowerCase(), opt.field.attrs[attr]);
                }
                if (typeof opt.options !== 'undefined') self.createObjectOptions(fld, opt, binding + prop);
                break;
            case 'templateRepeater':
                fld = $(`<div></div>`).appendTo(pnl).templateRepeater(opt.field);
                break;
            case 'panel':
                fld = $('<div></div>').appendTo(pnl)[`${opt.field.class}`](opt.field);
                if (typeof opt.field.style !== 'undefined') fld.css(opt.field.style);
                if (typeof opt.binding !== 'undefined') fld.attr('data-bind', opt.binding);
                if (typeof opt.field.cssClass !== 'undefined') fld.addClass(opt.field.cssClass);
                if (typeof opt.field.attrs !== 'undefined') {
                    for (var attr in opt.field.attrs) fld.attr(attr.toLowerCase(), opt.field.attrs[attr]);
                }
                if (typeof opt.options !== 'undefined') self.createObjectOptions(fld, opt, binding + prop);
                break;
            case 'tabBar':
            case 'tabbar':
                fld = $('<div></div>').appendTo(pnl).tabBar(opt.field);
                // Now we need to deal with all of the tabs.
                if (typeof opt.tabs !== 'undefined') {
                    for (var tabIndex = 0; tabIndex < opt.tabs.length; tabIndex++) {
                        var tab = opt.tabs[tabIndex]
                        var pane = fld[0].addTab(tab.field);
                        if (typeof tab.options !== 'undefined') self.createControlOptions(pane, tab.options, binding + prop);

                    }
                }
                fld[0].selectFirstVisibleTab();
                break;
            case 'scriptEditor':
                fld = $('<div></div>').appendTo(pnl).attr('data-bind', binding + prop).scriptEditor(opt.field);
                if (typeof opt.default !== 'undefined') fld[0].val(opt.default);
                break;
            default:
                fld = $(`<${opt.field.type || 'div'}></${opt.field.type || 'div'}>`).appendTo(pnl);
                if (typeof opt.field.cssClass !== 'undefined') fld.addClass(opt.field.cssClass);
                if (typeof opt.field.html !== 'undefined') fld.html(opt.field.html);
                if (typeof opt.field.style !== 'undefined') fld.css(opt.field.style);
                if (typeof opt.field.bind !== 'undefined') fld.attr('data-bind', binding + opt.field.bind);
                if (typeof opt.field.binding !== 'undefined') fld.attr('data-bind', binding + opt.field.binding);
                if (typeof opt.field.attrs !== 'undefined') { for (var attr in opt.field.attrs) fld.attr(attr.toLowerCase(), opt.field.attrs[attr]); }
                if (typeof opt.options !== 'undefined') self.createObjectOptions(fld, opt, binding + prop);
                break;
        }
        if (typeof fld !== 'undefined' && typeof opt.field !== 'undefined') {
            if (opt.field.fieldEvents !== 'undefined') {
                for (var eventName in opt.fieldEvents) {
                    var fevent = opt.fieldEvents[eventName];
                    if (typeof fevent === 'string') {
                        console.log('Adding field event:' + fevent);
                        fld.on(eventName, new Function('evt', fevent));
                    }
                    else if (typeof fevent === 'object') {
                        fld.on(eventName, (evt) => {
                            if (typeof fevent.confirm === 'object') {
                                var confirm = $.pic.modalDialog.createConfirm("dlgConfirmEvent", $.extend(true, {}, {
                                    title: 'Confirm Action',
                                    message: 'Are you sure you want to do this?'
                                }, fevent.confirm)).on('confirmed', function (e) { self._callServiceEvent(evt, fevent); });
                            }
                            else
                                self._callServiceEvent(evt, fevent);
                        });
                    }
                }

            }
        }
        return fld;
    },
    createObjectOptions: function (pnl, opts) {
        var self = this;
        if (typeof opts !== 'undefined' && typeof opts.options !== 'undefined') {
            for (var i = 0; i < opts.options.length; i++) {
                var opt = opts.options[i];
                self.createControlOptions(pnl, opt, opt.bind);
            }
        }
    },
    callServiceEvent: function (evt, fevent) {
        var self = this, o = self.options, el = self.element;
        var device = dataBinder.fromElement($(evt.currentTarget).parents(`*[data-bindingcontext="device"]:first`));
        var callObj;
        if (typeof fevent.callContext !== 'undefined') callObj = dataBinder.fromElement($(evt.currentTarget).parents(`*[data-bindingcontext="${fevent.callContext}"]`));
        if (typeof fevent.eventObject === 'string') callObj = $.extend(true, {}, callObj, evt[fevent.eventObject]);
        if (typeof fevent.callObj !== 'undefined') callObj = $.extend(true, callObj, fevent.callObj);
        var servicePath = eval(fevent.path);
        switch (fevent.type) {
            case 'putservice':
                $.putLocalService(servicePath, callObj, fevent.message, function (result, status, xhr) {
                    if (typeof fevent.resultContext !== 'undefined') {
                        $(evt.currentTarget).parents(`*[data-bindingcontext="${fevent.resultContext}"]`);
                        dataBinder.bind($(evt.currentTarget).parents(`*[data-bindingcontext="${fevent.resultContext}"]`), result);
                    }
                });
                break;
        }
    }
};
$.ui.position.fieldTip = {
    left: function (position, data) {
        //console.log({ fn: 'left', position: position, data: data });
        var initPos = position.left;
        $.ui.position.flip.left(position, data);
        if (initPos !== position.left) {
            data.elem.removeClass('right').addClass('left');
        } else {
            data.elem.removeClass('left').addClass('right');
        }
    },
    top: function (position, data) {
        var initPos = position.top;
        //console.log({ fn: 'top', position: position, data: data });
        $.ui.position.flip.top(position, data);
        if (initPos !== position.top) {
            data.elem.addClass('tooltipFlipTop');
        } else {
            data.elem.removeClass('tooltipFlipTop');
        }
    }
};
// Control Widgets
(function ($) {
    $.widget("pic.fieldTip", {
        options: {
            placement: {}
        },
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._initFieldTip();
        },
        _initFieldTip: function () {
            var self = this, o = self.options, el = self.element;
            let div = $('<div class="picFieldTip-message"></div>');
            var fld = o.field || el.parent();
            if (o.message instanceof jQuery)
                o.message.appendTo(div);
            else
                div.html(o.message);
            el.addClass('picFieldTip');
            el.css({ visibility: 'hidden' });
            if (typeof fld !== 'undefined') {
                var parent = el.parents('div.picAccordian-contents:first') || el.parents('div.picTabContent:first') || el.parents('div.picConfigContainer:first') || el.parents('div.picDashContainer:first');
                //el.appendTo(parent);
                var p = {
                    my: o.placement.my || 'left center',
                    at: o.placement.at || 'right+7 center',
                    of: fld,
                    collision: 'fieldTip',
                    within: parent[0]
                };
                setTimeout(function () {
                    el.position(p); el.css({ visibility: 'visible' });
                }, 0);

                if (typeof o.closeAfter === 'undefined') o.closeAfter = Math.max(o.message.length * 100, 5000);
                if (o.closeAfter > 0) setTimeout(function () {
                    el.fadeOut(400, function () { el.remove(); });
                }, o.closeAfter);
            }
            div.appendTo(el);
            el.on('click', function (evt) { el.remove(); evt.preventDefault(); evt.stopPropagation(); });
        }
    });
    $.widget("pic.toggleButton", {
        options: { isOn: false },
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._initToggleButton();
        },
        _initToggleButton: function () {
            var self = this, o = self.options, el = self.element;
            let div = $('<div class="picIndicator"></div>');
            el.addClass('picToggleButton');
            el.addClass('btn');
            if (typeof o.id !== 'undefined') el.attr('id', o.id);
            //el.addClass('btn');
            el[0].val = function (val) { return self.val(val); };
            el[0].disabled = function (val) { return self.disabled(val); }
            if (o.bind) el.attr('data-bind', o.bind);
            div.appendTo(el);
            $('<label></label>').appendTo(el).text(o.labelText);
            el.on('click', function (evt) {
                if (!self.disabled()) self.val(!o.isOn);
            });

        },
        disabled: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val === 'undefined')
                return el.hasClass('disabled');
            else {
                if (val) el.addClass('disabled');
                else el.removeClass('disabled');
            }
        },
        val: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof (val) !== 'undefined') {
                el.find('div.picIndicator').attr('data-status', val);
                o.isOn = val;
            }
            else
                return makeBool(el.find('div.picIndicator').attr('data-status'));
        }
    });
    $.widget("pic.actionButton", {
        options: {},
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._initActionButton();
        },
        _initActionButton: function () {
            var self = this, o = self.options, el = self.element;
            let icon = $('<span class="picButtonIcon"></span>');
            let text = $('<span class="picButtonText"></span>');
            icon.appendTo(el);
            text.appendTo(el);
            if (o.icon) icon.html(o.icon);
            if (o.id) el.attr('id', o.id);
            if (o.hidden) el.hide();
            el.addClass('picActionButton');
            el.addClass('btn');
            if (o.text) text.html(o.text);
            el[0].buttonText = function (val) { return self.buttonText(val); };
            if (o.bind) el.attr('data-bind', o.bind);
            el[0].buttonIcon = function (val) { return self.buttonIcon(val); };
            el[0].disabled = function (val) { return self.disabled(val); };
            if (typeof o.style !== 'undefined') el.css(o.style);

        },
        buttonText: function (val) {
            var self = this, o = self.options, el = self.element;
            return el.find('span.picButtonText').text(val);
        },
        buttonIcon: function (val) {
            var self = this, o = self.options, el = self.element;
            el.find('span.picButtonIcon').html(val);
        },
        disabled: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val === 'undefined')
                return el.hasClass('disabled');
            else {
                if (val) el.addClass('disabled');
                else el.removeClass('disabled');
            }
        }
    });
    $.widget("pic.optionButton", {
        options: {},
        _create: function () {
            var self = this, o = self.options, el = self.element;
            el[0].val = function (val) { return self.val(val); };
            el[0].buttonText = function (val) { return self.buttonText(val); };
            el[0].isEmpty = function () { return self.isEmpty(); };
            el[0].required = function (val) { return self.required(val); };
            if (o.required === true) self.required(true);
            el[0].disabled = function (val) { return self.disabled(val); };
            self._initOptionButton();
        },
        _initOptionButton: function () {
            var self = this, o = self.options, el = self.element;
            let text = $('<span class="picButtonText"></span>');
            var toggle = $('<div class="picOptionToggle"></div>');
            toggle.appendTo(el);
            toggle.toggleButton();
            text.appendTo(el);
            if (o.icon) icon.html(o.icon);
            el.addClass('picOptionButton');
            el.addClass('btn-border');
            if (typeof o.id !== 'undefined') el.prop('id', o.id);
            el.attr('data-datatype', 'boolean');
            if (o.text) text.text(o.text);
            if (o.bind) el.attr('data-bind', o.bind);
            if (o.dropdownButton) o.dropdownButton.appendTo(el);
            el.on('click', function (e) {
                if (el.hasClass('disabled')) {
                    e.stopImmediatePropagation();
                    return;
                }
                el.find('div.picIndicator').each(function () {
                    var v = makeBool($(this).attr('data-status'));
                    $(this).attr('data-status', !v);
                });
            });
        },
        buttonText: function (val) {
            var self = this, o = self.options, el = self.element;
            return el.find('span.picButtonText').text(val);
        },
        required: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val === 'undefined') return makeBool(el.attr('data-required'));
            else el.attr('data-required', makeBool(val));
        },
        isEmpty: function () {
            var self = this, o = self.options, el = self.element;
            var val = self.val();
            return typeof val === 'undefined' || val === '';
        },
        val: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val !== 'undefined')
                el.find('div.picIndicator').attr('data-status', val);
            else
                return el.find('div.picIndicator').attr('data-status');
        },
        disabled: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val === 'undefined')
                return el.hasClass('disabled');
            else {
                if (val) el.addClass('disabled');
                else el.removeClass('disabled');
            }
        }
    });
    $.widget("pic.valueSpinner", {
        options: {
            lastChange: 0, ramp: 40, ramps: 0, fmtMask: '#,##0.####', fmtEmpty: '', step: 1, inputAttrs: {}, labelAttrs: {}
        },
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._initValueSpinner();
        },
        _rampIncrement: function () {
            var self = this, o = self.options, el = self.element;
            if (o.timer) clearTimeout(o.timer);
            self.increment();
            o.timer = setTimeout(function () {
                o.ramps++;
                self._rampIncrement();
            }, Math.max(400 - ((o.ramps + 1) * o.ramp), o.ramp));
        },
        _rampDecrement: function () {
            var self = this, o = self.options, el = self.element;
            if (o.timer) clearTimeout(o.timer);
            self.decrement();
            o.timer = setTimeout(function () {
                o.ramps++;
                self._rampDecrement();
            }, Math.max(500 - ((o.ramps + 1) * o.ramp), o.ramp));
        },
        _fireValueChanged: function () {
            var self = this, o = self.options, el = self.element;
            var evt = $.Event('change');
            evt.value = o.val;
            el.trigger(evt);
        },
        _initValueSpinner: function () {
            var self = this, o = self.options, el = self.element;
            if (!el.hasClass) el.addClass('picSpinner');
            el[0].increment = function () { return self.increment(); };
            el[0].decrement = function () { return self.decrement(); };
            el[0].val = function (val) { return self.val(val); };
            el[0].options = function (opts) { return self.opts(opts); };
            el[0].isEmpty = function () { return self.isEmpty(); };
            el[0].required = function (val) { return self.required(val); };
            if (o.required === true) self.required(true);
            //$('<label class="picSpinner-label"></label><div class="picSpinner-down fld-btn-left"><i class="fas fa-minus"></i></div><div class="picSpinner-value fld-value-center"></div><div class="picSpinner-up fld-btn-right"><i class="fas fa-plus"></i></div><span class="picSpinner-units picUnits"></span>').appendTo(el);

            $('<label></label>').addClass('picSpinner-label').appendTo(el);
            $('<div></div>').addClass('picSpinner-down').addClass('fld-btn-left').appendTo(el).append($('<i class="fas fa-minus"></i>'));
            if (o.canEdit) {
                $('<div></div>').addClass('picSpinner-value').addClass('fld-value-center').attr('contenteditable', true).appendTo(el)
                    .on('focusout', function (evt) {
                        console.log(evt);
                        var val = Number($(evt.target).text().replace(/[^0-9\.\-]+/g, ''));
                        if (isNaN(val)) self.val(o.min);
                        else self.val(val);
                    });
            }
            else {
                $('<div></div>').addClass('picSpinner-value').addClass('fld-value-center').appendTo(el);
            }
            $('<div></div>').addClass('picSpinner-up').addClass('fld-btn-right').appendTo(el).append($('<i class="fas fa-plus"></i>'));
            $('<span></span>').addClass('picSpinner-units').addClass('picUnits').attr('data-bind', o.unitsBinding).appendTo(el);
            //$('<label class="picSpinner-label"></label><div class="picSpinner-down fld-btn-left"><i class="fas fa-minus"></i></div><div class="picSpinner-value fld-value-center"></div><div class="picSpinner-up fld-btn-right"><i class="fas fa-plus"></i></div><span class="picSpinner-units picUnits"></span>').appendTo(el);
            if (typeof o.min === 'undefined' || o.min === null) o.min = 0;
            if (typeof o.val === 'undefined' || o.val === null) o.val = o.min;
            if (typeof o.dataType !== 'undefined') el.attr('data-datatype', o.dataType);
            el.find('div.picSpinner-value').text(o.val.format(o.fmtMask, o.fmtEmpty));
            el.find('span.picSpinner-units').html(o.units);
            self._applyStyles();
            if (typeof o.value !== 'undefined') self.val(o.value);
            if (typeof o.binding !== 'undefined') el.attr('data-bind', o.binding);
            if (o.labelText) el.find('label.picSpinner-label:first').html(o.labelText);
            el.on('mousedown touchstart', 'div.picSpinner-down', function (evt) {
                self._rampDecrement();
                evt.preventDefault();
                evt.stopPropagation();
            });
            el.on('mousedown touchstart', 'div.picSpinner-up', function (evt) {
                self._rampIncrement();
                evt.preventDefault();
                evt.stopPropagation();
            });
            el.on('mouseup touchend', 'div.picSpinner-up, div.picSpinner-down', function (evt) {
                o.ramps = 0;
                clearTimeout(o.timer);
                o.timer = null;
                self._fireValueChanged();
            });
            el.on('mouseleave', 'div.picSpinner-up, div.picSpinner-down', function (evt) {
                o.ramps = 0;
                if (!o.timer) return;
                clearTimeout(o.timer);
                o.timer = null;
                self._fireValueChanged();
            });
        },
        opts: function (opts) {
            var self = this, o = self.options, el = self.element;
            if (typeof opts !== 'undefined') {
                $.extend(o, opts);
                if (typeof opts.val !== 'undefined') self.val(opts.val);
                else self.val(self.val());
            }
            else
                return o;
        },
        _applyStyles: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('picValueSpinner');
            if (typeof o.style !== 'undefined') el.css(o.style);
            var fld = el.find('div.picSpinner-value:first');
            var lbl = el.find('label.picSpinner-label:first');
            for (var ia in o.inputAttrs) {
                switch (ia) {
                    case 'style':
                        if (typeof o.inputAttrs[ia] === 'object') fld.css(o.inputAttrs[ia]);
                        break;
                    case 'maxlength':
                    case 'maxLength':
                        //if (typeof o.inputStyle.width === 'undefined')
                        fld.css({ width: parseInt(o.inputAttrs[ia], 10) * .7 + 'rem' });
                        break;
                    default:
                        if (ia.startsWith('data')) fld.attr(ia, o.inputAttrs[ia]);
                        break;

                }
            }
            for (var la in o.labelAttrs) {
                switch (la) {
                    case 'style':
                        if (typeof o.labelAttrs[la] === 'object') lbl.css(o.labelAttrs[la]);
                        break;
                    default:
                        lbl.attr(la, o.labelAttrs[la]);
                        break;
                }

            }
        },
        increment: function () {
            var self = this, o = self.options, el = self.element;
            o.val = Math.min(o.max, o.val + o.step);
            el.find('div.picSpinner-value').text(o.val.format(o.fmtMask, o.fmtEmpty));
            o.lastChange = new Date().getTime();
            return o.val;
        },
        decrement: function () {
            var self = this, o = self.options, el = self.element;
            o.val = Math.max(o.min, o.val - o.step);
            el.find('div.picSpinner-value').text(o.val.format(o.fmtMask, o.fmtEmpty));
            o.lastChange = new Date().getTime();
            return o.val;
        },
        required: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val === 'undefined') return makeBool(el.attr('data-required'));
            else el.attr('data-required', makeBool(val));
        },
        isEmpty: function () {
            var self = this, o = self.options, el = self.element;
            return isNaN(self.val());
        },
        val: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val === 'undefined') return o.val;
            if (val > o.max) val = o.max;
            else if (val < o.min) val = o.min;
            o.val = Math.min(Math.max(o.min, val), o.max);
            el.find('div.picSpinner-value').text(o.val.format(o.fmtMask, o.fmtEmpty));
        }
    });
    $.widget("pic.timeSpinner", {
        options: {
            lastChange: 0, ramp: 40, ramps: 0, fmtMask: 'hh:mmtt', fmtEmpty: '', step: 30, inputAttrs: {}, labelAttrs: {}
        },
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._initValueSpinner();
        },
        _rampIncrement: function () {
            var self = this, o = self.options, el = self.element;
            if (o.timer) clearTimeout(o.timer);
            self.increment();
            o.timer = setTimeout(function () {
                o.ramps++;
                self._rampIncrement();
            }, Math.max(400 - ((o.ramps + 1) * o.ramp), o.ramp));
        },
        _rampDecrement: function () {
            var self = this, o = self.options, el = self.element;
            if (o.timer) clearTimeout(o.timer);
            self.decrement();
            o.timer = setTimeout(function () {
                o.ramps++;
                self._rampDecrement();
            }, Math.max(500 - ((o.ramps + 1) * o.ramp), o.ramp));
        },
        _fireValueChanged: function () {
            var self = this, o = self.options, el = self.element;
            var evt = $.Event('change');
            evt.value = o.val;
            el.trigger(evt);
        },
        _initValueSpinner: function () {
            var self = this, o = self.options, el = self.element;
            if (!el.hasClass) el.addClass('picSpinner');
            el[0].increment = function () { return self.increment(); };
            el[0].decrement = function () { return self.decrement(); };
            el[0].val = function (val) { return self.val(val); };
            el[0].options = function (opts) { return self.opts(opts); };
            el[0].isEmpty = function () { return self.isEmpty(); };
            el[0].required = function (val) { return self.required(val); };
            if (o.required === true) self.required(true);
            $('<label class="picSpinner-label"></label><div class="picSpinner-down fld-btn-left"><i class="fas fa-minus"></i></div><input type="text" class="picSpinner-value fld-value-center"></input><div class="picSpinner-up fld-btn-right"><i class="fas fa-plus"></i></div><span class="picSpinner-units picUnits"></span>').appendTo(el);
            if (typeof o.min === 'undefined') o.min = 0;
            if (typeof o.val === 'undefined') o.val = o.min;
            // format our time based upon minutes from midnight.
            el.find('input.picSpinner-value').val(o.val.formatTime(o.fmtMask, o.fmtEmpty));
            el.find('span.picSpinner-units').attr('data-bind', o.unitsBinding).text(o.units);
            self._applyStyles();
            if (typeof o.value !== 'undefined') self.val(o.value);
            if (typeof o.binding !== 'undefined') el.attr('data-bind', o.binding);
            if (o.labelText) el.find('label.picSpinner-label:first').html(o.labelText);
            el.on('mousedown', 'div.picSpinner-down', function (evt) {
                self._rampDecrement();
                evt.preventDefault();
                evt.stopPropagation();
            });
            el.on('mousedown', 'div.picSpinner-up', function (evt) {
                self._rampIncrement();
                evt.preventDefault();
                evt.stopPropagation();
            });
            el.on('mouseup', 'div.picSpinner-up, div.picSpinner-down', function (evt) {
                o.ramps = 0;
                clearTimeout(o.timer);
                o.timer = null;
                self._fireValueChanged();
            });
            el.on('mouseleave', 'div.picSpinner-up, div.picSpinner-down', function (evt) {
                o.ramps = 0;
                if (!o.timer) return;
                clearTimeout(o.timer);
                o.timer = null;
                self._fireValueChanged();
            });
            el.on('change', 'input.picSpinner-value', function (evt) {
                self.val(self.parseTime($(evt.currentTarget).val()));
            });
        },
        opts: function (opts) {
            var self = this, o = self.options, el = self.element;
            if (typeof opts !== 'undefined') {
                $.extend(o, opts);
                if (typeof opts.val !== 'undefined') self.val(opts.val);
            }
            else
                return o;
        },
        _applyStyles: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('picValueSpinner');
            if (typeof o.style !== 'undefined') el.css(o.style);
            var fld = el.find('input.picSpinner-value:first');
            var lbl = el.find('label.picSpinner-label:first');
            for (var ia in o.inputAttrs) {
                switch (ia) {
                    case 'style':
                        if (typeof o.inputAttrs[ia] === 'object') fld.css(o.inputAttrs[ia]);
                        break;
                    case 'maxlength':
                    case 'maxLength':
                        //if (typeof o.inputStyle.width === 'undefined')
                        fld.css({ width: parseInt(o.inputAttrs[ia], 10) * .7 + 'rem' });
                        break;
                    default:
                        if (ia.startsWith('data')) fld.attr(ia, o.inputAttrs[ia]);
                        break;

                }
            }
            for (var la in o.labelAttrs) {
                switch (la) {
                    case 'style':
                        if (typeof o.labelAttrs[la] === 'object') lbl.css(o.labelAttrs[la]);
                        break;
                    default:
                        lbl.attr(la, o.labelAttrs[la]);
                        break;
                }

            }
        },
        increment: function () {
            var self = this, o = self.options, el = self.element;
            o.val = Math.min(o.max, o.val + o.step);
            el.find('input.picSpinner-value').val(o.val.formatTime(o.fmtMask, o.fmtEmpty));
            o.lastChange = new Date().getTime();
            return o.val;
        },
        decrement: function () {
            var self = this, o = self.options, el = self.element;
            o.val = Math.max(o.min, o.val - o.step);
            el.find('input.picSpinner-value').val(o.val.formatTime(o.fmtMask, o.fmtEmpty));
            o.lastChange = new Date().getTime();
            return o.val;
        },
        required: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val === 'undefined') return makeBool(el.attr('data-required'));
            else el.attr('data-required', makeBool(val));
        },
        isEmpty: function () {
            var self = this, o = self.options, el = self.element;
            return isNaN(self.val());
        },
        parseTime: function (val) {
            var self = this, o = self.options, el = self.element;
            var indexOfAny = function (str, arrChars) {
                for (var char in arrChars) {
                    console.log(char);
                    var ndx = str.indexOf(arrChars[char]);
                    if (ndx !== -1) return ndx;
                }
                return -1;
            };
            var bAddHrs = false;
            var hrs = 0;
            var mins = 0;
            var arr = val.split(':');
            if (arr.length > 0) {
                hrs = parseInt(arr[0].replace(/\D/g), 10);
                bAddHrs = (indexOfAny(arr[0], ['P', 'p']) !== -1);
            }
            if (arr.length > 1) {
                mins = parseInt(arr[1].replace(/\D/g), 10);
                bAddHrs = (indexOfAny(arr[1], ['P', 'p']) !== -1);
            }
            if (isNaN(hrs)) hrs = 0;
            if (isNaN(mins)) mins = 0;
            if (bAddHrs && hrs <= 12) hrs += 12;
            return (hrs * 60) + mins;

        },
        val: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val === 'undefined') return o.val;
            if (val > o.max) val = o.max;
            else if (val < o.min) val = o.min;
            //console.log({ m: 'Setting time', val: val, text: val.formatTime(o.fmtMask, o.fmtEmpty) });
            o.val = Math.min(Math.max(o.min, val), o.max);
            el.find('input.picSpinner-value').val(val.formatTime(o.fmtMask, o.fmtEmpty));
        }
    });
    $.widget("pic.selector", {
        options: {},
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._initSelector();
        },
        _initSelector: function () {
            var self = this, o = self.options, el = self.element;
            el[0].isEmpty = function () { return self.isEmpty(); };
            el[0].required = function (val) { return self.required(val); };
            if (o.required === true) self.required(true);
            el.addClass('picSelector');
            for (let i = 0; i < o.opts.length; i++) {
                let opt = o.opts[i];
                let divOpt = $('<div class="picOption"><div class="picIndicator"></div><label class="picOption"></label></div>');
                divOpt.appendTo(el);
                divOpt.find('label.picOption').text(opt.desc);
                divOpt.attr('data-name', opt.name);
                divOpt.attr('data-val', opt.val);
                if (opt.val === o.val) divOpt.find('div.picIndicator').attr('data-status', 'selected');

            }
            el.on('click', 'div.picOption', function (evt) {
                let opt = $(this);
                evt.preventDefault();
                if (opt.attr('data-val') === o.val.toString()) return;
                else {
                    let old = o.val;
                    o.val = opt.attr('data-val');
                    el.find('div.picOption').each(function () {
                        let $this = $(this);
                        let ind = $this.find('div.picIndicator:first');
                        ind.attr('data-status', $this.attr('data-val') === o.val.toString() ? 'selected' : '');
                    });
                    let e = $.Event('selchange');
                    e.oldVal = old;
                    e.newVal = o.val;
                    el.trigger(e);
                }
            });
        },
        required: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val === 'undefined') return makeBool(el.attr('data-required'));
            else el.attr('data-required', makeBool(val));
        },
        isEmpty: function () {
            var self = this, o = self.options, el = self.element;
            return el.find('div.picOption div.picIndicator[data-status=selected]').length === 0;
        }

    });
    $.widget("pic.tabBar", {
        options: {
            isInteractive: true,
            isEnabled: true
        },
        _create: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('picTabBar');
            if (typeof o.id !== 'undefined') el.attr('id', o.id);
            $('<div class="picTabs"></div>').prependTo(el);
            $('<div class="picTabContents tab-contents"></div>').appendTo(el);
            el.find('div.picTabs:first').on('click', 'div.picTab', function (evt) {
                // Set the active tab here.
                self.selectTabById($(evt.currentTarget).attr('data-tabid'));
                evt.preventDefault();
            });
            el[0].tabContent = function (tabId) { return self.tabContent(tabId); };
            el[0].selectTabById = function (tabId) { return self.selectTabById(tabId); };
            el[0].selectedTabId = function (tabId) { return self.selectedTabId(tabId); };
            el[0].showTab = function (tabId, show) { return self.showTab(tabId, show); }
            el[0].addTab = function (tabObj) { return self.addTab(tabObj); };
            el[0].removeTab = function (tabId) { return self.removeTab(tabId); }
            el[0].selectFirstVisibleTab = function () { return self.selectFirstVisibleTab(); }
            var evt = $.Event('initTabs');
            evt.contents = function () { return self.contents(); };
            el.trigger(evt);
        },
        isInDOM: function () { return $.contains(this.element[0].ownerDocument.documentElement, this.element[0]); },
        showTab: function (tabId, show) {
            var self = this, o = self.options, el = self.element;
            var tab = el.find('div.picTabs:first').children('div.picTab[data-tabid="' + tabId + '"]');
            //console.log({ msg: 'Showing tab', tab: tab, show: show });
            if (show) tab.show();
            else tab.hide();
            if (tab.hasClass('picTabSelected')) {
                if (show) self.contents().find('div.picTabContent[data-tabid=' + tabId + ']').show();
                else self.contents().find('div.picTabContent[data-tabid=' + tabId + ']').hide();
            }
        },
        removeTab: function (tabId) {
            var self = this, o = self.options, el = self.element;
            var tab = el.find('div.picTabs:first').children('div.picTab[data-tabid="' + tabId + '"]').remove();
            self.contents().find('div.picTabContent[data-tabid=' + tabId + ']').remove();
        },
        selectFirstVisibleTab: function () {
            var self = this, o = self.options, el = self.element;
            var evt = $.Event('tabchange');
            var tabId = '';
            el.find('div.picTabs:first').children('div.picTab').each(function () {
                if ($(this).css('display') !== 'none') {
                    tabId = $(this).attr('data-tabId');
                    self.selectTabById(tabId);
                    return false;
                }
            });
            return tabId;
        },

        selectTabById: function (tabId) {
            var self = this, o = self.options, el = self.element;
            var evt = $.Event('tabchange');
            if (o.tabId) evt.oldTab = { id: o.tabId, contents: self.tabContent(o.tabId) };
            evt.newTab = { id: tabId, contents: self.tabContent(tabId) };
            el.trigger(evt);
            //console.log(evt);
            if (!evt.isDefaultPrevented()) {
                el.find('div.picTabs:first').children('div.picTab').each(function () {
                    var $this = $(this);
                    var id = $this.attr('data-tabid');
                    if (id === tabId) {
                        $this.addClass('picTabSelected');
                        self.contents().find('div.picTabContent[data-tabid=' + id + ']').show();
                        o.tabId = id;
                    }
                    else {
                        $this.removeClass('picTabSelected');
                        self.contents().find('div.picTabContent[data-tabid=' + id + ']').hide();
                    }
                });
            }
        },
        selectedTabId: function (tabId) {
            var self = this, o = self.options, el = self.element;
            if (typeof tabId === 'undefined') return o.tabId;
            else if (tabId !== o.tadId)
                return self.selectTabById(tabId);
        },
        tabs: function () { return this.element.find('div.picTabs:first'); },
        contents: function () { return this.element.find('div.picTabContents:first'); },
        tabContent: function (tabId) { return this.contents().find('div.picTabContent[data-tabid=' + tabId + ']:first'); },
        addTab: function (tabObj) {
            var self = this, o = self.options, el = self.element;
            var tab = $('<div class="picTab tab-item"><span class="picTabText"></span></div>');
            tab.appendTo(self.tabs());
            tab.attr('data-tabid', tabObj.id);
            tab.find('span.picTabText').each(function () { $(this).html(tabObj.text); });
            var content = $('<div class="picTabContent"></div>');
            content.attr('data-tabid', tabObj.id);
            content.appendTo(self.contents());

            if (typeof tabObj.contents === 'string') content.html(tabObj.contents);
            else if (typeof tabObj.contents === 'function') tabObj.contents(content);
            else if (typeof tabObj.contents !== 'undefined') tabObj.contents.appendTo(content);
            return content;
        },
        _destroy: function () {
            var self = this, o = self.options, el = self.element;
        }

    });
    $.widget("pic.popover", {
        options: {
            id: _uniqueId,
            isInteractive: true,
            isPositioned: false,
            isEnabled: true,
            trigger: 'manual',
            targetSelector: null,
            positionStyle: 'movable',
            popoverStyle: 'modal',
            autoClose: true,
            animation: {
                type: 'fade',
                delay: { show: 500, hide: 100 }
            },
            placement: {
                target: null,
                attachment: 'left middle',
                targetAttachment: 'top center',
                collision: 'fit',
                constraints: [
                    {
                        to: 'window',
                        attachment: 'together',
                        pin: true
                    }]
            }
        },
        _create: function () {
            var self = this, o = self.options, el = self.element;
            o.id = _uniqueId++;
            el.addClass('picPopover');
            el.addClass('popover');
            el.attr('data-popoverid', o.id);
            el[0].toggle = function (elTarget) { self.toggle(elTarget); };
            el[0].show = function (elTarget) { self.show(elTarget); };
            el[0].hide = function () { self.hide(); };
            el[0].interactive = function (val) { self.interactive(val); };
            el[0].titleText = function (val) { return el.find('span.picPopoverTitle').html(val); };
            el[0].close = function () { return self.close(); };
            var header = $('<div class="picPopoverHeader control-panel-title"><div class="picPopoverTitle"><span class="picPopoverTitle"></span></div>').prependTo(el);
            if (!o.autoClose) {
                $('<div class="picClosePopover pover-icon picIconRight" title="Close"><i class="far fa-window-close"></i></div>').appendTo(header.find('div.picPopoverTitle:first'));
                el.on('click', 'div.picClosePopover', function (evt) { el[0].close(); });
            }
            $('<div class="picPopoverBody"></div>').appendTo(el);
            el.find('span.picPopoverTitle').html(o.title);
            //el.on('click', function (evt) { evt.preventDefault(); });
            var evt = $.Event('initPopover');
            evt.contents = function () { return el.find('div.picPopoverBody'); };
            if (o.popoverStyle === 'modal') {
                o.screenLayer = _screenLayer;
                el.css({ zIndex: _screenLayer++ });
            }
            el.trigger(evt);
        },
        interactive: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof (val) === 'undefined') return o.isInteractive;
            else {
                o.isInteractive = makeBool(val);
                if (self.isOpen()) self.hide();
            }
        },
        isOpen: function () { return this.element.is(':visible'); },
        isInDOM: function () { return $.contains(this.element[0].ownerDocument.documentElement, this.element[0]); },
        toggle: function (elTarget) {
            var self = this, o = self.options, el = self.element;
            if (!o.isEnabled) return;
            if (!self.isOpen()) self.show(elTarget);
            else self.hide();
        },
        close: function () {
            var self = this, o = self.options, el = self.element;
            if (o.popoverStyle === 'modal') _screenLayer = o.screenLayer;
            if (!self.isInDOM()) return;
            var evt = $.Event('beforeClose');

            el.trigger(evt);
            if (evt.isDefaultPrevented() || !self.isInDOM()) return;
            $('div.ui-widget-overlay[data-popoverid=' + o.id + ']').remove();
            el.remove();
        },
        show: function (elTarget) {
            var self = this, o = self.options, el = self.element;
            if (self.isOpen() || !o.isInteractive) return;

            var evt = $.Event('showPopover');
            evt.contents = function () { return el.find('div.picPopoverBody'); };
            el.trigger(evt);
            if (evt.isDefaultPrevented() || !self.isInDOM()) return;
            if (o.popoverStyle === 'modal') {
                o.overlay = $('<div class="ui-widget-overlay ui-front"></div>');
                o.overlay.attr('data-popoverid', o.id);
                o.overlay.css({ zIndex: o.screenLayer - 1 });
                if (o.autoClose) {
                    o.overlay.one('click', function () {
                        el.remove();
                        $('div.ui-widget-overlay[data-popoverid=' + o.id + ']').remove();
                    });
                }
                o.overlay.appendTo(document.body);
                if (o.trigger === 'focus' || o.trigger === 'hover')
                    o.overlay.one('click', function (evt) { self.hide(); });
            }
            else if (o.trigger === 'hover') {
                elTarget.one('mouseleave', function (evt) { self.hide(); });
            }
            else if (o.trigger === 'focus') {
                elTarget.one('focusout', function (evt) { self.hide(); });
            }

            if (el.hasClass('ui-draggable')) el.draggable('destroy');
            el.show();
            // We are going to position it with jquery.
            var p = {
                my: o.placement.my || 'center top',
                at: o.placement.at || 'center bottom',
                of: elTarget,
                collision: 'flipfit',
                within: o.placement.within
            };
            if (p.within === 'window') p.within = window;
            if (p.within === 'document') p.within = document;
            if (typeof (p.within) === 'string') p.within = $(p.within);
            el.position(p);
            if (o.positionStyle === 'movable') {
                var d = { cursor: 'crosshair', handle: 'div.picPopoverHeader', opacity: 0.55 };
                if (o.placement.within === 'window' || o.placement.within === 'document')
                    d.containment = o.placement.within;
                else if (o.placement.within === 'parent')
                    d.containment = elTarget.parent()[0];
                else if (typeof (p.within) === 'string')
                    d.containment = p.within;
                else if (typeof (p.within) !== 'undefined' && typeof (p.within.css) === 'function')
                    d.containment = p.within[0];
                else
                    d.containment = p.within;
                el.draggable(d);
                el.find('div.picPopoverHeader').css({ cursor: 'move' });
            }
            else
                el.find('div.picPopoverHeader').css({ cursor: '' });
        },
        hide: function () {
            var self = this, o = self.options, el = self.element;
            if (o.overlay && typeof (o.overlay) !== 'undefined') o.overlay.remove();
            o.overlay = null;
            el.hide();
        },
        _destroy: function () {
            var self = this, o = self.options, el = self.element;
            if (o.overlay !== null) o.overlay.remove();
            o.overlay = null;
        }

    });
    $.widget("pic.pickList", {
        options: {
            items: [],
            columns: [{ binding: 'id', hidden: true, text: 'Id', style: { whiteSpace: 'nowrap' } }, { binding: 'name', text: 'Name', style: { whiteSpace: 'nowrap' } }],
            bindColumn: 0,
            displayColumn: 1,
            inputAttrs: {},
            labelAttrs: {},
            pickListStyle: { maxHeight: '300px' }
        },
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._initPickList();
        },
        _initPickList: function () {
            var self = this, o = self.options, el = self.element;
            if (o.bind) el.attr('data-bind', o.bind);
            $('<label class="picPickList-label field-label"></label>').appendTo(el).text(o.labelText);
            if (typeof o.id !== 'undefined') el.attr('id', o.id);
            var itm = self._getItem(o.value);
            if (o.canEdit)
                $('<div class="picPickList-value fld-value-combo"><input type="text" class="picPickList-value"></input><div>').addClass('editable').appendTo(el);
            else
                $('<div class="picPickList-value fld-value-combo"></div>').appendTo(el);
            var col = self._getColumn(o.displayColumn);
            if (itm && col) self.text(itm[col.binding]);
            $('<div class="picPickList-drop fld-btn-right"><i class="fas fa-caret-down"></i></div>').appendTo(el);
            el.attr('data-bind', o.binding);
            el[0].label = function () { return el.find('label.picPickList-label:first'); };
            el[0].field = function () { return el.find('div.picPickList-value:first'); };
            el[0].text = function (text) { return self.text(text); };
            el[0].val = function (val) { return self.val(val); };
            el[0].disabled = function (val) { return self.disabled(val); };
            el[0].isEmpty = function () { return self.isEmpty(); };
            el[0].required = function (val) { return self.required(val); };
            el[0].items = function (val) { self.itemList(val); };
            el[0].selectedItem = function () { return self._getItem(o.value); };
            el.attr('data-val', o.value);
            if (o.required === true) self.required(true);
            el.attr('data-datatype', o.dataType);

            self._applyStyles();
            el.find('div.picPickList-drop').on('click', function (evt) {
                var div = el.find('div.picPickList-options:first');
                evt.stopImmediatePropagation();
                evt.preventDefault();
                if (div.length > 0) {
                    div.remove();
                    return;
                }
                else {
                    $('div.picPickList-options:first').remove();
                    if (!el.hasClass('disabled'))
                        self._buildOptionList();
                }
            });
            el.find('div.picPickList-drop').on('mousedown', function (evt) {
                evt.stopImmediatePropagation();

            });
            el.on('change', 'input.picPickList-value', function (evt) {
                self.val(el.find('input.picPickList-value:first').val());
            });
            $('<span></span>').addClass('picSpinner-units').addClass('picUnits').attr('data-bind', o.unitsBinding).appendTo(el).html(o.units);

        },
        _applyStyles: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('picPickList');
            var fld = el.find('div.picPickList-value:first');
            var lbl = el.find('label.picPickList-label:first');
            if (typeof o.style !== 'undefined') el.css(o.style);

            for (var ia in o.inputAttrs) {
                switch (ia) {
                    case 'style':
                        if (typeof o.inputAttrs[ia] === 'object') fld.css(o.inputAttrs[ia]);
                        break;
                    case 'maxlength':
                    case 'maxLength':
                        //if (typeof o.inputStyle.width === 'undefined')
                        fld.css({ width: parseInt(o.inputAttrs[ia], 10) * .7 + 'rem' });
                        if (o.canEdit) fld.attr('maxlength', o.inputAttrs[ia]);
                        break;
                    default:
                        if (ia.startsWith('data')) lbl.attr(ia, o.inputAttrs[ia]);
                        break;
                }
            }
            for (var la in o.labelAttrs) {
                switch (la) {
                    case 'style':
                        if (typeof o.labelAttrs[la] === 'object') lbl.css(o.labelAttrs[la]);
                        break;
                    default:
                        lbl.attr(la, o.labelAttrs[la]);
                        break;
                }

            }
        },
        _buildOptionHeader: function () {
            var self = this, o = self.options, el = self.element;
            var tbl = $('<table class="optHeader"><tbody><tr></tr></tbody></table>');
            var row = tbl.find('tr:first');
            for (var i = 0; i < o.columns.length; i++) {
                var col = self._getColumn(i);
                var td = $('<td><span class="optText">' + col.text + '</span></td>').appendTo(row);
                if (col.hidden) td.hide();
            }
            return tbl;
        },
        _buildOptionList: function () {
            var self = this, o = self.options, el = self.element;
            div = $('<div class="picPickList-options dropdown-panel"></div>');
            var tblOuter = $('<table class="optOuter"><tbody><tr class="optHeader header-background"><td></td></tr><tr class="optBody"><td><div class="optBody"><div></div></div></td></tr><tr class="optFooter"><td></td></tr></tbody></table>').appendTo(div);
            self._buildOptionHeader().appendTo(tblOuter.find('tr.optHeader:first > td'));
            var tbody = $('<table class="optBody"><tbody></tbody></table>').appendTo(tblOuter.find('div.optBody > div:first'));
            var val = self.val();
            for (var i = 0; i < o.items.length; i++) {
                var row = $('<tr></tr>').appendTo(tbody);
                var itm = o.items[i];
                for (var j = 0; j < o.columns.length; j++) {
                    var col = o.columns[j];
                    if (j === o.bindColumn) {
                        row.attr('data-value', itm[col.binding]);
                        if (typeof val !== 'undefined' && val !== null && val.toString() === itm[col.binding].toString()) row.addClass('selected');
                    }
                    var td = $('<td></td>').appendTo(row);
                    var span = $('<span class="optText"></span>').appendTo(td);
                    if (col.style) td.css(col.style);
                    if (col.hidden) td.hide();
                    span.html(dataBinder.createValue(itm, col.binding, col.fmtType, col.fmtEmpty));
                }
            }
            div.appendTo(el);
            if (o.dropdownStyle) div.css(o.dropdownStyle);
            el.parents('body').one('click', function (evt) { div.remove(); });
            var cols = tblOuter.find('table.optHeader > tbody > tr:first > td');
            var firstRow = tblOuter.find('table.optBody > tbody > tr:first > td');
            if (cols.length > 0 && firstRow.length > 0) {
                for (var k = cols.length - 2; k >= 0; k--) {
                    var hdrCol$ = $(cols[k]);
                    var dtaCol$ = $(firstRow[k]);
                    var colWidth = Math.max(hdrCol$.outerWidth(), dtaCol$.outerWidth());
                    hdrCol$.css('width', colWidth + 'px');
                    dtaCol$.css('width', colWidth + 'px');
                }
            }
            var width = tblOuter.find('table.optBody').outerWidth();
            var height = tblOuter.find('table.optBody').outerHeight();
            height += tblOuter.find('table.optHeader').outerHeight() + 2;

            css = { width: 'calc(' + width + 'px + 1.5rem)', height: 'calc(' + height + 'px + .5rem)' };
            //console.log(css);
            if (o.pickListStyle) div.css(o.pickListStyle);
            div.css(css);

            self._positionPickList(div);
            div.on('click', 'table.optBody > tbody > tr', function (evt) {
                evt.stopImmediatePropagation();
                self.val($(evt.currentTarget).attr('data-value'));
                setTimeout(function () { div.remove(); }, 0);
            });
        },
        _getOffset: function (el) {
            var off = { left: 0, top: 0 };
            el = el[0];
            while (el) {
                off.left += el.offsetLeft;
                off.top += el.offsetTop;
                el = el.offsetParent;
            }
            return off;
        },
        _getPosition: function (el) {
            el = el[0];
            parent = el.parent;
            var rect = el.getBoundingClientRect(el);
            var prect = parent ? parent.getBoundingClientRect(parent) : { left: 0, top: 0 };
            return { left: rect.left - prect.left, top: rect.top - prect.top };
        },
        _positionPickList: function (div) {
            var self = this, o = self.options, el = self.element;
            var fld = el.find('div.picPickList-value:first');
            var fldDims = { pos: fld.position(), off: fld.offset() };
            div.css({ left: fldDims.pos.left + 'px' });
            var divDims = { off: self._getOffset(div), pos: div.position(), height: div.outerHeight(), width: div.outerWidth() };
            var docDims = { height: document.documentElement.clientHeight, width: $(document).outerWidth() };

            var lbl = el.find('label.picPickList-label:first');
            var lblDims = { off: self._getOffset(lbl), pos: lbl.position(), height: lbl.outerHeight, width: lbl.outerWidth() };
            if (divDims.height > docDims.height) {
                div.css({ height: docDims.height + 'px' });
                divDims.height = docDims.height;
            }
            if (divDims.off.top + divDims.height > docDims.height)
                divDims.pos.top -= (divDims.off.top + divDims.height - docDims.height);
            div.css({ top: divDims.pos.top + 'px' });

            // We have to treat the width and height separately as we will be repositioning after a scrollbar disappears potentially.
            divDims = { off: div.offset(), pos: div.position(), height: div.outerHeight(), width: div.outerWidth() };
            docDims = { pos: $(document.documentElement).position(), height: document.documentElement.clientHeight, width: $(document).outerWidth() };
            if (divDims.off.left + divDims.width > docDims.width) {
                divDims.pos.left -= (divDims.off.left + divDims.width - docDims.width);
                div.css({ left: divDims.pos.left });
            }
        },
        _getColumn: function (nCol) {
            var self = this, o = self.options, el = self.element;
            return o.columns[nCol];
        },
        _getItem: function (value) {
            var self = this, o = self.options, el = self.element;
            if (typeof value === 'undefined' || value === null) return;
            var bind = self._getColumn(o.bindColumn);
            for (var i = 0; i < o.items.length; i++) {
                var itm = o.items[i];
                var val = typeof itm !== 'undefined' && typeof itm[bind.binding] !== 'undefined' ? itm[bind.binding] : '';
                if (value.toString() === val.toString()) return itm;
            }
        },
        itemList: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val === 'undefined') return o.items;
            else {
                var cv = self.val();
                o.items = val;
                self.val(cv);
            }
        },
        disabled: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val === 'undefined')
                return el.hasClass('disabled');
            else {
                if (val) {
                    el.addClass('disabled');
                    el.find('div.fld-btn-right').addClass('disabled');
                }
                else {
                    el.removeClass('disabled');
                    el.find('div.fld-btn-right').removeClass('disabled');
                }
            }
        },
        text: function (text) {
            var self = this, o = self.options, el = self.element;
            if (typeof text !== 'undefined') {
                if (o.canEdit)
                    el.find('input.picPickList-value').val(text);
                else
                    el.find('div.picPickList-value').html(text);
            }
            else
                return o.canEdit ? el.find('input.picPickList-value').val : el.find('div.picPickList-value').text();
        },
        required: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val === 'undefined') return makeBool(el.attr('data-required'));
            else el.attr('data-required', makeBool(val));
        },
        isEmpty: function () {
            var self = this, o = self.options, el = self.element;
            return o.value === null || typeof o.value === 'undefined';
        },
        val: function (val) {
            var self = this, o = self.options, el = self.element;
            var itm, oldItem;
            if (o.canEdit) {
                var fld = el.find('input.picPickList-value:first');
                if (typeof val !== 'undefined') {
                    if (el.attr('data-datatype') === 'int' && typeof val === 'string') {
                        var match = val.match(/(\d+)/g);
                        if (match) {
                            val = parseInt(match.join(''), 10);
                        }
                    }
                    //console.log({ m: 'Setting Val', oldVal: o.value, newVal: val });
                    evt = $.Event('changed');
                    evt.oldVal = o.value;
                    evt.newVal = val;
                    itm = self._getItem(evt.newVal);
                    o.value = evt.newVal;
                    if (evt.oldVal !== evt.newVal) {
                        fld.val(val);
                        // Trigger a selection changed.
                        oldItem = typeof o.value !== 'undefined' ? self._getItem(o.value) : undefined;
                        evt.oldItem = oldItem;
                        evt.newItem = itm;
                        el.trigger(evt);
                    }
                }
                else return fld.val();
            }
            else {
                if (typeof val !== 'undefined') {
                    itm = self._getItem(val);
                    var colVal = self._getColumn(o.bindColumn);
                    if (typeof itm !== 'undefined') {
                        if (itm[colVal.binding] !== o.value) {
                            var colText = self._getColumn(o.displayColumn);
                            // Trigger a selection changed.
                            oldItem = typeof o.value !== 'undefined' ? self._getItem(o.value) : undefined;
                            var evt = $.Event('beforeselchange');
                            evt.oldItem = oldItem;
                            evt.newItem = itm;
                            el.trigger(evt);
                            if (!evt.isDefaultPrevented()) {
                                o.value = itm[colVal.binding];
                                self.text(itm[colText.binding]);
                                evt = $.Event('selchanged');
                                evt.oldItem = oldItem;
                                evt.newItem = itm;
                                el.trigger(evt);
                            }
                        }
                    }
                    else {
                        self.text('');
                        o.value = null;
                    }
                }
                else {
                    //if (typeof o.value === 'undefined') console.log(o);
                    return o.value;
                }
            }
        }
    });
    $.widget("pic.inputField", {
        options: {
            inputAttrs: {},
            labelAttrs: {}
        },
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._initField();
        },
        _initField: function () {
            var self = this, o = self.options, el = self.element;
            //el[0].val = function (val) { return self.val(val); };
            if (o.bind) el.attr('data-bind', o.bind);
            if (typeof o.id !== 'undefined') el.attr('id', o.id);
            el.addClass('picInputField');
            $('<label></label>').appendTo(el).text(o.labelText);
            if (o.multiLine) {
                el.addClass('multiline');
                $('<textarea class="picInputField-value"></textarea>').addClass('fld-value').appendTo(el);
            }
            else
                $('<input type="text" class="picInputField-value"></input>').addClass('fld-value').appendTo(el);

            self.val(o.value);
            el.attr('data-bind', o.binding);
            el.attr('data-datatype', o.dataType);
            el.attr('data-fmtmask', o.fmtMask);
            el.attr('data-emptyMask', o.emptyMask);
            self._applyStyles();
            el[0].label = function () { return el.find('label:first'); };
            el[0].field = function () { return el.find('.picInputField-value:first'); };
            el[0].text = function (text) { return self.text(text); };
            el[0].val = function (val) { return self.val(val); };
            el[0].disabled = function (val) { return self.disabled(val); };
            el[0].isEmpty = function () { return self.isEmpty(); };
            el[0].required = function (val) { return self.required(val); };
            if (o.required === true) self.required(true);
            el.on('change', '.picInputField-value', function (evt) { self.formatField(); });
            if (typeof o.value !== 'undefined') self.val(o.value);
        },
        _applyStyles: function () {
            var self = this, o = self.options, el = self.element;
            var fld = el.find('.picInputField-value:first');
            var lbl = el.find('label:first');
            if (typeof o.style !== 'undefined') el.css(o.style);

            for (var ia in o.inputAttrs) {
                switch (ia) {
                    case 'style':
                        if (typeof o.inputAttrs[ia] === 'object') fld.css(o.inputAttrs[ia]);
                        break;
                    case 'maxlength':
                    case 'maxLength':
                        //if (typeof o.inputStyle.width === 'undefined')
                        fld.css({ width: parseInt(o.inputAttrs[ia], 10) * .55 + 'rem' });
                        fld.attr('maxlength', o.inputAttrs[ia]);
                        break;
                    default:
                        if (ia.startsWith('data')) fld.attr(ia, o.inputAttrs[ia]);
                        break;
                }
            }
            for (var la in o.labelAttrs) {
                switch (la) {
                    case 'style':
                        if (typeof o.labelAttrs[la] === 'object') lbl.css(o.labelAttrs[la]);
                        break;
                    default:
                        lbl.attr(la, o.labelAttrs[la]);
                        break;
                }
            }
            //console.log(o);
            //if (typeof o.inputStyle !== 'undefined') fld.css(o.inputStyle);
            //if (typeof o.labelStyle !== 'undefined') lbl.css(o.labelStyle);
        },
        required: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val === 'undefined') return makeBool(el.attr('data-required'));
            else el.attr('data-required', makeBool(val));
        },
        isEmpty: function () {
            var self = this, o = self.options, el = self.element;
            var val = self.val();
            return typeof val === 'undefined' || val.toString() === '';
        },
        formatField: function () {
            var self = this, o = self.options, el = self.element;
            var dataType = el.attr('data-datatype') || 'string';
            if (dataType !== 'string') {
                var v = self.val();
                self.val(v);
            }
        },
        val: function (val) {
            var self = this, o = self.options, el = self.element;
            //if (typeof val === 'undefined') console.log({ msg: 'Getting field value', val: el.find('input.picInputField-value:first').val(val) });
            var dataType = el.attr('data-datatype') || 'string';
            var fld = el.find('.picInputField-value:first');
            if (typeof val === 'undefined')
                return dataBinder.parseValue(fld.val(), dataType);
            else
                fld.val(dataBinder.formatValue(val, dataType, el.attr('data-fmtmask'), el.attr('data-emptymask')));
        },

        //val: function (val) {
        //    var self = this, o = self.options, el = self.element;
        //    //if (typeof val === 'undefined') console.log({ msg: 'Getting field value', val: el.find('input.picInputField-value:first').val(val) });
        //    if (el.attr('data-datatype') === 'int' && typeof val === 'undefined') {
        //        var v = el.find('.picInputField-value:first').val();
        //        var match = v.match(/(\d+)/g);
        //        return (match) ? parseInt(match.join(''), 10) : undefined;
        //    }
        //    return typeof val !== 'undefined' ? el.find('.picInputField-value:first').val(val) : el.find('.picInputField-value:first').val();
        //},
        disabled: function (val) {
            var self = this, o = self.options, el = self.element;
            var fld = el.find('.picInputField-value:first');
            if (typeof val === 'undefined') return el.hasClass('disabled');
            else {
                if (val) {
                    el.addClass('disabled');
                    fld.prop('disabled', true);
                    fld.attr('disabled', true);
                }
                else {
                    el.remove('disabled');
                    fld.prop('disabled', false);
                    fld.removeAttr('disabled');
                }
            }
        }
    });
    $.widget("pic.staticField", {
        options: {
            inputAttrs: {},
            labelAttrs: {}
        },
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._initField();
        },
        _initField: function () {
            var self = this, o = self.options, el = self.element;
            if (o.bind) el.attr('data-bind', o.bind);
            if (typeof o.id !== 'undefined') el.attr('id', o.id);
            el.addClass('picStaticField');
            $('<label></label>').appendTo(el).text(o.labelText);
            if (o.multiLine) {
                el.addClass('multiline');
                $('<div class="picStaticField-value"></div>').addClass('static-fld-value').appendTo(el);
            }
            else
                $('<span type="text" class="picStaticField-value"></span>').addClass('static-fld-value').appendTo(el);
            self.val(o.value);
            el.attr('data-bind', o.binding);
            el.attr('data-datatype', o.dataType);
            el.attr('data-fmtMask', o.fmtMask);
            el.attr('data-emptyMask', o.emptyMask);
            $('<span class="picStatic-units picUnits"></span>').attr('data-bind', o.unitsBinding).appendTo(el);
            if (typeof o.units !== 'undefined') el.find('span.picStatic-units').html(o.units);

            self._applyStyles();
            el[0].label = function () { return el.find('label:first'); };
            el[0].field = function () { return el.find('.picStaticField-value:first'); };
            el[0].text = function (text) { return self.text(text); };
            el[0].val = function (val) { return self.val(val); };
            el[0].isEmpty = function () { return self.isEmpty(); };
        },
        _applyStyles: function () {
            var self = this, o = self.options, el = self.element;
            var fld = el.find('.picStaticField-value:first');
            var lbl = el.find('label:first');
            if (typeof o.style !== 'undefined') el.css(o.style);

            for (var ia in o.inputAttrs) {
                switch (ia) {
                    case 'style':
                        if (typeof o.inputAttrs[ia] === 'object') {
                            //console.log({ style: o.inputAttrs[ia], fld: fld });
                            fld.css(o.inputAttrs[ia]);
                        }
                        break;
                    case 'maxlength':
                    case 'maxLength':
                        //if (typeof o.inputStyle.width === 'undefined')
                        fld.css({ width: parseInt(o.inputAttrs[ia], 10) * .55 + 'rem' });
                        fld.attr('maxlength', o.inputAttrs[ia]);
                        break;
                    default:
                        if (ia.startsWith('data')) fld.attr(ia, o.inputAttrs[ia]);
                        break;
                }
            }
            for (var la in o.labelAttrs) {
                switch (la) {
                    case 'style':
                        if (typeof o.labelAttrs[la] === 'object') lbl.css(o.labelAttrs[la]);
                        break;
                    default:
                        lbl.attr(la, o.labelAttrs[la]);
                        break;
                }
            }
        },
        isEmpty: function () {
            var self = this, o = self.options, el = self.element;
            var val = self.val();
            return typeof val === 'undefined' || val.toString() === '';
        },
        val: function (val) {
            var self = this, o = self.options, el = self.element;
            var dataType = el.attr('data-datatype') || 'string';
            var fld = el.find('.picStaticField-value:first')
            if (typeof val === 'undefined')
                return dataBinder.parseValue(fld.html(), dataType);
            else
                fld.html(dataBinder.formatValue(val, dataType, el.attr('data-fmtmask'), el.attr('data-emptymask')));

            ////if (typeof val === 'undefined') console.log({ msg: 'Getting field value', val: el.find('input.picStaticField-value:first').val(val) });
            //if (el.attr('data-datatype') === 'int' && typeof val === 'undefined') {
            //    var v = el.find('.picStaticField-value:first').html();
            //    var match = v.match(/(\d+)/g);
            //    return (match) ? parseInt(match.join(''), 10) : undefined;
            //}
            //return typeof val !== 'undefined' ? el.find('.picStaticField-value:first').html(val) : el.find('.picStaticField-value:first').html();
        },
        disabled: function (val) {
            var self = this, o = self.options, el = self.element;
            var fld = el.find('.picStaticField-value:first');
            if (typeof val === 'undefined') return el.hasClass('disabled');
            else {
                if (val) {
                    el.addClass('disabled');
                    fld.prop('disabled', true);
                    fld.attr('disabled', true);
                }
                else {
                    el.remove('disabled');
                    fld.prop('disabled', false);
                    fld.removeAttr('disabled');
                }
            }
        }
    });
    $.widget("pic.dateField", {
        options: {
            inputAttrs: {},
            labelAttrs: {}
        },
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._initDateField();
        },
        _initDateField: function () {
            var self = this, o = self.options, el = self.element;
            if (o.bind) el.attr('data-bind', o.bind);
            if (typeof o.id !== 'undefined') el.attr('id', o.id);
            $('<label class="picPickList-label"></label>').appendTo(el).text(o.labelText);
            if (o.canEdit)
                $('<div class="picPickList-value"><input type="text" class="picPickList-value"></input><div>').addClass('editable').appendTo(el);
            else
                $('<div class="picPickList-value"></div>').appendTo(el);
            $('<input class="datepicker-hidden" type="text" style="display:none;"></input>').appendTo(el).datepicker();

            $('<div class="picPickList-drop"><i class="fas fa-calendar-day"></i></div>').appendTo(el);
            el.attr('data-bind', o.binding);
            el[0].label = function () { return el.find('label.picPickList-label:first'); };
            el[0].field = function () { return el.find('div.picPickList-value:first'); };
            el[0].text = function (text) { return self.text(text); };
            el[0].val = function (val) { return self.val(val); };
            el[0].disabled = function (val) { return self.disabled(val); };
            el[0].isEmpty = function () { return self.isEmpty(); };
            el[0].required = function (val) { return self.required(val); };
            el.attr('data-val', o.value);
            if (o.required === true) self.required(true);
            el.attr('data-datatype', o.dataType);
            self._applyStyles();
            el.find('div.picPickList-drop').on('click', function (evt) {
                el.find('input.datepicker-hidden').datepicker('show');
            });
            el.on('change', 'input.datepicker-hidden', function (evt) {
                var val = el.find('input.datepicker-hidden:first').val();
                self.val(el.find('input.datepicker-hidden:first').val());
            });
            el.on('change', 'input.picPickList-value', function (evt) {
                el.find('input.picPickList-value:first').val(self.val());
            });
        },
        _applyStyles: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('picPickList');
            var fld = el.find('div.picPickList-value:first');
            var lbl = el.find('label.picPickList-label:first');
            if (typeof o.style !== 'undefined') el.css(o.style);

            for (var ia in o.inputAttrs) {
                switch (ia) {
                    case 'style':
                        if (typeof o.inputAttrs[ia] === 'object') fld.css(o.inputAttrs[ia]);
                        break;
                    case 'maxlength':
                    case 'maxLength':
                        //if (typeof o.inputStyle.width === 'undefined')
                        fld.css({ width: parseInt(o.inputAttrs[ia], 10) * .7 + 'rem' });
                        if (o.canEdit) fld.attr('maxlength', o.inputAttrs[ia]);
                        break;
                    default:
                        if (ia.startsWith('data')) lbl.attr(ia, o.inputAttrs[ia]);
                        break;
                }
            }
            for (var la in o.labelAttrs) {
                switch (la) {
                    case 'style':
                        if (typeof o.labelAttrs[la] === 'object') lbl.css(o.labelAttrs[la]);
                        break;
                    default:
                        lbl.attr(la, o.labelAttrs[la]);
                        break;
                }

            }
        },
        disabled: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val === 'undefined')
                return el.hasClass('disabled');
            else {
                if (val) el.addClass('disabled');
                else el.removeClass('disabled');
            }
        },
        text: function (text) {
            var self = this, o = self.options, el = self.element;
            if (typeof text !== 'undefined') {
                if (o.canEdit)
                    el.find('input.picPickList-value').val(text);
                else
                    el.find('div.picPickList-value').html(text);
            }
            else
                return o.canEdit ? el.find('input.picPickList-value').val : el.find('div.picPickList-value').text();
        },
        required: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val === 'undefined') return makeBool(el.attr('data-required'));
            else el.attr('data-required', makeBool(val));
        },
        isEmpty: function () {
            var self = this, o = self.options, el = self.element;
            var val = (o.canEdit) ? el.find('input.picPickList-value:first').val() : el.find('div.picPickList-value:first').text();;
            return val === null || typeof val === 'undefined';
        },
        val: function (val) {
            var self = this, o = self.options, el = self.element;
            var fld;
            if (o.canEdit) {
                fld = el.find('input.picPickList-value:first');
                if (typeof val !== 'undefined') {
                    if (typeof val.parseISO === 'function') {
                        fld.val(val.format('MM/dd/yyy'));
                    }
                    else if (typeof val === 'string') {
                        var dt;
                        if (val.indexOf('T') !== -1)
                            dt = Date.parseISO(val);
                        else
                            dt = new Date(Date.parse(val));
                        fld.val(dt.format('MM/dd/yyyy', ''));
                    }
                    else fld.val(val);
                    el.find('input.datepicker-hidden:first').val(fld.val());
                }
                else return fld.val();
            }
            else {
                fld = el.find('div.picPickList-value:first');
                if (typeof val !== 'undefined') {
                    if (typeof val.parseISO === 'function') {
                        fld.text(val.format('MM/dd/yyy'));
                    }
                    else if (typeof val === 'string') {
                        var d = Date.parseISO(val);
                        fld.text(d.format('MM/dd/yyyy', ''));
                    }
                    else fld.text(val);
                    el.find('input.datepicker-hidden:first').val(fld.text());
                }
                else {
                    //if (typeof o.value === 'undefined') console.log(o);
                    return fld.text();
                }
            }
        }
    });
    $.widget("pic.checkbox", {
        options: {
            inputStyle: {},
            labelStyle: {},
            inputAttrs: {},
            labelAttrs: {},
            isChecked: false
        },
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._initCheckbox();
        },
        _initCheckbox: function () {
            var self = this, o = self.options, el = self.element;
            //el[0].val = function (val) { return self.val(val); };
            if (o.bind) el.attr('data-bind', o.bind);
            o.cbId = 'cb_' + _uniqueId++;
            el.addClass('picCheckbox');
            if (typeof o.id !== 'undefined') el.attr('id', o.id);
            $('<input type="checkbox" class="picCheckbox-value"></input>').appendTo(el).attr('id', o.cbId).on('change', function (evt) {
                evt = $.Event('changed');
                evt.newVal = el.find('input[type="checkbox"]').is(':checked');
                evt.oldVal = !evt.newVal;
                o.isChecked = evt.newVal;
                el.trigger(evt);
            });
            $('<label></label>').attr('for', o.cbId).appendTo(el).html(o.labelText);
            self.val(o.value);
            el.attr('data-bind', o.binding);
            self._applyStyles();
            el[0].label = function () { return el.find('label:first'); };
            el[0].checkbox = function () { return el.find('input.picCheckbox-value:first'); };
            el[0].text = function (text) { return self.html(text); };
            el[0].val = function (val) { return self.val(val); };
        },
        _applyStyles: function () {
            var self = this, o = self.options, el = self.element;
            var fld = el.find('input.picCheckbox-value:first');
            var lbl = el.find('label:first');
            if (typeof o.style !== 'undefined') el.css(o.style);

            for (var la in o.labelAttrs) {
                switch (la) {
                    case 'style':
                        if (typeof o.labelAttrs[la] === 'object') lbl.css(o.labelAttrs[la]);
                        break;
                    default:
                        lbl.attr(la, o.labelAttrs[la]);
                        break;
                }
            }
            if (typeof o.inputStyle !== 'undefined') fld.css(o.inputStyle);
            if (typeof o.labelStyle !== 'undefined') lbl.css(o.labelStyle);
        },
        val: function (val) {
            var self = this, o = self.options, el = self.element;
            var cb = el.find('input.picCheckbox-value:first');
            if (typeof val !== 'undefined') {
                o.isChecked = cb.is(':checked');
                if (makeBool(val) !== o.isChecked) {
                    cb.prop('checked', makeBool(val));
                    evt = $.Event('changed');
                    evt.oldVal = o.isChecked;
                    o.isChecked = makeBool(val);
                    evt.newVal = o.isChecked;
                    el.trigger(evt);
                }
            }
            else return cb.is(':checked');
        }
    });
    $.widget("pic.accordian", {
        options: {
            columns: []
        },
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._initAccordian();
        },
        _initAccordian: function () {
            var self = this, o = self.options, el = self.element;
            //el[0].val = function (val) { return self.val(val); };
            if (o.bind) el.attr('data-bind', o.bind);
            el.addClass('picAccordian');
            var title = self._buildTitle().appendTo(el);
            var contents = $('<div class="picAccordian-contents"></div>').appendTo(el);
            el[0].titleBlock = function () { return el.find('div.picAccordian-title:first'); };
            el[0].text = function (text) { return self.text(text); };
            el[0].expanded = function (val) { return self.expanded(val); };
            el[0].columns = function () { return self.columns(); };
            el.on('click', 'div.picAccordian-title', function () {
                self.toggle();
            });
            el.attr('data-expanded', false);
            contents.hide();
            self.expanded(makeBool(o.expanded));
        },
        columns: function () {
            var self = this, o = self.options, el = self.element;
            var arr = [];
            el.find('div.picAccordian-title:first > div.picAccordian-titlecol').each(function () {
                arr.push({
                    el: $(this),
                    elText: function () { return this.el.find('span.picAccordian-title-text'); },
                    elGlyph: function () { return this.el.find('i:first'); }
                });
            });
            return arr;
        },
        _buildTitle: function () {
            var self = this, o = self.options, el = self.element;
            var title = $('<div class="picAccordian-title header-background"></div>');
            for (var i = 0; i < o.columns.length; i++) {
                var div = $('<div class="picAccordian-titlecol"></div>').appendTo(title);
                var col = o.columns[i];
                div.attr('col-binding', col.binding);
                var icon = $('<i></i>').appendTo(div);
                if (col.glyph) icon.addClass(col.glyph);
                var text = $('<span class="picAccordian-title-text"></span>').appendTo(div);
                div.css(col.style);
                text.html(col.text);
            }
            $('<i class="picAccordian-title-expand fas fa-angle-double-right"></i>').appendTo(title);
            return title;
        },

        toggle: function () {
            var self = this, o = self.options, el = self.element;
            var exp = makeBool(el.attr('data-expanded'));
            self.expanded(!exp);
        },
        expanded: function (val) {
            var self = this, o = self.options, el = self.element;
            var exp = makeBool(el.attr('data-expanded'));
            if (typeof val !== 'undefined') {
                if (exp !== val) {
                    var ico = el.find('i.picAccordian-title-expand:first');
                    el.attr('data-expanded', val);
                    if (val) {
                        el.find('div.picAccordian-contents:first').slideDown(250);
                        ico.removeClass('fa-angle-double-right');
                        ico.addClass('fa-angle-double-down');
                    }
                    else {
                        el.find('div.picAccordian-contents:first').slideUp(250);
                        ico.removeClass('fa-angle-double-down');
                        ico.addClass('fa-angle-double-right');
                    }
                }
            }
            else return exp;
        }
    });
    $.widget("pic.colorPicker", {
        options: { labelText: '', binding: '' },
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._initColorPicker();
        },
        _initColorPicker: function () {
            var self = this, o = self.options, el = self.element;
            $('<label class="picColorPicker-label"></label>').text(o.labelText).appendTo(el);
            $('<div class="picColorPicker-value picCSColor"></div>').appendTo(el);
            el.attr('data-datatype', 'int');
            el[0].val = function (val) { return self.val(val); };
            el[0].isEmpty = function (val) { return self.isEmpty(); };
            el[0].required = function (val) { return self.required(val); };
            el[0].label = function () { return el.find('label.picColorPicker.label:first'); };
            if (o.required === true) self.required(true);
            if (o.binding) el.attr('data-bind', o.binding);
            el.on('click', function (evt) { self._showPopover(); });
            self.val(o.value);
            self._applyStyles();
        },
        _showPopover: function () {
            var self = this, o = self.options, el = self.element;
            var divVal = el.find('div.picColorPicker-value:first');
            var divPopover = $('<div class="picCSColors"></div>');
            divPopover.appendTo(el.parent());
            divPopover.on('initPopover', function (evt) {
                let curr = el.find('div.picColorPicker-value:first').attr('data-color');
                let divColors = $('<div class= "picLightColors" data-bind="color"></div>').appendTo(evt.currentTarget);
                for (let i = 0; i < o.colors.length; i++) {
                    let color = o.colors[i];
                    let div = $('<div class="picCSColor picCSColorSelector" data-color="' + color.name + '"><div class="picToggleButton"></div><label class="picCSColorLabel"></label></div>');
                    div.appendTo(divColors);
                    div.attr('data-val', color.val);
                    div.attr('data-name', color.name);
                    div.find('label.picCSColorLabel').text(color.desc);
                    div.find('div.picToggleButton').toggleButton();
                    div.find('div.picToggleButton > div.picIndicator').attr('data-status', curr === color.name ? 'on' : 'off');
                    div.on('click', function (e) {
                        // Select the option and close
                        divVal.attr('data-color', $(e.currentTarget).attr('data-color'));
                        divVal.attr('data-val', $(e.currentTarget).attr('data-val'));
                        divPopover[0].close();
                        e.preventDefault();
                        e.stopPropagation();
                    });
                }
                evt.preventDefault();
                evt.stopImmediatePropagation();

            });
            divPopover.popover({ title: 'Select a Color', popoverStyle: 'modal', placement: { target: el } });
            divPopover[0].show(el);

        },
        _applyStyles: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('picColorPicker');
            var fld = el.find('div.picColorPicker-value:first');
            var lbl = el.find('label.picColorPicker-label:first');
            if (typeof o.style !== 'undefined') el.css(o.style);

            for (var ia in o.inputAttrs) {
                switch (ia) {
                    case 'style':
                        if (typeof o.inputAttrs[ia] === 'object') fld.css(o.inputAttrs[ia]);
                        break;
                    case 'maxlength':
                    case 'maxLength':
                        //if (typeof o.inputStyle.width === 'undefined')
                        fld.css({ width: parseInt(o.inputAttrs[ia], 10) * .7 + 'rem' });
                        break;
                    default:
                        if (ia.startsWith('data')) lbl.attr(ia, o.inputAttrs[ia]);
                        break;
                }
            }
            for (var la in o.labelAttrs) {
                switch (la) {
                    case 'style':
                        if (typeof o.labelAttrs[la] === 'object') lbl.css(o.labelAttrs[la]);
                        break;
                    default:
                        lbl.attr(la, o.labelAttrs[la]);
                        break;
                }

            }
        },
        _getColor: function (val) {
            var self = this, o = self.options, el = self.element;
            return o.colors.find(elem => elem.val === val);
        },
        required: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val === 'undefined') return makeBool(el.attr('data-required'));
            else el.attr('data-required', makeBool(val));
        },
        isEmpty: function () {
            var self = this, o = self.options, el = self.element;
            return self.val() === 'undefined';
        },
        val: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val !== 'undefined') {
                var color = self._getColor(val);
                el.find('div.picColorPicker-value:first').attr('data-color', typeof color !== 'undefined' ? color.name : 'white').attr('data-val', val);
            }
            else {
                return el.find('div.picColorPicker-value:first').attr('data-val');
            }
        }
    });
    $.widget("pic.crudList", {
        options: {
            caption: '',
            itemName: 'Item',
            columns: [],
            actions: { canCreate: false, canEdit: false, canRemove: false, canClear: false }
        },
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._initList();
            el[0].addRow = function (data) { return self.addRow(data); };
            el[0].saveRow = function (data) { return self.saveRow(data); };
            el[0].clear = function () { self.clear(); };
            el[0].actions = function (val) { return self.actions(val); };
        },
        _getColumn: function (nCol) { return this.options.columns[nCol]; },
        _createCaption: function () {
            var self = this, o = self.options, el = self.element;
            var caption = $('<div></div>').addClass('crud-caption').html(o.caption);
            $('<span></span>').appendTo(caption).addClass('header-icon-btn').addClass('btn-add').append($('<i class="fas fa-plus"></i>')).attr('title', 'Add a new ' + o.itemName)
                .on('click', function (e) {
                    e.stopPropagation();
                    var evt = $.Event('additem');
                    el.trigger(evt);
                });
            $('<span></span>').appendTo(caption).addClass('header-icon-btn').addClass('btn-clear').append($('<i class="fas fa-broom"></i>')).attr('title', 'Clear all ' + o.itemName)
                .on('click', function (e) {
                    e.stopPropagation();
                    var evt = $.Event('clearitems');
                    el.trigger(evt);
                });
            return caption;
        },
        _createHeader: function () {
            var self = this, o = self.options, el = self.element;
            var header = $('<div></div>').addClass('crud-header');
            var tbody = $('<tbody></tbody>').appendTo($('<table></table>').appendTo(header));
            var row = $('<tr></tr>').appendTo(tbody).addClass('crud-header');
            var btn = $('<td></td>').appendTo(row).addClass('crud-button').addClass('btn-edit'); // This is the buttons column.
            $('<span></span>').appendTo(btn).addClass('crud-row-btn');
            for (var i = 0; i < o.columns.length; i++) {
                var col = self._getColumn(i);
                var td = $('<td></td>').appendTo(row);
                var span = $('<span class="crud-header-text"></span>').appendTo(td).text(col.text);
                if (typeof col.style !== 'undefined') span.css(col.style);
                if (typeof col.headStyle !== 'undefined') div.css(col.headStyle);

                if (col.hidden) td.hide();
            }
            btn = $('<td></td>').appendTo(row).addClass('crud-button').addClass('btn-remove'); // This is the buttons column.
            $('<span></span>').appendTo(btn).addClass('crud-row-btn');
            return header;
        },
        _createBody: function () {
            var self = this, o = self.options, el = self.element;
            var body = $('<div></div>').addClass('crud-body');
            var tbody = $('<tbody></tbody>').appendTo($('<table></table>').appendTo(body).addClass('crud-table'));
            tbody.on('click', 'span.crud-row-btn.btn-edit', function (e) {
                var evt = $.Event('edititem');
                var row = $(e.currentTarget).parents('tr:first');
                evt.dataKey = row.data('key');
                evt.dataRow = row;
                el.trigger(evt);
            });
            tbody.on('click', 'span.crud-row-btn.btn-remove', function (e) {
                var evt = $.Event('removeitem');
                var row = $(e.currentTarget).parents('tr:first');
                evt.dataKey = row.data('key');
                evt.dataRow = row;
                el.trigger(evt);
            });
            return body;
        },
        _createActionButton: function (icon, title, cssClass) {
            var self = this, o = self.options, el = self.element;
            var span = $('<span></span>').addClass('crud-row-btn').addClass(cssClass).attr('title', title);
            $('<i></i>').appendTo(span).addClass(icon);
            return span;
        },
        addRow: function (data) {
            var self = this, o = self.options, el = self.element;
            var tbl = el.find('table.crud-table:first');
            var tbody = tbl.find('tbody:first');
            var row = $('<tr></tr>').appendTo(tbody);
            var btn = $('<td></td>').addClass('btn-edit').appendTo(row);
            self._createActionButton('fas fa-edit', 'Edit ' + o.itemName).addClass('btn-edit').appendTo(btn);
            for (var i = 0; i < o.columns.length; i++) {
                var col = o.columns[i];
                var td = $('<td></td>').appendTo(row);
                var div = $('<div></div>').appendTo(td).attr('data-bind', col.binding).attr('data-fmttype', col.fmtType).attr('data-fmtMask', col.fmtMask);
                if (typeof col.style !== 'undefined') div.css(col.style);
                if (typeof col.cellStyle !== 'undefined') td.css(col.cellStyle);
            }
            btn = $('<td></td>').addClass('btn-remove').appendTo(row);
            // Add in the buttons.
            self.dataBindRow(row, data);
            self._createActionButton('fas fa-trash', 'Remove ' + o.itemName).addClass('btn-remove').appendTo(btn);
            return row;
        },
        saveRow: function (data) {
            var self = this, o = self.options, el = self.element;
            if (typeof o.key !== 'undefined') {
                // See if the key exists.
                var key = data[o.key];
                var row;
                el.find('table.crud-table:first > tbody > row').each(function () {
                    if (key === $(this).data('key')) {
                        row = $(this);
                        dataBinder.bind(row, data);
                        return false;
                    }
                });
                return (typeof row === 'undefined') ? addRow(data) : row;
            }
            else
                self.addRow(data);
        },
        clear: function () {
            var self = this, o = self.options, el = self.element;
            el.find('table.crud-table:first > tbody > tr').remove();
        },
        dataBindRow: function (row, data) {
            var self = this, o = self.options, el = self.element;
            if (typeof o.key !== 'undefined') row.data('key', data[o.key]);
            dataBinder.bind(row, data);
        },
        _initList: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('crud-list');
            var caption = self._createCaption().appendTo(el);
            var header = self._createHeader().appendTo(el);
            var body = self._createBody().appendTo(el);
            if (typeof o.id !== 'undefined') el.attr('id', o.id);
            el.on('span.crud-row-btn.btn-edit', function (evt) {
                console.log('Edit clicked');
            });
            el.on('span.crud-row-btn.btn-remove', function (evt) {
                console.log('Remove clicked');
            });
            self.actions(o.actions);
        },
        actions: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val === 'undefined') {
                return o.actions = {
                    canCreate: makeBool(el.attr('data-cancreate')),
                    canEdit: makeBool(el.attr('data-canedit')),
                    canRemove: makeBool(el.attr('data-canremove')),
                    canClear: makeBool(el.attr('data-canclear'))
                }
            }
            else {
                var acts = typeof o.actions !== 'undefined' ? o.actions : o.actions = {}
                for (var prop in val) {
                    var name = prop.toLowerCase();
                    switch (name) {
                        case 'cancreate':
                            acts.canCreate = makeBool(val[prop]);
                            el.attr(`data-${name}`, makeBool(val[prop]));
                            break;
                        case 'canedit':
                            acts.canUpdate = makeBool(val[prop]);
                            el.attr(`data-${name}`, makeBool(val[prop]));
                            break;
                        case 'canremove':
                            acts.canRemove = makeBool(val[prop]);
                            el.attr(`data-${name}`, makeBool(val[prop]));
                            break;
                        case 'canclear':
                            acts.canClear = makeBool(val[prop]);
                            el.attr(`data-${name}`, makeBool(val[prop]));
                    }
                }
            }

        }

    });
    $.widget("pic.selectList", {
        options: {
            caption: '',
            itemName: 'Item',
            columns: [],
            actions: { canCreate: false, canEdit: false, canRemove: false, canClear: false }
        },
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._initList();
            el[0].addRow = function (data) { return self.addRow(data); };
            el[0].saveRow = function (data) { return self.saveRow(data); };
            el[0].clear = function () { self.clear(); }
            el[0].actions = function (val) { return self.actions(val); };
            el[0].val = function (val) { return self.val(val); };
        },
        _getColumn: function (nCol) { return this.options.columns[nCol]; },
        _createCaption: function () {
            var self = this, o = self.options, el = self.element;
            var caption = $('<div></div>').addClass('slist-caption').text(o.caption);
            $('<span></span>').appendTo(caption).addClass('header-icon-btn').addClass('btn-add').append($('<i class="fas fa-plus"></i>')).attr('title', 'Add a new ' + o.itemName)
                .on('click', function (e) {
                    e.stopPropagation();
                    var evt = $.Event('additem');
                    el.trigger(evt);
                });
            return caption;
        },
        _createHeader: function () {
            var self = this, o = self.options, el = self.element;
            var header = $('<div></div>').addClass('slist-header');
            var tbody = $('<tbody></tbody>').appendTo($('<table></table>').appendTo(header));
            var row = $('<tr></tr>').appendTo(tbody).addClass('slist-header');
            //var btn = $('<td></td>').appendTo(row).addClass('slist-button'); // This is the buttons column.
            //$('<span></span>').appendTo(btn).addClass('slist-row-btn');
            for (var i = 0; i < o.columns.length; i++) {
                var col = self._getColumn(i);
                var td = $('<td></td>').appendTo(row);
                var span = $('<span class="slist-header-text"></span>').appendTo(td).text(col.text);
                if (typeof col.style !== 'undefined') span.css(col.style);
                if (typeof col.headStyle !== 'undefined') div.css(col.headStyle);

                if (col.hidden) td.hide();
            }
            //btn = $('<td></td>').appendTo(row).addClass('slist-button'); // This is the buttons column.
            //$('<span></span>').appendTo(btn).addClass('slist-row-btn');
            return header;
        },
        _createBody: function () {
            var self = this, o = self.options, el = self.element;
            var body = $('<div></div>').addClass('slist-body');
            var tbody = $('<tbody></tbody>').appendTo($('<table></table>').appendTo(body).addClass('slist-table'));
            tbody.on('click', 'span.slist-row-btn.btn-edit', function (e) {
                var evt = $.Event('edititem');
                var row = $(e.currentTarget).parents('tr:first');
                evt.dataKey = row.data('key');
                evt.dataRow = row;
                el.trigger(evt);
            });
            tbody.on('click', 'span.slist-row-btn.btn-remove', function (e) {
                var evt = $.Event('removeitem');
                var row = $(e.currentTarget).parents('tr:first');
                evt.dataKey = row.data('key');
                evt.dataRow = row;
                el.trigger(evt);
            });
            return body;
        },
        _createActionButton: function (icon, title, cssClass) {
            var self = this, o = self.options, el = self.element;
            var span = $('<span></span>').addClass('slist-row-btn').addClass(cssClass).attr('title', title);
            $('<i></i>').appendTo(span).addClass(icon);
            return span;
        },
        val: function (val) {
            var self = this, o = self.options, el = self.element;
            console.log(`VAL CALLED and they want their data back`);
            console.log(val);
            if (typeof val !== 'undefined') {
                self.clear();
                for (data in val) {
                    self.addRow(val[data]);
                    console.log(val[data]);
                }
            }
        },
        addRow: function (data) {
            var self = this, o = self.options, el = self.element;
            var tbl = el.find('table.slist-table:first');
            var tbody = tbl.find('tbody:first');
            var row = $('<tr></tr>').appendTo(tbody);
            //var btn = $('<td></td>').appendTo(row);
            //self._createActionButton('fas fa-edit', 'Edit ' + o.itemName).addClass('btn-edit').appendTo(btn);
            for (var i = 0; i < o.columns.length; i++) {
                var col = o.columns[i];
                var td = $('<td></td>').appendTo(row);
                var div = $('<div></div>').appendTo(td).attr('data-bind', col.binding).attr('data-fmttype', col.fmtType).attr('data-fmtMask', col.fmtMask);
                if (typeof col.style !== 'undefined') div.css(col.style);
                if (typeof col.cellStyle !== 'undefined') td.css(col.cellStyle);
            }
            //btn = $('<td></td>').appendTo(row);
            // Add in the buttons.
            self.dataBindRow(row, data);
            //self._createActionButton('fas fa-trash', 'Remove ' + o.itemName).addClass('btn-remove').appendTo(btn);
            return row;
        },
        saveRow: function (data) {
            var self = this, o = self.options, el = self.element;
            if (typeof o.key !== 'undefined') {
                // See if the key exists.
                var key = data[o.key];
                var row;
                el.find('table.slist-table:first > tbody > row').each(function () {
                    if (key === $(this).data('key')) {
                        row = $(this);
                        dataBinder.bind(row, data);
                        return false;
                    }
                });
                return (typeof row === 'undefined') ? addRow(data) : row;
            }
            else
                self.addRow(data);
        },
        actions: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val === 'undefined') {
                return o.actions = {
                    canCreate: makeBool(el.attr('data-cancreate')),
                    canEdit: makeBool(el.attr('data-canedit')),
                    canRemove: makeBool(el.attr('data-canremove')),
                    canClear: makeBool(el.attr('data-canclear'))
                }
            }
            else {
                var acts = typeof o.actions !== 'undefined' ? o.actions : o.actions = {}
                for (var prop in val) {
                    var name = prop.toLowerCase();
                    switch (name) {
                        case 'cancreate':
                            acts.canCreate = makeBool(val[prop]);
                            el.attr(`data-${name}`, makeBool(val[prop]));
                            break;
                        case 'canedit':
                            acts.canUpdate = makeBool(val[prop]);
                            el.attr(`data-${name}`, makeBool(val[prop]));
                            break;
                        case 'canremove':
                            acts.canRemove = makeBool(val[prop]);
                            el.attr(`data-${name}`, makeBool(val[prop]));
                            break;
                        case 'canclear':
                            acts.canClear = makeBool(val[prop]);
                            el.attr(`data-${name}`, makeBool(val[prop]));
                    }
                }
            }
        },
        clear: function () {
            var self = this, o = self.options, el = self.element;
            el.find('table.slist-table:first > tbody > tr').remove();
        },
        dataBindRow: function (row, data) {
            var self = this, o = self.options, el = self.element;
            if (typeof o.key !== 'undefined') row.data('key', data[o.key]);
            dataBinder.bind(row, data);
        },
        _initList: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('slist-list');
            if (typeof o.cssClass !== 'undefined') el.addClass(o.cssClass);
            var caption = self._createCaption().appendTo(el);
            var header = self._createHeader().appendTo(el);
            var body = self._createBody().appendTo(el);
            if (typeof o.id !== 'undefined') el.attr('id', o.id);
            if (typeof o.bind !== 'undefined') el.attr('data-bind', o.bind);
            el.on('click', 'table.slist-table > tbody > tr', function (evt) {
                self.selectRow($(evt.currentTarget));
            });
            self.actions(o.actions);
            if (typeof o.style !== 'undefined') el.css(o.style);
        },
        selectRow: function (row) {
            var self = this, o = self.options, el = self.element;
            el.find('table.slist-table > tbody > tr.selected').removeClass('selected');
            row.addClass('selected');
            var evt = $.Event('selected');
            evt.dataKey = row.data('key');
            el.trigger(evt);
        }

    });
    $.widget("pic.modalDialog", $.ui.dialog, {
        options: {
            screenLayer: 0
        },
        _create: function () {
            var self = this, o = self.options, el = self.element;
            console.log('modalDialog: Create');
            console.log(o);
            el[0].returnValue = function (value) { return self.returnValue(value); };
            el[0].dialogArguments = function (args) { return self.dialogArguments(args); };
            var btns = o.buttons.slice();
            o.buttons = [];
            this._super('_create');
            if (typeof btns !== 'undefined') setTimeout(function () { self._buildButtons(btns); }, 0);
            o.screenLayer = _screenLayer;
            el.css({ zIndex: _screenLayer++ });
        },
        _buildButtons: function (btns) {
            var self = this, o = self.options, el = self.element;
            if (typeof btns !== 'undefined') {
                var btnPnl = $('<div class="picBtnPanel btn-panel"></div>').appendTo(el);
                for (var i = 0; i < btns.length; i++) {
                    var btn = btns[i];
                    var b = $('<div></div>').appendTo(btnPnl).actionButton({ id: btn.id, text: btn.text, icon: btn.icon, hidden: btn.hidden });
                    if (typeof btn.click === 'function') b.on('click', btn.click);
                }
            }
        },
        _destroy: function () {
            var self = this, o = self.options, el = self.element;
            this._super('_destroy');
            el.parents('.ui-dialog:first').remove();
        },
        returnValue: function (value) {
            var self = this, o = self.options, el = self.element;
            if (typeof value === 'undefined') return o.returnValue;
            else o.returnValue = value;
        },
        dialogArguments: function (args) {
            var self = this, o = self.options, el = self.element;
            if (typeof args === 'undefined') return o.dialogArguments;
            else o.dialogArguments = value;
        },
        open: function () {
            var self = this, o = self.options, el = self.element;
            this._super('open');
            var evt = $.Event('initdialog');
            setTimeout(function () { el.trigger(evt) }, 0);
        },
        close: function (event, ui) {
            var self = this, o = self.options, el = self.element;
            _screenLayer = o.screenLayer;
            // Close all others that are greater than this one.
            this._super('_close');
            this._destroy();
        }
    });
    $.widget("pic.errorPanel", {
        options: {

        },
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._buildControls();
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('picErrorPanel');
            var line = $('<div></div>').appendTo(el);
            if (typeof o.error !== 'undefined') {
                $('<label></label>').appendTo(line).addClass('errorLabel').text('Message');
                $('<span></span>').appendTo(line).addClass('errorMessage').text(o.error.message);
                if (typeof o.error.equipmentType !== 'undefined') {
                    line = $('<div></div>').appendTo(el);
                    $('<label></label>').appendTo(line).addClass('errorLabel').text('Eq Type');
                    $('<span></span>').appendTo(line).text(o.error.equipmentType);
                }
                if (typeof o.error.id !== 'undefined') {
                    line = $('<div></div>').appendTo(el);
                    $('<label></label>').appendTo(line).addClass('errorLabel').text('Eq Id');
                    $('<span></span>').appendTo(line).text(o.error.id);
                }
                if (typeof o.error.parameter !== 'undefined') {
                    line = $('<div></div>').appendTo(el);
                    $('<label></label>').appendTo(line).addClass('errorLabel').text('Param');
                    $('<span></span>').appendTo(line).text(o.error.parameter);
                    if (typeof o.error.value !== 'undefined') {
                        $('<label></label>').appendTo(line).text(' = ');
                        $('<span></span>').appendTo(line).text(o.error.value);
                    }
                }
                if (typeof o.error.stack !== 'undefined') {
                    var acc = $('<div></div>').appendTo(el).accordian({ columns: [{ text: 'Stack Trace', glyph: 'fab fa-stack-overflow', style: { width: '10rem' } }] });
                    var pnl = acc.find('div.picAccordian-contents');
                    var div = $('<div></div>').appendTo(pnl).addClass('picStackTrace').html(o.error.stack);
                }
            }
            else {
                var msg = '';
                if (typeof o.httpCode !== 'undefined') {
                    switch (o.httpCode) {
                        case 404:
                        case '404':
                            msg = 'http: 404 - Resource not found.';
                            break;
                        case 500:
                        case '500':
                            msg = 'http 500 - Server Error';
                            break;
                        case 400:
                        case '400':
                            msg = 'http 400 - General Application Error';
                            break;
                        default:
                            msg = 'http ' + o.httpCode + ' Error';
                            break;
                    }
                    $('<label></label>').appendTo(line).addClass('errorLabel').text('Message');
                    $('<span></span>').appendTo(line).addClass('errorMessage').text(msg);
                    if (o.url) {
                        line = $('<div></div>').appendTo(el);
                        $('<label></label>').appendTo(line).addClass('errorLabel').text('Url');
                        $('<span></span>').appendTo(line).addClass('errorMessage').text(o.url);
                    }
                    if (o.data) {
                        var acc = $('<div></div>').appendTo(el).accordian({ columns: [{ text: 'Request Payload', glyph: 'fab fa-stack-overflow', style: { width: '10rem' } }] });
                        var pnl = acc.find('div.picAccordian-contents');
                        var div = $('<div></div>').appendTo(pnl).addClass('picStackTrace').html(typeof o.data === 'string' ? o.data : JSON.stringify(o.data, null, 3));
                    }

                }
            }
        }
    });
    $.widget('pic.pinHeader', {
        options: {},
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._buildControls();
            el[0].selectedPin = function (val) { self.selectedPin(val); }
            el[0].state = function (val) { self.state(val); }
            el[0].pinLabel = function (pinId, label) { return self.pinLabel(pinId, label); }
            el[0].pinActive = function (pinId, label) { return self.pinActive(pinId, label); }
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            var header = o.header;
            el.addClass('pin-header');
            el.attr('data-id', header.id);
            el.attr('data-name', header.name);
            el.addClass(header.align);
            el.css({ backgroundColor: header.bgcolor });
            $('<div></div>').appendTo(el).addClass('pin-header-name').text(header.name);
            var opins = [];
            for (var overlay in o.overlays) {
                if (o.overlays[overlay] !== true) continue;
                var ov = header.overlays.find(elem => elem.name === overlay);
                if (typeof ov !== 'undefined') opins.push(...ov.pins);
            }
            var line = $('<div></div>').appendTo(el).addClass('pin-row');
            var sex = header.sex || 'male';
            var pins = header.pins || [];
            var width = header.width || 2;
            for (var ipin = 0; ipin < pins.length; ipin++) {
                var p = pins[ipin];
                var over = opins.find(elem => p.id === elem.id);
                var pin = $.extend(true, { sex: sex, align: (ipin + 1) % width === 0 && pin !== 1 ? 'right' : 'left' }, p, over);
                if (typeof o.pins !== 'undefined') {
                    var p = o.pins.find(elem => elem.headerId === header.id && elem.id === ipin + 1);
                    if (typeof p !== 'undefined') {
                        pin.label = p.name;
                        pin.active = p.isActive;
                        pin.state = p.state;
                    }
                    else if (typeof over === 'undefined' && pin.type === 'gpio') pin.active = false;
                }
                else pin.active = false;

                $('<div></div>').appendTo(line).headerPin(pin);
                if ((ipin + 1) % width === 0 && pin.id !== 1) line = $('<div></div>').appendTo(el).addClass('pin-row');
            }
            el.on('click', 'div.header-pin[data-type=gpio]', function (evt) {
                self.selectedPin($(evt.currentTarget).attr('data-id'));
            });
        },
        selectedPin: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val === 'undefined') return o.selectedPin;
            else {
                if (o.selectedPin !== val) {
                    var pin = el.find('div.header-pin[data-id=' + val + ']');
                    el.parent().find('div.header-pin.selected').removeClass('selected');
                    pin.addClass('selected');
                    var evt = $.Event('selchanged');
                    evt.headerId = o.header.id;
                    evt.oldPinId = o.selectedPin;
                    evt.newPinId = o.selectedPin = pin.attr('data-id');
                    el.trigger(evt);
                }
            }
        },
        state: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val === 'undefined') return el.attr('data-state');
            else {
                el.attr('data-state', val);
            }
        },
        pinLabel: function (id, label) {
            var self = this, o = self.options, el = self.element;
            // Find the pin
            var lbl;
            el.find(`div.header-pin[data-id=${id}]`).each(function () {
                lbl = this.label(label);
            });
            return lbl;
        },
        pinActive: function (id, active) {
            var self = this, o = self.options, el = self.element;
            // Find the pin
            var lbl;
            el.find(`div.header-pin[data-id=${id}]`).each(function () {
                lbl = this.active(active);
            });
            return lbl;
        }

    });
    $.widget('pic.headerPin', {
        options: {},
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._buildControls();
            el[0].state = function (val) { return self.state(val); }
            el[0].label = function (val) { return self.label(val); }
            el[0].active = function (val) { return self.active(val); }
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('header-pin');
            el.attr('data-sex', o.sex).attr('data-id', o.id).attr('data-type', o.type);
            if (o.align === 'left') $('<label></label>').appendTo(el).text(o.id).css({ textAlign: 'right' });
            var outer = $('<div></div>').appendTo(el).addClass('header-pin-outer');
            $('<div></div>').appendTo(outer).addClass('header-pin-inner');
            if (o.align !== 'left') $('<label></label>').appendTo(el).text(o.id).css({ textAlign: 'left' });
            var title = o.name;
            if (typeof o.gpioId !== 'undefined') {
                title += '\r\nGPIO #' + o.gpioId;
            }
            if (typeof o.label !== 'undefined') {
                el.attr('data-label', o.label);
                title += '\r\n' + o.label;
            }
            el.attr('title', title);
            el.attr('data-active', (o.active === false) ? 'false' : 'true');
            //if (typeof o.state !== 'undefined') {
            //    console.log({ msg: 'setting state', state: o.state, o: o });
            //}
            self.state(o.state);
        },
        state: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val !== 'undefined') {
                el.attr('data-state', makeBool(val) ? 'on' : 'off');
            }
            else return el.attr('data-state');
        },
        label: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val !== 'undefined') {
                el.attr('data-label', val);
                var title = o.name;
                if (typeof o.gpioId !== 'undefined') { title += '\r\nGPIO #' + o.gpioId; }
                if (typeof o.label !== 'undefined') title += '\r\n' + val;
                el.attr('title', title);
            }
            else return el.attr('data-state');
        },
        active: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val !== 'undefined') {
                el.attr('data-active', makeBool(val));
            }
            else return el.attr('data-active');
        }
    });
    $.widget('pic.scriptEditor', {
        options: {},
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._buildControls();
            el[0].val = function (val) { return self.val(val); }
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('script-editor');
            $('<div></div>').addClass('script-prefix').appendTo(el).html(Prism.highlight(o.prefix, Prism.languages.javascript, 'javascript'));
            var inner = $('<div></div>').appendTo(el).addClass('script-scroller');
            var jarElem = $('<code></code>').addClass('editor').addClass('language-javascript').appendTo(inner);
            o.jar = $CJ.CodeJar(jarElem[0], $CJ.LineNumbers(Prism.highlightElement));
            if (typeof o.style !== 'undefined') el.css(o.style);
            if (typeof o.codeStyle !== 'undefined') inner.css(o.codeStyle);
            el.attr('data-bind', o.binding);
            $('<div></div>').addClass('script-suffix').appendTo(el).html(Prism.highlight(o.suffix, Prism.languages.javascript, 'javascript'));
        },
        _encode: function (code) { return code.replace(/\n/g, '\\n'); },
        _decode: function (code) { return code.replace(/\\n/g, '\n'); },

        val: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val === 'undefined') {
                return o.jar.toString();
            }
            else {
                o.jar.updateCode(val);
            }
        },
        _destroy: function () {
            var self = this, o = self.options, el = self.element;
            o.jar.destroy();
            o.jar = undefined;
        }
    });
    $.widget('pic.relayBoard', {
        options: { columns: 4, total: 0, relays: [] },
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._buildControls();
            el[0].val = function (val) { return self.val(val); };
            el[0].relayCount = function (val) { return self.relayCount(val); };
            el[0].setRelay = function (val) { return self.setRelay(val); }
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('relay-board');
            if (typeof o.binding !== 'undefined') el.attr('data-bind', o.binding);
            for (var i = 0; i < o.total; i++) {
                self.addRelay(o.relays.find(elem => elem.id === i + 1) || { id: i + 1, name: `Relay #${i + 1}`, enabled: false });
            }
            el.on('click', 'span.relay-module-configure', function (e) {
                var evt = $.Event('configureRelay');
                var elemRelay = $(e.currentTarget).parents('div.relay-module:first');
                var id = parseInt(elemRelay.attr('data-relayid'), 10);
                evt.relay = o.relays.find(elem => elem.id === id) || { id: id, name: `Relay #${id}`, enabled: false };
                el.trigger(evt);
                if (!evt.isDefaultPrevented()) {
                    self.openConfigureRelay(evt.relay);
                }
                e.stopImmediatePropagation();
                e.preventDefault();
            });
            el.on('click', 'div.relay-module', function (e) {
                if (!$(e.currentTarget).hasClass('disabled')) {
                    var evt = $.Event('clickRelay');
                    var elemRelay = $(e.currentTarget);
                    var id = parseInt(elemRelay.attr('data-relayid'), 10);
                    evt.relay = o.relays.find(elem => elem.id === id) || { id: id, name: `Relay #${id}`, enabled: false };
                    el.trigger(evt);
                }
                e.stopImmediatePropagation();
                e.preventDefault();
            });
        },
        openConfigureRelay: function (relay) {
            var self = this, o = self.options, el = self.element;
            var dlg = $.pic.modalDialog.createDialog(`dlgEditRelay${relay.id}`, {
                width: '407px',
                height: 'auto',
                title: `Edit Relay #${relay.id}`,
                position: { my: "center center", at: "center center", of: window },
                buttons: [
                    {
                        text: 'Save', icon: '<i class="fas fa-save"></i>',
                        click: (evt) => {
                            var r = dataBinder.fromElement(dlg);
                            if (dataBinder.checkRequired(dlg, true)) {
                                self.saveRelay(r);
                            }
                            $.pic.modalDialog.closeDialog(dlg[0]);
                        }
                    },
                    {
                        text: 'Cancel', icon: '<i class="far fa-window-close"></i>',
                        click: function () { $.pic.modalDialog.closeDialog(this); }
                    }
                ]
            });
            $('<input type="hidden"></input>').appendTo(dlg).attr('data-bind', 'id').attr('data-datatype', 'int').val(relay.id);
            $('<div></div>').appendTo(dlg).html('Enable this relay if you are controlling it from REM.  Changes to the relay will not be saved until you press the save button on the previous screen.');
            $('<hr></hr>').appendTo(dlg);
            var line = $('<div></div>').appendTo(dlg);
            $('<div></div>').appendTo(line).inputField({ labelText: 'Name', binding: 'name', inputAttrs: { maxLength: 16, style: { width: "14rem" } } });
            $('<div></div>').appendTo(line).checkbox({ labelText: 'Enabled', binding: 'enabled' });
            line = $('<div></div>').appendTo(dlg);
            $('<hr></hr>').appendTo(line).css({ margin: '3px' });
            $('<div></div>').appendTo(line).pickList({
                binding: 'initState', labelText: 'Startup State',
                bindColumn: 0, displayColumn: 1, value: '',
                columns: [{ hidden: true, binding: 'name', text: 'name', style: { whiteSpace: 'nowrap' } }, { hidden: false, binding: 'desc', text: 'State', style: { whiteSpace: 'nowrap' } }],
                items: [{ name: 'on', desc: 'Relay On' },
                { name: 'off', desc: 'Relay Off' },
                { name: '', label: 'No Change', desc: 'No Change' },
                { name: 'last', label: 'Last State', desc: 'Last State' }],
                inputAttrs: { style: { width: '7rem' } }, labelAttrs: { style: {} }
            })
            $('<div></div>').appendTo(line).checkbox({ labelText: 'Invert Output Signal', binding: 'invert' });
            $('<hr></hr>').appendTo(dlg);
            line = $('<div></div>').appendTo(dlg);
            $('<div></div>').appendTo(line).html(`Use the delay settings below to add a delay for relay on/off sequences.  This will insert an additional delay time to ensure the relay does not cycle too fast.`).addClass('script-advanced-instructions');
            $('<div></div>').appendTo(line).valueSpinner({ canEdit: true, units: 'ms', labelText: 'On Delay', binding: 'sequenceOnDelay', min: 0, max: 5000, labelAttrs: { style: { width: '4.5rem' } }, inputAttrs: { maxLength: 5, style: { width: "5rem" } } });
            $('<div></div>').appendTo(line).valueSpinner({ canEdit: true, units: 'ms', labelText: 'Off Delay', binding: 'sequenceOffDelay', min: 0, max: 5000, labelAttrs: { style: { width: '4.5rem' } }, inputAttrs: { maxLength: 5, style: { width: "5rem" } } });

            dataBinder.bind(dlg, relay);
            dlg.css({ overflow: 'visible' });
        },
        createRelayElem: function (relay) {
            var self = this, o = self.options, el = self.element;
            var module = $('<div></div>').addClass('relay-module');
            var header = $('<div></div>').appendTo(module);
            $('<span></span>').addClass('relay-module-indicator').appendTo(header);
            $('<i class="fas fa-cogs"></i>').appendTo($('<span></span>').addClass('relay-module-configure').addClass('header-icon-btn').appendTo(header));
            module.attr('data-relayid', relay.id);
            var name = $('<div></div>').addClass('relay-module-name').appendTo(module);
            $('<span></span>').appendTo(name).text(relay.name);
            if (typeof relay === 'undefined' || !makeBool(relay.enabled)) module.addClass('disabled');
            module.attr('data-state', makeBool(relay.state));
            return module;
        },
        addRelay: function (relay) {
            var self = this, o = self.options, el = self.element;
            var before;
            el.children('div.relay-module').each(function () {
                if (parseInt($(this).attr('data-relayid'), 10) > relay.id) {
                    before = $(this);
                    return false;
                }
            });
            if (typeof before !== 'undefined' && before.length > 0) self.createRelayElem(relay).insertBefore(before);
            else self.createRelayElem(relay).appendTo(el);
            if (typeof o.relays.find(elem => elem.id === relay.id) === 'undefined') {
                o.relays.push(relay);
                o.relays.sort((a, b) => { return a.id - b.id; });
            }
        },
        setRelay: function (relay) {
            var self = this, o = self.options, el = self.element;
            if (typeof relay.id === 'undefined') return;
            var r = o.relays.find(elem => elem.id === relay.id);
            if (typeof r === 'undefined') {
                relay.enabled = makeBool(relay.enabled);
                if (typeof relay.name === 'undefined') relay.name(`Relay #${relay.id}`);
                self.addRelay(relay);
            }
            else {
                for (var prop in relay) {
                    if (prop !== 'id') r[prop] = relay[prop];
                }
            }
            var elemRelay = el.find(`div.relay-module[data-relayid="${relay.id}"]`);
            if (typeof relay.state !== 'undefined') elemRelay.attr('data-state', makeBool(relay.state));
            if (elemRelay.length === 0) self.addRelay(relay);
            else {
                elemRelay.find('div.relay-module-name > span').text(relay.name);
                if (relay.enabled) elemRelay.removeClass('disabled');
                else elemRelay.addClass('disabled');
            }
        },
        saveRelay: function (relay) {
            var self = this, o = self.options, el = self.element;
            var evt = $.Event('saveRelay');
            evt.relay = relay;
            el.trigger(evt);
            if (!evt.isDefaultPrevented()) {
                self.setRelay(evt.relay);
            }
        },
        removeRelay: function (relayId) {
            var self = this, o = self.options, el = self.element;
            for (var i = o.relays.length - 1; i >= 0; i--) {
                if (o.relays[i].id > count) o.relays.splice(i, 1);
            }
            el.find(`div.relay-module[data-relayid = "${relayId}]`).remove();
        },
        relayCount: function (count) {
            var self = this, o = self.options, el = self.element;
            if (typeof count !== 'undefined') {
                console.log(o.relays);
                o.relays.sort((a, b) => { return a.id - b.id; });
                if (count < o.relays.length) {
                    for (var i = o.relays.length - 1; i >= 0; i--) {
                        if (o.relays[i].id > count) o.relays.splice(i, 1);
                    }
                    el.find('div.relay-module').each(function () {
                        var id = parseInt($(this).attr('data-relayid'), 10);
                        if (id > count) $(this).remove();
                    });
                }
                else if (count > o.relays.length) {
                    for (var i = o.relays.length; i < count; i++) {
                        self.addRelay({ id: i + 1, name: `Relay #${i + 1}`, enabled: false });
                    }
                }
            }
            else return o.relays.length;
        },
        val: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val !== 'undefined') {
                self.relayCount(val.length);
                val.sort((a, b) => { return a.id - b.id });
                for (var i = 0; i < val.length; i++) {
                    self.setRelay(val[i]);
                }
            }
            else return o.relays;
        }
    });
    $.widget("pic.chemTank", {
        options: { labelText: '', binding: '', min: 0, max: 6, bindTank: false },
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._initChemTank();
        },
        _initChemTank: function () {
            var self = this, o = self.options, el = self.element;
            el.attr('data-datatype', 'int');
            el[0].val = function (val) { return self.val(val); };
            el[0].tank = function (val) { return self.tank(val); };
            el[0].isEmpty = function (val) { return self.isEmpty(); };
            var liquid = $('<div></div>').addClass('chemTank-liquid').appendTo(el);
            $('<div></div>').addClass('chemTank-level-top').appendTo(liquid);
            $('<div></div>').addClass('chemTank-level').appendTo(liquid);
            $('<div></div>').addClass('chemTank-scale').appendTo(liquid);

            // Create all the ticks for the scale by starting at the top and drawing down.
            var tickpos = 100 / 7;
            el.attr('data-chemtype', o.chemType);
            for (var i = 1; i <= 6; i++) {
                $('<div></div>').addClass('chemTank-scale-tick').css({ top: 'calc(' + (tickpos * i) + '% + 10.5px)' }).appendTo(liquid);
            }
            $('<label></label>').addClass('chemTank-label').text(o.labelText).appendTo(el);
            if (typeof o.style !== 'undefined') el.css(o.style);

            if (o.required === true) self.required(true);
            if (o.binding) el.attr('data-bind', o.binding);
            if (o.canSetAttributes) el.attr('data-setattributes', true);
            self.val(o.value);
            self._applyStyles();
            el.on('click', function (evt) {
                if (makeBool(el.attr('data-setattributes'))) {
                    // Open up the tank attributes dialog.
                    self._createAttributesDialog();
                }
            });
        },
        _createAttributesDialog() {
            var self = this, o = self.options, el = self.element;
            var dlg = $.pic.modalDialog.createDialog('dlgChemTankAttributes', {
                width: '447px',
                height: 'auto',
                title: `${o.labelText || 'Supply'} Tank Attributes`,
                position: { my: "center bottom", at: "center top", of: el },
                buttons: [
                    {
                        text: 'Save', icon: '<i class="fas fa-save"></i>',
                        click: function (evt) {
                            var tank = dataBinder.fromElement(dlg);
                            if (dataBinder.checkRequired(dlg, true)) {
                                var evt = $.Event('setattributes');
                                evt.tankAttributes = tank;
                                el.trigger(evt);
                                if (!evt.isDefaultPrevented()) {
                                    // Set the tank attributes.
                                    o.max = tank.capacity;
                                    o.units = tank.units;
                                    self.val(tank.level);
                                    $.pic.modalDialog.closeDialog(dlg);
                                }
                            }
                        }
                    },
                    {
                        text: 'Cancel', icon: '<i class="far fa-window-close"></i>',
                        click: function () { $.pic.modalDialog.closeDialog(this); }
                    }
                ]
            });
            $('<div></div>').appendTo(dlg).html(`Set the capacity, units, and current level for the tank.  As ${o.chemType} is pumped to and from the tank the level will rise and fall.`);
            $('<hr></hr>').appendTo(dlg).css({ margin: '2px' });
            var divPnl = $('<div></div>').appendTo(dlg).css({ display: 'inline-block' });
            var line = $('<div></div>').appendTo(divPnl);
            var capacity = $('<div></div>').appendTo(line).valueSpinner({
                canEdit: true,
                labelText: 'Capacity', binding: 'capacity', min: 0, max: 1000000,
                labelAttrs: { style: { width: '4rem' } },
                inputAttrs: { style: { width: '7rem' } }
            }).on('change', function (e) {
                // Set the max for the qtyLevel
                qty[0].options({ max: capacity[0].val() });
                console.log({ qty: qty[0].val(), cap: capacity[0].val() });
                pct.text(`${capacity[0].val() !== 0 ? Math.round((qty[0].val() / capacity[0].val()) * 100) : 0}%`);
            });
            $('<div></div>').appendTo(line).pickList({
                bindColumn: 0, displayColumn: 0, labelText: 'Capacity Units', binding: 'units', value: 'gal',
                columns: [{ binding: 'name', text: 'Units', style: { whiteSpace: 'nowrap' } }, { binding: 'desc', text: 'Description', style: { minWidth: '12rem' } }],
                items: [{ name: 'gal', desc: 'US Gallons' }, { name: 'L', desc: 'Litres' }, { name: 'cL', desc: 'Centilitres' }, { name: 'mL', desc: 'Millilitres' }, { name: 'oz', desc: 'Fluid Ounces' }, { name: 'qts', desc: 'Quarts' }, { name: 'pints', desc: 'Pints' }],
                inputAttrs: { style: { textAlign: 'center', width: '3rem' } }, labelAttrs: { style: { paddingLeft: '.1rem', display: 'none' } }

            }).on('selchanged', function (e) {
                var opts = {};
                switch (e.newItem.name) {
                    case 'L':
                    case 'gal':
                        opts = { step: .1, fmtMask: '#,##0.##', emptyMask: '' };
                        break;
                    case 'cL':
                    case 'quarts':
                    case 'pints':
                        opts = { step: .1, fmtMask: '#,##0.#', emptyMask: '' };
                        break;
                    case 'oz':
                    case 'mL':
                        opts = { step: 1, fmtMask: '#,##0', emptyMask: '' };
                        break;
                    default:
                        opts = { step: 1, fmtMask: '#,##0', emptyMask: '' };
                        break;
                }
                qty[0].options(opts);
                capacity[0].options(opts);
            });
            line = $('<div></div>').appendTo(divPnl);
            var qty = $('<div></div>').appendTo(line).valueSpinner({
                canEdit: true, labelText: 'Level', binding: 'level', min: 0, max: o.max,
                labelAttrs: { style: { width: '4rem' } },
                inputAttrs: { style: { width: '7rem' } }
            }).on('change', function (e) {
                pct.text(`${capacity[0].val() !== 0 ? Math.round((qty[0].val() / capacity[0].val()) * 100) : 0}%`);
            });
            divPnl = $('<div></div>').appendTo(dlg).css({ display: 'inline-block' });
            let pct = $('<div></div>').appendTo(divPnl).addClass('tank-attr-percent').css({ fontSize: '2em', textAlign: 'center', padding: '.5em' });
            dataBinder.bind(dlg, { capacity: o.max, units: o.units || '', level: o.value || 0 });
            pct.text(`${capacity[0].val() !== 0 ? Math.round((qty[0].val() / capacity[0].val()) * 100) : 0}%`);
            dlg.css({ overflow: 'visible' });
        },
        _applyStyles: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('picChemTank');
        },
        isEmpty: function () {
            var self = this, o = self.options, el = self.element;
            return self.val() === 'undefined';
        },
        tank: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val !== 'undefined') {
                var lvl;
                if (typeof val === 'number') lvl = val;
                else if (typeof val === 'object') {
                    lvl = typeof val.level !== 'undefined' ? val.level : o.value;
                    o.max = (typeof val.capacity !== 'undefined') ? val.capacity : o.max;
                    if (typeof val.units === 'string') o.units === val.units;
                    else if (typeof val.units === 'object') o.units = val.units.name;
                }
                var tot = o.max - o.min;
                // Calculate the left value.
                var pct = Math.max(0, Math.min(100, ((lvl - o.min) / (tot)) * 100));
                var liquid = el.find('div.chemTank-liquid');
                //console.log(liquid);
                liquid.find('div.chemTank-level-top').css({ top: 'calc(' + (100 - pct) + '% - 12.5px)' });
                liquid.find('div.chemTank-level').css({ top: 'calc(' + (100 - pct) + '% - 12.5px)', height: 'calc(' + pct + '% + 25px)' });
                o.value = lvl;
            }
            else {
                return { capacity: o.max, units: o.units, level: o.value };
            }
        },
        val: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val !== 'undefined') {
                var lvl;
                if (typeof val === 'number') lvl = val;
                else if (typeof val === 'object') {
                    self.tank(val);
                    return;
                }
                var tot = o.max - o.min;
                // Calculate the left value.
                var pct = Math.max(0, Math.min(100, ((lvl - o.min) / (tot)) * 100));
                var liquid = el.find('div.chemTank-liquid');
                //console.log(liquid);
                liquid.find('div.chemTank-level-top').css({ top: 'calc(' + (100 - pct) + '% - 12.5px)' });
                liquid.find('div.chemTank-level').css({ top: 'calc(' + (100 - pct) + '% - 12.5px)', height: 'calc(' + pct + '% + 25px)' });
                o.value = lvl;
            }
            else {
                return o.bindTank ? self.tank() : o.value;
            }
        }
    });
    $.widget('pic.adcBoard', {
        options: { columns: 4, total: 0, channels: [] },
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._buildControls();
            el[0].val = function (val) { return self.val(val); };
            el[0].channelCount = function (val) { return self.channelCount(val); };
            el[0].setChannel = function (val) { return self.setChannel(val); }
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('adc-board');
            if (typeof o.binding !== 'undefined') el.attr('data-bind', o.binding);
            for (var i = 0; i < o.total; i++) {
                self.addChannel(o.channels.find(elem => elem.id === i + 1) || { id: i + 1, name: `Channel #${i + 1}`, enabled: false });
            }
            el.on('click', 'span.channel-module-configure', function (e) {
                var evt = $.Event('configureChannel');
                var elemChannel = $(e.currentTarget).parents('div.channel-module:first');
                var id = parseInt(elemChannel.attr('data-channelid'), 10);
                evt.channel = o.channels.find(elem => elem.id === id) || { id: id, name: `Channel #${id}`, enabled: false };
                el.trigger(evt);
                if (!evt.isDefaultPrevented()) {
                    self.openConfigureChannel(evt.channel);
                }
                e.stopImmediatePropagation();
                e.preventDefault();
            });
            el.on('click', 'div.channel-module', function (e) {
                if (!$(e.currentTarget).hasClass('disabled')) {
                    var evt = $.Event('clickChannel');
                    var elemChannel = $(e.currentTarget);
                    var id = parseInt(elemChannel.attr('data-channelid'), 10);
                    evt.channel = o.channels.find(elem => elem.id === id) || { id: id, name: `Channel #${id}`, enabled: false };
                    el.trigger(evt);
                }
                e.stopImmediatePropagation();
                e.preventDefault();
            });

        },
        openConfigureChannel: function (channel) {
            var self = this, o = self.options, el = self.element;
            var dlg = $.pic.modalDialog.createDialog(`dlgEditChannel${channel.id}`, {
                width: '407px',
                height: 'auto',
                title: `Edit Channel #${channel.id}`,
                position: { my: "center center", at: "center center", of: window },
                buttons: [
                    {
                        text: 'Save', icon: '<i class="fas fa-save"></i>',
                        click: (evt) => {
                            var r = dataBinder.fromElement(dlg);
                            if (dataBinder.checkRequired(dlg, true)) {
                                self.saveChannel(r);
                            }
                            $.pic.modalDialog.closeDialog(dlg[0]);
                        }
                    },
                    {
                        text: 'Cancel', icon: '<i class="far fa-window-close"></i>',
                        click: function () { $.pic.modalDialog.closeDialog(this); }
                    }
                ]
            });
            $('<input type="hidden"></input>').appendTo(dlg).attr('data-bind', 'id').attr('data-datatype', 'int').val(channel.id);
            $('<div></div>').appendTo(dlg).html('Enable this channel if you are controlling it from REM.  Changes to the channel will not be saved until you save the overall channel.<hr style="margin:3px"></hr>');
            $('<hr></hr>').appendTo(dlg);
            var line = $('<div></div>').appendTo(dlg);
            $('<div></div>').appendTo(line).inputField({ labelText: 'Name', binding: 'name', inputAttrs: { maxLength: 16, style: { width: "14rem" } } });
            $('<div></div>').appendTo(line).checkbox({ labelText: 'Enabled', binding: 'enabled' });
            $('<div></div>').appendTo(dlg).pickList({
                labelText: 'Power Gain', binding: 'pga', dataType: 'number',
                labelAttrs: {
                    style: { width: "6rem" }
                },
                columns: [
                    {
                        hidden: true,
                        binding: "name",
                        text: "name",
                        style: { whiteSpace: "nowrap" }
                    },
                    {
                        hidden: false,
                        binding: "desc",
                        text: "Description",
                        style: { whiteSpace: "nowrap" }
                    }
                ],
                items: [
                    {
                        name: 6.144,
                        desc: "6.144v"
                    },
                    {
                        name: 4.096,
                        desc: "4.096v"
                    },
                    {
                        name: 2.048,
                        desc: "2.048v"
                    },
                    {
                        name: 1.024,
                        desc: "1.024v"
                    },
                    {
                        name: 0.512,
                        desc: "0.512v"
                    },
                    {
                        name: 0.256,
                        desc: "0.256v"
                    }
                ],
                value: 2.048,
                inputAttrs: { style: { width: "5rem" } }
            })
            line = $('<div></div>').appendTo(dlg);
            $('<div></div>').appendTo(dlg).checkbox({ labelText: 'Reverse Bias', binding: 'reverseBias' });
            dataBinder.bind(dlg, channel);
            dlg.css({ overflow: 'visible' });
        },
        createChannelElem: function (channel) {
            var self = this, o = self.options, el = self.element;
            var module = $('<div></div>').addClass('channel-module');
            var header = $('<div></div>').appendTo(module);
            $('<span></span>').addClass('channel-module-indicator').appendTo(header);
            $('<i class="fas fa-cogs"></i>').appendTo($('<span></span>').addClass('channel-module-configure').addClass('header-icon-btn').appendTo(header));
            module.attr('data-channelid', channel.id);
            var name = $('<div></div>').addClass('channel-module-name').appendTo(module);
            $('<span></span>').appendTo(name).text(channel.name);
            if (typeof channel === 'undefined' || !makeBool(channel.enabled)) module.addClass('disabled');
            module.attr('data-state', makeBool(channel.state));
            return module;
        },
        addChannel: function (channel) {
            var self = this, o = self.options, el = self.element;
            var before;
            el.children('div.channel-module').each(function () {
                if (parseInt($(this).attr('data-channelid'), 10) > channel.id) {
                    before = $(this);
                    return false;
                }
            });
            if (typeof before !== 'undefined' && before.length > 0) self.createChannelElem(channel).insertBefore(before);
            else self.createChannelElem(channel).appendTo(el);
            if (typeof o.channels.find(elem => elem.id === channel.id) === 'undefined') {
                o.channels.push(channel);
                o.channels.sort((a, b) => { return a.id - b.id; });
            }
        },
        setChannel: function (channel) {
            var self = this, o = self.options, el = self.element;
            if (typeof channel.id === 'undefined') return;
            var r = o.channels.find(elem => elem.id === channel.id);
            if (typeof r === 'undefined') {
                channel.enabled = makeBool(channel.enabled);
                if (typeof channel.name === 'undefined') channel.name(`Channel #${channel.id}`);
                self.addChannel(channel);
            }
            else {
                for (var prop in channel) {
                    if (prop !== 'id') r[prop] = channel[prop];
                }
            }
            var elemChannel = el.find(`div.channel-module[data-channelid="${channel.id}"]`);
            if (typeof channel.state !== 'undefined') elemChannel.attr('data-state', makeBool(channel.state));
            if (elemChannel.length === 0) self.addChannel(channel);
            else {
                elemChannel.find('div.channel-module-name > span').text(channel.name);
                if (channel.enabled) elemChannel.removeClass('disabled');
                else elemChannel.addClass('disabled');
            }
        },
        saveChannel: function (channel) {
            var self = this, o = self.options, el = self.element;
            var evt = $.Event('saveChannel');
            evt.channel = channel;
            el.trigger(evt);
            if (!evt.isDefaultPrevented()) {
                self.setChannel(evt.channel);
            }
        },
        removeChannel: function (channelId) {
            var self = this, o = self.options, el = self.element;
            for (var i = o.channels.length - 1; i >= 0; i--) {
                if (o.channels[i].id > count) o.channels.splice(i, 1);
            }
            el.find(`div.channel-module[data-channelid = "${channelId}]`).remove();
        },
        channelCount: function (count) {
            var self = this, o = self.options, el = self.element;
            if (typeof count !== 'undefined') {
                console.log(o.channels);
                o.channels.sort((a, b) => { return a.id - b.id; });
                if (count < o.channels.length) {
                    for (var i = o.channels.length - 1; i >= 0; i--) {
                        if (o.channels[i].id > count) o.channels.splice(i, 1);
                    }
                    el.find('div.channel-module').each(function () {
                        var id = parseInt($(this).attr('data-channelid'), 10);
                        if (id > count) $(this).remove();
                    });
                }
                else if (count > o.channels.length) {
                    for (var i = o.channels.length; i < count; i++) {
                        self.addChannel({ id: i + 1, name: `Channel #${i + 1}`, enabled: false });
                    }
                }
            }
            else return o.channels.length;
        },
        val: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val !== 'undefined') {
                self.channelCount(val.length);
                val.sort((a, b) => { return a.id - b.id });
                for (var i = 0; i < val.length; i++) {
                    self.setChannel(val[i]);
                }
            }
            else return o.channels;
        }
    });
    $.widget('pic.templateRepeater', {
        options: { rowCount: 1, binding: '' },
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._buildControls();
            el[0].val = function (val) { return self.val(val); };
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('template-repeater');
            for (var i = 0; i < o.rowCount; i++) {
                self.addRow(i, o.template);
            }
        },
        addRow: function (ndx, template) {
            var self = this, o = self.options, el = self.element;
            var divOuter = $('<div></div>').appendTo(el).addClass('template-repeater-row');
            divOuter.attr('data-rowindex', ndx);
            var binding = o.binding.replace(/%%index%%/g, ndx);
            binding = o.binding.replace(/%%ordinal%%/g, ndx + 1);
            for (var i = 0; i < o.template.length; i++) {
                templateBuilder.createControlOptions(divOuter, o.template[i], binding);
            }
        }

    });
    $.widget('pic.ioChannels', {
        options: { columns: 4, total: 0, ioType: 'digital', direction: 'in' },
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._buildControls();
            el[0].val = function (val) { return self.val(val); };
            el[0].channelCount = function (val) { return self.channelCount(val); };
            el[0].setChannel = function (val) { return self.setChannel(val); }
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            if (typeof o.channels === 'undefined') o.channels = [];
            el.addClass('io-channels');
            if (typeof o.binding !== 'undefined') el.attr('data-bind', o.binding);
            for (var i = 0; i < o.total; i++) {
                self.addChannel(o.channels.find(elem => elem.id === i + 1) || { id: i + 1, name: `Chan #${i + 1}`, enabled: false });
            }
            el.on('click', 'span.io-channel-configure', function (e) {
                var evt = $.Event('configureChannel');
                var elemChannel = $(e.currentTarget).parents('div.io-channel:first');
                var id = parseInt(elemChannel.attr('data-channelid'), 10);
                evt.channel = o.channels.find(elem => elem.id === id) || { id: id, name: `Chan #${id}`, enabled: false };
                el.trigger(evt);
                if (!evt.isDefaultPrevented()) {
                    self.openConfigureChannel(evt.channel);
                }
                e.stopImmediatePropagation();
                e.preventDefault();
            });
            el.on('click', 'div.io-channel', function (e) {
                if (!$(e.currentTarget).hasClass('disabled')) {
                    var evt = $.Event('clickChannel');
                    console.log(e);
                    var elemChannel = $(e.currentTarget);
                    var id = parseInt(elemChannel.attr('data-channelid'), 10);
                    evt.channel = o.channels.find(elem => elem.id === id) || { id: id, name: `Channel #${id}`, enabled: false };
                    el.trigger(evt);
                }
                e.stopImmediatePropagation();
                e.preventDefault();
            });
        },
        openConfigureChannel: function (channel) {
            var self = this, o = self.options, el = self.element;
            var dlg = $.pic.modalDialog.createDialog(`dlgEditChanel${channel.id}`, {
                width: '407px',
                height: 'auto',
                title: `Edit Channel #${channel.id}`,
                position: { my: "center center", at: "center center", of: window },
                buttons: [
                    {
                        text: 'Save', icon: '<i class="fas fa-save"></i>',
                        click: (evt) => {
                            var c = dataBinder.fromElement(dlg);
                            if (dataBinder.checkRequired(dlg, true)) {
                                self.saveChannel(c);
                            }
                            $.pic.modalDialog.closeDialog(dlg[0]);
                        }
                    },
                    {
                        text: 'Cancel', icon: '<i class="far fa-window-close"></i>',
                        click: function () { $.pic.modalDialog.closeDialog(this); }
                    }
                ]
            });
            $('<input type="hidden"></input>').appendTo(dlg).attr('data-bind', 'id').attr('data-datatype', 'int').val(channel.id);
            $('<div></div>').appendTo(dlg).html('Enable this channel if you are controlling it from REM.  Changes to the channel will not be saved until you press the save button on the previous screen.');
            $('<hr></hr>').appendTo(dlg);
            var line = $('<div></div>').appendTo(dlg);
            $('<div></div>').appendTo(line).inputField({ labelText: 'Name', binding: 'name', inputAttrs: { maxLength: 16, style: { width: "14rem" } } });
            $('<div></div>').appendTo(line).checkbox({ labelText: 'Enabled', binding: 'enabled' });
            line = $('<div></div>').appendTo(dlg);
            $('<hr></hr>').appendTo(line).css({ margin: '3px' });
            // Add in the template.
            if (typeof o.configTemplate !== 'undefined') {
                var divOpts = $('<div></div>').appendTo(dlg);
                console.log(o.configTemplate);
                templateBuilder.createControlOptions(divOpts, o.configTemplate, '');
            }
            console.log(channel);
            dataBinder.bind(dlg, channel);
            dlg.css({ overflow: 'visible' });
        },
        convertUnitsText: function (channel) {
            var self = this, o = self.options, el = self.element;
            if (typeof channel.units === 'undefined' || channel.units === '') return o.units;
            switch (channel.units) {
                case 'volts':
                    return 'v';
                case 'kohm':
                    return 'k&#8486';
                case 'ohm':
                    return '&#8486;';
                default:
                    return channel.units;
            }
            return '';
        },
        createChannelElem: function (channel) {
            var self = this, o = self.options, el = self.element;
            var module = $('<div></div>').addClass('io-channel');
            var header = $('<div></div>').addClass('io-channel-header').appendTo(module);
            var ioType = channel.ioType || o.ioType;
            var ioVal = $('<span></span>').addClass('io-channel-status').appendTo(header);
            var ind = $('<span></span>').addClass('io-channel-indicator').appendTo(ioVal);
            var val = $('<span></span>').addClass('io-channel-value').appendTo(ioVal);
            var units = $('<span></span>').addClass('io-channel-value-units').appendTo(ioVal).html(self.convertUnitsText(channel));
            if (ioType === 'digital') {
                val.hide();
                units.hide();
            }
            else {
                ind.hide();
            }
            $('<i class="fas fa-cogs"></i>').appendTo($('<span></span>').addClass('io-channel-configure').addClass('header-icon-btn').appendTo(header));
            module.attr('data-channelid', channel.id);
            module.attr('data-direction', channel.direction || o.direction);
            var name = $('<div></div>').addClass('io-channel-name').appendTo(module);
            $('<span></span>').appendTo(name).text(channel.name);
            if (typeof channel === 'undefined' || !makeBool(channel.enabled)) module.addClass('disabled');
            module.attr('data-state', makeBool(channel.state));
            return module;
        },
        addChannel: function (channel) {
            var self = this, o = self.options, el = self.element;
            var before;
            console.log(`Adding channel ${channel.id} ${channel.units}`)
            el.children('div.io-channel').each(function () {
                if (parseInt($(this).attr('data-channelid'), 10) > channel.id) {
                    before = $(this);
                    return false;
                }
            });
            if (typeof before !== 'undefined' && before.length > 0) self.createChannelElem(channel).insertBefore(before);
            else self.createChannelElem(channel).appendTo(el);
            if (typeof o.channels.find(elem => elem.id === channel.id) === 'undefined') {
                o.channels.push(channel);
                o.channels.sort((a, b) => { return a.id - b.id; });
            }
        },
        setChannel: function (channel) {
            var self = this, o = self.options, el = self.element;
            if (typeof channel.id === 'undefined') return;
            var c = o.channels.find(elem => elem.id === channel.id);
            if (typeof c === 'undefined') {
                c.enabled = makeBool(channel.enabled);
                if (typeof channel.name === 'undefined') channel.name(`Chan #${channel.id}`);
                self.addChannel(channel);
            }
            for (var prop in channel) {
                if (prop === 'type') {
                    if (typeof c[prop] === 'undefined') c[prop] = channel[prop];
                }
                else if (prop !== 'id') c[prop] = channel[prop];
            }
            var elemChannel = el.find(`div.io-channel[data-channelid="${channel.id}"]`);
            if (typeof channel.state !== 'undefined') elemChannel.attr('data-state', makeBool(channel.state));
            if (elemChannel.length === 0) {
                self.addChannel(channel);
                elemChannel = el.find(`div.io-channel[data-channelid="${channel.id}"]`);
            }
            elemChannel.find('div.io-channel-name > span').text(channel.name);
            if (channel.enabled) {
                elemChannel.removeClass('disabled');
            }
            else elemChannel.addClass('disabled');
            var ioType = c.ioType || o.ioType;
            elemChannel.attr('data-value', c.value);
            var elemStatus = elemChannel.find('.io-channel-status:first');
            if (ioType === 'digital') {
                c.enabled ? elemStatus.find('.io-channel-indicator').show() : elemStatus.find('.io-channel-indicator').hide();
                elemStatus.find('.io-channel-value').hide();
                elemStatus.find('.io-channel-value-units').hide();
                elemChannel.attr('data-state', c.value > 0);
            }
            else {
                elemStatus.find('.io-channel-indicator').hide();
                elemStatus.find('.io-channel-value').show();
                elemStatus.find('.io-channel-value-units').show();
                if (c.enabled) {
                    elemChannel.find('span.io-channel-value').text(dataBinder.formatValue(channel.state || channel.value, 'number', '#,##0.0##', '--.-'));
                    if (typeof channel.units !== 'undefined') {
                        elemChannel.find('span.io-channel-value-units').html(self.convertUnitsText(channel));
                        //console.log(elemChannel.find('span.io-channel-value-units'));
                    }
                }
                else elemChannel.find('span.io-channel-value').text('--.-');
            }
            elemChannel.attr('data-iotype', ioType);

        },
        saveChannel: function (channel) {
            var self = this, o = self.options, el = self.element;
            var evt = $.Event('setIOChannel');
            evt.channel = channel;
            el.trigger(evt);
            if (!evt.isDefaultPrevented()) {
                var c = o.channels.find(elem => elem.id === channel.id);
                if (typeof c === 'undefined') {
                    c.enabled = makeBool(channel.enabled);
                    if (typeof channel.name === 'undefined') channel.name(`Chan #${channel.id}`);
                    self.addChannel(channel);
                }
                for (var prop in channel) {
                    if (prop !== 'id') c[prop] = channel[prop];
                }
                self.setChannel(evt.channel);
                evt = $.Event('saveIOChannel');
                evt.channel = c;
                el.trigger(evt);
            }

        },
        removeChannel: function (channelId) {
            var self = this, o = self.options, el = self.element;
            for (var i = o.channels.length - 1; i >= 0; i--) {
                if (o.channels[i].id > count) o.channels.splice(i, 1);
            }
            el.find(`div.io-channel[data-channelid = "${channelId}]`).remove();
        },
        channelCount: function (count) {
            var self = this, o = self.options, el = self.element;
            if (typeof count !== 'undefined') {
                o.channels.sort((a, b) => { return a.id - b.id; });
                if (count < o.channels.length) {
                    for (var i = o.channels.length - 1; i >= 0; i--) {
                        if (o.channels[i].id > count) o.channels.splice(i, 1);
                    }
                    el.find('div.io-channel').each(function () {
                        var id = parseInt($(this).attr('data-channelid'), 10);
                        if (id > count) $(this).remove();
                    });
                }
                else if (count > o.channels.length) {
                    for (var i = o.channels.length; i < count; i++) {
                        self.addChannel({ id: i + 1, name: `Chan #${i + 1}`, enabled: false });
                    }
                }
            }
            else return o.channels.length;
        },
        val: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val !== 'undefined') {
                val.sort((a, b) => { return a.id - b.id });
                for (var i = 0; i < val.length; i++) {
                    self.setChannel(val[i]);
                }
            }
            else return o.channels;
        }
    });
})(jQuery);
$.pic.modalDialog.createDialog = function (id, options) {
    var opt = typeof options !== 'undefined' && options !== null ? options : {
        autoOpen: false,
        height: 300,
        width: 350,
        modal: true,
        message: '',
        buttons: {
            Cancel: function () { dlg.modalDialog("close"); }
        }
    };
    opt.modal = true;
    if (typeof opt.autoOpen === 'undefined') opt.autoOpen = false;
    var dlg = $('div#' + id);
    if (dlg.length === 0) {
        dlg = $('<div id="' + id + '" style="display:block;position:relative;padding:4px;"></div>');
        dlg.modalDialog(opt);
    }
    dlg.modalDialog('open');
    return dlg;
};
$.pic.modalDialog.createConfirm = function (id, options) {
    var opt = {
        autoOpen: false,
        width: 350,
        modal: true,
        message: '',
        buttons: [
            {
                text: 'Cancel', icon: '<i class="far fa-window-close"></i>',
                click: function () { $.pic.modalDialog.closeDialog(this); }
            },
            {
                text: 'Ok', icon: '<i class="far fa-thumbs-up"></i>',
                click: function () {
                    var evt = $.Event('confirmed');
                    dlg.trigger(evt);
                    if (!evt.isDefaultPrevented()) $.pic.modalDialog.closeDialog(this);
                }
            }
        ]
    };
    opt = $.extend(true, {}, opt, options);
    opt.modal = true;
    if (typeof opt.autoOpen === 'undefined') opt.autoOpen = false;
    var dlg = $('div#' + id);
    if (dlg.length === 0) {
        dlg = $('<div id="' + id + '" style="display:block;position:relative;padding:4px;"></div>');
        dlg.modalDialog(opt);
    }
    dlg.html(opt.message);
    dlg.modalDialog('open');
    return dlg;
};
$.pic.modalDialog.closeDialog = function (el) {
    var dlg = $(el);
    if (!dlg.hasClass('ui-dialog-content'))
        dlg = dlg.parents('.ui-dialog-content:first');
    dlg.modalDialog('close');
    return dlg;
};
$.pic.modalDialog.createApiError = function (err, options) {
    var opt = typeof options !== 'undefined' && options !== null ? options : {
        autoOpen: false,
        height: 'auto',
        width: '30rem',
        modal: true,
        message: '',
        buttons: [
            { text: 'Close', icon: '<i class="far fa-window-close"></i>', click: function () { dlg.modalDialog("close"); } }
        ]
    };
    opt.modal = true;
    opt.title = 'Error: ';
    if (typeof err.error === 'object' && err.error !== undefined && err.error.name)
        opt.title += err.error.name;
    else
        opt.title += 'General Error';
    console.log(opt);
    console.log(err);
    var id = 'errorDialog' + _uniqueId++;
    if (typeof opt.autoOpen === 'undefined') opt.autoOpen = false;
    var dlg = $('div#' + id);
    if (dlg.length === 0) {
        dlg = $('<div id="' + id + '" style="display:block;position:relative;padding:4px;"></div>');
        $('<div></div>').appendTo(dlg).errorPanel(err);
        dlg.modalDialog(opt);
    }

    dlg.modalDialog('open');
    return dlg;
};
$.pic.boardPanel = function () { return $('div.pnl-board-definition:first'); }
var _controller = function () { return $.pic.boardPanel()[0]; }
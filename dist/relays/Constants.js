"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
class Timestamp {
    constructor(dt) {
        this._isUpdating = false;
        this._dt = dt || new Date();
        this.emitter = new events_1.EventEmitter();
    }
    set isUpdating(val) { this._isUpdating = val; }
    get isUpdating() { return this._isUpdating; }
    get hours() { return this._dt.getHours(); }
    set hours(val) {
        if (this.hours !== val) {
            this._dt.setHours(val);
            this.emitter.emit('change');
        }
    }
    get minutes() { return this._dt.getMinutes(); }
    set minutes(val) {
        if (this.minutes !== val) {
            this._dt.setMinutes(val);
            this.emitter.emit('change');
        }
    }
    get seconds() { return this._dt.getSeconds(); }
    set seconds(val) {
        if (this.seconds !== val) {
            this._dt.setSeconds(val);
            // No need to emit this change as Intellicenter only
            // reports to the minute.
            //this.emitter.emit('change');
        }
    }
    get milliseconds() { return this._dt.getMilliseconds(); }
    set milliseconds(val) { this._dt.setMilliseconds(val); }
    get fullYear() { return this._dt.getFullYear(); }
    set fullYear(val) { this._dt.setFullYear(val); }
    get year() { return this._dt.getFullYear(); }
    set year(val) {
        let y = val < 100 ? (Math.floor(this._dt.getFullYear() / 100) * 100) + val : val;
        if (y !== this.year) {
            this._dt.setFullYear(y);
            this.emitter.emit('change');
        }
    }
    get month() { return this._dt.getMonth() + 1; }
    set month(val) {
        if (this.month !== val) {
            this._dt.setMonth(val - 1);
            this.emitter.emit('change');
        }
    }
    get date() { return this._dt.getDate(); }
    set date(val) {
        if (this.date !== val) {
            this._dt.setDate(val);
            this.emitter.emit('change');
        }
    }
    get dayOfWeek() {
        // for IntelliTouch set date/time
        if (this._dt.getUTCDay() === 0)
            return 0;
        else
            return Math.pow(2, this._dt.getUTCDay() - 1);
    }
    getTime() { return this._dt.getTime(); }
    format() { return Timestamp.toISOLocal(this._dt); }
    static toISOLocal(dt) {
        let tzo = dt.getTimezoneOffset();
        var pad = function (n) {
            var t = Math.floor(Math.abs(n));
            return (t < 10 ? '0' : '') + t;
        };
        return new Date(dt.getTime() - (tzo * 60000)).toISOString().slice(0, -1) + (tzo > 0 ? '-' : '+') + pad(tzo / 60) + pad(tzo % 60);
    }
    setTimeFromSystemClock() {
        this._dt = new Date();
        this.emitter.emit('change');
    }
    calcTZOffset() {
        let obj = { tzOffset: 0, adjustDST: false };
        let dateJan = new Date(this._dt.getFullYear(), 0, 1, 2);
        let dateJul = new Date(this._dt.getFullYear(), 6, 1, 2);
        obj.tzOffset = dateJan.getTimezoneOffset() / 60 * -1;
        obj.adjustDST = dateJan.getTimezoneOffset() - dateJul.getTimezoneOffset() > 0;
        return obj;
    }
}
exports.Timestamp = Timestamp;
class Utils {
    makeBool(val) {
        if (typeof (val) === 'boolean')
            return val;
        if (typeof (val) === 'undefined')
            return false;
        if (typeof (val) === 'number')
            return val >= 1;
        if (typeof (val) === 'string') {
            if (val === '' || typeof val === 'undefined')
                return false;
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
            if (!isNaN(parseInt(val, 10)))
                return parseInt(val, 10) >= 1;
        }
        return false;
    }
}
exports.Utils = Utils;
exports.utils = new Utils();
//# sourceMappingURL=Constants.js.map
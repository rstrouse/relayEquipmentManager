"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const extend = require("extend");
const events_1 = require("events");
const Logger_1 = require("../logger/Logger");
class valueMap extends Map {
    transform(byte, ext) { return extend(true, { val: byte || 0 }, this.get(byte) || this.get(0)); }
    toArray() {
        let arrKeys = Array.from(this.keys());
        let arr = [];
        for (let i = 0; i < arrKeys.length; i++)
            arr.push(this.transform(arrKeys[i]));
        return arr;
    }
    transformByName(name) {
        let arr = this.toArray();
        for (let i = 0; i < arr.length; i++) {
            if (typeof (arr[i].name) !== 'undefined' && arr[i].name === name)
                return arr[i];
        }
        return { name: name };
    }
    getValue(name) { return this.transformByName(name).val; }
    getName(val) { return val >= 0 && typeof this.get(val) !== 'undefined' ? this.get(val).name : ''; } // added default return as this was erroring out by not finding a name
    merge(vals) {
        for (let val of vals) {
            this.set(val[0], val[1]);
        }
    }
    valExists(val) {
        let arrKeys = Array.from(this.keys());
        return typeof arrKeys.find(elem => elem === val) !== 'undefined';
    }
    encode(val, def) {
        let v = this.findItem(val);
        if (typeof v === 'undefined')
            Logger_1.logger.debug(`Invalid enumeration: val = ${val} map = ${JSON.stringify(this)}`);
        return typeof v === 'undefined' ? def : v.val;
    }
    findItem(val) {
        if (typeof val === null || typeof val === 'undefined')
            return;
        else if (typeof val === 'number')
            return this.transform(val);
        else if (typeof val === 'string') {
            let v = parseInt(val, 10);
            if (!isNaN(v))
                return this.transform(v);
            else
                return this.transformByName(val);
        }
        else if (typeof val === 'object') {
            if (typeof val.val !== 'undefined')
                return this.transform(parseInt(val.val, 10));
            else if (typeof val.name !== 'undefined')
                return this.transformByName(val.name);
        }
    }
}
exports.valueMap = valueMap;
class valueMaps {
    constructor() {
        this.controllerTypes = new valueMap([
            [0, { name: 'unspecified', desc: 'Unspecified' }],
            [1, { name: 'raspi', desc: 'Raspberry Pi', pinouts: 'raspi.json' }],
            [2, { name: 'opi', desc: 'Orange Pi' }],
            [3, { name: 'beagle', desc: 'Beagle Bone Black', pinouts: 'beaglebone.json' }]
        ]);
        this.pinDirections = new valueMap([
            [0, { name: 'input', desc: 'Input' }],
            [1, { name: 'output', desc: 'Output' }],
            [2, { name: 'both', desc: 'Input/Output' }]
        ]);
        this.pinTypes = new valueMap([
            [0, { name: 'unused', desc: 'Unused' }],
            [1, { name: 'power3v3', desc: '3v3 Power' }],
            [2, { name: 'power5', desc: '5v Power' }],
            [3, { name: 'ground', desc: 'Ground' }],
            [4, { name: 'gpio', desc: 'General Purpose I/O' }]
        ]);
        this.pinStates = new valueMap([
            [0, { name: 'off', desc: 'Off', inst: 'The pin is currently off.', gpio: 0 }],
            [1, { name: 'on', desc: 'On', inst: 'The pin is currently on.', gpio: 1 }],
            [2, { name: 'unknown', desc: 'Unknown', inst: 'The state of the pin is currently unknown.' }]
        ]);
        this.headerSex = new valueMap([
            [0, { name: 'male', desc: 'Male' }],
            [1, { name: 'female', desc: 'Female' }]
            //,[2, { name: 'trans', desc: 'Multi Sex'}] // If we need to support individual pin layouts.
        ]);
        this.connectionTypes = new valueMap([
            [0, { name: 'njspc', desc: 'nodejs-PoolController', inst: 'Socket connection to nodejs-PoolController server.', urn: 'urn:schemas-upnp-org:device:PoolController:1', bindings: 'njspc.json' }],
            [1, { name: 'webSocket', desc: 'Web Socket', inst: 'Web socket connection.' }],
            [2, { name: 'wsEndpoint', desc: 'Service Endpoint', inst: 'End points that can be called from an external process.' }],
            [3, { name: 'wsClient', desc: 'Poll Service', inst: 'A webservice connection that can be called on an interval.' }],
            [4, { name: 'mqttBroker', desc: 'MQTT Broker', inst: 'Sets up an internal MQTT broker to publish and subscribe to states.' }]
        ]);
        this.triggerStates = new valueMap([
            [0, { name: 'off', desc: 'Off', inst: 'Trigger will turn the pin off.' }],
            [1, { name: 'on', desc: 'On', inst: 'Trigger will turn the pin on.' }]
        ]);
        this.operators = new valueMap([
            [0, { name: 'eq', op: '==', desc: 'Equals' }],
            [1, { name: 'gt', op: '>', desc: 'Greater Than' }],
            [2, { name: 'gte', op: '>=', desc: 'Greater Than or Equal' }],
            [3, { name: 'lt', op: '<', desc: 'Less Than' }],
            [4, { name: 'lte', op: '<=', desc: 'Less Than or Equal' }],
            [5, { name: 'neq', op: '!=', desc: 'Not Equal' }]
        ]);
    }
}
exports.valueMaps = valueMaps;
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
exports.vMaps = new valueMaps();
exports.utils = new Utils();
//# sourceMappingURL=Constants.js.map
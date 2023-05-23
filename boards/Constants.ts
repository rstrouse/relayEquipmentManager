import * as extend from 'extend';
import { EventEmitter } from 'events';
import { logger } from '../logger/Logger';
import { setTimeout } from 'timers';
export class valueMap extends Map<number, any> {
    public transform(byte: number, ext?: number) { return extend(true, { val: byte || 0 }, this.get(byte) || this.get(0)); }
    public toArray(): any[] {
        let arrKeys = Array.from(this.keys());
        let arr = [];
        for (let i = 0; i < arrKeys.length; i++) arr.push(this.transform(arrKeys[i]));
        return arr;
    }
    public transformByName(name: string) {
        let arr = this.toArray();
        for (let i = 0; i < arr.length; i++) {
            if (typeof (arr[i].name) !== 'undefined' && arr[i].name === name) return arr[i];
        }
        return { name: name };
    }
    public getValue(name: string): number { return this.transformByName(name).val; }
    public getName(val: number): string { return val >= 0 && typeof this.get(val) !== 'undefined' ? this.get(val).name : ''; } // added default return as this was erroring out by not finding a name
    public merge(vals) {
        for (let val of vals) {
            this.set(val[0], val[1]);
        }
    }
    public valExists(val: number) {
        let arrKeys = Array.from(this.keys());
        return typeof arrKeys.find(elem => elem === val) !== 'undefined';
    }
    public encode(val: string | number | { val: any, name: string }, def?: number) {
        let v = this.findItem(val);
        if (typeof v === 'undefined') logger.debug(`Invalid enumeration: val = ${val} map = ${JSON.stringify(this)}`);
        return typeof v === 'undefined' ? def : v.val;
    }
    public findItem(val: string | number | { val: any, name: string }) {
        if (typeof val === null || typeof val === 'undefined') return;
        else if (typeof val === 'number') return this.transform(val);
        else if (typeof val === 'string') {
            let v = parseInt(val, 10);
            if (!isNaN(v)) return this.transform(v);
            else return this.transformByName(val);
        }
        else if (typeof val === 'object') {
            if (typeof val.val !== 'undefined') return this.transform(parseInt(val.val, 10));
            else if (typeof val.name !== 'undefined') return this.transformByName(val.name);
        }
    }
}
export class valueMaps {
    constructor() { }
    public controllerTypes: valueMap = new valueMap([
        [1, { name: 'raspi', desc: 'Raspberry Pi', pinouts:'raspi.json', spi0:true, spi1:true, i2c:true }],
        [2, { name: 'opi', desc: 'Orange Pi', pinouts:'orangepi.json', spi0: true, spi1:true, i2c:true }],
        [3, { name: 'beagle', desc: 'Beagle Bone Black', pinouts: 'beaglebone.json', spi0: true, spi1: false, i2c: true }]
    ]);
    public pinDirections: valueMap = new valueMap([
        [0, { name: 'input', desc: 'Input', gpio:'in' }],
        [1, { name: 'output', desc: 'Output', gpio:'out' }]
    ]);
    public pinTypes: valueMap = new valueMap([
        [0, { name: 'unused', desc: 'Unused' }],
        [1, { name: 'power3v3', desc: '3v3 Power' }],
        [2, { name: 'power5', desc: '5v Power' }],
        [3, { name: 'ground', desc: 'Ground' }],
        [4, { name: 'gpio', desc: 'General Purpose I/O'}]
    ]);
    public pinStates: valueMap = new valueMap([
        [0, { name: 'off', desc: 'Off', inst: 'The pin is currently off.', gpio:0, boolean: false }],
        [1, { name: 'on', desc: 'On', inst: 'The pin is currently on.', gpio:1, boolean: true }],
        [2, { name: 'unknown', desc: 'Unknown', inst: 'The state of the pin is currently unknown.' }]
    ]);
    public headerSex: valueMap = new valueMap([
        [0, { name: 'male', desc: 'Male' }],
        [1, { name: 'female', desc: 'Female' }]
        //,[2, { name: 'trans', desc: 'Multi Sex'}] // If we need to support individual pin layouts.
    ]);
    public connectionTypes: valueMap = new valueMap([
        [-1, {name: 'internal', desc: 'Internal', inst: 'Internal connection to defined devices'}],
        [0, { name: 'njspc', desc: 'nodejs-PoolController', inst: 'Socket connection to nodejs-PoolController server.', urn:'urn:schemas-tagyoureit-org:device:PoolController:1', bindings:'njspc.json' }],
        [1, { name: 'webSocket', desc: 'Web Socket', inst: 'Web socket connection.', bindings:'webservice.json' }],
        //[2, { name: 'wsEndpoint', desc: 'Service Endpoint', inst: 'End points that can be called from an external process.' }],
        [3, { name: 'mqttClient', desc: 'MQTT Client', inst: 'A client connection to an MQTT broker.' }]
        //[4, { name: 'mqttBroker', desc: 'MQTT Broker', inst: 'Sets up an internal MQTT broker to publish and subscribe to states.' }]
    ]);
    public triggerStates: valueMap = new valueMap([
        [0, { name: 'off', desc: 'Off', inst: 'Trigger will turn the pin off.' }],
        [1, { name: 'on', desc: 'On', inst: 'Trigger will turn the pin on.' }],
        [2, { name: 'toggle', desc: 'Toggle', inst: 'Trigger will toggle the current state.'}]
    ]);
    public operators: valueMap = new valueMap([
        [0, { name: 'eq', op: '==', desc:'Equals' }],
        [1, { name: 'gt', op: '>', desc:'Greater Than' }],
        [2, { name: 'gte', op: '>=', desc: 'Greater Than or Equal' }],
        [3, { name: 'lt', op: '<', desc: 'Less Than' }],
        [4, { name: 'lte', op: '<=', desc: 'Less Than or Equal' }],
        [5, { name: 'neq', op: '!=', desc: 'Not Equal' }]
    ]);
}
export class Timestamp {
    private _dt: Date;
    public emitter: EventEmitter;
    constructor(dt?: Date) {
        this._dt = dt || new Date();
        this.emitter = new EventEmitter();
    }
    private _isUpdating: boolean = false;
    public set isUpdating(val: boolean) { this._isUpdating = val; }
    public get isUpdating(): boolean { return this._isUpdating; }
    public get hours(): number { return this._dt.getHours(); }
    public set hours(val: number) {
        if (this.hours !== val) {
            this._dt.setHours(val);
            this.emitter.emit('change');
        }
    }
    public get minutes(): number { return this._dt.getMinutes(); }
    public set minutes(val: number) {
        if (this.minutes !== val) {
            this._dt.setMinutes(val);
            this.emitter.emit('change');
        }
    }
    public get seconds(): number { return this._dt.getSeconds(); }
    public set seconds(val: number) {
        if (this.seconds !== val) {
            this._dt.setSeconds(val);
            // No need to emit this change as Intellicenter only
            // reports to the minute.
            //this.emitter.emit('change');
        }
    }
    public get milliseconds(): number { return this._dt.getMilliseconds(); }
    public set milliseconds(val: number) { this._dt.setMilliseconds(val); }
    public get fullYear(): number { return this._dt.getFullYear(); }
    public set fullYear(val: number) { this._dt.setFullYear(val); }
    public get year(): number { return this._dt.getFullYear(); }
    public set year(val: number) {
        let y = val < 100 ? (Math.floor(this._dt.getFullYear() / 100) * 100) + val : val;
        if (y !== this.year) {
            this._dt.setFullYear(y);
            this.emitter.emit('change');
        }
    }
    public get month(): number { return this._dt.getMonth() + 1; }
    public set month(val: number) {
        if (this.month !== val) {
            this._dt.setMonth(val - 1);
            this.emitter.emit('change');
        }
    }
    public get date(): number { return this._dt.getDate(); }
    public set date(val: number) {
        if (this.date !== val) {
            this._dt.setDate(val);
            this.emitter.emit('change');
        }
    }
    public get dayOfWeek(): number {
        // for IntelliTouch set date/time
        if (this._dt.getUTCDay() === 0)
            return 0;
        else
            return Math.pow(2, this._dt.getUTCDay() - 1);
    }
    public getTime() { return this._dt.getTime(); }
    public format(): string { return Timestamp.toISOLocal(this._dt); }
    public static toISOLocal(dt): string {
        let tzo = dt.getTimezoneOffset();
        var pad = function (n) {
            var t = Math.floor(Math.abs(n));
            return (t < 10 ? '0' : '') + t;
        };
        return new Date(dt.getTime() - (tzo * 60000)).toISOString().slice(0, -1) + (tzo > 0 ? '-' : '+') + pad(tzo / 60) + pad(tzo % 60)
    }
    public setTimeFromSystemClock() {
        this._dt = new Date();
        this.emitter.emit('change');
    }
    public calcTZOffset(): { tzOffset: number, adjustDST: boolean } {
        let obj = { tzOffset: 0, adjustDST: false };
        let dateJan = new Date(this._dt.getFullYear(), 0, 1, 2);
        let dateJul = new Date(this._dt.getFullYear(), 6, 1, 2);
        obj.tzOffset = dateJan.getTimezoneOffset() / 60 * -1;
        obj.adjustDST = dateJan.getTimezoneOffset() - dateJul.getTimezoneOffset() > 0;
        return obj;
    }
}
export class Utils {
    public wait(ms) { return new Promise((resolve, reject) => { setTimeout(() => { resolve(ms) }, ms); }); }
    public makeBool(val) {
        if (typeof (val) === 'boolean') return val;
        if (typeof (val) === 'undefined') return false;
        if (typeof (val) === 'number') return val >= 1;
        if (typeof (val) === 'string') {
            if (val === '' || typeof val === 'undefined') return false;
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
    public convert = {
        temperature: {
            f: {
                k: (val) => { return (val - 32) * (5 / 9) + 273.15; },
                c: (val) => { return (val - 32) * (5 / 9); },
                f: (val) => { return val; }
            },
            c: {
                k: (val) => { return val + 273.15; },
                c: (val) => { return val; },
                f: (val) => { return (val * (9 / 5)) + 32; }
            },
            k: {
                k: (val) => { return val; },
                c: (val) => { return val - 273.15; },
                f: (val) => { return ((val - 273.15) * (9 / 5)) + 32; }
            },
            shart: (ref: number, temp: number, resistance: number, beta: number, units: string): number => {
                let rtemp = this.convert.temperature.convertUnits(temp, 'c', 'k');
                let tK = (beta * rtemp) / (beta + (rtemp * Math.log(resistance / ref)));
                return this.convert.temperature.convertUnits(tK, 'k', units);
            },
            convertUnits: (val: number, from: string, to: string) => {
                if (typeof val !== 'number') return null;
                let fn = this.convert.temperature[from.toLowerCase()];
                if (typeof fn !== 'undefined' && typeof fn[to.toLowerCase()] === 'function') return fn[to.toLowerCase()](val);
            }
        },
        pressure: {
            psi: {
                psi: (val) => { return val; },
                kpa: (val) => { return val / 6.89476; },
                atm: (val) => { return val / 0.068406; }
            },
            kpa: {
                psi: (val) => { return val * 6.89476; },
                kpa: (val) => { return val; },
                atm: (val) => { return val * 0.00986923; }
            },
            atm: {
                psi: (val) => { return val * 14.6959; },
                kpa: (val) => { return val * 101.325; },
                atm: (val) => { return val; }
            },
            convertUnits: (val: number, from: string, to: string) => {
                if (typeof val !== 'number') return null;
                let fn = this.convert.pressure[from.toLowerCase()];
                if (typeof fn !== 'undefined' && typeof fn[to.toLowerCase()] === 'function') return fn[to.toLowerCase()](val);
            }
        }
    }
    public getObjectProperties(obj): string[] {
        let props = [];
        do {
            Object.getOwnPropertyNames(obj).forEach((prop) => {
                try {
                    if (props.indexOf(prop) === -1 && typeof obj[prop] !== 'function') props.push(prop);
                } catch (err) { }

            });
        } while (obj = Object.getPrototypeOf(obj));
        return props;
    }
    public setObjectProperties(source, target) {
        let op = this.getObjectProperties(source);
        for (let i in op) {
            let prop = op[i];
            if (typeof this[prop] === 'function') continue;
            if (prop.startsWith('_')) continue;
            if (typeof source[prop] !== 'undefined') {
                if (typeof source[prop] === null) continue;
                target[prop] = source[prop];
            }
        }

    }
}
export const vMaps = new valueMaps();
export const utils = new Utils();
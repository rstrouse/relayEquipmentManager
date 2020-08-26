import * as path from "path";
import * as fs from "fs";
import * as extend from "extend";
import * as util from "util";

import { setTimeout } from "timers";
import { logger } from "../logger/Logger";
import { webApp } from "../web/Server";
import { vMaps, valueMap, utils } from "./Constants";
import { PinDefinitions } from "../pinouts/Pinouts";
import { connBroker, ConnectionBindings } from "../connections/Bindings";
import { gpioPins } from "./GpioPins";
interface IConfigItemCollection {
    set(data);
    clear();
}

class ConfigItem {
    constructor(data: any, name?: string) {
        if (typeof name === 'undefined') {
            this.data = data;
            this.initData(data);
        }
        else {
            this.data = data[name];
            this.initData(data[name]);
        }
        this.dataName = name;
    }
    public dataName: string;
    public hasChanged: boolean = false;
    protected initData(data?:any) { return data; }
    protected data: any;
    protected setDataVal(name, val, persist?: boolean) {
        if (this.data[name] !== val) {
            this.data[name] = val;
            if (typeof persist === 'undefined' || persist) this.hasChanged = true;
        }
        else if (typeof persist !== 'undefined' && persist) this.hasChanged = true;

    }
    protected setMapVal(name, val, map: valueMap, persist?: boolean) {
        if (typeof val === 'number') {
            // Map this to the string value.
            let m = map.transform(val);
            this.setDataVal(name, m.name, persist);
        }
        else if (typeof val === 'string') this.setDataVal(name, val, persist);
        else if (typeof val === 'undefined') this.setDataVal(name, val, persist);
        else if (typeof val.val === 'number') this.setMapVal(name, val.val, map, persist);
        else if (typeof val.name === 'string') this.setDataVal(name, val.name, persist);
        else this.setDataVal(name, val, persist);
    }
    protected getMapVal(val, map: valueMap) {
        if (typeof val === 'number') return map.transform(val);
        return map.transformByName(val);
    }
    public get(bCopy?: boolean): any { return bCopy ? JSON.parse(JSON.stringify(this.data)) : this.data; }
    public getExtended(): any { return this.get(true); }
    public set(data: any) {
        let op = Object.getOwnPropertyNames(Object.getPrototypeOf(this))
        for (let i in op) {
            let prop = op[i];
            if (typeof this[prop] === 'function') continue;
            if (typeof data[prop] !== 'undefined') {
                if (this[prop] instanceof ConfigItemCollection) {
                    ((this[prop] as unknown) as IConfigItemCollection).set(data[prop]);
                }
                else if (this[prop] instanceof ConfigItem)
                    ((this[prop] as unknown) as ConfigItem).set(data[prop]);
                else {
                    if (typeof this[prop] === null || typeof data[prop] === null) continue;
                    this[prop] = data[prop];
                }
            }
        }
    }
}
class ConfigItemCollection<T> implements IConfigItemCollection {
    protected data: any;
    protected name: string;
    constructor(data: [], name: string) {
        if (typeof data[name] === 'undefined') data[name] = [];
        this.data = data[name];
        this.name = name;
    }
    public getItemByIndex(ndx: number, add?: boolean, data?: any): T {
        if (this.data.length > ndx) return this.createItem(this.data[ndx]);
        if (typeof add !== 'undefined' && add)
            return this.add(extend({}, { id: ndx + 1 }, data));
        return this.createItem(extend({}, { id: ndx + 1 }, data));
    }
    public getItemById(id: number | string, add?: boolean, data?: any): T {
        let itm = this.find(elem => elem.id === id && typeof elem.id !== 'undefined');
        if (typeof itm !== 'undefined') return itm;
        if (typeof add !== 'undefined' && add) return this.add(data || { id: id });
        return this.createItem(data || { id: id });

    }
    public removeItemById(id: number | string): T {
        let rem: T = null;
        for (let i = this.data.length - 1; i >= 0; i--)
            if (typeof this.data[i].id !== 'undefined' && this.data[i].id === id) {
                rem = this.data.splice(i, 1);
                return rem;
            }
        return rem;
    }
    public set(data) {
        if (typeof data !== 'undefined') {
            if (Array.isArray(data)) {
                this.clear();
                for (let i = 0; i < data.length; i++) {
                    // We are getting clever here in that we are simply adding the object and the add method
                    // should take care of hooking it all up.
                    this.add(data[i]);
                }
            }
        }
    }
    public removeItemByIndex(ndx: number) {
        this.data.splice(ndx, 1);
    }
    // Finds an item and returns undefined if it doesn't exist.
    public find(f: (value: any, index?: number, obj?: any) => boolean): T {
        let itm = this.data.find(f);
        if (typeof itm !== 'undefined') return this.createItem(itm);
    }
    // This will return a new collection of this type. NOTE: This is a separate object but the data is still attached to the
    // overall configuration.  This meanse that changes made to the objects in the collection will reflect in the configuration.
    // HOWEVER, any of the array manipulation methods like removeItemBy..., add..., or creation methods will not modify the configuration.
    public filter(f: (value: any, index?: any, array?: any[]) => []): ConfigItemCollection<T> {
        return new ConfigItemCollection<T>(this.data.filter(f), this.name);
    }
    public toArray() {
        let arr = [];
        if (typeof this.data !== 'undefined') {
            for (let i = 0; i < this.data.length; i++) {
                arr.push(this.createItem(this.data[i]));
            }
        }
        return arr;
    }
    public toExtendedArray() {
        let arr = [];
        if (typeof this.data !== 'undefined') {
            for (let i = 0; i < this.data.length; i++) {
                arr.push(((this.createItem(this.data[i]) as unknown) as ConfigItem).getExtended());
            }
        }
        return arr;
    }
    public createItem(data: any): T { return (new ConfigItem(data) as unknown) as T; }
    public clear() { this.data.length = 0; }
    public get length(): number { return typeof this.data !== 'undefined' ? this.data.length : 0; }
    public set length(val: number) { if (typeof val !== 'undefined' && typeof this.data !== 'undefined') this.data.length = val; }
    public add(obj: any): T { let ndx = this.data.push(obj) - 1; return this.createItem(this.data[ndx]); }
    public get(): any { return this.data; }
    public emitEquipmentChange() { webApp.emitToClients(this.name, this.data); }
    public sortByName() {
        this.sort((a, b) => {
            return a.name > b.name ? 1 : a.name !== b.name ? -1 : 0;
        });
    }
    public sortById() { this.sort((a, b) => { return a.id > b.id ? 1 : a.id !== b.id ? -1 : 0; }); }
    public sort(fn: (a, b) => number) { this.data.sort(fn); }
    public getMaxId(activeOnly?: boolean, defId?: number) {
        let maxId;
        for (let i = 0; i < this.data.length; i++) {
            if (typeof this.data[i].id !== 'undefined') {
                if (activeOnly === true && this.data[i].isActive === false) continue;
                maxId = Math.max(maxId || 0, this.data[i].id);
            }
        }
        return typeof maxId !== 'undefined' ? maxId : defId;
    }
    public getMinId(activeOnly?: boolean, defId?: number) {
        let minId;
        for (let i = 0; i < this.data.length; i++) {
            if (typeof this.data[i].id !== 'undefined') {
                if (typeof activeOnly !== 'undefined' && this.data[i].isActive === false) continue;
                minId = Math.min(minId || this.data[i].id, this.data[i].id);
            }
        }
        return typeof minId !== 'undefined' ? minId : defId;
    }
}

export class Controller extends ConfigItem {
    constructor(data) { super(data); this.cfgPath = path.posix.join(process.cwd(), '/data/controllerConfig.json'); }
    public init() {
        let cfg = this.loadConfigFile(this.cfgPath, {});
        let cfgDefault = this.loadConfigFile(path.posix.join(process.cwd(), '/defaultController.json'), {});
        cfg = extend(true, {}, cfgDefault, cfg);
        let cfgVer = 1;
        this.data = this.onchange(cfg, function () { cont.dirty = true; });
        this.gpio = new Gpio(this.data, 'gpio');
        if (typeof this.data.configVersion === 'undefined') {
            this.gpio.upgrade(this.data.ver);
        }
        this.data.configVersion = cfgVer;
        this.connections = new ConnectionSourceCollection(this.data, 'connections');
    }
    public async stopAsync() {
        if (this._timerChanges) clearTimeout(this._timerChanges);
        if (this._timerDirty) clearTimeout(this._timerDirty);
        return this; // Allow chaining.
    }
    public cfgPath: string;
    protected _lastUpdated: Date;
    protected _isDirty: boolean;
    protected _timerDirty: NodeJS.Timeout = null;
    protected _timerChanges: NodeJS.Timeout;
    private _pinouts;
    public get dirty(): boolean { return this._isDirty; }
    public set dirty(val) {
        this._isDirty = val;
        this._lastUpdated = new Date();
        this.data.lastUpdated = this._lastUpdated.toLocaleString();
        if (this._timerDirty !== null) {
            clearTimeout(this._timerDirty);
            this._timerDirty = null;
        }
        if (this._isDirty) {
            this._timerDirty = setTimeout(() => this.persist(), 3000);
        }
    }
    public persist() {
        this._isDirty = false;
        // Don't overwrite the configuration if we failed during the initialization.
        Promise.resolve()
            .then(() => { fs.writeFileSync(this.cfgPath, JSON.stringify(this.data, undefined, 2)); })
            .catch(function (err) { if (err) logger.error('Error writing controller config %s %s', err, this.cfgPath); });
    }
    public get controllerType() { return this.getMapVal(this.data.controllerType || 'raspi', vMaps.controllerTypes); }
    public set controllerType(val) {
        let old = this.data.controllerType;
        this.setMapVal('controllerType', val, vMaps.controllerTypes);
        if (old !== val) this._pinouts = undefined;
    }
    private loadConfigFile(path: string, def: any) {
        let cfg = def;
        if (fs.existsSync(path)) {
            try {
                let data = fs.readFileSync(path, 'utf8');
                cfg = JSON.parse(data || '{}');
            }
            catch (ex) {
                cfg = def;
            }
        }
        return cfg;
    }
    protected onchange = (obj, fn) => {
        const handler = {
            get(target, property, receiver) {
                // console.log(`getting prop: ${property} -- dataName? ${target.length}`)
                const val = Reflect.get(target, property, receiver);
                if (typeof val === 'function') return val.bind(receiver);
                if (typeof val === 'object' && val !== null) {
                    if (util.types.isProxy(val)) return val;
                    return new Proxy(val, handler);
                }
                return val;
            },
            set(target, property, value, receiver) {
                if (property !== 'lastUpdated' && Reflect.get(target, property, receiver) !== value) {
                    fn();
                }
                return Reflect.set(target, property, value, receiver);
            },
            deleteProperty(target, property) {
                if (property in target) Reflect.deleteProperty(target, property);
                return true;
            }
        };
        return new Proxy(obj, handler);
    };
    public gpio: Gpio;
    public connections: ConnectionSourceCollection;
    public get pinouts() {
        if (typeof this._pinouts === 'undefined') {
            this._pinouts = PinDefinitions.loadDefintionByName(this.controllerType.name);
        }
        return this._pinouts;
    }
    /**************************************************
     * Api Methods
     *************************************************/
    public async setGeneralConfigAsync(data) {
        return new Promise((resolve, reject) => {
            this.set(data);
            resolve();
        });
    }
    public async setConnectionAsync(data): Promise<ConnectionSource> {
        let c = this.connections.find(elem => elem.id === data.id);
        if (typeof c === 'undefined') {
            data.id = this.connections.getMaxId(false, -1) + 1;
            if (data.id === 0) data.id = 1;
        }
        return new Promise<ConnectionSource>((resolve, reject) => {
            let conn = this.connections.getItemById(data.id, true);
            conn.set(data);
            resolve(conn);
        });
    }
    public async deleteConnectionAsync(id: number): Promise<ConnectionSource> {
        let conn = this.connections.getItemById(id);
        return new Promise<ConnectionSource>((resolve, reject) => {
            for (let i = 0; i < this.gpio.pins.length; i++) {
                let pin = this.gpio.pins.getItemByIndex(i);
                for (let j = 0; j < pin.triggers.length; j++)
                    pin.triggers.removeItemByIndex(j);
            }
            connBroker.deleteConnection(id);
            this.connections.removeItemById(id);
            conn.isActive = false;
            resolve(conn);
        });
    }
    public async setPinAsync(headerId: number, pinId: number, data): Promise<GpioPin> {
        let pin = this.gpio.pins.getPinById(headerId, pinId, true);
        return new Promise<GpioPin>((resolve, reject) => {
            pin.set(data);
            resolve(pin);
        });
    }
    public async setPinTriggerAsync(headerId: number, pinId: number, data): Promise<GpioPinTrigger> {
        let pin = this.gpio.pins.getPinById(headerId, pinId, true);
        let c = pin.triggers.find(elem => elem.id === data.id);
        if (typeof c === 'undefined') {
            data.id = pin.triggers.getMaxId(false, -1) + 1;
            if (data.id === 0) data.id = 1;
        }
        return new Promise<GpioPinTrigger>((resolve, reject) => {
            let trig = pin.triggers.getItemById(data.id, true);
            if (typeof data.bindings !== 'undefined' || typeof data.expression !== 'undefined' || data.expression !== '') {
                let test = extend(true, trig.get(true), data);
                let err = GpioPinTrigger.validateExpression(test);
                if (typeof err !== 'undefined') {
                    logger.error(`Invalid Pin#${pin.id} Trigger Expression: ${err}`);
                    return reject(new Error(`Invalid Pin#${pin.id} Trigger Expression: ${err}`));
                }
            }
            trig.set(data);
            resolve(trig);
        });
    }
    public async deletePinTriggerAsync(headerId: number, pinId: number, triggerId: number): Promise<GpioPin> {
        let pin = this.gpio.pins.getPinById(headerId, pinId);
        return new Promise<GpioPin>((resolve, reject) => {
            pin.triggers.removeItemById(triggerId);
            resolve(pin);
        });
    }
    public async reset(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                await gpioPins.reset();
                await connBroker.compile();
                resolve();
            }
            catch (err) { reject(err); }
        });
    }
    public getExtended() {
        let cont = this.get(true);
        cont.connections = [];
        cont.gpio = this.gpio.getExtended();
        for (let i = 0; i < this.connections.length; i++) {
            cont.connections.push(this.connections.getItemByIndex(i).getExtended());
        }
        return cont;
    }
}
export class Gpio extends ConfigItem {
    constructor(data, name?: string) { super(data, name || 'gpio'); }
    protected initData(data?: any) {
        if (typeof this.data.pins === 'undefined') this.data.pins = [];
        if (typeof this.data.exported === 'undefined') this.data.exported =[];
        return data;
    }
    public upgrade(ver) { this.pins.upgrade(ver); }
    public setExported(gpioId: number) {
        if (this.data.exported.find(elem => elem === gpioId) === undefined) {
            this.data.exported.push(gpioId);
            return false;
        }
        return true;
    }
    public setUnexported(gpioId: number) {
        let ndx = this.data.exported.indexOf(gpioId);
        let bExported = false;
        while (ndx >= 0) {
            this.data.exported.splice(ndx, 1);
            ndx = this.data.exported.indexOf(gpioId);
            bExported = true;
        }
        return bExported;
    }
    public get exported(): number[] { return this.data.exported; }
    public set exported(val: number[]) { this.data.exported.length = 0; this.data.exported.push.apply(this.data.exported, val); }
    public get pins(): GpioPinCollection { return new GpioPinCollection(this.data, 'pins'); }
}
export class GpioPinCollection extends ConfigItemCollection<GpioPin> {
    constructor(data: any, name?: string) { super(data, name || 'pins') }
    public createItem(data: any): GpioPin { return new GpioPin(data); }
    public upgrade(ver) {
        for (let i = 0; i < this.data.length; i++) {
            let pin = this.getItemByIndex(i);
            pin.upgrade(ver);
        }
    }
    public getPinById(headerId: number, pinId: number, add?: boolean, data?: any) {
        let pin = this.find(elem => elem.headerId === headerId && elem.id === pinId);
        if (typeof pin !== 'undefined') return pin;
        if (typeof add !== 'undefined' && add) return this.add(data || { id: pinId, headerId: headerId });
        return this.createItem(data || { id: pinId, headerId: headerId });
    }
}
export class GpioPin extends ConfigItem {
    constructor(data) { super(data); }
    public initData(data?: any) {
        if (typeof this.data.isInverted === 'undefined') this.isInverted = false;
        if (typeof this.data.direction === 'undefined') this.direction = 'output';
        if (typeof this.data.triggers === 'undefined') this.data.triggers = [];
        return data;
    }
    public upgrade(ver) {
        this.triggers.upgrade(ver);
    }
    public get id(): number { return this.data.id; }
    public set id(val: number) { this.setDataVal('id', val); }
    public get isActive(): boolean { return utils.makeBool(this.data.isActive); }
    public set isActive(val: boolean) { this.setDataVal('isActive', val); }
    public get headerId(): number { return this.data.headerId; }
    public set headerId(val: number) { this.setDataVal('headerId', val); }
    public get direction() { return this.getMapVal(this.data.direction, vMaps.pinDirections); }
    public set direction(val) { this.setMapVal('direction', val, vMaps.pinDirections); }
    public get type() { return this.getMapVal(this.data.type, vMaps.pinTypes); }
    public set type(val) { this.setMapVal('type', val, vMaps.pinTypes); }
    public get isInverted(): boolean { return utils.makeBool(this.data.isInverted); }
    public set isInverted(val: boolean) { this.setDataVal('isInverted', val); }
    public get state() { return this.getMapVal(this.data.state || 'unknown', vMaps.pinStates); }
    public set state(val) {
        this.setMapVal('state', val, vMaps.pinStates);
        let mv = this.getMapVal(this.data.state, vMaps.pinStates);
        if (typeof mv !== 'undefined' && mv.gpio !== 'undefined' && this.isActive) gpioPins.writePinAsync(this.headerId, this.id, mv.gpio).catch(err => logger.error(err));
    }
    public get triggers(): GpioPinTriggerCollection { return new GpioPinTriggerCollection(this.data, 'triggers'); }
    public getExtended() {
        let pin = this.get(true);
        pin.triggers = [];
        let pinouts = cont.pinouts;
        let header = pinouts.headers.find(elem => elem.id === this.headerId);
        let pinout = typeof header !== 'undefined' ? header.pins.find(elem => elem.id === this.id) : {};
        pin = extend(true, pin, pinout, { header: header });
        pin.type = this.type;
        pin.state = this.state;
        pin.isActive = this.isActive;
        for (let i = 0; i < this.triggers.length; i++) {
            pin.triggers.push(this.triggers.getItemByIndex(i).getExtended());
        }
        return pin;
    }

}
export class GpioPinTriggerCollection extends ConfigItemCollection<GpioPinTrigger> {
    constructor(data: any, name?: string) { super(data, name || 'triggers') }
    public createItem(data: any): GpioPinTrigger { return new GpioPinTrigger(data); }
    public upgrade(ver) {
        for (let i = 0; i < this.data.length; i++) {
            let trigger = this.getItemByIndex(i);
            trigger.upgrade(ver);
        }
    }
}
export class GpioPinTrigger extends ConfigItem {
    constructor(data) { super(data); }
    public initData(data?: any) {
        if (typeof this.data.isActive === 'undefined') this.isActive = false;
        if (typeof this.data.bindings === 'undefined') this.data.bindings = [];
        return data;
    }
    public upgrade(ver) {
        if (typeof this.data.binding !== 'undefined') {
            if (this.data.bindings.find(elem => elem.binding === this.data.binding) === undefined) {
                this.bindings.add({
                    isActive: true,
                    binding: this.data.binding,
                    operator: this.data.operator,
                    bindValue: this.data.bindValue === 'true' || this.data.bindValue === 'false' ? utils.makeBool(this.data.bindValue) : this.data.bindValue
                });
                this.data.usePinId = (typeof this.data.equipmentId === 'undefined');
            }
            this.data.equipmentId = undefined;
            this.data.operator = undefined;
            this.data.binding = undefined;
            this.data.bindValue = undefined;
        }
    }
    public get id(): number { return this.data.id; }
    public set id(val: number) { this.setDataVal('id', val); }
    public get isActive(): boolean { return utils.makeBool(this.data.isActive); }
    public set isActive(val: boolean) { this.setDataVal('isActive', val); }
    public get sourceId(): number { return this.data.sourceId; }
    public set sourceId(val: number) { this.setDataVal('sourceId', val); }
    public get usePinId(): boolean { return utils.makeBool(this.data.usePinId); }
    public set usePinId(val: boolean) { this.setDataVal('usePinId', val); }
    public get state() { return this.getMapVal(this.data.state || 0, vMaps.triggerStates); }
    public set state(val) { this.setMapVal('state', val, vMaps.triggerStates); }
    public getExtended() {
        let trigger = this.get(true);
        trigger.state = this.state;
        trigger.connection = cont.connections.getItemById(this.sourceId).getExtended();
        trigger.filter = this.filter;
        let binds = [];
        // TODO: Move this into a normalize method so that it is only done
        // once.  Probably during the upgrade process.
        // Reorganize the bindings so that they match what we get from the event.
        if (typeof this.data.bindings !== 'undefined' && typeof this.data.eventName !== 'undefined' && typeof this.data.sourceId !== 'undefined') {
            let conn = cont.connections.getItemById(this.data.sourceId);
            let bindings = ConnectionBindings.loadBindingsByConnectionType(conn.type.name);
            if (typeof bindings !== 'undefined' && typeof bindings.events !== 'undefined') {
                let event = bindings.events.find(elem => elem.name === trigger.eventName);
                if (typeof event !== 'undefined') {
                    for (let i = 0; i < event.bindings.length; i++) {
                        binds.push({ binding: event.bindings[i].binding, isActive: false });
                    }
                }
            }
        }
        for (let i = 0; i < trigger.bindings.length; i++) {
            let bind = trigger.bindings[i];
            let b = binds.find(elem => elem.binding === bind.binding);
            if (typeof b !== 'undefined') {
                b.isActive = bind.isActive;
                b.operator = bind.operator;
                b.bindValue = bind.bindValue;
            }
        }
        trigger.bindings = binds;
        return trigger;
    }
    public get eventName(): string { return this.data.eventName; }
    public set eventName(val: string) { this.setDataVal('eventName', val); }
    public get expression(): string { return this.data.expression; }
    public set expression(val: string) { this.setDataVal('expression', val); }
    public get bindings(): GpioPinTriggerBindingCollection {
        return new GpioPinTriggerBindingCollection(this.data, 'bindings');
    }
    public get filter(): string {
        let filter = '';
        let n = 0;
        let bindings = this.bindings;
        for (let i = 0; i < bindings.length; i++) {
            let b = bindings.getItemByIndex(i);
            if (!b.isActive) continue;
            if (n !== 0) filter += ' &&\r\n'
            filter += `${b.binding} ${b.operator.op} `;
            if (typeof b.bindValue === 'string') filter += `'${b.bindValue}'`;
            else filter += `${b.bindValue}`;
            n++;
        }
        if (typeof this.expression !== 'undefined' && this.expression !== '') {
            if (n > 0) filter += ' &&\r\n';
            filter += '<script expression>'
        }
        return filter;
    }
    public makeExpression() { return GpioPinTrigger._makeExpression(this.data, 'data'); }
    private static _makeExpression(data, dataName) {
        let expression = '';
        if (typeof data.bindings !== 'undefined' && data.bindings.length > 0) {
            let n = 0;
            expression += 'if(!('
            if (utils.makeBool(data.usePinId)) {
                expression += 'parseInt(data.pinId, 10) === pin.id';
                n++;
            }
            for (let i = 0; i < data.bindings.length; i++) {
                let b = data.bindings[i];
                if (!utils.makeBool(b.isActive)) continue;
                let op = vMaps.operators.transform(b.operator);
                if (n !== 0) expression += ' && '
                expression += `${dataName}.${b.binding} ${op.op} `;
                if (typeof b.bindValue === 'string') expression += `'${b.bindValue}'`;
                else expression += `${b.bindValue}`;
                n++;
            }
            expression += ')) return false;'
        }
        if (typeof data.expression !== 'undefined' && data.expression !== '') {
            expression += ' {' + data.expression + '}';
        }
        else if (typeof data.bindings !== 'undefined' && data.bindings.length > 0) { expression += ' else return true;' }
        return expression;
    }
    public static validateExpression(data) {
        try {
            new Function('connection', 'pin', 'trigger', 'data', GpioPinTrigger._makeExpression(data, 'data'));
        }
        catch (err) { return new Error(`${err} ${GpioPinTrigger._makeExpression(data, 'data')}`); }
    }
    public makeTriggerFunction() { return new Function('connection', 'pin', 'trigger', 'data', GpioPinTrigger._makeExpression(this.data, 'data')); }
}
export class GpioPinTriggerBindingCollection extends ConfigItemCollection<GpioPinTriggerBinding> {
    constructor(data: any, name?: string) { super(data, name || 'bindings') }
    public createItem(data: any): GpioPinTriggerBinding { return new GpioPinTriggerBinding(data); }
}
export class GpioPinTriggerBinding extends ConfigItem {
    constructor(data) { super(data); }
    public initData(data?: any) {
        if (typeof this.data.isActive === 'undefined') this.isActive = false;
        return data;
    }
    public get binding(): string { return this.data.binding; }
    public set binding(val: string) { this.setDataVal('binding', val); }
    public get isActive(): boolean { return utils.makeBool(this.data.isActive); }
    public set isActive(val: boolean) { this.setDataVal('isActive', val); }
    public get operator() { return this.getMapVal(this.data.operator || 0, vMaps.operators); }
    public set operator(val) { this.setMapVal('operator', val, vMaps.operators); }
    public get bindValue(): any { return this.data.bindValue; }
    public set bindValue(val: any) { this.setDataVal('bindValue', val); }
    public getExtended() {
        let exp = this.get();
        exp.operator = this.operator;
        return exp;
    }
}

export class ConnectionSourceCollection extends ConfigItemCollection<ConnectionSource> {
    constructor(data: any, name?: string) { super(data, name || 'connections') }
    public createItem(data: any): ConnectionSource { return new ConnectionSource(data); }
}
export class ConnectionSource extends ConfigItem {
    constructor(data) { super(data); }
    public initData(data?: any) {
        if (typeof this.data.isActive === 'undefined') this.isActive = false;
        return data;
    }
    public get id(): number { return this.data.id; }
    public set id(val: number) { this.setDataVal('id', val); }
    public get name(): string { return this.data.name; }
    public set name(val: string) { this.setDataVal('name', val); }
    public get isActive(): boolean { return utils.makeBool(this.data.isActive); }
    public set isActive(val: boolean) { this.setDataVal('isActive', val); }
    public get type() { return this.getMapVal(this.data.type || 0, vMaps.connectionTypes); }
    public set type(val) { this.setMapVal('type', val, vMaps.connectionTypes); }
    public get protocol(): string { return this.data.protocol; }
    public set protocol(val: string) { this.setDataVal('protocol', val); }
    public get ipAddress(): string { return this.data.ipAddress; }
    public set ipAddress(val: string) { this.setDataVal('ipAddress', val); }
    public get port(): number { return this.data.port; }
    public set port(val: number) { this.setDataVal('port', val); }
    public get userName(): string { return this.data.userName; }
    public set userName(val: string) { this.setDataVal('userName', val); }
    public get password(): string { return this.data.password; }
    public set password(val: string) { this.setDataVal('password', val); }
    public get sslKeyFile(): string { return this.data.sslKeyFile; }
    public set sslKeyFile(val: string) { this.setDataVal('sslKeyFile', val); }
    public get sslCertFile(): string { return this.data.sslCertFile; }
    public set sslCertFile(val: string) { this.setDataVal('sslCertFile', val); }
    public getExtended() {
        let src = this.get(true);
        src.type = this.type;
        return src;
    }
    public get url(): string {
        let port = typeof this.port !== 'undefined' ? ':' + this.port.toString() : '';
        return `${this.protocol}//${this.ipAddress}${port}`;
    }
}

export let cont = new Controller({});
import * as path from "path";
import * as fs from "fs";
import * as extend from "extend";
import * as util from "util";

import { setTimeout } from "timers";
import { logger } from "../logger/Logger";
import { webApp } from "../web/Server";
import { vMaps, valueMap, utils } from "./Constants";
import { PinDefinitions } from "../pinouts/Pinouts";
import { SpiAdcChips } from "../spi-adc/SpiAdcChips";
import { connBroker, ConnectionBindings } from "../connections/Bindings";
import { gpioPins } from "./GpioPins";
import { spi0, spi1 } from "../spi-adc/SpiAdcBus";
import { i2c, i2cBus } from "../i2c-bus/I2cBus";
import { AnalogDevices } from "../devices/AnalogDevices";
interface IConfigItemCollection {
    set(data);
    clear();
}

export class ConfigItem {
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
        let op = Object.getOwnPropertyNames(Object.getPrototypeOf(this));
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
export class ConfigItemCollection<T> implements IConfigItemCollection {
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
                    let obj = (this.getItemByIndex(i, true) as unknown) as ConfigItem;
                    obj.set(data[i]);
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
        this.data = this.onchange(cfg, () => { this.dirty = true; });
        this.gpio = new Gpio(this.data, 'gpio');
        if (typeof this.data.configVersion === 'undefined') {
            this.gpio.upgrade(this.data.ver);
        }
        this.spi0 = new SpiController(this.data, 'spi0');
        this.spi1 = new SpiController(this.data, 'spi1');
        this.i2c = new I2cController(this.data, 'i2c');
        this.data.configVersion = cfgVer;
        this.connections = new ConnectionSourceCollection(this.data, 'connections');
    }
    public async stopAsync(): Promise<Controller> {
        try {
            if (this._timerChanges) clearTimeout(this._timerChanges);
            if (this._timerDirty) clearTimeout(this._timerDirty);
            if (this._isDirty) await this.persist();
            return Promise.resolve(this); // Allow chaining.
        }
        catch (err) { logger.error(`Error stopping Controller object: ${err.message}`); }
    }
    public cfgPath: string;
    protected _lastUpdated: Date;
    protected _lastPersisted: Date = new Date();
    protected _isDirty: boolean;
    protected _timerDirty: NodeJS.Timeout = null;
    protected _timerChanges: NodeJS.Timeout;
    private _pinouts;
    private _spiAdcChips;
    private _analogDevices;
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
            logger.verbose(`Setting Dirty... ${val} ${new Date().getTime() - this._lastPersisted.getTime()}`);
            if (new Date().getTime() - this._lastPersisted.getTime() > 10000) //TODO: Set this higher as we don't need to write it every 10 seconds.
                this.persist();
            else
                this._timerDirty = setTimeout(function () { cont.persist(); }, 3000);
        }
    }
    public persist() {
        this._isDirty = false;
        logger.verbose('Persisting Configuration data...');
        // Don't overwrite the configuration if we failed during the initialization.
        Promise.resolve()
            .then(() => { fs.writeFileSync(this.cfgPath, JSON.stringify(this.data, undefined, 2)); })
            .then(() => { this._lastPersisted = new Date() })
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
    public spi0: SpiController;
    public spi1: SpiController;
    public i2c: I2cController;
    public connections: ConnectionSourceCollection;
    public get pinouts() {
        if (typeof this._pinouts === 'undefined') {
            this._pinouts = PinDefinitions.loadDefintionByName(this.controllerType.name);
        }
        return this._pinouts;
    }
    public get spiAdcChips() {
        if (typeof this._spiAdcChips === 'undefined') {
            this._spiAdcChips = SpiAdcChips.loadDefintions();
        }
        return this._spiAdcChips;
    }
    public get analogDevices() {
        //if (typeof this._analogDevices === 'undefined') {
            this._analogDevices = AnalogDevices.loadDefintions();
        //}
        return this._analogDevices;
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
    public resetSpiAdcChips() { this._spiAdcChips = undefined; }
    public resetAnalogDevices() { this._analogDevices = undefined; }
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
    public async setSpiControllerAsync(controllerId: number, data): Promise<SpiController> {
        return new Promise<SpiController>((resolve, reject) => {
            if (isNaN(controllerId) || controllerId < 0 || controllerId > 1) return reject(new Error(`Invalid SPI Controller Id ${controllerId}`));
            let spi: SpiController = cont['spi' + controllerId];
            if (typeof spi === 'undefined') return reject(new Error(`Could not find controller Id ${controllerId}`));
            spi.set(data);
            resolve(spi);
        });
    }
    public async setI2cBusAsync(data): Promise<I2cBus> {
        return new Promise<I2cBus>((resolve, reject) => {
            let bus: I2cBus;
            let id = parseInt(data.id || -1, 10);
            if (isNaN(id)) return reject(new Error(`An invalid I2C id was supplied`));
            let busNumber = parseInt(data.busNumber, 10);
            if (id < 0) {
                // We are adding a new bus.
                if (isNaN(busNumber)) return reject(new Error(`The I2C bus number was not supplied`));
                bus = this.i2c.buses.find(elem => elem.busNumber === busNumber);
                if (typeof bus !== 'undefined') return reject(new Error(`There is already an I2C bus defined at Bus #${busNumber}.`));
                bus = this.i2c.buses.getItemById((this.i2c.buses.getMaxId() || 0) + 1, true);
                bus.set(data);
            }
            else {
                bus = this.i2c.buses.find(elem => elem.id === id);
                if (typeof bus === 'undefined') return reject(new Error(`Could not find I2C bus definition at id ${id}.`));
                if (typeof data.busNumber !== 'undefined') {
                    if (isNaN(busNumber)) return reject(new Error(`An invalid bus number was supplied for the bus ${data.busNumber}`));
                    bus = this.i2c.buses.find(elem => elem.busNumber === busNumber);
                    if (bus.id !== id) return reject(new Error(`Cannot change bus number because another bus shares ${data.busNumber}`));
                }
                bus = this.i2c.buses.getItemById(id);
                bus.set(data);
            }
            resolve(bus);
        });
    }
    public async deletePinTriggerAsync(headerId: number, pinId: number, triggerId: number): Promise<GpioPin> {
        let pin = this.gpio.pins.getPinById(headerId, pinId);
        return new Promise<GpioPin>((resolve, reject) => {
            pin.triggers.removeItemById(triggerId);
            resolve(pin);
        });
    }
    public async setPinStateAsync(data): Promise<GpioPin> {
        return new Promise<GpioPin>((resolve, reject) => {
            let gpioId = parseInt(data.gpioId, 10);
            let headerId = parseInt(data.headerId, 10);
            let pin: GpioPin;
            if (isNaN(gpioId)) {
                let pinId = parseInt(data.pinId || data.id, 10);
                pin = this.gpio.pins.getPinById(headerId, pinId, false);
            }
            else {
                let pinout;
                let pinouts = this.pinouts;
                for (let i = 0; i < pinouts.headers.length; i++) {
                    let head = pinouts.headers[i];
                    if (isNaN(headerId) || headerId === head.id) {
                        let p = head.pins.find(elem => elem.gpioId === gpioId);
                        if (typeof p !== 'undefined') {
                            headerId = head.id;
                            pin = this.gpio.pins.getPinById(head.id, p.id);
                            break;
                        }
                    }
                }
            }
            if (typeof pin !== 'undefined' && pin.isActive) {
                try {
                    pin.state = utils.makeBool(data.state) ? 'on' : 'off';
                    resolve(pin);
                }
                catch (err) { reject(err); }
            }
            else reject(new Error(`Cannot set pin state: Unidentified Pin # -- ${JSON.stringify(data)}`));

        });
    }
    public async reset(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                await gpioPins.reset();
                await connBroker.compile();
                await spi0.resetAsync(this.spi0);
                await spi1.resetAsync(this.spi1);
                await i2c.resetAsync(this.i2c);
                resolve();
            }
            catch (err) { reject(err); }
        });
    }
    public getExtended() {
        let c = this.get(true);
        c.connections = [];
        c.gpio = this.gpio.getExtended();
        c.i2c = this.i2c.getExtended();
        for (let i = 0; i < this.connections.length; i++) {
            c.connections.push(this.connections.getItemByIndex(i).getExtended());
        }
        return c;
    }
    public set(data) {
        super.set(data);
        if (typeof data.spi0 !== 'undefined') this.spi0.set(data.spi0);
        if (typeof data.spi1 !== 'undefined') this.spi1.set(data.spi1);
        if (typeof data.i2c !== 'undefined') this.i2c.set(data.i2c);
    }
}
//export class Interfaces extends ConfigItem {
//    constructor(data, name?: string) { super(data, name || 'interfaces'); }
//    protected initData(data?: any) {
//        if (typeof this.data.spi0 === 'undefined') this.data.spi0 = false;
//        if (typeof this.data.spi1 === 'undefined') this.data.spi1 = false;
//        if (typeof this.data.i2c === 'undefined') this.data.i2c = false;
//        return data;
//    }
//    public get spi0(): boolean { return utils.makeBool(this.data.spi0); }
//    public set spi0(val: boolean) { this.setDataVal('spi0', val); }
//    public get spi1(): boolean { return utils.makeBool(this.data.spi1); }
//    public set spi1(val: boolean) { this.setDataVal('spi1', val); }
//    public get i2c(): boolean { return utils.makeBool(this.data.i2c); }
//    public set i2c(val: boolean) { this.setDataVal('i2c', val); }
//}
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
export class SpiController extends ConfigItem {
    constructor(data, name: string) { super(data, name); }
    public initData(data?: any) {
        if (typeof this.data.isActive === 'undefined') this.isActive = false;
        if (typeof this.data.referenceVoltage === 'undefined') this.referenceVoltage = 3.3;
        if (typeof this.data.spiClock === 'undefined') this.spiClock = 1000;
        if (typeof this.data.channels === 'undefined') this.data.channels = [];
        return data;
    }
    public get isActive(): boolean { return utils.makeBool(this.data.isActive); }
    public set isActive(val: boolean) { this.setDataVal('isActive', val); }
    public get busNumber(): number { return this.data.busNumber; }
    public get adcChipType(): number { return this.data.adcChipType; }
    public set adcChipType(val: number) { this.setDataVal('adcChipType', val); }
    public get referenceVoltage(): number { return this.data.referenceVoltage; }
    public set referenceVoltage(val: number) { this.setDataVal('referenceVoltage', val); }
    public get spiClock(): number { return this.data.spiClock; }
    public set spiClock(val: number) { this.setDataVal('spiClock', val); }
    public get channels(): SpiChannelCollection { return new SpiChannelCollection(this.data, 'channels'); }
    public getExtended() {
        let c = this.get(true);
        c.chipType = cont.spiAdcChips.find(elem => elem.id === this.adcChipType);
        c.channels = [];
        for (let i = 0; i < this.channels.length; i++) {
            c.channels.push(this.channels.getItemByIndex(i).getExtended());
        }
        return c;
    }
}
export class I2cController extends ConfigItem {
    constructor(data, name: string) { super(data, name); }
    public initData(data?: any) {
        if (typeof this.data.isActive === 'undefined') this.isActive = false;
        if (typeof this.data.buses === 'undefined') this.data.buses = [];
        if (typeof this.data.detected === 'undefined') this.data.detected = [];
        return data;
    }
    public get id(): number { return this.data.id; }
    public set id(val: number) { this.setDataVal('id', val); }
    public get isActive(): boolean { return utils.makeBool(this.data.isActive); }
    public set isActive(val: boolean) { this.setDataVal('isActive', val); }
    public get detected(): any[] { return this.data.detected; }
    public set detected(val: any[]) { this.data.detected = val; }
    public get buses(): I2cBusCollection { return new I2cBusCollection(this.data, 'buses'); }
    public getExtended() {
        let c = this.get(true);
        c.buses = this.buses.toExtendedArray();
        return c;
    }
    public async setDevice(dev): Promise<I2cDevice> {
        try {
            let busId = (typeof dev.busId !== 'undefined') ? parseInt(dev.busId, 10) : undefined;
            let busNumber = (typeof dev.busNumber !== 'undefined') ? parseInt(dev.busNumber, 10) : undefined;
            let bus: I2cBus;
            if (typeof busId !== 'undefined') {
                bus = this.buses.getItemById(busId);
                if (typeof bus.busNumber === 'undefined') return Promise.reject(new Error(`An invalid I2c bus id was supplied ${dev.busId}`));
            }
            else if (typeof busNumber !== 'undefined') {
                bus = this.buses.getItemByBusNumber(busNumber);
                if (typeof bus.id === 'undefined') return Promise.reject(new Error(`An invalid I2c bus # was supplied ${dev.busNumber}`));
            }
            else {
                return Promise.reject(new Error(`The specified I2c bus could not be found at busId:${dev.busId} or busNumber:${dev.busNumber}`));
            }
            let device = await bus.setDevice(dev);
            return Promise.resolve(device);
        }
        catch (err) { return Promise.reject(err); }
    }
    public async runDeviceCommand(busNumber: number, address: number, command: string, options: any): Promise<any> {
        try {
            let dbus = i2c.buses.find(elem => elem.busNumber === busNumber);
            if (typeof dbus === 'undefined') return Promise.reject(`Cannot execute command Bus #${busNumber} could not be found`);
            let ddevice = dbus.devices.find(elem => elem.device.address === address);
            if (typeof ddevice === 'undefined') { return Promise.reject(`Cannot execute command Bus #${busNumber} Address ${address} could not be found`); }
            let result = await ddevice.callCommand({ name: command, params: [options] });
            return Promise.resolve(result);
        }
        catch (err) { return Promise.reject(err); }
    }
    public async deleteDevice(dev): Promise<I2cDevice> {
        try {
            let bus = (typeof dev.busId !== 'undefined') ? this.buses.getItemById(dev.busId) : typeof dev.busNumber !== 'undefined' ? this.buses.getItemByBusNumber(dev.busNumber) : undefined;
            if (typeof bus === 'undefined') return Promise.reject(`Could not find bus by bus #${dev.busNumber} or id ${dev.busId}`);
            let device = await bus.deleteDevice(dev);
            return Promise.resolve(device);
        }
        catch (err) { return Promise.reject(err); }
    }
    public async deleteBus(bus): Promise<I2cBus> {
        try {
            let b = (typeof bus.Id !== 'undefined') ? this.buses.getItemById(bus.id) : typeof bus.busNumber !== 'undefined' ? this.buses.getItemByBusNumber(bus.busNumber) : undefined;
            if (typeof b === 'undefined') return Promise.reject(`Could not find bus by bus #${bus.busNumber} or id ${bus.busId}`);
            await b.closeAsync();
            this.buses.removeItemById(b.id);
            return Promise.resolve(bus);
        }
        catch (err) { return Promise.reject(err); }
    }
}
export class I2cBusCollection extends ConfigItemCollection<I2cBus> {
    constructor(data: any, name?: string) { super(data, name) }
    public createItem(data: any): I2cBus { return new I2cBus(data); }
    public getItemByBusNumber(busNumber: number | string, add?: boolean, data?: any): I2cBus {
        let itm = this.find(elem => elem.busNumber === busNumber && typeof elem.busNumber !== 'undefined');
        if (typeof itm !== 'undefined') return itm;
        let id = this.getMaxId() + 1 || 1;
        if (typeof add !== 'undefined' && add) return this.add(data || { id: id, busNumber: busNumber });
        return this.createItem(data || { id: id, busNumber: busNumber });
    }
}

export class I2cBus extends ConfigItem {
    public initData(data?: any) {
        if (typeof this.data.isActive === 'undefined') this.isActive = true;
        if (typeof this.data.devices === 'undefined') this.data.devices = [];
        return data;
    }
    public get id(): number { return this.data.id; }
    public set id(val: number) { this.setDataVal('id', val); }
    public get busNumber(): number { return this.data.busNumber; }
    public set busNumber(val: number) { this.setDataVal('busNumber', val); }
    public get isActive(): boolean { return utils.makeBool(this.data.isActive); }
    public set isActive(val: boolean) { this.setDataVal('isActive', val); }
    public get addresses(): { address: number, name: string, product: number, manufacturer: number }[] { return this.data.addresses || []; }
    public set addresses(val: { address: number, name: string, product: number, manufacturer: number }[]) { this.setDataVal('addresses', val); }
    public get functions(): any { return this.data.functions || {}; }
    public set functions(val: any) { this.setDataVal('functions', val); }
    public get devices(): I2cDeviceCollection { return new I2cDeviceCollection(this.data, 'devices'); }
    public getExtended() {
        let c = this.get(true);
        c.detected = cont.i2c.detected.find(elem => elem.busNumber === this.busNumber);
        c.devices = [];
        for (let i = 0; i < this.devices.length; i++) {
            c.devices.push(this.devices.getItemByIndex(i).getExtended());
        }
        return c;
    }
    public async closeAsync(): Promise<void> {
        try {
            let dbus = i2c.buses.find(elem => elem.busNumber === this.busNumber);
            if (typeof dbus !== 'undefined') {
                await dbus.closeAsync();
            }
            return Promise.resolve();
        }
        catch (err) { return Promise.reject(err); }
    }
    public async setDevice(dev): Promise<I2cDevice> {
        try {
            let id = typeof dev.id !== 'undefined' && dev.id ? parseInt(dev.id, 10) : undefined;
            let address = typeof dev.address !== 'undefined' ? parseInt(dev.address, 10) : undefined;
            let typeId = typeof dev.typeId !== 'undefined' ? parseInt(dev.typeId, 10) : undefined;
            let device: I2cDevice;
            let added = false;
            if (typeof id === 'undefined') {
                // We are adding a device.
                if (typeof address === 'undefined' || isNaN(address) || address < 1) return Promise.reject(new Error(`An valid I2c device address was not supplied ${dev.address}`));
                if (typeof typeId === 'undefined' || isNaN(typeId)) return Promise.reject(new Error(`An invalid device type id was supplied ${dev.typeId}`));
                if (typeof this.devices.find(elem => elem.address === address) !== 'undefined') return Promise.reject(`A device already exists at thes specified address ${address}`);
                id = this.devices.getMaxId() + 1 || 1;
                device = this.devices.getItemById(id, true);
                device.address = address;
                device.typeId = typeId;
                device.options = dev.options || {};
                added = true;
            }
            else {
                if (typeof typeId !== 'undefined') { if (isNaN(typeId)) return Promise.reject(new Error(`An invalid deviceTypeId was supplied ${dev.deviceTypeId}`)); }
                if (typeof address !== 'undefined') {
                    if (isNaN(address) || address < 0) return Promise.reject(new Error(`An invalid I2c address was supplied ${dev.address}`));
                    if (typeof this.devices.find(elem => elem.address === address && elem.id !== id) !== 'undefined') return Promise.reject(`A device already exists at thes specified address ${address}`);
                }
                if (typeof id !== 'undefined') {
                    if (isNaN(id)) return Promise.reject(new Error(`An invalid device id was supplied ${dev.id}`));
                    device = this.devices.getItemById(id);
                }
                else if (typeof address !== 'undefined') {
                    device = this.devices.getItemByAddress(address);
                }
            }
            // At this point we should have our device.
            if (typeof dev.typeId !== 'undefined' && typeId !== device.typeId) {
                // If the type has changed clear out the options;
                device.typeId = typeId;
                device.options = {};
            } 
            if (typeof dev.address !== 'undefined' && address !== device.address) device.address = address;
            if (typeof dev.sampling !== 'undefined' && !isNaN(parseInt(dev.sampling, 10))) device.sampling = parseInt(dev.sampling, 10);
            if (typeof dev.isActive !== 'undefined') device.isActive = utils.makeBool(dev.isActive);
            // Need to deal with the triggers and feeds.
            //if (typeof dev.options !== 'undefined') {
            //    let op = Object.getOwnPropertyNames(dev.options);
            //    for (let i in op) {
            //        let prop = op[i];
            //        if (typeof this[prop] === 'function') continue;
            //        if (typeof dev.options[prop] !== 'undefined') {
            //            device.options[prop] = dev.options[prop];
            //        }
            //    }
            //}
            let dbus = i2c.buses.find(elem => elem.busNumber === this.busNumber);
            if (typeof dbus !== 'undefined') {
                let ddev = dbus.devices.find(elem => elem.device.id === device.id);
                if (typeof ddev === 'undefined') {
                    await dbus.addDevice(device);
                }
                else {
                    if (typeof dev.options !== 'undefined') await ddev.setOptions(dev.options);
                }
            }
            let addr = this.addresses.find(elem => elem.address === device.address);
            if (typeof addr !== 'undefined') addr.name = device.name;
            return Promise.resolve(device);
        }
        catch (err) { return Promise.reject(err); }
    }
    public async deleteDevice(dev): Promise<I2cDevice> {
        try {
            let id = parseInt(dev.id, 10);
            if (isNaN(id)) return Promise.reject(`Cannot delete device. Invalid device id ${dev.id}`);
            let dbus = i2c.buses.find(elem => elem.busNumber == this.busNumber);
            if (typeof dbus !== 'undefined') {
                dbus.devices.forEach(async (item, index) => {
                    if (item.device.id === id) {
                        dbus.devices.splice(index, 1);
                        await item.closeAsync();
                    }
                });
            }
            let device = this.devices.getItemById(id);
            this.devices.removeItemById(id);
            let addr = this.addresses.find(elem => elem.address === device.address);
            if (typeof addr !== 'undefined') addr.name = 'Unknown';
            return Promise.resolve(device);
        }
        catch (err) { return Promise.reject(err); }
    }
}
export class I2cDeviceCollection extends ConfigItemCollection<I2cDevice> {
    constructor(data: any, name?: string) { super(data, name || 'devices') }
    public createItem(data: any): I2cDevice { return new I2cDevice(data); }
    public getItemByAddress(address: number | string, add?: boolean, data?: any): I2cDevice {
        let itm = this.find(elem => elem.address === address && typeof elem.address !== 'undefined');
        if (typeof itm !== 'undefined') return itm;
        let id = this.getMaxId() + 1 || 1;
        if (typeof add !== 'undefined' && add) return this.add(data || { id: id, address: address });
        return this.createItem(data || { address: address });
    }
}
export class I2cDevice extends ConfigItem {
    constructor(data) { super(data); }
    public initData(data?: any) {
        if (typeof this.data.values === 'undefined') this.values = {};
        if (typeof this.data.options === 'undefined') this.options = {};
        if (typeof this.data.info === 'undefined') this.info = {};
    }
    public get id(): number { return this.data.id; }
    public set id(val: number) { this.setDataVal('id', val); }
    public get name(): string { return this.data.name; }
    public set name(val: string) { this.setDataVal('name', val); }
    public get isActive(): boolean { return utils.makeBool(this.data.isActive); }
    public set isActive(val: boolean) { this.setDataVal('isActive', val); }
    public get typeId(): number { return this.data.typeId; }
    public set typeId(val: number) { this.setDataVal('typeId', val); }
    public get address(): number { return this.data.address; }
    public set address(val: number) { this.setDataVal('address', val); }
    public get feeds(): I2cDeviceFeedCollection { return new I2cDeviceFeedCollection(this.data, 'feeds'); }
    public get options(): any { return typeof this.data.options === 'undefined' ? this.data.options = {} : this.data.options; }
    public set options(val: any) { this.setDataVal('options', val || {}); }
    public get info(): any { return typeof this.data.info === 'undefined' ? this.data.info = {} : this.data.info; }
    public set info(val: any) { this.setDataVal('info', val || {}); }
    public get values(): any { return typeof this.data.values === 'undefined' ? this.data.values = {} : this.data.values; }
    public set values(val: any) { this.setDataVal('values', val || {}); }
    public get sampling(): number { return this.data.sampling; }
    public set sampling(val: number) { this.setDataVal('sampling', val); }
    public getExtended() {
        let dev = this.get(true);
        dev.deviceType = cont.analogDevices.find(elem => elem.id === this.typeId);
        dev.feeds = [];
        for (let i = 0; i < this.feeds.length; i++) {
            dev.feeds.push(this.feeds.getItemByIndex(i).getExtended());
        }
        return dev;
    }
    public getDeviceType() {
        return cont.analogDevices.find(elem => elem.id === this.typeId);
    }
}
export class I2cDeviceFeedCollection extends ConfigItemCollection<I2cDeviceFeed> {
    constructor(data: any, name?: string) { super(data, name || 'feeds') }
    public createItem(data: any): I2cDeviceFeed { return new I2cDeviceFeed(data); }
}
export class I2cDeviceFeed extends ConfigItem {
    constructor(data) { super(data); }
    public initData(data?: any) {
        if (typeof this.data.isActive === 'undefined') this.isActive = false;
        if (typeof this.data.changesOnly === 'undefined') this.changesOnly = true;
        return data;
    }
    public get id(): number { return this.data.id; }
    public set id(val: number) { this.setDataVal('id', val); }
    public get connectionId(): number { return this.data.connectionId; }
    public set connectionId(val: number) { this.setDataVal('connectionId', val); }
    public get isActive(): boolean { return utils.makeBool(this.data.isActive); }
    public set isActive(val: boolean) { this.setDataVal('isActive', val); }
    public get eventName(): string { return this.data.eventName; }
    public set eventName(val: string) { this.setDataVal('eventName', val); }
    public get property(): string { return this.data.property; }
    public set property(val: string) { this.setDataVal('property', val); }
    public get frequency(): number { return this.data.frequency; }
    public set frequency(val: number) { this.setDataVal('frequency', val); }
    public get changesOnly(): boolean { return utils.makeBool(this.data.changesOnly); }
    public set changesOnly(val: boolean) { this.setDataVal('changesOnly', val); }
    public get payloadExpression(): string { return this.data.payloadExpression; }
    public set payloadExpression(val: string) { this.setDataVal('payloadExpression', val); }
    public getExtended() {
        let feed = this.get(true);
        feed.connection = cont.connections.getItemById(this.connectionId).getExtended();
        return feed;
    }

}




export class SpiChannelCollection extends ConfigItemCollection<SpiChannel> {
    constructor(data: any, name?: string) { super(data, name || 'channels') }
    public createItem(data: any): SpiChannel { return new SpiChannel(data); }
}
export class SpiChannel extends ConfigItem {
    constructor(data) { super(data); }
    public initData(data?: any) {
        if (typeof this.data.isActive === 'undefined') this.isActive = false;
        if (typeof this.data.feeds === 'undefined') this.data.feeds = [];
        return data;
    }
    public get id(): number { return this.data.id; }
    public set id(val: number) { this.setDataVal('id', val); }
    public get isActive(): boolean { return utils.makeBool(this.data.isActive); }
    public set isActive(val: boolean) { this.setDataVal('isActive', val); }
    public get deviceId(): number { return this.data.deviceId; }
    public set deviceId(val: number) { this.setDataVal('deviceId', val); }
    public get feeds(): SpiChannelFeedCollection { return new SpiChannelFeedCollection(this.data, 'feeds'); }
    public get options(): any { return this.data.options; }
    public set options(val: any) { this.data.options = val; }
    public get sampling(): number { return this.data.sampling; }
    public set sampling(val: number) { this.setDataVal('sampling', val); }
    public getExtended() {
        let chan = this.get(true);
        chan.device = cont.analogDevices.find(elem => elem.id === this.deviceId);
        chan.feeds = [];
        for (let i = 0; i < this.feeds.length; i++) {
            chan.feeds.push(this.feeds.getItemByIndex(i).getExtended());
        }
        return chan;
    }
}
export class SpiChannelFeedCollection extends ConfigItemCollection<SpiChannelFeed> {
    constructor(data: any, name?: string) { super(data, name || 'feeds') }
    public createItem(data: any): SpiChannelFeed { return new SpiChannelFeed(data); }
}
export class SpiChannelFeed extends ConfigItem {
    constructor(data) { super(data); }
    public initData(data?: any) {
        if (typeof this.data.isActive === 'undefined') this.isActive = false;
        if (typeof this.data.changesOnly === 'undefined') this.changesOnly = true;
        return data;
    }
    public get id(): number { return this.data.id; }
    public set id(val: number) { this.setDataVal('id', val); }
    public get connectionId(): number { return this.data.connectionId; }
    public set connectionId(val: number) { this.setDataVal('connectionId', val); }
    public get isActive(): boolean { return utils.makeBool(this.data.isActive); }
    public set isActive(val: boolean) { this.setDataVal('isActive', val); }
    public get eventName(): string { return this.data.eventName; }
    public set eventName(val: string) { this.setDataVal('eventName', val); }
    public get property(): string { return this.data.property; }
    public set property(val: string) { this.setDataVal('property', val); }
    public get frequency(): number { return this.data.frequency; }
    public set frequency(val: number) { this.setDataVal('frequency', val); }
    public get changesOnly(): boolean { return utils.makeBool(this.data.changesOnly); }
    public set changesOnly(val: boolean) { this.setDataVal('changesOnly', val); }
    public get payloadExpression(): string { return this.data.payloadExpression; }
    public set payloadExpression(val: string) { this.setDataVal('payloadExpression', val); }
    public getExtended() {
        let feed = this.get(true);
        feed.connection = cont.connections.getItemById(this.connectionId).getExtended();
        return feed;
    }

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
        let mv = this.getMapVal(val, vMaps.pinStates);
        if (typeof mv !== 'undefined') {
            if (mv.gpio !== 'undefined' && this.isActive) {
                gpioPins.writePinAsync(this.headerId, this.id, mv.gpio)
                    .then(() => {
                        this.setMapVal('state', val, vMaps.pinStates);
                    })
                    .catch(err => logger.error(err));
            }
            else this.setMapVal('state', val, vMaps.pinStates);
        }
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
        pin.isExported = typeof cont.gpio.exported.find(elem => elem === pin.gpioId) !== 'undefined';
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
    public get options(): any { return typeof this.data.optons === 'undefined' ? this.data.options = {} : this.data.options; }
    public set options(val: any) { this.setDataVal('options', val); }
}

export let cont = new Controller({});
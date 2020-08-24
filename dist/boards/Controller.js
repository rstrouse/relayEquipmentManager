"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const fs = require("fs");
const extend = require("extend");
const util = require("util");
const timers_1 = require("timers");
const Logger_1 = require("../logger/Logger");
const Server_1 = require("../web/Server");
const Constants_1 = require("./Constants");
const Pinouts_1 = require("../pinouts/Pinouts");
const Bindings_1 = require("../connections/Bindings");
const GpioPins_1 = require("./GpioPins");
class ConfigItem {
    constructor(data, name) {
        this.hasChanged = false;
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
    initData(data) { return data; }
    setDataVal(name, val, persist) {
        if (this.data[name] !== val) {
            // console.log(`Changing equipment: ${this.dataName} ${this.data.id} ${name}:${this.data[name]} --> ${val}`);
            this.data[name] = val;
            if (typeof persist === 'undefined' || persist)
                this.hasChanged = true;
        }
        else if (typeof persist !== 'undefined' && persist)
            this.hasChanged = true;
    }
    setMapVal(name, val, map, persist) {
        if (typeof val === 'number') {
            // Map this to the string value.
            let m = map.transform(val);
            this.setDataVal(name, m.name, persist);
        }
        else if (typeof val === 'string')
            this.setDataVal(name, val, persist);
        else if (typeof val === 'undefined')
            this.setDataVal(name, val, persist);
        else if (typeof val.val === 'number')
            this.setMapVal(name, val.val, map, persist);
        else if (typeof val.name === 'string')
            this.setDataVal(name, val.name, persist);
        else
            this.setDataVal(name, val, persist);
    }
    getMapVal(val, map) {
        if (typeof val === 'number')
            return map.transform(val);
        return map.transformByName(val);
    }
    get(bCopy) { return bCopy ? JSON.parse(JSON.stringify(this.data)) : this.data; }
    getExtended() { return this.get(true); }
    set(data) {
        let op = Object.getOwnPropertyNames(Object.getPrototypeOf(this));
        for (let i in op) {
            let prop = op[i];
            if (typeof this[prop] === 'function')
                continue;
            if (typeof data[prop] !== 'undefined') {
                if (this[prop] instanceof ConfigItemCollection) {
                    this[prop].set(data[prop]);
                }
                else if (this[prop] instanceof ConfigItem)
                    this[prop].set(data[prop]);
                else {
                    if (typeof this[prop] === null || typeof data[prop] === null)
                        continue;
                    this[prop] = data[prop];
                }
            }
        }
    }
}
class ConfigItemCollection {
    constructor(data, name) {
        if (typeof data[name] === 'undefined')
            data[name] = [];
        this.data = data[name];
        this.name = name;
    }
    getItemByIndex(ndx, add, data) {
        if (this.data.length > ndx)
            return this.createItem(this.data[ndx]);
        if (typeof add !== 'undefined' && add)
            return this.add(extend({}, { id: ndx + 1 }, data));
        return this.createItem(extend({}, { id: ndx + 1 }, data));
    }
    getItemById(id, add, data) {
        let itm = this.find(elem => elem.id === id && typeof elem.id !== 'undefined');
        if (typeof itm !== 'undefined')
            return itm;
        if (typeof add !== 'undefined' && add)
            return this.add(data || { id: id });
        return this.createItem(data || { id: id });
    }
    removeItemById(id) {
        let rem = null;
        for (let i = this.data.length - 1; i >= 0; i--)
            if (typeof this.data[i].id !== 'undefined' && this.data[i].id === id) {
                rem = this.data.splice(i, 1);
                return rem;
            }
        return rem;
    }
    set(data) {
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
    removeItemByIndex(ndx) {
        this.data.splice(ndx, 1);
    }
    // Finds an item and returns undefined if it doesn't exist.
    find(f) {
        let itm = this.data.find(f);
        if (typeof itm !== 'undefined')
            return this.createItem(itm);
    }
    // This will return a new collection of this type. NOTE: This is a separate object but the data is still attached to the
    // overall configuration.  This meanse that changes made to the objects in the collection will reflect in the configuration.
    // HOWEVER, any of the array manipulation methods like removeItemBy..., add..., or creation methods will not modify the configuration.
    filter(f) {
        return new ConfigItemCollection(this.data.filter(f), this.name);
    }
    toArray() {
        let arr = [];
        if (typeof this.data !== 'undefined') {
            for (let i = 0; i < this.data.length; i++) {
                arr.push(this.createItem(this.data[i]));
            }
        }
        return arr;
    }
    toExtendedArray() {
        let arr = [];
        if (typeof this.data !== 'undefined') {
            for (let i = 0; i < this.data.length; i++) {
                arr.push(this.createItem(this.data[i]).getExtended());
            }
        }
        return arr;
    }
    createItem(data) { return new ConfigItem(data); }
    clear() { this.data.length = 0; }
    get length() { return typeof this.data !== 'undefined' ? this.data.length : 0; }
    set length(val) { if (typeof val !== 'undefined' && typeof this.data !== 'undefined')
        this.data.length = val; }
    add(obj) { this.data.push(obj); return this.createItem(obj); }
    get() { return this.data; }
    emitEquipmentChange() { Server_1.webApp.emitToClients(this.name, this.data); }
    sortByName() {
        this.sort((a, b) => {
            return a.name > b.name ? 1 : a.name !== b.name ? -1 : 0;
        });
    }
    sortById() {
        this.sort((a, b) => {
            return a.id > b.id ? 1 : a.id !== b.id ? -1 : 0;
        });
    }
    sort(fn) { this.data.sort(fn); }
    getMaxId(activeOnly, defId) {
        let maxId;
        for (let i = 0; i < this.data.length; i++) {
            if (typeof this.data[i].id !== 'undefined') {
                if (activeOnly === true && this.data[i].isActive === false)
                    continue;
                maxId = Math.max(maxId || 0, this.data[i].id);
            }
        }
        return typeof maxId !== 'undefined' ? maxId : defId;
    }
    getMinId(activeOnly, defId) {
        let minId;
        for (let i = 0; i < this.data.length; i++) {
            if (typeof this.data[i].id !== 'undefined') {
                if (typeof activeOnly !== 'undefined' && this.data[i].isActive === false)
                    continue;
                minId = Math.min(minId || this.data[i].id, this.data[i].id);
            }
        }
        return typeof minId !== 'undefined' ? minId : defId;
    }
}
class Controller extends ConfigItem {
    constructor(data) {
        super(data);
        this._timerDirty = null;
        this.onchange = (obj, fn) => {
            const handler = {
                get(target, property, receiver) {
                    // console.log(`getting prop: ${property} -- dataName? ${target.length}`)
                    const val = Reflect.get(target, property, receiver);
                    if (typeof val === 'function')
                        return val.bind(receiver);
                    if (typeof val === 'object' && val !== null) {
                        if (util.types.isProxy(val))
                            return val;
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
                    if (property in target)
                        Reflect.deleteProperty(target, property);
                    return true;
                }
            };
            return new Proxy(obj, handler);
        };
        this.cfgPath = path.posix.join(process.cwd(), '/data/controllerConfig.json');
    }
    init() {
        let cfg = this.loadConfigFile(this.cfgPath, {});
        let cfgDefault = this.loadConfigFile(path.posix.join(process.cwd(), '/defaultController.json'), {});
        cfg = extend(true, {}, cfgDefault, cfg);
        this.data = this.onchange(cfg, function () { exports.cont.dirty = true; });
        this.gpio = new Gpio(this.data, 'gpio');
        this.connections = new ConnectionSourceCollection(this.data, 'connections');
    }
    async stopAsync() {
        if (this._timerChanges)
            clearTimeout(this._timerChanges);
        if (this._timerDirty)
            clearTimeout(this._timerDirty);
        return this; // Allow chaining.
    }
    get dirty() { return this._isDirty; }
    set dirty(val) {
        this._isDirty = val;
        this._lastUpdated = new Date();
        this.data.lastUpdated = this._lastUpdated.toLocaleString();
        if (this._timerDirty !== null) {
            clearTimeout(this._timerDirty);
            this._timerDirty = null;
        }
        if (this._isDirty) {
            this._timerDirty = timers_1.setTimeout(() => this.persist(), 3000);
        }
    }
    persist() {
        this._isDirty = false;
        // Don't overwrite the configuration if we failed during the initialization.
        Promise.resolve()
            .then(() => { fs.writeFileSync(this.cfgPath, JSON.stringify(this.data, undefined, 2)); })
            .catch(function (err) { if (err)
            Logger_1.logger.error('Error writing controller config %s %s', err, this.cfgPath); });
    }
    get controllerType() { return this.getMapVal(this.data.controllerType, Constants_1.vMaps.controllerTypes); }
    set controllerType(val) {
        let old = this.data.controllerType;
        this.setMapVal('controllerType', val, Constants_1.vMaps.controllerTypes);
        if (old !== val)
            this._pinouts = undefined;
    }
    loadConfigFile(path, def) {
        let cfg = def;
        if (fs.existsSync(path)) {
            try {
                cfg = JSON.parse(fs.readFileSync(path, 'utf8') || '{}');
            }
            catch (ex) {
                cfg = def;
            }
        }
        return cfg;
    }
    get pinouts() {
        if (typeof this._pinouts === 'undefined') {
            this._pinouts = Pinouts_1.PinDefinitions.loadDefintionByName(this.controllerType.name);
        }
        return this._pinouts;
    }
    /**************************************************
     * Api Methods
     *************************************************/
    async setGeneralConfigAsync(data) {
        return new Promise((resolve, reject) => {
            this.set(data);
            resolve();
        });
    }
    async setConnectionAsync(data) {
        let c = this.connections.find(elem => elem.id === data.id);
        if (typeof c === 'undefined') {
            data.id = this.connections.getMaxId(false, -1) + 1;
            if (data.id === 0)
                data.id = 1;
        }
        return new Promise((resolve, reject) => {
            let conn = this.connections.getItemById(data.id, true);
            conn.set(data);
            resolve(conn);
        });
    }
    async deleteConnectionAsync(id) {
        let conn = this.connections.getItemById(id);
        return new Promise((resolve, reject) => {
            for (let i = 0; i < this.gpio.pins.length; i++) {
                let pin = this.gpio.pins.getItemByIndex(i);
                for (let j = 0; j < pin.triggers.length; j++)
                    pin.triggers.removeItemByIndex(j);
            }
            Bindings_1.connBroker.deleteConnection(id);
            this.connections.removeItemById(id);
            conn.isActive = false;
            resolve(conn);
        });
    }
    async setPinAsync(headerId, pinId, data) {
        let pin = this.gpio.pins.getPinById(headerId, pinId, true);
        return new Promise((resolve, reject) => {
            pin.set(data);
            resolve(pin);
        });
    }
    async setPinTriggerAsync(headerId, pinId, data) {
        let pin = this.gpio.pins.getPinById(headerId, pinId, true);
        let c = pin.triggers.find(elem => elem.id === data.id);
        if (typeof c === 'undefined') {
            data.id = pin.triggers.getMaxId(false, -1) + 1;
            if (data.id === 0)
                data.id = 1;
        }
        return new Promise((resolve, reject) => {
            let trig = pin.triggers.getItemById(data.id, true);
            trig.set(data);
            if (typeof data.equipmentId === 'undefined')
                trig.equipmentId = undefined;
            resolve(trig);
        });
    }
    async deletePinTriggerAsync(headerId, pinId, triggerId) {
        let pin = this.gpio.pins.getPinById(headerId, pinId);
        return new Promise((resolve, reject) => {
            pin.triggers.removeItemById(triggerId);
            resolve(pin);
        });
    }
    async reset() {
        return new Promise(async (resolve, reject) => {
            try {
                await GpioPins_1.gpioPins.reset();
                await Bindings_1.connBroker.compile();
                resolve();
            }
            catch (err) {
                reject(err);
            }
        });
    }
    getExtended() {
        let cont = this.get(true);
        cont.connections = [];
        cont.gpio = this.gpio.getExtended();
        for (let i = 0; i < this.connections.length; i++) {
            cont.connections.push(this.connections.getItemByIndex(i).getExtended());
        }
        return cont;
    }
}
exports.Controller = Controller;
class Gpio extends ConfigItem {
    constructor(data, name) { super(data, name || 'gpio'); }
    initData(data) {
        if (typeof this.data.pins === 'undefined')
            this.data.pins = [];
        return data;
    }
    get pins() { return new GpioPinCollection(this.data, 'pins'); }
}
exports.Gpio = Gpio;
class GpioPinCollection extends ConfigItemCollection {
    constructor(data, name) { super(data, name || 'pins'); }
    createItem(data) { return new GpioPin(data); }
    getPinById(headerId, pinId, add, data) {
        let pin = this.find(elem => elem.headerId === headerId && elem.id === pinId);
        if (typeof pin !== 'undefined')
            return pin;
        if (typeof add !== 'undefined' && add)
            return this.add(data || { id: pinId, headerId: headerId });
        return this.createItem(data || { id: pinId, headerId: headerId });
    }
}
exports.GpioPinCollection = GpioPinCollection;
class GpioPin extends ConfigItem {
    constructor(data) { super(data); }
    initData(data) {
        if (typeof this.data.isInverted === 'undefined')
            this.isInverted = false;
        if (typeof this.data.direction === 'undefined')
            this.direction = 'output';
        if (typeof this.data.triggers === 'undefined')
            this.data.triggers = [];
        return data;
    }
    get id() { return this.data.id; }
    set id(val) { this.setDataVal('id', val); }
    get isActive() { return Constants_1.utils.makeBool(this.data.isActive); }
    set isActive(val) { this.setDataVal('isActive', val); }
    get headerId() { return this.data.headerId; }
    set headerId(val) { this.setDataVal('headerId', val); }
    get direction() { return this.getMapVal(this.data.direction, Constants_1.vMaps.pinDirections); }
    set direction(val) { this.setMapVal('direction', val, Constants_1.vMaps.pinDirections); }
    get type() { return this.getMapVal(this.data.type, Constants_1.vMaps.pinTypes); }
    set type(val) { this.setMapVal('type', val, Constants_1.vMaps.pinTypes); }
    get isInverted() { return Constants_1.utils.makeBool(this.data.isInverted); }
    set isInverted(val) { this.setDataVal('isInverted', val); }
    get state() { return this.getMapVal(this.data.state || 'unknown', Constants_1.vMaps.pinStates); }
    set state(val) {
        this.setMapVal('state', val, Constants_1.vMaps.pinStates);
        let mv = this.getMapVal(this.data.state, Constants_1.vMaps.pinStates);
        if (typeof mv !== 'undefined' && mv.gpio !== 'undefined')
            GpioPins_1.gpioPins.writePinAsync(this.headerId, this.id, mv.gpio);
    }
    get triggers() { return new GpioPinTriggerCollection(this.data, 'triggers'); }
    getExtended() {
        let pin = this.get(true);
        pin.triggers = [];
        let pinouts = exports.cont.pinouts;
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
exports.GpioPin = GpioPin;
class GpioPinTriggerCollection extends ConfigItemCollection {
    constructor(data, name) { super(data, name || 'triggers'); }
    createItem(data) { return new GpioPinTrigger(data); }
}
exports.GpioPinTriggerCollection = GpioPinTriggerCollection;
class GpioPinTrigger extends ConfigItem {
    constructor(data) { super(data); }
    initData(data) {
        if (typeof this.data.isActive === 'undefined')
            this.isActive = false;
        return data;
    }
    get id() { return this.data.id; }
    set id(val) { this.setDataVal('id', val); }
    get isActive() { return Constants_1.utils.makeBool(this.data.isActive); }
    set isActive(val) { this.setDataVal('isActive', val); }
    get sourceId() { return this.data.sourceId; }
    set sourceId(val) { this.setDataVal('sourceId', val); }
    get state() { return this.getMapVal(this.data.state || 0, Constants_1.vMaps.triggerStates); }
    set state(val) { this.setMapVal('state', val, Constants_1.vMaps.triggerStates); }
    getExtended() {
        let trigger = this.get(true);
        trigger.state = this.state;
        trigger.connection = exports.cont.connections.getItemById(this.sourceId).getExtended();
        trigger.filter = this.filter;
        return trigger;
    }
    get eventName() { return this.data.eventName; }
    set eventName(val) { this.setDataVal('eventName', val); }
    get equipmentId() { return this.data.equipmentId; }
    set equipmentId(val) { this.setDataVal('equipmentId', val); }
    get binding() { return this.data.binding; }
    set binding(val) { this.setDataVal('binding', val); }
    get operator() { return this.getMapVal(this.data.operator || 0, Constants_1.vMaps.operators); }
    set operator(val) { this.setMapVal('operator', val, Constants_1.vMaps.operators); }
    get expression() { return this.data.expression; }
    set expression(val) { this.setDataVal('expression', val); }
    get bindValue() { return this.data.bindValue; }
    set bindValue(val) { this.setDataVal('bindValue', val); }
    get filter() {
        let filter = '';
        if (typeof this.equipmentId !== 'undefined') {
            filter += ('id == ' + this.equipmentId);
        }
        if (typeof this.binding !== 'undefined') {
            if (filter.length > 0)
                filter += ' && ';
            filter += (this.binding + ' ');
            if (typeof this.operator !== 'undefined')
                filter += (this.operator.op + ' ');
            if (typeof this.bindValue !== 'undefined')
                filter += (this.bindValue + ' ');
        }
        return filter;
    }
    makeExpression(dataName, usePinId) {
        let expression = '';
        if (usePinId === true && typeof this.equipmentId === 'undefined') {
            expression = 'if(data.pinId != pin.id) return false; else ';
        }
        expression += 'return ';
        if (typeof this.equipmentId !== 'undefined') {
            expression += (`${dataName}.id == ${this.equipmentId} `);
            if (typeof this.binding !== 'undefined')
                expression += ' && ';
        }
        if (typeof this.binding !== 'undefined') {
            expression += (`${dataName}.${this.binding} `);
            if (typeof this.operator !== 'undefined')
                expression += (this.operator.op + ' ');
            if (typeof this.bindValue !== 'undefined')
                expression += (`${this.bindValue}`);
        }
        return expression;
    }
}
exports.GpioPinTrigger = GpioPinTrigger;
class ConnectionSourceCollection extends ConfigItemCollection {
    constructor(data, name) { super(data, name || 'connections'); }
    createItem(data) { return new ConnectionSource(data); }
}
exports.ConnectionSourceCollection = ConnectionSourceCollection;
class ConnectionSource extends ConfigItem {
    constructor(data) { super(data); }
    initData(data) {
        if (typeof this.data.isActive === 'undefined')
            this.isActive = false;
        return data;
    }
    get id() { return this.data.id; }
    set id(val) { this.setDataVal('id', val); }
    get name() { return this.data.name; }
    set name(val) { this.setDataVal('name', val); }
    get isActive() { return Constants_1.utils.makeBool(this.data.isActive); }
    set isActive(val) { this.setDataVal('isActive', val); }
    get type() { return this.getMapVal(this.data.type || 0, Constants_1.vMaps.connectionTypes); }
    set type(val) { this.setMapVal('type', val, Constants_1.vMaps.connectionTypes); }
    get protocol() { return this.data.protocol; }
    set protocol(val) { this.setDataVal('protocol', val); }
    get ipAddress() { return this.data.ipAddress; }
    set ipAddress(val) { this.setDataVal('ipAddress', val); }
    get port() { return this.data.port; }
    set port(val) { this.setDataVal('port', val); }
    get userName() { return this.data.userName; }
    set userName(val) { this.setDataVal('userName', val); }
    get password() { return this.data.password; }
    set password(val) { this.setDataVal('password', val); }
    get sslKeyFile() { return this.data.sslKeyFile; }
    set sslKeyFile(val) { this.setDataVal('sslKeyFile', val); }
    get sslCertFile() { return this.data.sslCertFile; }
    set sslCertFile(val) { this.setDataVal('sslCertFile', val); }
    getExtended() {
        let src = this.get(true);
        src.type = this.type;
        return src;
    }
    get url() {
        let port = typeof this.port !== 'undefined' ? ':' + this.port.toString() : '';
        return `${this.protocol}//${this.ipAddress}${port}`;
    }
}
exports.ConnectionSource = ConnectionSource;
exports.cont = new Controller({});
//# sourceMappingURL=Controller.js.map
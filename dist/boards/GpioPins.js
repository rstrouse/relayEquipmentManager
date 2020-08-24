"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const extend = require("extend");
const Logger_1 = require("../logger/Logger");
const Constants_1 = require("./Constants");
const Controller_1 = require("../boards/Controller");
const gp = require('onoff').Gpio;
class GpioController {
    constructor(data) {
        this.pins = [];
    }
    init() {
        this.initPins();
        return this;
    }
    async stopAsync() {
        Logger_1.logger.info(`Stopping GPIO Controller`);
        for (let i = this.pins.length - 1; i >= 0; i--) {
            this.pins[i].gpio.unexport();
            this.pins.splice(i, 1);
        }
        return this;
    }
    reset() {
        this.stopAsync();
        this.init();
    }
    initPins() {
        let pinouts = Controller_1.cont.pinouts;
        Logger_1.logger.info(`Initializing GPIO Pins ${Controller_1.cont.gpio.pins.length}`);
        for (let i = 0; i < Controller_1.cont.gpio.pins.length; i++) {
            let pinDef = Controller_1.cont.gpio.pins.getItemByIndex(i);
            if (!pinDef.isActive)
                continue;
            let pinoutHeader = pinouts.headers.find(elem => elem.id === pinDef.headerId);
            if (typeof pinoutHeader !== 'undefined') {
                let pinout = pinoutHeader.pins.find(elem => elem.id === pinDef.id);
                if (typeof pinout !== 'undefined') {
                    let pin = this.pins.find(elem => elem.pinId === pinDef.id && elem.headerId === -pinDef.headerId);
                    if (typeof pin === 'undefined') {
                        pin = { headerId: pinDef.headerId, pinId: pinDef.id };
                        this.pins.push(pin);
                        if (gp.accessible) {
                            Logger_1.logger.info(`Configuring Pin #${pinDef.id} Gpio #${pinout.gpioId} on Header ${pinDef.headerId}.`);
                            pin.gpio = gp(pinout.gpioId, pinDef.direction.name, 'none', { activeLow: pinDef.isInverted, reconfigureDirection: false });
                        }
                        else {
                            Logger_1.logger.info(`Configuring Mock Pin #${pinDef.id} Gpio #${pinout.gpioId} on Header ${pinDef.headerId}.`);
                            pin.gpio = new MockGpio(pinout.gpioId, pinDef.direction.name, 'none', { activeLow: pinDef.isInverted, reconfigureDirection: false });
                        }
                    }
                }
                else
                    Logger_1.logger.error(`Pin #${pinDef.id} does not exist on Header ${pinDef.headerId}.`);
            }
            else
                Logger_1.logger.error(`Cannot find Pin #${pinDef.id} for Header ${pinDef.headerId}.  Header does not exist on this board.`);
        }
    }
    readPinAsync(headerId, pinId) {
        let pin = this.pins.find(elem => elem.headerId === headerId && elem.pinId === pinId);
        if (typeof pin === 'undefined')
            return Promise.reject(new Error('Invalid pin. Could not find pin in controller.'));
        return new Promise(async (resolve, reject) => {
            try {
                let val = await pin.gpio.readSync();
                resolve(val);
            }
            catch (err) {
                reject(err);
            }
        });
    }
    async writePinAsync(headerId, pinId, val) {
        let pin = this.pins.find(elem => elem.headerId === headerId && elem.pinId === pinId);
        if (typeof pin === 'undefined')
            return Promise.reject(new Error('Invalid pin. Could not find pin in controller.'));
        return new Promise(async (resolve, reject) => {
            try {
                await pin.gpio.writeSync(val);
                resolve();
            }
            catch (err) {
                reject(err);
            }
        });
    }
}
exports.GpioController = GpioController;
class MockGpio {
    constructor(pinId, direction, edge, options) {
        this._watches = [];
        this._isExported = false;
        this._pinId = pinId;
        this._direction = direction;
        this._edge = edge;
        this._opts = extend(true, { activeLow: false, debounceTimeout: 0, reconfigureDirection: true }, options);
        this._value = 0;
        this._isExported = true;
    }
    read(callback) {
        if (typeof callback !== 'undefined')
            callback(this.checkExported(), this._value);
        else
            return Promise.resolve(this._value);
    }
    readSync() { return new Promise((resolve, reject) => { !this._isExported ? reject(this.checkExported()) : resolve(this._value); }); }
    write(val, callback) {
        let prom;
        if (this._direction === 'in') {
            let err = !this._isExported ? this.notExportedError : new Error(`EPERM: Pin #${this._pinId} Write operation is not permitted.`);
            if (err)
                Logger_1.logger.error(err);
            if (typeof callback !== 'undefined')
                callback(err, this._value = val);
            else
                prom = Promise.reject(err);
            this.setValueInternal(err, this._value);
        }
        else {
            if (typeof callback !== 'undefined')
                callback(this.checkExported(), this._value = val);
            else
                prom = !this._isExported ? Promise.reject(this.notExportedError()) : Promise.resolve(val);
            this.setValueInternal(undefined, val);
        }
        return prom;
    }
    writeSync(val) {
        let prom;
        if (this._direction === 'in') {
            let err = !this._isExported ? this.notExportedError : new Error(`EPERM: Pin #${this._pinId} Write operation is not permitted.`);
            if (err)
                Logger_1.logger.error(err);
            prom = Promise.reject(err);
            this.setValueInternal(err, this._value);
        }
        else {
            prom = !this._isExported ? Promise.reject(this.notExportedError()) : Promise.resolve(val);
            this.setValueInternal(undefined, val);
        }
        return prom;
    }
    watch(callback) {
        Logger_1.logger.info(`Watching Pin #${this._pinId}`);
        this._watches.push(callback);
    }
    unwatch(callback) {
        if (typeof callback === 'undefined')
            this.unwatchAll();
        else {
            Logger_1.logger.info(`Unwatch Pin #${this._pinId} callback`);
            for (let i = this._watches.length - 1; i >= 0; i--) {
                if (this._watches[i] === callback) {
                    this._watches.splice(i, 1);
                }
            }
        }
    }
    unwatchAll() { this._watches.length = 0; Logger_1.logger.info(`Unwatch ${this._pinId} all callbacks`); }
    edge() {
        Logger_1.logger.info(`Get Pin ${this._pinId} Edge: ${this.edge}`);
        return this._edge;
    }
    setEdge(edge) {
        this._edge = edge;
        Logger_1.logger.info(`Set Pin #${this._pinId} Edge to ${this.edge}`);
    }
    activeLow() {
        Logger_1.logger.info(`Get Pin #${this._pinId} ActiveLow: ${this._opts.activeLow}`);
        return Constants_1.utils.makeBool(this._opts.activeLow);
    }
    setActiveLow(activeLow) { this._opts.activeLow = activeLow; }
    unexport() {
        Logger_1.logger.info(`Unexported Pin #${this._pinId}`);
        this._isExported = false;
    }
    setValueInternal(err, val) {
        if (this._isExported) {
            Logger_1.logger.info(`Wrote Pin #${this._pinId} to ${val}`);
            let oldVal = this._value;
            this._value = val;
            if (oldVal !== val && ((this._edge === 'both') ||
                (this._edge === 'rising' && val === 1) ||
                (this._edge === 'falling' && val === 0))) {
                for (let i = 0; i < this._watches.length; i++) {
                    Logger_1.logger.info(`Fired Pin #${this._pinId} watch #${i + 1}`);
                    this._watches[i](err, val);
                }
            }
        }
    }
    checkExported() {
        if (!this._isExported)
            Logger_1.logger.error(this.notExportedError());
        return !this._isExported ? this.notExportedError() : undefined;
    }
    notExportedError() { return new Error(`EPERM: The pin #${this._pinId} has not been exported.`); }
}
MockGpio.HIGH = 1;
MockGpio.LOW = 0;
exports.gpioPins = new GpioController({});
//# sourceMappingURL=GpioPins.js.map
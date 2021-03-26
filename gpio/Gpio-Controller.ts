import * as path from "path";
import * as fs from "fs";
import * as extend from "extend";
import * as util from "util";

import { setTimeout, clearTimeout } from "timers";
import { logger } from "../logger/Logger";
import { webApp } from "../web/Server";
import { vMaps, valueMap, utils } from "../boards/Constants";
import { cont, DeviceBinding, GpioPin } from "../boards/Controller";
import { IDevice, DeviceStatus } from "../devices/AnalogDevices";

import { PinDefinitions } from "../pinouts/Pinouts";
import { connBroker, ServerConnection } from "../connections/Bindings";
const gp = require('onoff').Gpio;

export class GpioController {
    constructor(data) { }
    public pins: gpioPinComms[] = [];
    public init() {
        this.initPins();
        return this;
    }
    public async stopAsync() {
        logger.info(`Stopping GPIO Controller`);
        for (let i = this.pins.length - 1; i >= 0; i--) {
            //this.pins[i].gpio.unexport();
            this.pins.splice(i, 1);
        }
        return this;
    }
    public reset() {
        this.stopAsync();
        this.init();
    }
    private translateState(direction: string, state: string) {
        switch (state) {
            case 'on':
                return (direction === 'out') ? 'high' : direction;
                break;
            case 'off':
                return (direction === 'out') ? 'low' : direction;
                break;
            default:
                return direction;
        }
    }
    public resetPinTriggers(headerId: number, pinId: number) {
        let pin = this.pins.find(elem => elem.pinId === pinId && elem.headerId === headerId);
        pin.resetTriggers();
    }

    public initPin(pinDef: GpioPin): gpioPinComms {
        let pin = this.pins.find(elem => elem.pinId === pinDef.id && elem.headerId === pinDef.headerId);
        let dir = pinDef.direction.gpio;
        let opts = { activeLow: pinDef.isInverted, reconfigureDirection: false };
        let pinoutHeader = cont.pinouts.headers.find(elem => elem.id === pinDef.headerId);
        if (typeof pinoutHeader !== 'undefined') {
            let pinout = pinoutHeader.pins.find(elem => elem.id === pinDef.id);
            if (typeof pinout !== 'undefined') {
                if (!pinDef.isActive) {
                    if (cont.gpio.isExported(pinout.gpioId)) {
                        let p;
                        if (gp.accessible)
                            p = new gp(pinout.gpioId, dir);
                        else
                            p = new MockGpio(pinout.gpioId, dir);
                        p.unexport();
                        cont.gpio.setUnexported(pinout.gpioId);
                        if (typeof pin !== 'undefined') pin.gpio = undefined;
                        let ndx = this.pins.findIndex(elem => elem.gpioId === pinout.gpioId);
                        if (ndx !== -1) this.pins.splice(ndx, 1);
                        logger.info(`Unexported Gpio pin#${pinDef.headerId}-${pinDef.id} ${pinout.gpioId}`);
                    }
                }
                else {
                    if (typeof pin === 'undefined') {
                        pin = new gpioPinComms(pinDef.headerId, pinDef.id, pinout.gpioId);
                        this.pins.push(pin);
                    }
                    else if (typeof pin.gpio !== 'undefined') {
                        if (dir !== pin.gpio.direction()) {
                            opts.reconfigureDirection = true;
                        }
                        pin.gpio.unwatchAll();
                    }
                    if (dir === 'in' && pinDef.debounceTimeout > 0) opts['debounceTimeout'] = pinDef.debounceTimeout;
                    let stateDir = this.translateState(dir, pinDef.state.name);
                    if (gp.accessible) {
                        logger.info(`Configuring Pin #${pinDef.id} Gpio #${pinout.gpioId}:${stateDir} on Header ${pinDef.headerId} Edge: ${dir === 'in' ? 'both' : 'none'}. ${JSON.stringify(opts)}`);
                        pin.gpio = new gp(pinout.gpioId, stateDir, dir === 'in' ? 'both' : 'none', opts);
                        logger.info(`Pin #${pinDef.id} Gpio #${pinout.gpioId}:${pinDef.direction.gpio} on Header ${pinDef.headerId} Configured.`);
                    }
                    else {
                        logger.info(`Configuring Mock Pin #${pinDef.id} Gpio #${pinout.gpioId}:${stateDir} on Header ${pinDef.headerId} Edge: ${dir === 'in' ? 'both' : 'none'}. ${JSON.stringify(opts)}`);
                        pin.gpio = new MockGpio(pinout.gpioId, stateDir, dir === 'in' ? 'both' : 'none', opts);
                    }
                    cont.gpio.setExported(pinout.gpioId);
                    if (dir === 'in') {
                        pin.gpio.watch((err, value) => {
                            if (err) logger.error(`Watch callback error GPIO Pin# ${pinDef.headerId}-${pinDef.id}`);
                            else {
                                pinDef.state = value === 1;
                                cont.gpio.emitFeeds(pin.pinId, pin.headerId);
                                webApp.emitToClients('gpioPin', { pinId: pin.pinId, headerId: pin.headerId, gpioId: pin.gpioId, state: value });
                            }
                        });
                    }
                }
            }
            else logger.error(`Pin #${pinDef.id} does not exist on Header ${pinDef.headerId}.`)
        }
        else logger.error(`Cannot find Pin #${pinDef.id} on Header ${pinDef.headerId}.  Header does not exist on this board.`)
        return pin;
    }
    public initPins() {
        let pinouts = cont.pinouts;
        logger.info(`Initializing GPIO Pins ${cont.gpio.pins.length}`);
        let prevExported = [...cont.gpio.exported];
        let exported = [];
        let useGpio = gp.accessible;
        for (let i = 0; i < cont.gpio.pins.length; i++) {
            let pinDef = cont.gpio.pins.getItemByIndex(i);
            let pin = this.initPin(pinDef);
            if (typeof pin !== 'undefined' && pinDef.isActive) exported.push(pin.gpioId);
            //if (!pinDef.isActive) continue;
            //let pinoutHeader = pinouts.headers.find(elem => elem.id === pinDef.headerId);
            //if (typeof pinoutHeader !== 'undefined') {
            //    let pinout = pinoutHeader.pins.find(elem => elem.id === pinDef.id);
            //    if (typeof pinout !== 'undefined') {
            //        let pin = this.pins.find(elem => elem.pinId === pinDef.id && elem.headerId === pinDef.headerId);
            //        if (typeof pin === 'undefined') {
            //            pin = new gpioPinComms(pinDef.headerId, pinDef.id, pinout.gpioId);
            //            this.pins.push(pin);
            //            if (useGpio) {
            //                logger.info(`Configuring Pin #${pinDef.id} Gpio #${pinout.gpioId}:${pinDef.direction.gpio} on Header ${pinDef.headerId}.`);
            //                pin.gpio = new gp(pinout.gpioId, this.translateState(pinDef.direction.gpio, pinDef.state.name), 'none', { activeLow: pinDef.isInverted, reconfigureDirection: false });
            //                logger.info(`Pin #${pinDef.id} Gpio #${pinout.gpioId}:${pinDef.direction.gpio} on Header ${pinDef.headerId} Configured.`);
            //            }
            //            else {
            //                logger.info(`Configuring Mock Pin #${pinDef.id} Gpio #${pinout.gpioId}:${pinDef.direction.gpio} on Header ${pinDef.headerId}.`);
            //                pin.gpio = new MockGpio(pinout.gpioId, this.translateState(pinDef.direction.gpio, pinDef.state.name), 'none', { activeLow: pinDef.isInverted, reconfigureDirection: false });
            //            }
            //            cont.gpio.setExported(pinout.gpioId);
            //            exported.push(pinout.gpioId);
            //            pin.gpio.read().then((value) => {
            //                pin.state = value;
            //                webApp.emitToClients('gpioPin', { pinId: pin.pinId, headerId: pin.headerId, gpioId: pin.gpioId, state: pin.state });
            //            }).catch(err => logger.error(err));
            //        }
            //    }
            //    else
            //        logger.error(`Pin #${pinDef.id} does not exist on Header ${pinDef.headerId}.`)
            //}
            //else
            //    logger.error(`Cannot find Pin #${pinDef.id} for Header ${pinDef.headerId}.  Header does not exist on this board.`)
        }
        // Unexport any pins that we have previously been exported.
        for (let i = 0; i < prevExported.length; i++) {
            if (exported.find(elem => elem === prevExported[i]) === undefined) {
                let p;
                if (useGpio) {
                    logger.info(`Unexporting unused Gpio #${prevExported[i]}`);
                    p = new gp(prevExported[i], 'out');
                }
                else {
                    logger.info(`Unexporting Mock unused Gpio #${prevExported[i]}`);
                    p = new MockGpio(prevExported[i], 'out');
                }
                p.unexport();
                cont.gpio.setUnexported(prevExported[i]);
            }
        }
    }
    public readPinAsync(headerId: number, pinId: number): Promise<number> {
        let pin = this.pins.find(elem => elem.headerId === headerId && elem.pinId === pinId);
        if (typeof pin === 'undefined') throw new Error(`Invalid Pin #${headerId}-${pinId}. Could not find pin in controller`);
        return new Promise<number>(async (resolve, reject) => {
            try {
                let val = await pin.gpio.read();
                resolve(val);
            }
            catch (err) { reject(err); }
        });
    }
    public async writePinAsync(headerId: number, pinId: number, val: number, latch?: number): Promise<void> {
        try {
            let pin = this.pins.find(elem => elem.headerId === headerId && elem.pinId === pinId);
            if (typeof pin === 'undefined') return Promise.reject(new Error(`Invalid pin. Could not find pin in controller. ${headerId}:${pinId}`));
            return await pin.writePinAsync(val, latch);
        }
        catch (err) { Promise.reject(err); }
    }
    public get pinStates() {
        let states = [];
        for (let i = 0; i < this.pins.length; i++) {
            let pin = this.pins[i];
            states.push({
                headerId: pin.headerId,
                pinId: pin.pinId,
                gpioId: pin.gpioId,
                state: pin.state
            });
        }
        return states;
    }
}
export class gpioPinComms implements IDevice {
    constructor(headerId: number, pinId: number, gpioId: number) {
        this.headerId = headerId;
        this.pinId = pinId;
        this.gpioId = gpioId;
    }
    private _latchTimer: NodeJS.Timeout;
    public lastComm: number;
    public status: string;
    public hasFault: boolean = false;
    public headerId: number;
    public pinId: number;
    public gpioId: number;
    public state: number;
    public gpio;
    public get deviceStatus(): DeviceStatus { return { name: `GPIO Pin #${this.headerId}-${this.pinId}`, category: 'GPIO Pin', hasFault: utils.makeBool(this.hasFault), status: this.status, lastComm: this.lastComm, protocol: 'gpio', busNumber: this.headerId, address: this.gpioId }; }
    public async readPinAsync(): Promise<number> {
        try {
            let val = await this.gpio.read();
            this.lastComm = new Date().getTime();
            this.hasFault = false;
            this.status = undefined;
            this.state = val;
            return val;
        } catch (err) { this.hasFault = true; this.status = err.message; return Promise.reject(err); }
    }
    public async resetTriggers() {
        try {
            // Get all the connections we are dealing with.
            let conns: ServerConnection[] = [];
            let pin = cont.gpio.pins.getPinById(this.headerId, this.pinId);
            for (let i = 0; i < pin.triggers.length; i++) {
                let trigger = pin.triggers.getItemByIndex(i);
                if (typeof conns.find(elem => elem.connectionId === trigger.sourceId) === 'undefined') conns.push(connBroker.findServer(trigger.sourceId));
            }
            for (let i = 0; i < conns.length; i++) {
                let conn = conns[i];
                conn.resetDeviceTriggers(`gpio:${this.headerId || 0}:${this.pinId}`);
            }
        } catch (err) { return logger.error(`Error resetting trigger for device.`); }
    }
    public async writePinAsync(val: number, latch?: number): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                if (typeof latch !== 'undefined') {
                    if (typeof this._latchTimer !== 'undefined') clearTimeout(this._latchTimer);
                    this._latchTimer = undefined;
                }
                logger.debug(`Writing Pin #${this.headerId}:${this.pinId} -> GPIO #${this.gpioId} to ${val}`);
                await this.gpio.write(val);
                if (latch > 0) {
                    this._latchTimer = setTimeout(async () => {
                        try {
                            // await this.writePinAsync(val ? 0 : 1, -1);
                            cont.gpio.setDeviceStateAsync(new DeviceBinding(`gpio:${this.headerId || 0}:${ this.pinId }`), val ? 0 : 1);
                        }
                        catch (err) { logger.error(`Error unlatching GPIO Pin #${this.headerId}-${this.pinId}: ${err.message}`); }
                    }, latch);
                }
                this.lastComm = new Date().getTime();
                this.hasFault = false;
                this.status = undefined;
                this.state = val;
                cont.gpio.emitFeeds(this.pinId, this.headerId);
                // logger.info(`writePinAsync with val: ${val}, latch: ${latch}`)
                webApp.emitToClients('gpioPin', { pinId: this.pinId, headerId: this.headerId, gpioId: this.gpioId, state: val });
                resolve();
            }
            catch (err) { this.hasFault = true; this.status = err.message; reject(err); }
        })
    }
}
class MockGpio {
    private _opts;
    private _pinId: number;
    private _direction: string;
    private _edge: string;
    private _value: number;
    private _watches: any[] = [];
    private _isExported = false;
    constructor(pinId: number, direction: string, edge?: string, options?) {
        this._pinId = pinId;
        switch (direction) {
            case 'high':
                this._value = 1;
                this._direction = 'out';
                break;
            case 'low':
                this._value = 0;
                this._direction = 'out';
                break;
            default:
                this._direction = direction;
                this._value = 0;
                break;
        }
        this._edge = edge;
        this._opts = extend(true, { activeLow: false, debounceTimeout: 0, reconfigureDirection: true }, options);
        this._value = 0;
        this._isExported = true;
        if (this._direction !== direction) logger.info(`Input direction translated to initial state ${direction} --> ${this._direction}`);
    }
    public read(callback?: (err, value) => void) {
        if (typeof callback !== 'undefined')
            callback(this.checkExported(), this._value);
        else
            return this._isExported ? Promise.resolve(this._value) : Promise.reject(this.notExportedError());
    }
    public readSync(): number {
        if (!this._isExported)
            throw this.notExportedError()
        return this._value;
    }
    public write(val: number, callback?: (err, value) => void) {
        if (this._direction === 'in') {
            let err = !this._isExported ? this.notExportedError() : new Error(`EPERM: GPIO #${this._pinId} Write operation is not permitted for inputs.`);
            if (typeof callback !== 'undefined') callback(err, this._value);
            else return Promise.reject(err);
        }
        else {
            let err = this.checkExported();
            this.setValueInternal(err, val);
            if (typeof callback !== 'undefined')
                callback(err, this._value);
            else
                return err ? Promise.reject(this.notExportedError()) : Promise.resolve(this._value);
        }
    }
    public writeSync(val): Promise<number> {
        let prom;
        if (this._direction === 'in') {
            let err = !this._isExported ? this.notExportedError : new Error(`EPERM: GPIO #${this._pinId} Write operation is not permitted.`);
            if (err) logger.error(err);
            prom = Promise.reject(err);
            this.setValueInternal(err, this._value);
        }
        else {
            prom = !this._isExported ? Promise.reject(this.notExportedError()) : Promise.resolve(val);
            this.setValueInternal(undefined, val);
        }
        return prom;
    }
    public watch(callback: (err, value) => void) {
        logger.info(`Watching GPIO #${this._pinId}`);
        this._watches.push(callback);
    }
    public unwatch(callback?: (err, value) => void) {
        if (typeof callback === 'undefined') this.unwatchAll();
        else {
            logger.info(`Unwatch GPIO #${this._pinId} callback`);

            for (let i = this._watches.length - 1; i >= 0; i--) {
                if (this._watches[i] === callback) {
                    this._watches.splice(i, 1);
                }
            }
        }
    }
    public unwatchAll() { this._watches.length = 0; logger.info(`Unwatch ${this._pinId} all callbacks`); }
    public edge(): string {
        logger.info(`Get GPIO #${this._pinId} Edge: ${this._edge}`);
        return this._edge
    }
    public setEdge(edge: string) {
        this._edge = edge;
        logger.info(`Set GPIO #${this._pinId} Edge to ${this.edge}`);
    }
    public activeLow(): boolean {
        logger.info(`Get GPIO #${this._pinId} ActiveLow: ${this._opts.activeLow}`);
        return utils.makeBool(this._opts.activeLow);
    }
    public direction() { return this._direction; }
    public setActiveLow(activeLow: boolean) { this._opts.activeLow = activeLow; }
    public unexport() {
        logger.info(`Unexported GPIO #${this._pinId}`);
        this._isExported = false;
    }
    private setValueInternal(err, val) {
        if (!err && this._isExported) {
            let oldVal = this._value;
            logger.debug(`Wrote GPIO #${this._pinId} from ${oldVal} to ${val}`);
            this._value = val;
            if ((typeof oldVal === 'undefined' || oldVal !== val) && ((this._edge === 'both') ||
                (this._edge === 'rising' && val === 1) ||
                (this._edge === 'falling' && val === 0))) {
                for (let i = 0; i < this._watches.length; i++) {
                    logger.info(`Fired GPIO #${this._pinId} watch #${i + 1} val:${val}`);
                    this._watches[i](err, val);
                }
            }
        }
        else {
            logger.error(`Cannot write GPIO #${this._pinId}`);
        }
        return this._value;
    }
    private checkExported() {
        if (!this._isExported) logger.error(this.notExportedError());
        return !this._isExported ? this.notExportedError() : undefined;
    }
    private notExportedError() { return new Error(`EPERM: GPIO #${this._pinId} has not been exported.`); }
    public static HIGH = 1;
    public static LOW = 0;
}
export let gpioCont = new GpioController({});
import * as path from "path";
import * as fs from "fs";
import * as extend from "extend";
import * as util from "util";

import { setTimeout } from "timers";
import { logger } from "../logger/Logger";
import { webApp } from "../web/Server";
import { vMaps, valueMap, utils } from "./Constants";
import { cont, DeviceBinding } from "../boards/Controller";

import { PinDefinitions } from "../pinouts/Pinouts";
import { connBroker } from "../connections/Bindings";
import { EPERM } from "constants";
const gp = require('onoff').Gpio;

export class GpioController  {
    constructor(data) { }
    public pins = [];
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
    public initPins() {
        let pinouts = cont.pinouts;
        logger.info(`Initializing GPIO Pins ${cont.gpio.pins.length}`);
        let prevExported = cont.gpio.exported;
        let exported = [];
        let useGpio = gp.accessible;
        for (let i = 0; i < cont.gpio.pins.length; i++) {
            let pinDef = cont.gpio.pins.getItemByIndex(i);
            if (!pinDef.isActive) continue;
            let pinoutHeader = pinouts.headers.find(elem => elem.id === pinDef.headerId);
            if (typeof pinoutHeader !== 'undefined') {
                let pinout = pinoutHeader.pins.find(elem => elem.id === pinDef.id);
                if (typeof pinout !== 'undefined') {
                    let pin = this.pins.find(elem => elem.pinId === pinDef.id && elem.headerId === - pinDef.headerId);
                    if (typeof pin === 'undefined') {
                        pin = { headerId: pinDef.headerId, pinId: pinDef.id, gpioId: pinout.gpioId };
                        this.pins.push(pin);
                        if (useGpio) {
                            logger.info(`Configuring Pin #${pinDef.id} Gpio #${pinout.gpioId}:${pinDef.direction.gpio} on Header ${pinDef.headerId}.`);
                            pin.gpio = new gp(pinout.gpioId, this.translateState(pinDef.direction.gpio, pinDef.state.name), 'none', { activeLow: pinDef.isInverted, reconfigureDirection: false });
                            logger.info(`Pin #${pinDef.id} Gpio #${pinout.gpioId}:${pinDef.direction.gpio} on Header ${pinDef.headerId} Configured.`);
                        }
                        else {
                            logger.info(`Configuring Mock Pin #${pinDef.id} Gpio #${pinout.gpioId} on Header ${pinDef.headerId}.`);
                            pin.gpio = new MockGpio(pinout.gpioId, this.translateState(pinDef.direction.gpio, pinDef.state.name), 'none', { activeLow: pinDef.isInverted, reconfigureDirection: false });
                        }
                        cont.gpio.setExported(pinout.gpioId);

                        exported.push(pinout.gpioId);
                        pin.gpio.read().then((value) => {
                            pin.state = value;
                            webApp.emitToClients('gpioPin', { pinId: pin.pinId, headerId: pin.headerId, gpioId: pin.gpioId, state: pin.state });
                        }).catch(err => logger.error(err));
                    }
                }
                else
                    logger.error(`Pin #${pinDef.id} does not exist on Header ${pinDef.headerId}.`)
            }
            else
                logger.error(`Cannot find Pin #${pinDef.id} for Header ${pinDef.headerId}.  Header does not exist on this board.`)
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
    public async writePinAsync(headerId: number, pinId: number, val:number): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                let pin = this.pins.find(elem => elem.headerId === headerId && elem.pinId === pinId);
                if (typeof pin === 'undefined') return reject(new Error(`Invalid pin. Could not find pin in controller. ${headerId}:${pinId}`));
                logger.info(`Writing Pin #${pin.headerId}:${pin.pinId} -> GPIO #${pin.gpioId} to ${val}`);
                await pin.gpio.write(val);
                webApp.emitToClients('gpioPin', { pinId: pin.pinId, headerId: pin.headerId, gpioId: pin.gpioId, state: val });
                pin.state = val;
                resolve();
            }
            catch (err) { reject(err); }
        });
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
        this._opts = extend(true, { activeLow: false, debounceTimeout:0, reconfigureDirection:true }, options);
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
        logger.info(`Get GPIO #${this._pinId} ActiveLow: ${ this._opts.activeLow }`);
        return utils.makeBool(this._opts.activeLow);
    }
    public setActiveLow(activeLow: boolean) { this._opts.activeLow = activeLow; }
    public unexport() {
        logger.info(`Unexported GPIO #${this._pinId}`);
        this._isExported = false;
    }
    private setValueInternal(err, val) {
        if (!err && this._isExported) {
            let oldVal = this._value;
            logger.info(`Wrote GPIO #${this._pinId} from ${oldVal} to ${val}`);
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
export let gpioPins = new GpioController({});
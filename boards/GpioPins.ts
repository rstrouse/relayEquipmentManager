import * as path from "path";
import * as fs from "fs";
import * as extend from "extend";
import * as util from "util";

import { setTimeout } from "timers";
import { logger } from "../logger/Logger";
import { webApp } from "../web/Server";
import { vMaps, valueMap, utils } from "./Constants";
import { cont } from "../boards/Controller";

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
            this.pins[i].gpio.unexport();
            this.pins.splice(i, 1);
        }
        return this;
    }
    public reset() {
        this.stopAsync();
        this.init();
    }
    public initPins() {
        let pinouts = cont.pinouts;
        logger.info(`Initializing GPIO Pins ${cont.gpio.pins.length}`);
        for (let i = 0; i < cont.gpio.pins.length; i++) {
            let pinDef = cont.gpio.pins.getItemByIndex(i);
            if (!pinDef.isActive) continue;
            let pinoutHeader = pinouts.headers.find(elem => elem.id === pinDef.headerId);
            if (typeof pinoutHeader !== 'undefined') {
                let pinout = pinoutHeader.pins.find(elem => elem.id === pinDef.id);
                if (typeof pinout !== 'undefined') {
                    let pin = this.pins.find(elem => elem.pinId === pinDef.id && elem.headerId === - pinDef.headerId);
                    if (typeof pin === 'undefined') {
                        pin = { headerId: pinDef.headerId, pinId: pinDef.id };
                        this.pins.push(pin);
                        if (gp.accessible) {
                            logger.info(`Configuring Pin #${pinDef.id} Gpio #${pinout.gpioId} on Header ${pinDef.headerId}.`);
                            pin.gpio = gp(pinout.gpioId, pinDef.direction.name, 'none', { activeLow: pinDef.isInverted, reconfigureDirection: false });
                        }
                        else {
                            logger.info(`Configuring Mock Pin #${pinDef.id} Gpio #${pinout.gpioId} on Header ${pinDef.headerId}.`);
                            pin.gpio = new MockGpio(pinout.gpioId, pinDef.direction.name, 'none', { activeLow: pinDef.isInverted, reconfigureDirection: false });
                        }
                    }
                }
                else
                    logger.error(`Pin #${pinDef.id} does not exist on Header ${pinDef.headerId}.`)
            }
            else
                logger.error(`Cannot find Pin #${pinDef.id} for Header ${pinDef.headerId}.  Header does not exist on this board.`)
        }
    }
    public readPinAsync(headerId: number, pinId: number): Promise<number> {
        let pin = this.pins.find(elem => elem.headerId === headerId && elem.pinId === pinId);
        if (typeof pin === 'undefined') throw new Error(`Invalid pin. Could not find pin in controller. ${headerId}:${pinId}`);
        return new Promise<number>(async (resolve, reject) => {
            try {
                let val = await pin.gpio.readSync();
                resolve(val);
            }
            catch (err) { reject(err); }
        });
    }
    public async writePinAsync(headerId: number, pinId: number, val:number): Promise<void> {
        let pin = this.pins.find(elem => elem.headerId === headerId && elem.pinId === pinId);
        if (typeof pin === 'undefined') throw new Error(`Invalid pin. Could not find pin in controller. ${headerId}:${pinId}`);
        return new Promise<void>(async (resolve, reject) => {
            try {
                logger.info(`Writing Pin ${pin.headerId}: ${pin.pinId}`);
                await pin.gpio.writeSync(val);
                resolve();
            }
            catch (err) { reject(err); }
        });
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
        this._direction = direction;
        this._edge = edge;
        this._opts = extend(true, { activeLow: false, debounceTimeout:0, reconfigureDirection:true }, options);
        this._value = 0;
        this._isExported = true;
    }
    public read(callback?: (err, value) => void) {
        if (typeof callback !== 'undefined')
            callback(this.checkExported(), this._value);
        else
            return Promise.resolve(this._value);
    }
    public readSync(): Promise<number> { return new Promise<number>((resolve, reject) => { !this._isExported ? reject(this.checkExported()) : resolve(this._value); }); }
    public write(val: number, callback?: (err, value) => void) {
        let prom;
        if (this._direction === 'in') {
            let err = !this._isExported ? this.notExportedError : new Error(`EPERM: Pin #${this._pinId} Write operation is not permitted.`);
            if (err) logger.error(err);
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
    public writeSync(val): Promise<number> {
        let prom;
        if (this._direction === 'in') {
            let err = !this._isExported ? this.notExportedError : new Error(`EPERM: Pin #${this._pinId} Write operation is not permitted.`);
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
        logger.info(`Watching Pin #${this._pinId}`);
        this._watches.push(callback);
    }
    public unwatch(callback?: (err, value) => void) {
        if (typeof callback === 'undefined') this.unwatchAll();
        else {
            logger.info(`Unwatch Pin #${this._pinId} callback`);

            for (let i = this._watches.length - 1; i >= 0; i--) {
                if (this._watches[i] === callback) {
                    this._watches.splice(i, 1);
                }
            }
        }
    }
    public unwatchAll() { this._watches.length = 0; logger.info(`Unwatch ${this._pinId} all callbacks`); }
    public edge(): string {
        logger.info(`Get Pin ${this._pinId} Edge: ${this.edge}`);
        return this._edge
    }
    public setEdge(edge: string) {
        this._edge = edge;
        logger.info(`Set Pin #${this._pinId} Edge to ${this.edge}`);
    }
    public activeLow(): boolean {
        logger.info(`Get Pin #${this._pinId} ActiveLow: ${ this._opts.activeLow }`);
        return utils.makeBool(this._opts.activeLow);
    }
    public setActiveLow(activeLow: boolean) { this._opts.activeLow = activeLow; }
    public unexport() {
        logger.info(`Unexported Pin #${this._pinId}`);
        this._isExported = false;
    }
    private setValueInternal(err, val) {
        if (this._isExported) {
            logger.info(`Wrote Pin #${this._pinId} to ${val}`);
            let oldVal = this._value;
            this._value = val;
            if (oldVal !== val && ((this._edge === 'both') ||
                (this._edge === 'rising' && val === 1) ||
                (this._edge === 'falling' && val === 0))) {
                for (let i = 0; i < this._watches.length; i++) {
                    logger.info(`Fired Pin #${this._pinId} watch #${i + 1}`);
                    this._watches[i](err, val);
                }
            }
        }
    }
    private checkExported() {
        if (!this._isExported) logger.error(this.notExportedError());
        return !this._isExported ? this.notExportedError() : undefined;
    }
    private notExportedError() { return new Error(`EPERM: The pin #${this._pinId} has not been exported.`); }
    public static HIGH = 1;
    public static LOW = 0;
}
export let gpioPins = new GpioController({});
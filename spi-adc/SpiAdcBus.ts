import { logger } from "../logger/Logger";
import { SpiController, cont, SpiChannel, DeviceFeed } from "../boards/Controller";
import { setTimeout, clearTimeout } from "timers";
import { AnalogDevices, DeviceStatus } from "../devices/AnalogDevices";
import { webApp } from "../web/Server";
import { connBroker, ServerConnection } from "../connections/Bindings";
import * as extend from "extend";
export class SpiAdcBus {
    private _spiBus;
    //private _opts;
    private _ct;
    public channels: SpiAdcChannel[] = [];
    public busNumber: number;
    constructor(busNumber: number) {
        try {
            this.busNumber = busNumber;
            switch (process.platform) {
                case 'linux':
                    this._spiBus = require('spi-device');
                    break;
                default:
                    this._spiBus = new mockSpi();
                    break;
            }
        } catch (err) { console.log(err); }
    }
    public async initAsync(def: SpiController) {
        try {
            logger.info(`Initializing SPI Bus #${this.busNumber}`);
            this._ct = cont.spiAdcChips.find(elem => elem.id === def.adcChipType);
            //this._opts = {
            //    channelCount: this._ct.maxChannels,
            //    maxRawValue: Math.pow(2, this._ct.bits) - 1,
            //    speedHz: Math.round(def.spiClock * 1000) || Math.round(this._ct.spiClock * 1000)
            //}
            for (let i = 0; i < def.channels.length; i++) {
                let chan = def.channels.getItemByIndex(i);
                if (!chan.isActive) continue;
                this.channels.push(new SpiAdcChannel(this._ct, chan, def.referenceVoltage));
            }
            for (let i = 0; i < this.channels.length; i++) {
                await this.channels[i].openAsync(this._spiBus, { busNumber: this.busNumber });
            }
            logger.info(`SPI Bus #${this.busNumber} Initialized`);
        } catch (err) { logger.error(err); }
    }
    public async resetAsync(spiBus) {
        try {
            await this.closeAsync();
            await this.initAsync(spiBus);
        } catch (err) { logger.error(err); }
    }
    public async closeAsync() {
        for (let i = 0; i < this.channels.length; i++) {
            await this.channels[i].closeAsync();
        }
        this.channels.length = 0;
    }
}
export class SpiAdcChannel {
    private _readCommand: Function;
    private _getValue: Function;
    private _convertValue: Function;
    public maxRawValue: number;
    private _ct;
    public busNumber: number;
    public channel: number;
    public refVoltage: number;
    private rawValue: number;
    private convertedValue: number;
    private units: string;
    public device;
    public precision: number;
    private _spiDevice;
    public speedHz: number;
    private _timerRead: NodeJS.Timeout;
    public feeds: SpiAdcFeed[] = [];
    public lastVal: number;
    public deviceOptions: any;
    public sampling: number = 1;
    public samples: number[] = [];
    public isOpen: boolean = false;
    public lastComm: number;
    constructor(ct, chan: SpiChannel, refVoltage) {
        this._ct = ct;
        this.channel = chan.id - 1;
        this._readCommand = new Function('channel', ct.readChannel);
        this._getValue = new Function('buffer', ct.getValue);
        this.device = cont.analogDevices.find(elem => elem.id === chan.deviceId);
        this._convertValue = new Function('maps', 'opts', 'value', this.device.convertValue);
        this.deviceOptions = extend(true, {}, chan.options);
        this.maxRawValue = Math.pow(2, this._ct.bits) - 1;
        this.refVoltage = refVoltage;
        this.precision = this.device.precision;
        this.sampling = chan.sampling || 1;
        for (let i = 0; i < chan.feeds.length; i++) {
            let f = chan.feeds.getItemByIndex(i);
            if (f.isActive) this.feeds.push(new SpiAdcFeed(chan.id, f));
        }
    }
    public resetDeviceFeeds(chan: SpiChannel) {
        for (let i = this.feeds.length - 1; i <= 0; i--) {
            let f = this.feeds[i];
            if (f.channelId === chan.id) this.feeds.splice(i, 1);
        }
        for (let i = 0; i < chan.feeds.length; i++) {
            let f = chan.feeds.getItemByIndex(i);
            if (f.isActive) this.feeds.push(new SpiAdcFeed(chan.id, f));
        }
    }
    public openAsync(spiBus, opts) {
        return new Promise<void>((resolve, reject) => {
            this.busNumber = opts.busNumber;
            try {
                logger.info(`Attempting to open SPI Bus #${opts.busNumber} Channel #${this.channel}`);
                this._spiDevice = spiBus.open(opts.busNumber || 0, this.channel, err => {
                    if (err) { logger.error(err); reject(err) }
                    else {
                        this.isOpen = true;
                        setTimeout(() => { this.readAsync(); }, 500);
                        resolve();
                    }
                });
                logger.info(`Opened SPI Bus #${opts.busNumber} Channel #${this.channel}`);
            } catch (err) { logger.error(err); }
        });
    }
    public get deviceStatus(): DeviceStatus { return { name: this.device.name, category: 'SPI Channel', hasFault: !this.isOpen, status: this.isOpen ? 'ok' : 'not open', lastComm: this.lastComm, protocol: 'spi', busNumber: this.busNumber, address: this.channel } }
    private convertValue(val): number {
        let ratio = val !== 0 ? ((this.maxRawValue / val - 1)) : 0;
        let lval;
        let vout = (this.refVoltage * val) / this.maxRawValue;
        switch (this.device.input.toLowerCase()) {
            case 'ohms':
                let ohms = (this.deviceOptions.resistance || this.device.resistance);
                let resistance = ohms * val / (this.maxRawValue - val);

                // Below is Steinhart/Hart equation.
                //let A = 0.001129148
                //let B = 0.000234125
                //let C = 0.0000000876741;
                //let Rth = resistance;
                //let tk = (1 / (A + (B * Math.log(resistance)) + (C * Math.pow((Math.log(resistance)), 3))));
                //let tc = tk - 273.15;
                //let tf = tc * 9 / 5 + 32;
                // lval = tf;



                //console.log({
                //    vcc: this.refVoltage, vout: vout, ohms: ohms, resistance: resistance, max: this.maxRawValue,
                //    tk: tk,
                //    tc: tc,
                //    tf: tf
                //});
                //lval = tf;

                lval = this._convertValue(AnalogDevices.maps, this.deviceOptions, resistance); 
                break;
            case 'v':
            case 'volts':
                lval = this._convertValue(AnalogDevices.maps, this.deviceOptions, this.refVoltage * ratio);
                break;
            case 'mv':
            case 'millivolts':
                lval = this._convertValue(AnalogDevices.maps, this.deviceOptions, (this.refVoltage * 1000) * ratio);
                break;
            default:
                lval = val;
                break;
        }
        return this.setPrecision(lval);
    }
    private setPrecision(val: number): number {
        if (typeof this.precision !== 'number') return val;
        let pow = Math.pow(10, this.precision);
        return Math.round(val * pow) / pow;
    }
    public readAsync(): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            if (!this.isOpen) return reject(new Error(`SPI Channel is closed and cannot be read`));
            if (this._timerRead) clearTimeout(this._timerRead);
            let readBuff = this._readCommand(this.channel);
            let b: Buffer = Buffer.from([0, 0, 0]);
            let message = [{
                byteLength: readBuff.byteLength,
                sendBuffer: readBuff,
                receiveBuffer: Buffer.alloc(readBuff.byteLength),
                speedHz: this.speedHz || 2000
            }];
            //if (this.channel === 1) console.log(readBuff);
            this._spiDevice.transfer(message, (err, reading) => {
                if (err) { logger.error(err); reject(err); }
                else {
                    try {
                        let rawVal = this.rawValue = this._getValue(message[0].receiveBuffer);
                        if (this.sampling > 1) {
                            this.samples.push(rawVal);
                            if (this.samples.length >= this.sampling) {
                                let mid = Math.floor(this.samples.length / 2);
                                let nums = [...this.samples].sort((a, b) => a - b);
                                rawVal = this.samples.length % 2 !== 0 ? nums[mid] : ((nums[mid - 1] + nums[mid]) / 2);
                                this.samples.length = 0;
                            }
                            else {
                                this._timerRead = setTimeout(() => { this.readAsync(); }, 500);
                                resolve(rawVal);
                                return;
                            }
                        }
                        //logger.info(`Raw:${this.rawValue} b(1):${message[0].receiveBuffer[1]} b(2):${message[0].receiveBuffer[2]} Speed: ${ message[0].speedHz }`);
                        this.convertedValue = this.convertValue(rawVal);
                        // Now we need to trigger the values to all the cannel feeds.
                        if (typeof this.lastVal === 'undefined' || this.lastVal !== this.convertedValue) {
                            webApp.emitToClients('spiChannel', { bus: this.busNumber, channel: this.channel, raw: rawVal, converted: this.convertedValue, buffer: message[0].receiveBuffer });
                            for (let i = 0; i < this.feeds.length; i++) this.feeds[i].value = this.convertedValue;
                        }
                        this._timerRead = setTimeout(() => { this.readAsync(); }, 500);
                    }
                    catch (err) { logger.error(err); reject(err); }
                    resolve(reading);
                }
            });
        });
    }
    public closeAsync(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            if (typeof this._timerRead !== 'undefined') clearTimeout(this._timerRead);
            for (let i = 0; i < this.feeds.length; i++) this.feeds[i].closeAsync();
            this._timerRead = null;
            this.isOpen = false;
            logger.info(`Closing SPI Channel ${this.busNumber} ${this.channel}`);
            this._spiDevice.close(err => {
                if (err) reject(err);
                resolve();
            });
        });
    }
}
class SpiAdcFeed {
    public server: ServerConnection;
    //public frequency: number;
    //public eventName: string;
    //public property: string;
    public lastSent: number;
    public value: number;
    //public changesOnly: boolean;
    private _timerSend: NodeJS.Timeout;
    public translatePayload: Function;
    public channelId: number;
    public feed: DeviceFeed;
    constructor(channelId: number, feed: DeviceFeed) {
        this.server = connBroker.findServer(feed.connectionId);
        //this.frequency = feed.frequency * 1000;
        //this.eventName = feed.eventName;
        //this.property = feed.property;
        //this.changesOnly = feed.changesOnly;
        this.feed = feed;
        this._timerSend = setTimeout(() => this.send(), Math.max(1000, this.feed.frequency * 1000));
        if (typeof feed.payloadExpression !== 'undefined' && feed.payloadExpression.length > 0)
            this.translatePayload = new Function('feed', 'value', feed.payloadExpression);
    }
    public async send() {
        try {
            if (this._timerSend) clearTimeout(this._timerSend);
            if (typeof this.value !== 'undefined') {
                if (!this.feed.changesOnly || this.lastSent !== this.value) {
                    await this.server.send({
                        eventName: this.feed.eventName,
                        property: this.feed.property,
                        deviceBinding: this.feed.deviceBinding,
                        value: typeof this.translatePayload === 'function' ? this.translatePayload(this, this.value) : this.value
                    });
                    this.lastSent = this.value;
                }
            }
            this._timerSend = setTimeout(() => this.send(), Math.max(1000, this.feed.frequency * 1000));
        } catch (err) { }
    }
    public closeAsync() {
        if (typeof this._timerSend !== 'undefined') clearTimeout(this._timerSend);
        this._timerSend = null;
    }
}
class mockSpiDevice {
    constructor(busNumber, deviceNumber, opts?) {
        this.busNumber = busNumber;
        this.deviceNumber = deviceNumber;
        if (typeof opts !== 'undefined') {
            for (let s in opts) {
                this._opts[s] = opts[s];
            }
        }

    }
    private busNumber = 0;
    private deviceNumber = 0;
    private _opts = {
        mode: 0,
        chipSelectHigh: false,
        lsbFirst: false,
        threeWire: false,
        loopback: false,
        noChipSelect: false,
        ready: false,
        bitsPerWord: 8,
        maxSpeedHz: 150000
    };
    public transfer(message: { byteLength: number, sendBuffer?:Buffer, receiveBuffer?:Buffer, speedHz?:number, microSecondDelay?:number, bitsPerWord?:number, chipSelectChange?:boolean }[], cb) {
        // Put together the message.
        logger.silly(`Send SPI Device ${this.busNumber}-${this.deviceNumber} Buffer: ${message[0].sendBuffer.join(',')}`);
        let spi = this.busNumber === 0 ? spi0 : spi1;
        let chan = spi.channels.find(elem => elem.channel === this.deviceNumber);
        let maxRawValue = chan.maxRawValue;
        let rand = Math.random();
        let val = Math.round(maxRawValue * rand);
        let bbw = message[0].bitsPerWord || this._opts.bitsPerWord;
        let blen = message[0].byteLength;
        let mask = Math.pow(2, bbw) - 1;
        // Encode a random result.
        if (!this._opts.lsbFirst) {
            // Start writing the bytes from the msb.
            let v = val;
            for (let i = blen - 1; i >= 0; i--) {
                message[0].receiveBuffer[i] = (v & mask);
                v = v >> bbw;
            }
        }
        else {
            let v = val;
            for (let i = 0; i < blen; i++) {
                message[0].receiveBuffer[i] = (v & mask);
                v = v >> bbw;
            }
        }
        logger.silly(`Receive SPI Device ${this.busNumber}-${this.deviceNumber} Buffer: ${message[0].receiveBuffer.join(',')}`);
        if (typeof cb === 'function') return cb(undefined, message);
    }
    public getOptions(cb) { if (typeof cb === 'function') return cb(undefined, this._opts); }
    public setOptions(opts, cb) {
        logger.info(`Setting SPI Device Options ${this.busNumber}-${this.deviceNumber}`);
        for (let s in opts) {
            this._opts[s] = opts[s];
        }
        if (typeof cb === 'function') return cb();
    }
    public close(cb) {
        logger.info(`Closing Mock SPI Device ${this.busNumber}-${this.deviceNumber}`);
        if (typeof cb === 'function') return cb();
    }
}
class mockSpi {
    public open(busNumber, deviceNumber, cb?) {
        logger.info(`Opening Mock SPI Device #${busNumber}-${deviceNumber}`);
        if (typeof cb !== 'undefined') cb();
        return new mockSpiDevice(busNumber, deviceNumber);
    }
}
export const spi0: SpiAdcBus = new SpiAdcBus(0);
export const spi1: SpiAdcBus = new SpiAdcBus(1);
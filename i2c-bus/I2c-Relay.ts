import { logger } from "../logger/Logger";
import { vMaps, valueMap, utils } from "../boards/Constants";
import { setTimeout, clearTimeout } from "timers";
import * as extend from "extend";
import { Buffer } from "buffer";
import { i2cDeviceBase } from "./I2cBus";
import { webApp } from "../web/Server";
import { I2cDevice } from "../boards/Controller";

export class i2cRelay extends i2cDeviceBase {
    protected static commandBytes = {
        mcp23017: [0x12, 0x13],
        mcp23008: [0x0A],
        pcf8574: [],
        seeed: [0x06]
    };
    protected getCommandByte(ord: number): number {
        let arr = i2cRelay.commandBytes[this.device.options.controllerType];
        if (typeof arr !== 'undefined') return arr.length > ord ? arr[ord] : undefined;
    }
    protected _timerRead: NodeJS.Timeout;
    protected toHexString(bytes: number[]) { return bytes.reduce((output, elem) => (output + '0x' + ('0' + elem.toString(16)).slice(-2)) + ' ', ''); }
    protected async sendCommand(command: number[]): Promise<{ bytesWritten: number, buffer: Buffer }> {
        try {
            let buffer = Buffer.from(command);
            let w = await this.i2c.writeCommand(this.device.address, buffer);
            logger.info(`Executed send command ${this.toHexString(command)} bytes written:${w}`);
            return Promise.resolve(w);
        }
        catch (err) { logger.error(err); }
    }
    protected async readCommand(command: number): Promise<number> {
        try {
            let r = await this.i2c.readByte(this.device.address, command);
            //logger.info(`Executed read command ${'0x' + ('0' + command.toString(16)).slice(-2)} byte read:${'0x' + ('0' + r.toString(16)).slice(-2)}`);
            return Promise.resolve(r);
        }
        catch (err) { logger.error(err); }
    }

    public async stopReadContinuous() { if (typeof this._timerRead !== 'undefined') clearTimeout(this._timerRead); return Promise.resolve(); }
    public async readContinuous(): Promise<boolean> {
        try {
            if (this._timerRead) clearTimeout(this._timerRead);
            let orp = await this.readAllRelayStates();
            this._timerRead = setTimeout(() => { this.readContinuous(); }, this.device.options.readInterval || 500);
            return Promise.resolve(orp);
        }
        catch (err) { logger.error(err); }
    }

    public async initAsync(deviceType): Promise<boolean> {
        try {
            if (this._timerRead) clearTimeout(this._timerRead);
            if (typeof this.device.options === 'undefined') this.device.options = {};
            if (typeof this.device.options.relays === 'undefined') this.device.options.relays = [];
            if (typeof this.device.options.name !== 'string' || this.device.options.name.length === 0) this.device.name = this.device.options.name = deviceType.name;
            else this.device.name = this.device.options.name;
            if (typeof this.device.options.idType === 'undefined' || this.device.options.idType.length === 0) this.device.options.idType = 'bit';
            this.readContinuous();
            return Promise.resolve(true);
        }
        catch (err) { logger.error(err); return Promise.resolve(false); }
    }
    public async readAllRelayStates(): Promise<boolean> {
        try {
            switch (this.device.options.idType) {
                case 'bit':
                    let bmVals = [];
                    // Force a sort so that it gets the correct address.
                    this.device.options.relays.sort((a, b) => { return a.id - b.id; });
                    for (let i = 0; i < this.device.options.relays.length; i++) {
                        let relay = this.device.options.relays[i];
                        // Get the byte map data from the controller.
                        let bmOrd = Math.floor(relay.id / 8);
                        let cmdByte = this.getCommandByte(bmOrd);
                        if (bmOrd + 1 > bmVals.length) bmVals.push(await this.readCommand(cmdByte));
                        let byte = bmVals[bmOrd];
                        let state = utils.makeBool((byte & 1 << ((relay.id - (bmOrd * 8)) - 1)));
                        if (state !== relay.state) {
                            relay.state = state;
                            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, relayStates:[relay] });
                        }
                    }
                    break;
                default:
                    for (let i = 0; i < this.device.options.relays.length; i++) {
                        await this.readRelayState(this.device.options.relays[i]);
                    }
                    break;
            }
            return Promise.resolve(true);
        }
        catch (err) { return Promise.reject(err); }
    }
    public async readRelayState(relay): Promise<boolean> {
        let byte: number;
        let cmdByte = relay.id;
        try {
            switch (this.device.options.idType) {
                case 'bit':
                    let bmOrd = Math.floor(relay.id / 8);
                    cmdByte = this.getCommandByte(bmOrd);
                    byte = await this.readCommand(cmdByte);
                    byte = byte & 1 << ((relay.id - (bmOrd * 8) - 1));
                    break;
                default:
                    byte = await this.readCommand(relay.id);
                    break;
            }
            if (typeof byte !== 'undefined') {
                let b = utils.makeBool(byte);
                if (relay.state !== b) {
                    relay.state = b;
                    webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, relayStates: [relay] });
                }
            }
            return Promise.resolve(true);
        }
        catch (err) { return Promise.reject(err); }
    }
    public async setOptions(opts): Promise<any> {
        try {
            await this.stopReadContinuous();
            if (typeof opts.name !== 'undefined' && this.device.name !== opts.name) this.device.options.name = this.device.name = opts.name;
            if (typeof opts.readInterval === 'number') this.device.options.readInterval = opts.readInterval;
            if (typeof opts.relays !== 'undefined') this.device.options.relays = opts.relays;
            if (typeof opts.controllerType !== 'undefined') this.device.options.controllerType = opts.controllerType;
            if (typeof opts.idType !== 'undefined') this.device.options.idType = opts.idType;
            this.readContinuous();
            Promise.resolve(this.device.options);
        }
        catch (err) { logger.error(err); Promise.reject(err); }
    }
    public async closeAsync(): Promise<void> {
        try {
            await this.stopReadContinuous();
            await super.closeAsync();
            return Promise.resolve();
        }
        catch (err) { return Promise.reject(err); }
    }
    //protected transformId(id:number): string {
    //    let tid = id.toString();
    //    switch (this.device.options.idType) {
    //        case 'bit':
    //            tid = (0x01 << (id - 1)).toString();
    //            break;
    //        case 'default':
    //            break;
    //    }
    //    return tid;
    //}
    public async setRelayState(opts): Promise<{ id: number, name: string, state: boolean }> {
        try {
            let relay = this.device.options.relays.find(elem => { return elem.id === opts.id });
            let command: number[] = [];
            if (typeof relay === 'undefined') {
                console.log(this.device.options.relays);
                return Promise.reject(`${this.device.name} - Invalid Relay id: ${opts.id}`);
            }
            // Make the relay command.
            switch (this.device.options.idType) {
                case 'bit':
                    // Make sure we have all the relay states up to date.
                    // MCP23017 uses 0x12 for port A (bmOrd 0) and 0x13 for port B (bmOrd 1).
                    // MCP23008 uses 0x09 for port A (bmOrd 0)
                    if (await this.readAllRelayStates()) {
                        let bmOrd = Math.floor((relay.id - 1) / 8);
                        let cmdByte = this.getCommandByte(bmOrd);
                        let byte = 0x00;
                        for (let i = bmOrd * 8; i < this.device.options.relays.length && i < (bmOrd * 8) + 8; i++) {
                            let r = this.device.options.relays[i];
                            if (utils.makeBool(r.state) || (relay.id === r.id && utils.makeBool(opts.state))) {
                                byte |= (1 << (r.id - (bmOrd * 8) - 1));
                            }
                        }
                        if (typeof cmdByte !== 'undefined') command.push(cmdByte);
                        command.push(byte);
                    }
                    break;
                default:
                    command.push(relay.id);
                    command.push(utils.makeBool(opts.state) ? 255 : 0);
                    break;
            }
            if (command.length > 0) {
                await this.sendCommand(command);
                relay.state = utils.makeBool(opts.state);
            }
            return Promise.resolve(relay);
        }
        catch (err) { return Promise.reject(err) };
    }
}
export class i2cRelayMulti extends i2cRelay {

}

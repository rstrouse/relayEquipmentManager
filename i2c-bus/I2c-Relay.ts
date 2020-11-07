import { logger } from "../logger/Logger";
import { vMaps, valueMap, utils } from "../boards/Constants";
import { setTimeout, clearTimeout } from "timers";
import * as extend from "extend";
import { Buffer } from "buffer";
import { i2cDeviceBase } from "./I2cBus";
import { webApp } from "../web/Server";
import { I2cDevice } from "../boards/Controller";

export class i2cRelay extends i2cDeviceBase {
    protected _timerRead: NodeJS.Timeout;
    protected createError(byte, command): Error {
        let err: Error;
        switch (byte) {
            case 255:
                err = new Error(`${this.device.address} ${command}. No I2c data to send`);
                break;
            case 254:
                err = new Error(`${this.device.address} ${command}. Still processing not ready`);
                break;
            case 2:
                err = new Error(`${this.device.address} ${command}. Syntax error`);
                break;
        }
        return err;
    }
    protected toHexString(bytes: number[]) { return bytes.reduce((output, elem) => (output + '0x' + ('0' + elem.toString(16)).slice(-2)) + ' ', ''); }
    protected async sendCommand(command: number[]): Promise<{bytesRead:number, buffer:Buffer}> {
        try {
            let buffer = Buffer.from(command);
            logger.info(`Executing send command ${this.toHexString(command)}`);
            let w = await this.i2c.writeCommand(this.device.address, buffer);
            logger.info(`Executed send command ${this.toHexString(command)} bytes written:${w}`);
            return Promise.resolve(w);
        }
        catch (err) { logger.error(err); }
    }
    public async stopReadContinuous() { if (typeof this._timerRead !== 'undefined') clearTimeout(this._timerRead); return Promise.resolve(); }
    public async initAsync(deviceType): Promise<boolean> {
        try {
            if (this._timerRead) clearTimeout(this._timerRead);
            if (typeof this.device.options === 'undefined') this.device.options = {};
            if (typeof this.device.options.relays === 'undefined') this.device.options.relays = [];
            if (typeof this.device.options.name !== 'string' || this.device.options.name.length === 0) this.device.name = this.device.options.name = deviceType.name;
            else this.device.name = this.device.options.name;
            if (typeof this.device.options.idType === 'undefined' || this.device.options.idType.length === 0) this.device.options.idType = 'bit';
            return Promise.resolve(true);
        }
        catch (err) { logger.error(err); return Promise.resolve(false); }
    }
    public async setOptions(opts): Promise<any> {
        try {
            if (typeof opts.name !== 'undefined' && this.device.name !== opts.name) this.device.options.name = this.device.name = opts.name;
            if (typeof opts.readInterval === 'number') this.device.options.readInterval = opts.readInterval;
            if (typeof opts.relays !== 'undefined') this.device.options.relays = opts.relays;
            if (typeof opts.controllerType !== 'undefined') this.device.options.controllerType = opts.controllerType;
            if (typeof opts.idType !== 'undefined') this.device.options.idType = opts.idType;
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
    protected transformId(id:number): string {
        let tid = id.toString();
        switch (this.device.options.idType) {
            case 'bit':
                tid = (0x01 << (id - 1)).toString();
                break;
            case 'default':
                break;
        }
        return tid;
    }
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
                    break;
                default:
                    command.push(relay.id);
                    command.push(utils.makeBool(opts.state) ? 255 : 0);
                    break;
            }
            await this.sendCommand(command);
            relay.state = utils.makeBool(opts.state);
            return Promise.resolve(relay);
        }
        catch (err) { return Promise.reject(err) };
    }
}
export class i2cRelayMulti extends i2cRelay {

}

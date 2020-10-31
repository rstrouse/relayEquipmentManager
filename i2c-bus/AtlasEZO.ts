import { logger } from "../logger/Logger";
import { vMaps, valueMap, utils } from "../boards/Constants";
//import { I2cController, cont, I2cBus, I2cDevice, I2cDeviceFeed } from "../boards/Controller";
import { setTimeout, clearTimeout } from "timers";
//import { AnalogDevices } from "../devices/AnalogDevices";
//import { webApp } from "../web/Server";
//import { connBroker, ServerConnection } from "../connections/Bindings";
import * as extend from "extend";
import { Buffer } from "buffer";
import { i2cDeviceBase } from "./I2cBus";

export class AtlasEZO extends i2cDeviceBase {
    public static addClasses() {
        console.log(`Adding classes`);
        //deviceClasses.AtlasEZOpH = AtlasEZOpH.prototype.constructor;
        //deviceClasses.AtlasEZOorp = AtlasEZOorp.prototype.constructor;
    }
    protected createError(byte): Error {
        let err: Error;
        switch (byte) {
            case 255:
                err = new Error('No I2c data to send');
                break;
            case 254:
                err = new Error('Still processing not ready');
                break;
            case 2:
                err = new Error('Syntax error');
                break;
        }
        return err;
    }
    protected async execCommand(command: string, timeout: number, length: number = 31): Promise<string> {
        try {
            let w = await this.i2c.writeCommand(this.device.address, command);
            await new Promise((resolve, reject) => { setTimeout(() => resolve(), timeout); });
            logger.info(`Executed command ${command} Bytes Written: ${w}`);
            let value = await this.i2c.read(this.device.address, length);
            logger.info(`Reading Result ${command} value: ${JSON.stringify(value)}`);

            // Check the first byte of the buffer.  This is the error code.
            switch (value.buffer[0]) {
                case 1:
                    break;
                case 0:
                    break;
                default:
                    let err = this.createError(value.buffer[0]);
                    return Promise.reject(err);
            }
            let data = value.buffer.toString('utf8', 1);
            
            console.log(data);
            return Promise.resolve(data);
        }
        catch (err) { logger.error(err); }
    }

}
export class AtlasEZOorp extends AtlasEZO {

}
export class AtlasEZOpH extends AtlasEZO {
    public async initAsync(deviceType): Promise<boolean> {
        try {
            this.device.options.name = await this.getName();
            this.device.options.deviceInfo = await this.getDeviceInformation();
            this.device.options.isProtoLocked = await this.isProtocolLocked();
            this.device.options.extendedScale = await this.getExtendedScale();
            this.device.options.calibrationMode = await this.getCalibrated();
            this.device.options.slope = await this.getSlope();
            this.device.options.status = await this.getStatus();
            return Promise.resolve(true);
        }
        catch (err) { logger.error(err); return Promise.resolve(false); }
    }
    public async readProbeAysnc(tempCompensation?:number): Promise<number> {
        try {
            let result = typeof tempCompensation !== 'undefined' ? await this.execCommand(`RT,${tempCompensation.toFixed(1)}`, 900) : await this.execCommand('R', 900);
            return Promise.resolve(parseFloat(result));
        }
        catch (err) { logger.error(err); }
    }
    public async lockProtocol(val: boolean): Promise<boolean> {
        try {
            await this.execCommand('Plock,' + (val ? '1' : '0'), 300, 2);
            return Promise.resolve(true);
        }
        catch (err) { logger.error(err); }
    }
    public async isProtocolLocked() {
        try {
            let result = await this.execCommand('Plock,?', 300);
            let arrDims = result.split(',');
            return Promise.resolve(utils.makeBool(arrDims[1]));
        }
        catch (err) { logger.error(err); }
    }
    public async getStatus(): Promise<{ vcc: number, lastRestart: string }> {
        try {
            let result = await this.execCommand('Status', 300);
            let arrDims = result.split(',');
            return Promise.resolve({ vcc: parseFloat(arrDims[2] || '0'), lastRestart: arrDims[1] || '' });
        }
        catch (err) { logger.error(err); }
    }
    public async getDeviceInformation(): Promise<{ device: string, firmware: string }> {
        try {
            let result = await this.execCommand('i', 300);
            let arrDims = result.split(',');
            return Promise.resolve({ device: arrDims[1] || '', firmware: arrDims[2] || '' });
        }
        catch (err) { logger.error(err); }
    }
    public async getExtendedScale(): Promise<boolean> {
        try {
            let result = await this.execCommand('pHext,?', 300);
            let arrDims = result.split(',');
            return Promise.resolve(utils.makeBool(arrDims[1]));
        }
        catch (err) { logger.error(err); }
    }
    public async getCalibrated(): Promise<number> {
        try {
            let result = await this.execCommand('cal,?', 300);
            let arrDims = result.split(',');
            return Promise.resolve(parseInt(arrDims[1] || '0', 10));
        }
        catch (err) { logger.error(err); }
    }
    public async setCalibrationPoint(point: string, value: number): Promise<boolean> {
        try {
            await this.execCommand(`Cal,${point},${value.toFixed(2)}`, 900);
            return Promise.resolve(true);
        }
        catch (err) { logger.error(err); }
    }
    public async setCalibration(point1: number, point2?: number, point3?: number): Promise<boolean> {
        try {
            let low: number, mid: number, high: number;
            if (typeof point3 !== 'undefined') {
                await this.setCalibrationPoint('mid', point2);
                await this.setCalibrationPoint('low', point1);
                await this.setCalibrationPoint('high', point3);
            }
            else if (typeof point2 !== 'undefined') {
                await this.setCalibrationPoint('mid', point2);
                await this.setCalibrationPoint('low', point1);
            }
            else {
                await this.setCalibrationPoint('mid', point1);
            }
            return Promise.resolve(true);
        }
        catch (err) { logger.error(err); }
    }
    public async getName(): Promise<string> {
        try {
            let result = await this.execCommand('Name,?', 300);
            let arrDims = result.split(',');
            return Promise.resolve(arrDims[1] || '');
        }
        catch (err) { logger.error(err); }
    }
    public async getSlope(): Promise<{ ideal: number, base: number, mV: number }> {
        try {
            let result = await this.execCommand('Name,?', 300);
            let arrDims = result.split(',');
            return Promise.resolve({ ideal: parseFloat(arrDims[1] || '0'), base: parseFloat(arrDims[2] || '0'), mV: parseFloat(arrDims[3] || '0') });
        }
        catch (err) { logger.error(err); }
    }
    public async getTempCompensation(): Promise<number> {
        try {
            let result = await this.execCommand('T,?', 300);
            let arrDims = result.split(',');
            return Promise.resolve(parseFloat(arrDims[1] || '0'));
        }
        catch (err) { logger.error(err); }

    }
    public async setTempCompensation(value: number): Promise<boolean> {
        try {
            await this.execCommand(`T,${value.toFixed(1)}`, 300);
            return Promise.resolve(true);
        }
        catch (err) { logger.error(err); }
    }
    public async setName(name: string): Promise<boolean> {
        try {
            await this.execCommand(`Name,${name.substring(0, 15)}`, 300);
            return Promise.resolve(true);
        }
        catch (err) { logger.error(err); }
    }
    public async clearCalibration(): Promise<boolean> {
        try {
            await this.execCommand(`Cal,clear`, 300);
            return Promise.resolve(true);
        }
        catch (err) { logger.error(err); }
    }
    public async setExtendedScale(val: boolean): Promise<boolean> {
        try {
            await this.execCommand('pHext,' + (val ? '1' : '0'), 300);
            return Promise.resolve(true);
        }
        catch (err) { logger.error(err); }
    }

    public async sleep(): Promise<boolean> {
        try {
            await this.i2c.writeCommand(this.device.address, 'Sleep');
            return Promise.resolve(true);
        }
        catch (err) { logger.error(err); }
    }
    public async exportCalibrationAsync(): Promise<string[]> {
        try {
            let result = await this.execCommand('Export,?', 300);
            let arrDims = result.split(',');
            let dims = { len: parseInt(arrDims[0], 10), total: parseInt(arrDims[1], 10) };
            let arr:string[] = [];
            for (let i = 0; i < dims.len; i++) {
                let val = await this.execCommand('Export', 300);
                arr.push(val);
            }
            return Promise.resolve(arr);
        }
        catch(err) { logger.error(err); }
    }
}


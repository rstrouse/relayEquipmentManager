import { logger } from "../logger/Logger";
import { vMaps, valueMap, utils } from "../boards/Constants";
import { setTimeout, clearTimeout } from "timers";
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
            let data = value.buffer.toString('utf8', 1).replace(/^[\s\uFEFF\xA0\0]+|[\s\uFEFF\xA0\0]+$/g, '');
            console.log(data);
            return Promise.resolve(data);
        }
        catch (err) { logger.error(err); }
    }
    public async setAddress(val: number): Promise<boolean> {
        try {
            if (val < 1 || val > 127) return Promise.reject(new Error(`Address must be between 1-127`));
            await this.execCommand('I2C,' + (Math.floor(val)), 300);
            return Promise.resolve(true);
        }
        catch (err) { logger.error(err); }
    }

    public async lockProtocol(val: boolean): Promise<boolean> {
        try {
            await this.execCommand('Plock,' + (val ? '1' : '0'), 300);
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
    public async getStatus(): Promise<{ vcc: number, lastRestart: { val: string, desc: string } }> {
        try {
            let result = await this.execCommand('Status', 300);
            let arrDims = result.split(',');
            let lr = { val: arrDims[1] || 'U', desc: 'unknown' };
            switch (lr.val) {
                case 'U':
                    lr.desc = 'Unknown';
                    break;
                case 'P':
                    lr.desc = 'Powered Off';
                    break;
                case 'S':
                    lr.desc = 'Software Reset';
                    break;
                case 'B':
                    lr.desc = 'Brown Out';
                    break;
                case 'W':
                    lr.desc = 'Watchdog';
                    break;
            }
            return Promise.resolve({ vcc: parseFloat(arrDims[2] || '0'), lastRestart: lr });
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
    public async clearCalibration(): Promise<boolean> {
        try {
            await this.execCommand(`Cal,clear`, 300);
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

}
export class AtlasEZOorp extends AtlasEZO {
    public async initAsync(deviceType): Promise<boolean> {
        try {
            this.device.options.name = await this.getName();
            this.device.options.deviceInfo = await this.getDeviceInformation();
            this.device.options.isProtoLocked = await this.isProtocolLocked();
            this.device.options.calibrationMode = await this.getCalibrated();
            this.device.options.status = await this.getStatus();
            return Promise.resolve(true);
        }
        catch (err) { logger.error(err); return Promise.resolve(false); }
    }
    public async getCalibrated(): Promise<boolean> {
        try {
            let result = await this.execCommand('cal,?', 300);
            let arrDims = result.split(',');
            return Promise.resolve(utils.makeBool(arrDims[1]));
        }
        catch (err) { logger.error(err); }
    }
    public async setCalibrationPoint(point: string, value: number): Promise<boolean> {
        try {
            await this.execCommand(`Cal,${Math.floor(value)}`, 900);
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
    public async setName(name: string): Promise<boolean> {
        try {
            await this.execCommand(`Name,${name.substring(0, 15)}`, 300);
            return Promise.resolve(true);
        }
        catch (err) { logger.error(err); }
    }
    public async exportCalibration(): Promise<{ len: number, total: number, data: string[] }> {
        try {
            let result = await this.execCommand('Export,?', 300);
            let arrDims = result.split(',');
            let dims = { len: parseInt(arrDims[1], 10), total: parseInt(arrDims[2], 10), data: [] };
            for (let i = 0; i <= dims.len; i++) {
                let val = await this.execCommand('Export', 300);
                dims.data.push(val);
            }
            return Promise.resolve(dims);
        }
        catch (err) { logger.error(err); }
    }
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
            this.device.options.calibration = await this.exportCalibration();
            return Promise.resolve(true);
        }
        catch (err) { logger.error(err); return Promise.resolve(false); }
    }
    public async readProbeAysnc(tempCompensation?: number): Promise<number> {
        try {
            let result = typeof tempCompensation !== 'undefined' ? await this.execCommand(`RT,${tempCompensation.toFixed(1)}`, 900) : await this.execCommand('R', 900);
            return Promise.resolve(parseFloat(result));
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
    public async setName(name: string): Promise<boolean> {
        try {
            await this.execCommand(`Name,${name.substring(0, 15)}`, 300);
            return Promise.resolve(true);
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
    public async setExtendedScale(val: boolean): Promise<boolean> {
        try {
            await this.execCommand('pHext,' + (val ? '1' : '0'), 300);
            return Promise.resolve(true);
        }
        catch (err) { logger.error(err); }
    }
    public async exportCalibration(): Promise<{ len: number, total: number, data: string[] }> {
        try {
            let result = await this.execCommand('Export,?', 300);
            let arrDims = result.split(',');
            let dims = { len: parseInt(arrDims[1], 10), total: parseInt(arrDims[2], 10), data: [] };
            for (let i = 0; i <= dims.len; i++) {
                let val = await this.execCommand('Export', 300);
                dims.data.push(val);
            }
            return Promise.resolve(dims);
        }
        catch (err) { logger.error(err); }
    }
}
export class AtlasEZOpmp extends AtlasEZO {
    public async initAsync(deviceType): Promise<boolean> {
        try {
            this.device.options.dispense = await this.getDispenseStatus();
            this.device.options.deviceInfo = await this.getDeviceInformation();
            this.device.options.isProtoLocked = await this.isProtocolLocked();
            this.device.options.parameters = await this.getParameterInfo();
            this.device.options.calibration = await this.getCalibrated();
            this.device.options.pumpVoltage = await this.getPumpVoltage();
            this.device.options.status = await this.getStatus();
            return Promise.resolve(true);
        }
        catch (err) { logger.error(err); return Promise.resolve(false); }
    }
    public async getDispenseStatus(): Promise<{ lastVolume: number, isDispensing: boolean }> {
        try {
            let result = await this.execCommand('D,?', 300);
            let arrDims = result.split(',');
            return Promise.resolve({ lastVolume: parseFloat(arrDims[1] || '0'), isDispensing: utils.makeBool(arrDims[0]) });
        }
        catch (err) { logger.error(err); }
    }
    public async getPumpVoltage(): Promise<number> {
        try {
            let result = await this.execCommand('PV,?', 300);
            let arrDims = result.split(',');
            return Promise.resolve(parseFloat(arrDims[1] || '0'));
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
    public async getParameterInfo(): Promise<{ pumpVolume: boolean, pumpTotal: boolean, pumpAbsolute: boolean }> {
        try {
            let result = await this.execCommand('O,?', 300);
            let arrDims = result.split(',');
            return Promise.resolve({ pumpVolume: utils.makeBool(arrDims[1]), pumpTotal: utils.makeBool(arrDims[2]), pumpAbsolute: utils.makeBool(arrDims[3]) });
        }
        catch (err) { logger.error(err); }
    }

    public async getCalibrated(): Promise<{ volume: boolean, time: boolean }> {
        try {
            let opts = { volume: false, time: false };
            let result = await this.execCommand('cal,?', 300);
            let arrDims = result.split(',');
            let val = parseInt(arrDims[1] || '0');
            opts.volume = (val & 0x0001) > 0;
            opts.time = (val & 0x0002) > 0;
            return Promise.resolve(opts);
        }
        catch (err) { logger.error(err); }
    }
}

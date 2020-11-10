//*EZO-pH
//*EZO-ORP
//EZO-DO(Dissolved Oxygen)
//EZO-EC(Conductivity)
//*EZO-RTD(Temperature)
//EZO-CO2 sensor
//EZO-O2 sensor
//EZO-RGB Color Sensor
//*EZO-PMP(Peristaltic Pump)
//*EZO-PRS(Pressure Sensor)
//*EZO-HUM sensor(Humidity Sensor)

import { logger } from "../logger/Logger";
import { vMaps, valueMap, utils } from "../boards/Constants";
import { setTimeout, clearTimeout } from "timers";
import * as extend from "extend";
import { Buffer } from "buffer";
import { i2cDeviceBase } from "./I2cBus";
import { webApp } from "../web/Server";
import { I2cDevice } from "../boards/Controller";

export class AtlasEZO extends i2cDeviceBase {
    protected _timerRead: NodeJS.Timeout;
    protected _infoRead: NodeJS.Timeout;
    protected _waitCount = 0;
    protected _pollInformationInterval = 10000;
    protected logError(err, msg?:string) { logger.error(`${this.device.name} ${typeof msg !== 'undefined' ? msg + ' ': ''}${typeof err !== 'undefined' ? err.message : ''}`); }
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
    protected escapeName(name: string): string { return name.substring(0, 15).replace(/\s+/g, '_'); }
    protected get version(): number { return typeof this.device !== 'undefined' && this.device.options !== 'undefined' && typeof this.device.options.deviceInfo !== 'undefined' ? parseFloat(this.device.options.deviceInfo.firmware) : 0 }
    protected beginCommand() { this._waitCount++; }
    protected endCommand() {
    this._waitCount--;
        //if (this._waitCount > 0) logger.warn(`${this.device.name} Wait Count: ${this._waitCount}`);
    }
    protected async execCommand(command: string, timeout: number, length: number = 31): Promise<string> {
        try {
            let w = await this.i2c.writeCommand(this.device.address, command);
            await new Promise((resolve, reject) => { setTimeout(() => resolve(), timeout); });
            let value = await this.i2c.read(this.device.address, length);
            // Check the first byte of the buffer.  This is the error code.
            switch (value.buffer[0]) {
                case 1:
                    break;
                case 0:
                    break;
                default:
                    let err = this.createError(value.buffer[0], command);
                    return Promise.reject(err);
            }
            let data = value.buffer.toString('utf8', 1).replace(/^[\s\uFEFF\xA0\0]+|[\s\uFEFF\xA0\0]+$/g, '');
            logger.info(`${this.device.name} command ${command} bytes written:${w} result:${data}`);
            return Promise.resolve(data);
        }
        catch (err) { return Promise.reject(err); }
    }

    public async setAddress(val: number): Promise<boolean> {
        try {
            if (val < 1 || val > 127) return Promise.reject(new Error(`Address must be between 1-127`));
            await this.execCommand('I2C,' + (Math.floor(val)), 300);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async lockProtocol(val: boolean): Promise<boolean> {
        try {
            await this.execCommand('Plock,' + (val ? '1' : '0'), 300);
            this.device.options.isProtocolLocked = val;
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async getName(): Promise<string> {
        try {
            return Promise.resolve(this.device.name);
        }
        catch (err) { this.logError(err); }
    }
    public async setName(name: string): Promise<boolean> {
        try {
            this.device.name = this.device.options.name = name;
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async isProtocolLocked() {
        try {
            let result = await this.execCommand('Plock,?', 300);
            let arrDims = result.split(',');
            return Promise.resolve(utils.makeBool(arrDims[1]));
        }
        catch (err) { this.logError(err); }
    }
    public async getStatus(): Promise<boolean> {
        try {
            this.beginCommand();
            let result = await this.execCommand('Status', 300);
            if (this.i2c.isMock) return Promise.resolve(true);
            let arrDims = result.split(',');
            this.device.options.deviceInfo.vcc = parseFloat(arrDims[2] || '0');
            this.device.options.deviceInfo.lastRestart = this.transformRestart((arrDims[1] || 'U').toUpperCase());
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err, `Error getting device status:`); return Promise.reject(err); }
        finally { this.endCommand(); }
    }
    public async getLedEnabled(): Promise<boolean> {
        try {
            this.beginCommand();
            let result = await this.execCommand('L,?', 300);
            let arrDims = result.split(',');
            this.device.options.ledEnabled = utils.makeBool(arrDims[1]);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
        finally { this.endCommand(); }
    }
    public async enableLed(enable: boolean): Promise<boolean> {
        try {
            this.beginCommand();
            let result = await this.execCommand(`L,${enable ? '1' : '0'}`, 300);
            this.device.options.ledEnabled = enable;
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
        finally { this.endCommand(); }
    }
    public async getInfo(): Promise<{ device: string, firmware: string }> {
        try {
            this.beginCommand();
            let result = await this.execCommand('i', 300);
            let arrDims = result.split(',');
            if (typeof this.device.options.deviceInfo === 'undefined') this.device.options.deviceInfo = {};
            this.device.options.deviceInfo.device = arrDims[1] || '';
            this.device.options.deviceInfo.firmware = arrDims[2] || '';
            return Promise.resolve({ device: arrDims[1] || '', firmware: arrDims[2] || '' });
        }
        catch (err) { logger.error(`Error getting info ${err.message}`); return Promise.reject(err); }
        finally { this.endCommand(); }
    }
    public async getDeviceInformation(): Promise<boolean> {
        try {
            this.beginCommand();
            if (this._infoRead) clearTimeout(this._infoRead);
            if (this._waitCount > 0) {
                this._infoRead = setTimeout(() => { this.getDeviceInformation(); }, this._pollInformationInterval);
                return Promise.resolve(true);
            }
            await this.getStatus();
            webApp.emitToClients('i2cDeviceInformation', { bus: this.i2c.busNumber, address: this.device.address, options: { deviceInfo: this.device.options.deviceInfo } });
            this._infoRead = setTimeout(() => { this.getDeviceInformation(); }, this._pollInformationInterval);
        }
        catch (err) { logger.error(`Error retrieving device status: ${err.message}`); this._infoRead = setTimeout(() => { this.getDeviceInformation(); }, this._pollInformationInterval); return Promise.reject(err); }
        finally { this.endCommand(); }
    }
    public async clearCalibration(): Promise<boolean> {
        try {
            await this.execCommand(`Cal,clear`, 300);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async sleep(): Promise<boolean> {
        try {
            this.beginCommand();
            await this.i2c.writeCommand(this.device.address, 'Sleep');
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    public async stopReadContinuous(): Promise<void> { if (typeof this._timerRead !== 'undefined') clearTimeout(this._timerRead); return Promise.resolve(); }
    public async closeAsync(): Promise<void> {
        try {
            await this.stopReadContinuous();
            await super.closeAsync();
            return Promise.resolve();
        }
        catch (err) { return this.logError(err); }
    }
    protected transformRestart(code: string): { name: string, desc: string } {
        let status = { name: code, desc: 'Unknown' };
        switch (code) {
            case 'P':
                status.desc = 'Powered Off';
                break;
            case 'S':
                status.desc = 'Software Reset';
                break;
            case 'B':
                status.desc = 'Brown Out';
                break;
            case 'W':
                status.desc = 'Watchdog';
                break;
            case 'U':
                status.desc = 'Unknown';
                break;
        }
        return status;
    }
}
export class AtlasEZOorp extends AtlasEZO {
    public async initAsync(deviceType): Promise<boolean> {
        try {
            this.beginCommand();
            if (this._timerRead) clearTimeout(this._timerRead);
            if (this._infoRead) clearTimeout(this._infoRead);
            this.device.options.name = await this.getName();
            await this.getInfo();
            await this.getLedEnabled();
            this.device.options.isProtocolLocked = await this.isProtocolLocked();
            await this.getCalibrated();
            //this.device.options.status = await this.getStatus();
            this.device.options.calibration = await this.exportCalibration();
            this.device.options.readInterval = this.device.options.readInterval || deviceType.readings.orp.interval.default;
            if (typeof this.device.options.name !== 'string' || this.device.options.name.length === 0) await this.setName(deviceType.name);
            else this.device.name = this.device.options.name;
            setTimeout(() => { this.getDeviceInformation(); }, 500);
            setTimeout(() => { this.readContinuous(); }, 1000);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.resolve(false); }
        finally { this.endCommand(); }
    }
    public async setOptions(opts): Promise<any> {
        try {
            if (typeof opts.name !== 'undefined' && this.device.name !== opts.name) await this.setName(opts.name);
            if (typeof opts.isProtocolLocked !== 'undefined' && this.device.options.isProtocolLocked !== opts.isProcolLocked) await this.lockProtocol(utils.makeBool(opts.isProtocolLocked));
            if (typeof opts.ledEnabled !== 'undefined' && this.device.options.ledEnabled !== opts.ledEnabled) await this.enableLed(utils.makeBool(opts.ledEnabled));
            if (typeof opts.readInterval === 'number') this.device.options.readInterval = opts.readInterval;
        }
        catch (err) { this.logError(err); Promise.reject(err); }
    }
    public async readContinuous(): Promise<boolean> {
        try {
            if (this._timerRead) clearTimeout(this._timerRead);
            if (this._waitCount > 0) {
                this._timerRead = setTimeout(() => { this.getDeviceInformation(); }, this.device.options.readInterval);
                return Promise.resolve(true);
            }
            await this.readProbe();
            this._timerRead = setTimeout(() => { this.readContinuous(); }, this.device.options.readInterval);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async getCalibrated(): Promise<boolean> {
        try {
            this.beginCommand();
            let result = await this.execCommand('cal,?', 300);
            let arrDims = result.split(',');
            this.device.options.calibrationMode = utils.makeBool(arrDims[1]);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    public async setCalibrationPoint(value: number): Promise<boolean> {
        try {
            this.beginCommand();
            await this.execCommand(`Cal,${Math.floor(value)}`, 900);
            this.device.options.calPoint = Math.floor(value);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    public async calibrate(data): Promise<I2cDevice> {
        try {
            this.beginCommand();
            if (typeof data === 'undefined' || typeof data.options === 'undefined') return Promise.reject(`Could not calibrate EZO-ORP invalid data format. ${JSON.stringify(data)}`);
            if (typeof data.options.calPoint !== 'undefined') await this.setCalibrationPoint(parseFloat(data.options.calPoint));
            else { return Promise.reject(`Could not calibrate EZO-ORP no setpoint was provided. ${JSON.stringify(data)}`) }
            this.device.options.calibrationMode = await this.getCalibrated();
            return Promise.resolve(this.device);
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
        finally { this.endCommand(); }
    }

    public async getName(): Promise<string> {
        try {
            this.beginCommand();
            let result = await this.execCommand('Name,?', 300);
            let arrDims = result.split(',');
            return Promise.resolve(arrDims[1] || '');
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    public async setName(name: string): Promise<boolean> {
        try {
            this.beginCommand();
            await this.execCommand(`Name,${this.escapeName(name)}`, 300);
            this.device.options.name = this.device.name = this.escapeName(name);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    public async readProbe(): Promise<number> {
        try {
            this.beginCommand();
            let result = await this.execCommand('R', 900);
            let val = parseFloat(result);
            this.device.values.orp = val;
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.device.values });
            return Promise.resolve(val);
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    public async exportCalibration(): Promise<{ len: number, total: number, data: string[] }> {
        try {
            this.beginCommand();
            let result = await this.execCommand('Export,?', 300);
            let arrDims = result.split(',');
            let dims = { len: parseInt(arrDims[1], 10), total: parseInt(arrDims[2], 10), data: [] };
            for (let i = 0; i < dims.len; i++) {
                let val = await this.execCommand('Export', 300);
                dims.data.push(val);
            }
            return Promise.resolve(dims);
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
}
export class AtlasEZOpH extends AtlasEZO {
    public async initAsync(deviceType): Promise<boolean> {
        try {
            if (this._timerRead) clearTimeout(this._timerRead);
            this.device.options.name = await this.getName();
            await this.getInfo();
            this.device.options.isProtocolLocked = await this.isProtocolLocked();
            await this.getLedEnabled();
            await this.getExtendedScale();
            await this.getCalibrated();
            await this.getSlope();
            await this.getTempCompensation();
            this.device.options.calibration = await this.exportCalibration();
            this.device.options.readInterval = this.device.options.readInterval || deviceType.readings.pH.interval.default;
            if (typeof this.device.options.name !== 'string' || this.device.options.name.length === 0) await this.setName(deviceType.name);
            else this.device.name = this.escapeName(this.device.options.name);
            setTimeout(() => { this.getDeviceInformation(); }, 500);
            setTimeout(() => { this.readContinuous(); }, 1000);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.resolve(false); }
    }
    public async setOptions(opts): Promise<any> {
        try {
            this.stopReadContinuous();
            if (typeof opts.name !== 'undefined' && this.device.name !== opts.name) await this.setName(opts.name);
            if (typeof opts.isProtocolLocked !== 'undefined' && this.device.options.isProtocolLocked !== opts.isProtocolLocked) await this.lockProtocol(utils.makeBool(opts.isProtocolLocked));
            if (typeof opts.extendedScale !== 'undefined' && this.device.options.extendedScale !== opts.extendedScale) await this.setExtendedScale(utils.makeBool(opts.extendedScale));
            if (typeof opts.tempCompensation === 'number' && this.device.options.tempCompensation !== opts.tempCompensation) await this.setTempCompensation(opts.tempCompensation);
            if (typeof opts.ledEnabled !== 'undefined' && this.device.options.ledEnabled !== opts.ledEnabled) await this.enableLed(utils.makeBool(opts.ledEnabled));
            if (typeof opts.readInterval === 'number') this.device.options.readInterval = opts.readInterval;
            this.readContinuous();
            return Promise.resolve(this.device.options);
        }
        catch (err) { this.logError(err); Promise.reject(err); }
    }
    public async readContinuous(): Promise<boolean> {
        try {
            if (this._timerRead) clearTimeout(this._timerRead);
            if (this._waitCount > 0) {
                this._timerRead = setTimeout(() => { this.getDeviceInformation(); }, this._pollInformationInterval);
                return Promise.resolve(true);
            }
            await this.readProbe();
            this._timerRead = setTimeout(() => { this.readContinuous(); }, this.device.options.readInterval);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async calibrate(data): Promise<I2cDevice> {
        try {
            this.beginCommand();
            if (typeof data === 'undefined' || typeof data.options === 'undefined') return Promise.reject(`Could not calibrate EZO-PH invalid data format. ${JSON.stringify(data)}`);
            if (typeof data.options.calMidPoint !== 'undefined') await this.setCalibrationPoint('mid', parseFloat(data.options.calMidPoint));
            else if (typeof data.options.calLowPoint !== 'undefined') await this.setCalibrationPoint('low', parseFloat(data.options.calLowPoint));
            else if (typeof data.options.calHighPoint !== 'undefined') await this.setCalibrationPoint('high', parseFloat(data.options.calHighPoint));
            else { return Promise.reject(`Could not calibrate EZO-PH no setpoint was provided. ${JSON.stringify(data)}`) }
            this.device.options.calibrationMode = await this.getCalibrated();
            return Promise.resolve(this.device);
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
        finally { this.endCommand(); }
    }
    public async readProbe(tempCompensation?: number): Promise<number> {
        try {
            this.beginCommand();
            if (typeof tempCompensation !== 'undefined' && this.version < 2.12) {
                if (tempCompensation !== this.device.values.temperature) await this.setTempCompensation(tempCompensation);
            }
            let result = typeof tempCompensation !== 'undefined' && this.version >= 2.12 ? await this.execCommand(`RT,${tempCompensation.toFixed(1)}`, 900) : await this.execCommand('R', 900);
            let val = parseFloat(result);
            if (typeof this.device.values === 'undefined') this.device.values = {};
            this.device.values.pH = val;
            if (typeof tempCompensation !== 'undefined') this.device.values.temperature = tempCompensation;
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.device.values });
            return Promise.resolve(val);
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    public async getExtendedScale(): Promise<boolean> {
        try {
            this.beginCommand();
            let result = await this.execCommand('pHext,?', 300);
            let arrDims = result.split(',');
            this.device.options.extendedScale = utils.makeBool(arrDims[1]);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    public async getCalibrated(): Promise<boolean> {
        try {
            this.beginCommand();
            let result = await this.execCommand('cal,?', 300);
            let arrDims = result.split(',');
            this.device.options.calibrationMode = parseInt(arrDims[1] || '0', 10);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    public async setCalibrationPoint(point: string, value: number): Promise<boolean> {
        try {
            this.beginCommand();
            await this.execCommand(`Cal,${point},${value.toFixed(2)}`, 900);
            let ptName = `cal${point.substring(0, 1).toUpperCase()}${point.substring(1).toLowerCase()}Point`;
            this.device.options[ptName] = value;
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    public async getName(): Promise<string> {
        try {
            this.beginCommand();
            let result = await this.execCommand('Name,?', 300);
            let arrDims = result.split(',');
            return Promise.resolve(arrDims[1] || '');
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    public async setName(name: string): Promise<boolean> {
        try {
            this.beginCommand();
            await this.execCommand(`Name,${this.escapeName(name)}`, 300);
            this.device.name = this.device.options.name = this.escapeName(name);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    public async getSlope(): Promise<boolean> {
        try {
            this.beginCommand();
            let result = await this.execCommand('Slope,?', 300);
            let arrDims = result.split(',');
            this.device.options.slope = { acid: parseFloat(arrDims[1] || '0'), base: parseFloat(arrDims[2] || '0'), mV: parseFloat(arrDims[3] || '0') }
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    public async getTempCompensation(): Promise<boolean> {
        try {
            this.beginCommand();
            let result = await this.execCommand('T,?', 300);
            let arrDims = result.split(',');
            this.device.values.temperature = parseFloat(arrDims[1] || '25');
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.device.values });
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    public async setTempCompensation(value: number): Promise<boolean> {
        try {
            this.beginCommand();
            await this.execCommand(`T,${value.toFixed(1)}`, 300);
            this.device.values.temperature = value;
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.device.values });
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    public async setExtendedScale(val: boolean): Promise<boolean> {
        try {
            this.beginCommand();
            await this.execCommand('pHext,' + (val ? '1' : '0'), 300);
            this.device.options.extendedScale = val;
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    public async exportCalibration(): Promise<{ len: number, total: number, data: string[] }> {
        try {
            this.beginCommand();
            let result = await this.execCommand('Export,?', 300);
            let arrDims = result.split(',');
            let dims = { len: parseInt(arrDims[1], 10), total: parseInt(arrDims[2], 10), data: [] };
            for (let i = 0; i < dims.len; i++) {
                let val = await this.execCommand('Export', 300);
                dims.data.push(val);
            }
            return Promise.resolve(dims);
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
}
export class AtlasEZOpmp extends AtlasEZO {
    public async initAsync(deviceType): Promise<boolean> {
        try {
            if (this._timerRead) clearTimeout(this._timerRead);
            if (this._infoRead) clearTimeout(this._infoRead);
            this._pollInformationInterval = 10000;
            this.device.options.name = await this.getName();
            //this.device.options.values = await this.getDispenseStatus();
            await this.getInfo();
            this.device.options.isProtoLocked = await this.isProtocolLocked();
            await this.getLedEnabled();
            await this.getParameterInfo();
            if (!this.device.options.parameters.pumpVolume) await this.enableParameter('V', true);
            if (!this.device.options.parameters.pumpTotal) await this.enableParameter('TV', true);
            if (!this.device.options.parameters.pumpAbsolute) await this.enableParameter('ATV', true);
            this.device.options.calibration = await this.getCalibrated();
            //this.device.options.pumpVoltage = await this.getPumpVoltage();
            if (typeof this.device.options.name !== 'string' || this.device.options.name.length === 0) await this.setName(deviceType.name);
            else this.device.name = this.escapeName(this.device.options.name);
            this.device.options.readInterval = this.device.options.readInterval || deviceType.readings.dispensed.interval.default;
            setTimeout(() => { this.getDeviceInformation(); }, 500);
            setTimeout(() => { this.getDispenseStatus(); }, 1000);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.resolve(false); }
    }
    public async getName(): Promise<string> {
        try {
            this.beginCommand();
            let result = await this.execCommand('Name,?', 300);
            let arrDims = result.split(',');
            return Promise.resolve(arrDims[1] || '');
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    public async setName(name: string): Promise<boolean> {
        try {
            this.beginCommand();
            await this.execCommand(`Name,${this.escapeName(name)}`, 300);
            this.device.name = this.device.options.name = this.escapeName(name);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    private transformDispenseMode(code: string, paused: boolean): { name: string, desc: string } {
        let mode = { name: code, desc: 'Unknown' };
        switch (code) {
            case 'volOverTime':
                mode.desc = 'Volume Over Time';
                break;
            case 'vol':
                mode.desc = 'Volume';
                break;
            case 'continuous':
                mode.desc = 'Continuous';
                break;
            case 'flowRate':
                mode.desc = 'Flow Rate';
                break;
            case 'flowOverTime':
                mode.desc = 'Flow Rate over Time'
                break;
            case 'pause':
                mode.desc = 'Dispense Paused';
                break;
            case 'off':
                mode.desc = 'Off';
                break;
        }
        if (paused) mode.desc += ' - Paused';
        return mode;
    }
    public async getPumpVoltage(): Promise<number> {
        try {
            this.beginCommand();
            let result = await this.execCommand('PV,?', 300);
            let arrDims = result.split(',');
            return Promise.resolve(parseFloat(arrDims[1] || '0'));
        }
        catch (err) { this.logError(err, `Error getting pump voltage: `); return Promise.reject(err); }
        finally { this.endCommand(); }
    }
    public async getDeviceInformation(): Promise<boolean> {
        try {
            this.beginCommand();
            if (this._infoRead) clearTimeout(this._infoRead);
            await this.getPumpVoltage();
            await super.getDeviceInformation();
        }
        catch (err) { return Promise.reject(err); }
        finally { this.endCommand(); }
    }

    public async getParameterInfo(): Promise<boolean> {
        try {
            this.beginCommand();
            let result = await this.execCommand('O,?', 300);
            let params = result.toUpperCase();
            if (typeof this.device.options.parameters === 'undefined') this.device.options.parameters = {};
            console.log(params);
            this.device.options.parameters.pumpVolume = params.indexOf(',V') >= 0;
            this.device.options.parameters.pumpTotal = params.indexOf(',TV') >= 0;
            this.device.options.parameters.pumpAbsolute = params.indexOf(',ATV') >= 0;
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    public async enableParameter(param: string, enable:boolean = true): Promise<boolean> {
        try {
            this.beginCommand();
            await this.execCommand(`O,${param},${enable ? '1' : '0'}`, 300);
            switch (param) {
                case 'V':
                    this.device.options.parameters.pumpVolume = enable;
                    break;
                case 'TV':
                    this.device.options.parameters.pumpTotal = enable;
                    break;
                case 'ATV':
                    this.device.options.parameters.pumpAbsolute = enable;
                    break;
            }
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
        finally { this.endCommand(); }
    }
    public async getDispenseStatus(): Promise<{ dispensing: boolean, volume?: number, continuous: boolean, reverse: boolean, maxRate: number, mode: { name: string, desc: string } }> {
        try {
            if (this._waitCount > 0) {
                this._timerRead = setTimeout(() => { this.getDispenseStatus(); }, this.device.options.readInterval);
                console.log('Forced to wait');
                return Promise.resolve(this.device.values);
            }
            let result = await this.execCommand('D,?', 300);
            let arrDims = result.split(',');
            let disp:any = {};
            let run = parseInt(arrDims[2] || '0', 10);
            if (isNaN(run)) run = 0;
            this.device.values.dispensing = run !== 0;
            this.device.values.reverse = run < 0;
            this.device.values.continuous = disp.dispensing && arrDims[1].indexOf('*') !== -1;
            this.device.values.paused = utils.makeBool(this.device.values.paused);
            if (typeof this.device.values.mode === 'undefined') this.device.values.mode = { name: 'off', desc: 'Off' };
            let mode = 'off';
            if (this.device.values.continuous) mode = 'continuous';
            else if (this.device.values.dispensing || this.device.values.paused) mode = this.device.values.mode.name;
            if (mode.startsWith('vol')) this.device.values.volume = parseFloat(arrDims[2]);
            else this.device.values.volume = null;
            if (mode === 'off') {
                this.device.values.volume = null;
                this.device.values.flowRate = null;
                this.device.values.dispenseTime = null;
            }
            this.device.values.mode = this.transformDispenseMode(mode, this.device.values.paused);
            result = await this.execCommand('DC,?', 300);
            arrDims = result.split(',');
            this.device.values.maxRate = parseFloat(arrDims[1]);
            this.device.values.totalVolume = await this.getVolumeDispensed();
            this.device.values = disp;
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.device.values });
            if (this.device.values.dispensing) this._timerRead = setTimeout(() => { this.getDispenseStatus(); }, this.device.options.readInterval);
            return Promise.resolve(this.device.values);
        }
        catch (err) { logger.error(new Error(`Could not get dispense status: ${err.message}`)); this._timerRead = setTimeout(() => { this.getDispenseStatus(); }, this.device.options.readInterval); }
    }
    public async getVolumeDispensed(): Promise<{ total: number, absolute: number }> {
        try {
            this.beginCommand();
            let vol = { total: 0, absolute: 0 };
            let result = await this.execCommand('TV,?', 300);
            let arrDims = result.split(',');
            vol.total = parseFloat(arrDims[1]);
            result = await this.execCommand('ATV,?', 300);
            arrDims = result.split(',');
            vol.absolute = parseFloat(arrDims[1]);
            return Promise.resolve(vol);
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
        finally { this.endCommand(); }
    }
    public async stopDispense(): Promise<boolean> {
        try {
            this.beginCommand();
            await this.execCommand('X', 300);
            this.device.values.mode = this.transformDispenseMode('off', false);
            this.device.values.paused = false;
            this.device.values.volume = null;
            this.device.values.flowRate = null;
            this.device.values.dispenseTime = null;
            this.device.values.dispensing = false;
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.device.values });
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    public async pauseDispense(): Promise<boolean> {
        try {
            this.beginCommand();
            await this.execCommand('P', 300);
            let result = await this.execCommand('P,?', 300);
            let arrDims = result.split(',');
            let paused = utils.makeBool(arrDims[1]);
            this.device.values.paused = paused;
            this.device.values.mode = this.transformDispenseMode(this.device.values.mode.name, paused);
            await this.getDispenseStatus();
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.device.values });
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    public async dispenseContinuous(reverse: boolean = false): Promise<boolean> {
        try {
            this.beginCommand();
            await this.execCommand(`D,${utils.makeBool(reverse) ? '-*' : '*'}`, 300);
            this.device.values.continuous = true;
            this.device.values.dispensing = true;
            this.device.values.reverse = reverse;
            this.device.values.paused = false;
            this.device.values.volume = null;
            this.device.values.dispenseTime = null;
            this.device.values.flowRate = null;
            this.device.values.mode = this.transformDispenseMode('continuous', false);
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.device.values });
            this.getDispenseStatus();
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    public async dispenseVolume(volume: number, minutes?:number): Promise<boolean> {
        try {
            this.beginCommand();
            typeof minutes === 'undefined' || minutes <= 0 ? await this.execCommand(`D,${volume.toFixed(2)}`, 300) : await this.execCommand(`D,${volume.toFixed(2)}, ${Math.round(minutes)}`, 300);
            this.device.values.dispensing = true;
            this.device.values.reverse = volume < 0;
            this.device.values.dispenseTime = typeof minutes !== 'undefined' ? minutes : null;
            this.device.values.paused = false;
            this.device.values.continuous = false;
            this.device.values.volume = volume;
            this.device.values.flowRate = null;
            this.device.values.mode = this.transformDispenseMode(typeof minutes !== 'undefined' ? 'volOverTime' : 'vol', false);
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.device.values });
            this.getDispenseStatus();
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    public async dispenseFlowRate(rate: number, minutes?: number): Promise<boolean> {
        try {
            this.beginCommand();
            typeof minutes === 'undefined' || minutes <= 0 ? await this.execCommand(`DC,${rate.toFixed(2)},*`, 300) : await this.execCommand(`DC,${rate.toFixed(2)}, ${Math.round(minutes)}`, 300);
            this.device.values.flowRate = rate;
            this.device.values.dispensing = true;
            this.device.values.continuous = false;
            this.device.values.reverse = rate < 0;
            this.device.values.dispenseTime = typeof minutes !== 'undefined' ? minutes : null;
            this.device.values.volume = null;
            this.device.values.paused = false;
            this.device.values.mode = this.transformDispenseMode(typeof minutes !== 'undefined' ? 'flowOverTime' : 'flowRate', false);
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.device.values });
            this.getDispenseStatus();
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    public async dispense(opts:any): Promise<boolean> {
        try {
            if (typeof opts === 'undefined' || typeof opts.dispense === 'undefined') return Promise.reject(new Error('Cannot dispense EZO-PMP. Dispense options not provided'));
            let reverse = utils.makeBool(opts.dispense.reverse);
            let flowRate = (reverse) ? Math.abs(parseFloat(opts.dispense.flowRate)) * -1 : parseFloat(opts.dispense.flowRate);
            let volume = (reverse) ? Math.abs(parseFloat(opts.dispense.volume)) * -1 : parseFloat(opts.dispense.volume);
            switch (opts.dispense.method) {
                case 'continuous':
                    await this.dispenseContinuous(utils.makeBool(opts.dispense.reverse));
                    break;
                case 'volume':
                    if (isNaN(volume)) return Promise.reject(new Error(`Cannot dispense EZO-PMP by volume. Invalid volume ${opts.dispense.volume}`));
                    await this.dispenseVolume(volume);
                    break;
                case 'volumeOverTime':
                    if (isNaN(volume)) return Promise.reject(new Error(`Cannot dispense EZO-PMP by volume over time. Invalid volume ${opts.dispense.volume}`));
                    if (typeof opts.dispense.time === 'undefined' || isNaN(parseFloat(opts.dispense.time))) return Promise.reject(new Error(`Cannot dispense EZO-PMP by volume over time. Invalid time ${opts.dispense.time}`));
                    await this.dispenseVolume(volume, parseFloat(opts.dispense.time));
                    break;
                case 'flowRate':
                    if (isNaN(flowRate)) return Promise.reject(new Error(`Cannot dispense EZO-PMP by flow rate. Invalid flow rate ${opts.dispense.flowRate}`));
                    await this.dispenseFlowRate(flowRate);
                    break;
                case 'flowOverTime':
                    if (isNaN(flowRate)) return Promise.reject(new Error(`Cannot dispense EZO-PMP by flow rate over time. Invalid flow rate ${opts.dispense.flowRate}`));
                    if (typeof opts.dispense.time === 'undefined' || isNaN(parseFloat(opts.dispense.time))) return Promise.reject(new Error(`Cannot dispense EZO-PMP by flow rate over time. Invalid time ${opts.dispense.time}`));
                    await this.dispenseFlowRate(parseFloat(opts.dispense.flowRate), parseFloat(opts.dispense.time));
                    break;
            }
            return Promise.resolve(true);
        } catch (err) { this.logError(err); }
    }
    public async getCalibrated(): Promise<{ volume: boolean, time: boolean }> {
        try {
            this.beginCommand();
            let opts = { volume: false, time: false };
            let result = await this.execCommand('Cal,?', 300);
            let arrDims = result.split(',');
            let val = parseInt(arrDims[1] || '0');
            opts.volume = (val & 0x0001) > 0;
            opts.time = (val & 0x0002) > 0;
            return Promise.resolve(opts);
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    public async setCalibration(point: number): Promise<boolean> {
        try {
            this.beginCommand();
            await this.execCommand(`Cal,${point.toFixed(2)}`, 300);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    public async calibrate(data): Promise<I2cDevice> {
        try {
            this.beginCommand();
            if (typeof data === 'undefined' || typeof data.options === 'undefined') return Promise.reject(`Could not calibrate EZO-PMP invalid data format. ${JSON.stringify(data)}`);
            if (typeof data.options.calPoint !== 'undefined') await this.setCalibration(parseFloat(data.options.calPoint));
            else { return Promise.reject(`Could not calibrate EZO-PMP no setpoint was provided. ${JSON.stringify(data)}`) }
            this.device.options.calibration = await this.getCalibrated();
            return Promise.resolve(this.device);
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
        finally { this.endCommand(); }
    }
    public async setOptions(opts): Promise<any> {
        try {
            if (typeof opts.name !== 'undefined' && this.device.name !== opts.name) await this.setName(opts.name);
            if (typeof opts.isProtocolLocked !== 'undefined' && this.device.options.isProtocolLocked !== opts.isProtocolLocked) await this.lockProtocol(utils.makeBool(opts.isProtocolLocked));
            if (typeof opts.ledEnabled !== 'undefined' && this.device.options.ledEnabled !== opts.ledEnabled) await this.enableLed(utils.makeBool(opts.ledEnabled));
            if (typeof opts.readInterval === 'number') this.device.options.readInterval = opts.readInterval;
        }
        catch (err) { this.logError(err); Promise.reject(err); }
    }
}
export class AtlasEZOprs extends AtlasEZO {
    public async initAsync(deviceType): Promise<boolean> {
        try {
            if (this._timerRead) clearTimeout(this._timerRead);
            if (this._infoRead) clearTimeout(this._infoRead);
            this.device.options.name = await this.getName();
            await this.getInfo();
            this.device.options.isProtoLocked = await this.isProtocolLocked();
            await this.getLedEnabled();
            //this.device.options.status = await this.getStatus();
            this.device.options.readInterval = this.device.options.readInterval || deviceType.readings.pressure.interval.default;
            await this.getUnits(),
            this.device.options.decPlaces = await this.getDecPlaces()
            this.device.options.alarm = this.getAlarm();
            if (typeof this.device.options.name !== 'string' || this.device.options.name.length === 0) await this.setName(deviceType.name);
            else this.device.name = this.device.options.name;
            setTimeout(() => { this.getDeviceInformation(); }, 500);
            setTimeout(() => { this.readContinuous(); }, 1000);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.resolve(false); }
    }
    public async setOptions(opts): Promise<any> {
        try {
            if (typeof opts.name !== 'undefined' && this.device.name !== opts.name) await this.setName(opts.name);
            if (typeof opts.isProtocolLocked !== 'undefined' && this.device.options.isProtocolLocked !== opts.isProtocolLocked) await this.lockProtocol(utils.makeBool(opts.isProtocolLocked));
            if (typeof opts.ledEnabled !== 'undefined' && this.device.options.ledEnabled !== opts.ledEnabled) await this.enableLed(utils.makeBool(opts.ledEnabled));
            if (typeof opts.alarm !== 'undefined' &&
                (this.device.options.alarm.enable !== opts.alarm.enable || this.device.options.alarm.pressure !== opts.alarm.pressure || this.device.options.alarm.tolerance !== opts.alarm.tolerance)) {
                await this.setAlarm(utils.makeBool(opts.alarm.enable), opts.alarm.pressure, opts.alarm.tolerance);
            }
            if (typeof opts.decPlaces !== 'undefined' && this.device.options.decPlaces !== opts.decPlaces) await this.setDecPlaces(opts.decPlaces);
            if (typeof opts.units !== 'undefined' && typeof opts.units.name !== 'undefined' && this.device.options.units.name !== opts.units.name) await this.setUnits(opts.units.name);
            if (typeof opts.readInterval === 'number') this.device.options.readInterval = opts.readInterval;
        }
        catch (err) { this.logError(err); Promise.reject(err); }
    }
    public async readContinuous(): Promise<number> {
        try {
            if (this._timerRead) clearTimeout(this._timerRead);
            let pressure = await this.readProbe();
            this._timerRead = setTimeout(() => { this.readContinuous(); }, this.device.options.readInterval);
            return Promise.resolve(pressure);
        }
        catch (err) { this.logError(err); }
    }
    public async stopReadContinuous() { clearTimeout(this._timerRead); }
    public async readProbe(): Promise<number> {
        try {
            this.beginCommand();
            let result = await this.execCommand('R', 900);
            let val = parseFloat(result);
            if (typeof this.device.values === 'undefined') this.device.values = {};
            this.device.values.pressure = val;
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.device.values });
            return Promise.resolve(val);
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    public async setDecPlaces(decPlaces: number): Promise<boolean> {
        try {
            this.beginCommand();
            await this.execCommand(`Dec,${decPlaces}`, 900);
            this.device.options.decPlaces = decPlaces;
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    public async getDecPlaces(): Promise<number> {
        try {
            this.beginCommand();
            let result = await this.execCommand('Dec,?', 900);
            let arrDims = result.split(',');
            return Promise.resolve(parseInt(arrDims[1] || '0', 10));
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    public async getUnits(): Promise<boolean> {
        try {
            this.beginCommand();
            let result = await this.execCommand('U,?', 300);
            let arrDims = result.split(',');
            let units = this.transformUnits((arrDims[1] || 'psi').toLowerCase());
            this.device.values.units = units;
            if (typeof this.device.options.alarm === 'undefined') this.device.options.alarm = {};
            this.device.options.alarm.units = units;
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
        finally { this.endCommand(); }
    }
    public async setUnits(units: string): Promise<boolean> {
        try {
            this.beginCommand();
            await this.execCommand(`U,${units}`, 300);
            this.device.options.alarm.units = this.device.values.units = this.device.options.units = this.transformUnits(units);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    private transformUnits(code: string): { name: string, desc: string } { 
        let units = { name: code, desc: 'Unknown' };
        switch (code) {
            case 'psi':
                units.desc = 'Pounds per Square Inch';
                break;
            case 'atm':
                units.desc = 'Atmospheres';
                break;
            case 'bar':
                units.desc = 'Metric Pessure';
                break;
            case 'kPa':
                units.desc = 'Kilo-Pascals';
                break;
            case 'inh2o':
                units.desc = 'Inches of Water Column';
                break;
            case 'cmh2o':
                units.desc = 'Centimeters of Water Column';
                break;
        }
        return units;
    }
    public async setAlarm(enable: boolean, pressure?: number, tolerance?: number): Promise<boolean> {
        try {
            this.beginCommand();
            if (typeof this.device.options.alarm === 'undefined') this.device.options.alarm = {};
            if (enable) {
                if (typeof pressure === 'undefined' || typeof tolerance === 'undefined') return Promise.reject(new Error('Alarm must include a pressure setting and tolerance.'));
                await this.execCommand(`Alarm,en,1`, 300);
                await this.execCommand(`Alarm,${pressure}`, 300);
                await this.execCommand(`Alarm,tol,${tolerance}`, 300);
                this.device.options.alarm.enable = enable;
                this.device.options.alarm.pressure = pressure;
                this.device.options.alarm.tolerance = tolerance;
            }
            else {
                await this.execCommand(`Alarm,en,0`, 300);
                this.device.options.alarm.enable = enable;
            }
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    public async getAlarm(): Promise<boolean> {
        try {
            this.beginCommand();
            if (typeof this.device.options.alarm === 'undefined') this.device.options.alarm = {};
            let result = await this.execCommand('Alarm,?', 300);
            let arrDims = result.split(',');
            this.device.options.alarm.enable = arrDims.length > 2;
            this.device.options.alarm.pressure = parseInt(arrDims[1], 10);
            this.device.options.alarm.tolerance = parseInt(arrDims[2], 10);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
        finally { this.endCommand(); }
    }

}
export class AtlasEZOrtd extends AtlasEZO {
    public async initAsync(deviceType): Promise<boolean> {
        try {
            if (this._timerRead) clearTimeout(this._timerRead);
            if (this._infoRead) clearTimeout(this._infoRead);
            this.device.options.name = await this.getName();
            await this.getInfo();
            this.device.options.isProtocolLocked = await this.isProtocolLocked();
            await this.getLedEnabled();
            this.device.options.calibrationMode = await this.getCalibrated();
            //this.device.options.status = await this.getStatus();
            this.device.options.scale = await this.getScale();
            this.device.options.calibration = await this.exportCalibration();
            this.device.options.readInterval = this.device.options.readInterval || deviceType.readings.temperature.interval.default;
            if (typeof this.device.options.name !== 'string' || this.device.options.name.length === 0) await this.setName(deviceType.name);
            else this.device.name = this.device.options.name;
            setTimeout(() => { this.getDeviceInformation(); }, 500);
            setTimeout(() => { this.readContinuous(); }, 1000);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.resolve(false); }
    }
    public async setOptions(opts): Promise<any> {
        try {
            if (typeof opts.name !== 'undefined' && this.device.name !== opts.name) await this.setName(opts.name);
            if (typeof opts.isProtocolLocked !== 'undefined' && utils.makeBool(this.device.options.isProtocolLocked) !== utils.makeBool(opts.isProcolLocked)) await this.lockProtocol(utils.makeBool(opts.isProtocolLocked));
            if (typeof opts.ledEnabled !== 'undefined' && this.device.options.ledEnabled !== opts.ledEnabled) await this.enableLed(utils.makeBool(opts.ledEnabled));
            if (typeof opts.readInterval === 'number') this.device.options.readInterval = opts.readInterval;
            if (typeof this.device.options.scale === 'undefined') this.device.options.scale = await this.getScale();
            if (typeof opts.scale === 'string' && opts.scale.length > 0 && opts.scale.toLowerCase() !== this.device.options.scale.toLowerCase()) await this.setScale(opts.scale);
        }
        catch (err) { this.logError(err); Promise.reject(err); }
    }
    public async readContinuous(): Promise<number> {
        try {
            if (this._timerRead) clearTimeout(this._timerRead);
            let temperature = await this.readProbe();
            this._timerRead = setTimeout(() => { this.readContinuous(); }, this.device.options.readInterval);
            return Promise.resolve(temperature);
        }
        catch (err) { this.logError(err); }
    }
    public async getCalibrated(): Promise<boolean> {
        try {
            this.beginCommand();
            let result = await this.execCommand('Cal,?', 300);
            let arrDims = result.split(',');
            return Promise.resolve(utils.makeBool(arrDims[1]));
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    public async getScale(): Promise<string> {
        try {
            this.beginCommand();
            let result = await this.execCommand('S,?', 300);
            let arrDims = result.split(',');
            this.device.options.calibration.units = this.device.values.units = this.device.options.scale = (arrDims[1] || 'c').toUpperCase();
            return Promise.resolve(this.device.options.scale);
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
        finally { this.endCommand(); }
    }
    public async setScale(value: string): Promise<boolean> {
        try {
            this.beginCommand();
            await this.execCommand(`S,${value.toLowerCase()}`, 300);
            this.device.options.calibration.units = this.device.values.units = this.device.options.scale = value.toUpperCase();
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    public async setCalibrationPoint(value: number): Promise<boolean> {
        try {
            this.beginCommand();
            await this.execCommand(`Cal,${value.toFixed(2)}`, 600);
            this.device.options.calPoint = value;
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    public async calibrate(data): Promise<I2cDevice> {
        try {
            if (typeof data === 'undefined' || typeof data.options === 'undefined') return Promise.reject(`Could not calibrate EZO-RTD invalid data format. ${JSON.stringify(data)}`);
            if (typeof data.options.calPoint !== 'undefined') await this.setCalibrationPoint(parseFloat(data.options.calPoint));
            else { return Promise.reject(`Could not calibrate EZO-RTD no setpoint was provided. ${JSON.stringify(data)}`) }
            this.device.options.calibrationMode = await this.getCalibrated();
            return Promise.resolve(this.device);
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
    }
    public async getName(): Promise<string> {
        try {
            this.beginCommand();
            let result = await this.execCommand('Name,?', 300);
            let arrDims = result.split(',');
            logger.info(`Got RTD Name ${JSON.stringify(arrDims)}`);
            return Promise.resolve(arrDims[1] || '');
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    public async setName(name: string): Promise<boolean> {
        try {
//            await this.execCommand(`Name,${this.escapeName(name)}`, 300);
            this.device.options.name = this.device.name = this.escapeName(name);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async readProbe(): Promise<number> {
        try {
            this.beginCommand();
            let result = await this.execCommand('R', 600);
            let val = parseFloat(result);
            this.device.values.temperature = val;
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.device.values });
            return Promise.resolve(val);
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
    public async exportCalibration(): Promise<{ len: number, total: number, data: string[] }> {
        try {
            this.beginCommand();
            let result = await this.execCommand('Export,?', 300);
            let arrDims = result.split(',');
            let dims = { len: parseInt(arrDims[1], 10), total: parseInt(arrDims[2], 10), data: [] };
            for (let i = 0; i <= dims.len; i++) {
                let val = await this.execCommand('Export', 300);
                dims.data.push(val);
            }
            return Promise.resolve(dims);
        }
        catch (err) { this.logError(err); }
        finally { this.endCommand(); }
    }
}


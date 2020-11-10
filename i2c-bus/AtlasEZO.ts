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
    protected _suspendPolling: number = 0;
    protected _pollInformationInterval = 5000;
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
    protected get version(): number { return typeof this.device !== 'undefined' && this.device.options !== 'undefined' && typeof this.device.info !== 'undefined' ? parseFloat(this.device.info.firmware) : 0 }
    protected processing = 0;
    protected async execCommand(command: string, timeout: number, length: number = 31): Promise<string> {
        try {
            while (this.processing > 0) {
                if (this.processing++ > 5) {
                    return Promise.reject(new Error(`${this.device.name}: Node busy could not send command ${command}`))
                }
                logger.info(`${this.device.name}: Node busy waiting to send command ${command}`);
                await new Promise((resolve, reject) => { setTimeout(() => resolve(), 150); });
            }
            this.processing = 1;
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
        finally { this.processing = 0; }
    }
    protected pollDeviceInformation() {
        try {
            if (this._infoRead) clearTimeout(this._infoRead);
            this._infoRead = null;
            if (!this.suspendPolling) {
                this.getDeviceInformation();
            }
        }
        catch (err) { this.logError(err, 'Error Polling Device Information'); }
        finally { this._infoRead = setTimeout(() => { this.pollDeviceInformation(); }, this._pollInformationInterval); }
    }
    protected pollReadings() {
        try {
            if (this._timerRead) clearTimeout(this._timerRead);
            this._timerRead == null;
            if (!this.suspendPolling) {
                this.takeReadings();
            }
        }
        catch (err) { this.logError(err, 'Error Polling Device Values'); }
        finally { this._timerRead = setTimeout(() => { this.pollReadings }, this.device.options.readInterval) }
    }
    public async takeReadings(): Promise<boolean> {
        try { return Promise.resolve(true); }
        catch (err) { this.logError(err, 'Error taking device readings'); }
    }
    public get suspendPolling(): boolean { if (this._suspendPolling > 0) logger.warn(`${this.device.name} Suspend Polling ${this._suspendPolling}`); return this._suspendPolling > 0; }
    public set suspendPolling(val: boolean) {
        if(!val) logger.warn(`${this.device.name} Cancel Suspend Start ${this._suspendPolling} - End ${Math.max(0, this._suspendPolling + (val ? 1 : -1))}`);
        this._suspendPolling = Math.max(0, this._suspendPolling + (val ? 1 : -1));
    }
    public stopPolling() {
        this.suspendPolling = true;
        if (this._timerRead) clearTimeout(this._timerRead);
        if (this._infoRead) clearTimeout(this._infoRead);
        this._timerRead = this._infoRead = null;
        this._suspendPolling = 0;
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
            let result = await this.execCommand('Status', 300);
            if (this.i2c.isMock) return Promise.resolve(true);
            let arrDims = result.split(',');
            this.device.info.vcc = parseFloat(arrDims[2] || '0');
            this.device.info.lastRestart = this.transformRestart((arrDims[1] || 'U').toUpperCase());
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err, `Error getting device status:`); return Promise.reject(err); }
    }
    public async getLedEnabled(): Promise<boolean> {
        try {
            let result = await this.execCommand('L,?', 300);
            let arrDims = result.split(',');
            this.device.options.ledEnabled = utils.makeBool(arrDims[1]);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
    }
    public async enableLed(enable: boolean): Promise<boolean> {
        try {
            let result = await this.execCommand(`L,${enable ? '1' : '0'}`, 300);
            this.device.options.ledEnabled = enable;
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
    }
    public async getInfo(): Promise<{ device: string, firmware: string }> {
        try {
            let result = await this.execCommand('i', 300);
            let arrDims = result.split(',');
            if (typeof this.device.info === 'undefined') this.device.info = {};
            this.device.info.device = arrDims[1] || '';
            this.device.info.firmware = arrDims[2] || '';
            return Promise.resolve({ device: arrDims[1] || '', firmware: arrDims[2] || '' });
        }
        catch (err) { logger.error(`Error getting info ${err.message}`); return Promise.reject(err); }
    }
    public async getDeviceInformation(): Promise<boolean> {
        try {
            if (this._infoRead) clearTimeout(this._infoRead);
            await this.getStatus();
            webApp.emitToClients('i2cDeviceInformation', { bus: this.i2c.busNumber, address: this.device.address, options: { deviceInfo: this.device.info } });
        }
        catch (err) { logger.error(`Error retrieving device status: ${err.message}`); return Promise.reject(err); }
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
            await this.i2c.writeCommand(this.device.address, 'Sleep');
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async closeAsync(): Promise<void> {
        try {
            await this.stopPolling();
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
            this.stopPolling();
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
            this.pollDeviceInformation();
            this.pollReadings();
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.resolve(false); }
    }
    public async setOptions(opts): Promise<any> {
        try {
            this.suspendPolling = true;
            if (typeof opts.name !== 'undefined' && this.device.name !== opts.name) await this.setName(opts.name);
            if (typeof opts.isProtocolLocked !== 'undefined' && this.device.options.isProtocolLocked !== opts.isProcolLocked) await this.lockProtocol(utils.makeBool(opts.isProtocolLocked));
            if (typeof opts.ledEnabled !== 'undefined' && this.device.options.ledEnabled !== opts.ledEnabled) await this.enableLed(utils.makeBool(opts.ledEnabled));
            if (typeof opts.readInterval === 'number') this.device.options.readInterval = opts.readInterval;
        }
        catch (err) { this.logError(err); Promise.reject(err); }
        finally { this.suspendPolling = false };
    }
    public async takeReadings(): Promise<boolean> {
        try {
            if (this._timerRead) clearTimeout(this._timerRead);
            await this.readProbe();
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async getCalibrated(): Promise<boolean> {
        try {
            let result = await this.execCommand('cal,?', 300);
            let arrDims = result.split(',');
            this.device.options.calibrationMode = utils.makeBool(arrDims[1]);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async setCalibrationPoint(value: number): Promise<boolean> {
        try {
            await this.execCommand(`Cal,${Math.floor(value)}`, 900);
            this.device.options.calPoint = Math.floor(value);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async calibrate(data): Promise<I2cDevice> {
        try {
            if (typeof data === 'undefined' || typeof data.options === 'undefined') return Promise.reject(`Could not calibrate EZO-ORP invalid data format. ${JSON.stringify(data)}`);
            if (typeof data.options.calPoint !== 'undefined') await this.setCalibrationPoint(parseFloat(data.options.calPoint));
            else { return Promise.reject(`Could not calibrate EZO-ORP no setpoint was provided. ${JSON.stringify(data)}`) }
            this.device.options.calibrationMode = await this.getCalibrated();
            return Promise.resolve(this.device);
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
    }

    public async getName(): Promise<string> {
        try {
            let result = await this.execCommand('Name,?', 300);
            let arrDims = result.split(',');
            return Promise.resolve(arrDims[1] || '');
        }
        catch (err) { this.logError(err); }
    }
    public async setName(name: string): Promise<boolean> {
        try {
            await this.execCommand(`Name,${this.escapeName(name)}`, 300);
            this.device.options.name = this.device.name = this.escapeName(name);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async readProbe(): Promise<number> {
        try {
            let result = await this.execCommand('R', 900);
            let val = parseFloat(result);
            this.device.values.orp = val;
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.device.values });
            return Promise.resolve(val);
        }
        catch (err) { this.logError(err); }
    }
    public async exportCalibration(): Promise<{ len: number, total: number, data: string[] }> {
        try {
            this.suspendPolling = true;
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
        finally { this.suspendPolling = false; }
    }
}
export class AtlasEZOpH extends AtlasEZO {
    public async initAsync(deviceType): Promise<boolean> {
        try {
            this.stopPolling();
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
            this.pollDeviceInformation();
            this.pollReadings();
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.resolve(false); }
    }
    public async setOptions(opts): Promise<any> {
        try {
            this.suspendPolling = true;
            if (typeof opts.name !== 'undefined' && this.device.name !== opts.name) await this.setName(opts.name);
            if (typeof opts.isProtocolLocked !== 'undefined' && this.device.options.isProtocolLocked !== opts.isProtocolLocked) await this.lockProtocol(utils.makeBool(opts.isProtocolLocked));
            if (typeof opts.extendedScale !== 'undefined' && this.device.options.extendedScale !== opts.extendedScale) await this.setExtendedScale(utils.makeBool(opts.extendedScale));
            if (typeof opts.tempCompensation === 'number' && this.device.options.tempCompensation !== opts.tempCompensation) await this.setTempCompensation(opts.tempCompensation);
            if (typeof opts.ledEnabled !== 'undefined' && this.device.options.ledEnabled !== opts.ledEnabled) await this.enableLed(utils.makeBool(opts.ledEnabled));
            if (typeof opts.readInterval === 'number') this.device.options.readInterval = opts.readInterval;
            return Promise.resolve(this.device.options);
        }
        catch (err) { this.logError(err); Promise.reject(err); }
        finally { this.suspendPolling = false; }
    }
    public async takeReadings(): Promise<boolean> {
        try {
            if (this._timerRead) clearTimeout(this._timerRead);
            await this.readProbe();
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async calibrate(data): Promise<I2cDevice> {
        try {
            this.suspendPolling = true;
            if (typeof data === 'undefined' || typeof data.options === 'undefined') return Promise.reject(`Could not calibrate EZO-PH invalid data format. ${JSON.stringify(data)}`);
            if (typeof data.options.calMidPoint !== 'undefined') await this.setCalibrationPoint('mid', parseFloat(data.options.calMidPoint));
            else if (typeof data.options.calLowPoint !== 'undefined') await this.setCalibrationPoint('low', parseFloat(data.options.calLowPoint));
            else if (typeof data.options.calHighPoint !== 'undefined') await this.setCalibrationPoint('high', parseFloat(data.options.calHighPoint));
            else { return Promise.reject(`Could not calibrate EZO-PH no setpoint was provided. ${JSON.stringify(data)}`) }
            await this.getCalibrated();
            await this.getSlope();
            return Promise.resolve(this.device);
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
        finally { this.suspendPolling = false; }
    }
    public async readProbe(tempCompensation?: number): Promise<number> {
        try {
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
    }
    public async getExtendedScale(): Promise<boolean> {
        try {
            let result = await this.execCommand('pHext,?', 300);
            let arrDims = result.split(',');
            this.device.options.extendedScale = utils.makeBool(arrDims[1]);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async getCalibrated(): Promise<boolean> {
        try {
            let result = await this.execCommand('cal,?', 300);
            let arrDims = result.split(',');
            this.device.options.calibrationMode = parseInt(arrDims[1] || '0', 10);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async setCalibrationPoint(point: string, value: number): Promise<boolean> {
        try {
            await this.execCommand(`Cal,${point},${value.toFixed(2)}`, 900);
            let ptName = `cal${point.substring(0, 1).toUpperCase()}${point.substring(1).toLowerCase()}Point`;
            this.device.options[ptName] = value;
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async getName(): Promise<string> {
        try {
            let result = await this.execCommand('Name,?', 300);
            let arrDims = result.split(',');
            return Promise.resolve(arrDims[1] || '');
        }
        catch (err) { this.logError(err); }
    }
    public async setName(name: string): Promise<boolean> {
        try {
            await this.execCommand(`Name,${this.escapeName(name)}`, 300);
            this.device.name = this.device.options.name = this.escapeName(name);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async getSlope(): Promise<boolean> {
        try {
            let result = await this.execCommand('Slope,?', 300);
            let arrDims = result.split(',');
            this.device.options.slope = { acid: parseFloat(arrDims[1] || '0'), base: parseFloat(arrDims[2] || '0'), mV: parseFloat(arrDims[3] || '0') }
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async getTempCompensation(): Promise<boolean> {
        try {
            let result = await this.execCommand('T,?', 300);
            let arrDims = result.split(',');
            this.device.values.temperature = parseFloat(arrDims[1] || '25');
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.device.values });
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async setTempCompensation(value: number): Promise<boolean> {
        try {
            await this.execCommand(`T,${value.toFixed(1)}`, 300);
            this.device.values.temperature = value;
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.device.values });
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async setExtendedScale(val: boolean): Promise<boolean> {
        try {
            await this.execCommand('pHext,' + (val ? '1' : '0'), 300);
            this.device.options.extendedScale = val;
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async exportCalibration(): Promise<{ len: number, total: number, data: string[] }> {
        try {
            this.suspendPolling = true;
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
        finally { this.suspendPolling = false; }
    }
}
export class AtlasEZOpmp extends AtlasEZO {
    public async initAsync(deviceType): Promise<boolean> {
        try {
            this.stopPolling();
            this._pollInformationInterval = 10000;
            this.device.options.name = await this.getName();
            await this.getInfo();
            this.device.options.isProtoLocked = await this.isProtocolLocked();
            await this.getLedEnabled();
            await this.getParameterInfo();
            if (!this.device.options.parameters.pumpVolume) await this.enableParameter('V', true);
            if (!this.device.options.parameters.pumpTotal) await this.enableParameter('TV', true);
            if (!this.device.options.parameters.pumpAbsolute) await this.enableParameter('ATV', true);
            this.device.options.calibration = await this.getCalibrated();
            if (typeof this.device.options.name !== 'string' || this.device.options.name.length === 0) await this.setName(deviceType.name);
            else this.device.name = this.escapeName(this.device.options.name);
            this.device.options.readInterval = this.device.options.readInterval || deviceType.readings.dispensed.interval.default;
            this.pollDeviceInformation();
            // This device does not have readings to poll if the pump is not running so we will set a timeout to get the device
            // pumping information.  If it is running it will ask for it again.
            setTimeout(() => { this.getDispenseStatus() }, 500);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.resolve(false); }
    }
    public async getName(): Promise<string> {
        try {
            let result = await this.execCommand('Name,?', 300);
            let arrDims = result.split(',');
            return Promise.resolve(arrDims[1] || '');
        }
        catch (err) { this.logError(err); }
    }
    public async setName(name: string): Promise<boolean> {
        try {
            await this.execCommand(`Name,${this.escapeName(name)}`, 300);
            this.device.name = this.device.options.name = this.escapeName(name);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
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
    public async getPumpVoltage(): Promise<boolean> {
        try {
            let result = await this.execCommand('PV,?', 300);
            let arrDims = result.split(',');
            this.device.info.pumpVoltage = parseFloat(arrDims[1] || '0');
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err, `Error getting pump voltage: `); return Promise.reject(err); }
    }
    public async getDeviceInformation(): Promise<boolean> {
        try {
            await this.getPumpVoltage();
            await super.getDeviceInformation();
        }
        catch (err) { return Promise.reject(err); }
    }
    public async getParameterInfo(): Promise<boolean> {
        try {
            let result = await this.execCommand('O,?', 300);
            let params = result.toUpperCase();
            if (typeof this.device.options.parameters === 'undefined') this.device.options.parameters = {};
            this.device.options.parameters.pumpVolume = params.indexOf(',V') >= 0;
            this.device.options.parameters.pumpTotal = params.indexOf(',TV') >= 0;
            this.device.options.parameters.pumpAbsolute = params.indexOf(',ATV') >= 0;
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async enableParameter(param: string, enable:boolean = true): Promise<boolean> {
        try {
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
    }
    public async getDispenseStatus(): Promise<{ dispensing: boolean, volume?: number, continuous: boolean, reverse: boolean, maxRate: number, mode: { name: string, desc: string } }> {
        if (this.suspendPolling) return Promise.resolve(this.device.values);
        try {
            this.suspendPolling = true;
            let result = await this.execCommand('D,?', 300);
            let arrDims = result.split(',');
            let run = parseInt(arrDims[2] || '0', 10);
            if (isNaN(run)) run = 0;
            this.device.values.dispensing = run !== 0;
            this.device.values.reverse = run < 0;
            this.device.values.continuous = this.device.values.dispensing && arrDims[1].indexOf('*') !== -1;
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
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.device.values });
            return Promise.resolve(this.device.values);
        }
        catch (err) { logger.error(new Error(`Could not get dispense status: ${err.message}`)); }
        finally { if (this.device.values.dispensing) this._timerRead = setTimeout(() => { this.getDispenseStatus(); }, this.device.options.readInterval); this.suspendPolling = false; }
    }
    public async getVolumeDispensed(): Promise<{ total: number, absolute: number }> {
        try {
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
    }
    public async stopDispense(): Promise<boolean> {
        try {
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
    }
    public async pauseDispense(): Promise<boolean> {
        try {
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
    }
    public async dispenseContinuous(reverse: boolean = false): Promise<boolean> {
        try {
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
    }
    public async dispenseVolume(volume: number, minutes?:number): Promise<boolean> {
        try {
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
    }
    public async dispenseFlowRate(rate: number, minutes?: number): Promise<boolean> {
        try {
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
            let opts = { volume: false, time: false };
            let result = await this.execCommand('Cal,?', 300);
            let arrDims = result.split(',');
            let val = parseInt(arrDims[1] || '0');
            opts.volume = (val & 0x0001) > 0;
            opts.time = (val & 0x0002) > 0;
            return Promise.resolve(opts);
        }
        catch (err) { this.logError(err); }
    }
    public async setCalibration(point: number): Promise<boolean> {
        try {
            await this.execCommand(`Cal,${point.toFixed(2)}`, 300);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async calibrate(data): Promise<I2cDevice> {
        try {
            if (typeof data === 'undefined' || typeof data.options === 'undefined') return Promise.reject(`Could not calibrate EZO-PMP invalid data format. ${JSON.stringify(data)}`);
            if (typeof data.options.calPoint !== 'undefined') await this.setCalibration(parseFloat(data.options.calPoint));
            else { return Promise.reject(`Could not calibrate EZO-PMP no setpoint was provided. ${JSON.stringify(data)}`) }
            this.device.options.calibration = await this.getCalibrated();
            return Promise.resolve(this.device);
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
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
            this.stopPolling();
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
            setTimeout(() => { this.pollDeviceInformation() }, 500);
            setTimeout(() => { this.pollReadings(); }, 1000);
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
    public async takeReadings(): Promise<boolean> {
        try {
            await this.readProbe();
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async readProbe(): Promise<number> {
        try {
            let result = await this.execCommand('R', 900);
            let val = parseFloat(result);
            if (typeof this.device.values === 'undefined') this.device.values = {};
            this.device.values.pressure = val;
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.device.values });
            return Promise.resolve(val);
        }
        catch (err) { this.logError(err); }
    }
    public async setDecPlaces(decPlaces: number): Promise<boolean> {
        try {
            await this.execCommand(`Dec,${decPlaces}`, 900);
            this.device.options.decPlaces = decPlaces;
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async getDecPlaces(): Promise<number> {
        try {
            let result = await this.execCommand('Dec,?', 900);
            let arrDims = result.split(',');
            return Promise.resolve(parseInt(arrDims[1] || '0', 10));
        }
        catch (err) { this.logError(err); }
    }
    public async getUnits(): Promise<boolean> {
        try {
            let result = await this.execCommand('U,?', 300);
            let arrDims = result.split(',');
            let units = this.transformUnits((arrDims[1] || 'psi').toLowerCase());
            this.device.values.units = units;
            if (typeof this.device.options.alarm === 'undefined') this.device.options.alarm = {};
            this.device.options.alarm.units = units;
            this.device.options.units = units;
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
    }
    public async setUnits(units: string): Promise<boolean> {
        try {
            await this.execCommand(`U,${units}`, 300);
            if (typeof this.device.options.alarm === 'undefined') this.device.options.alarm = {};
            this.device.options.alarm.units = this.device.values.units = this.device.options.units = this.transformUnits(units);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
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
            this.suspendPolling = true;
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
        finally { this.suspendPolling = false; }
    }
    public async getAlarm(): Promise<boolean> {
        try {
            if (typeof this.device.options.alarm === 'undefined') this.device.options.alarm = {};
            let result = await this.execCommand('Alarm,?', 300);
            let arrDims = result.split(',');
            this.device.options.alarm.enable = arrDims.length > 2;
            this.device.options.alarm.pressure = parseInt(arrDims[1], 10);
            this.device.options.alarm.tolerance = parseInt(arrDims[2], 10);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
    }
}
export class AtlasEZOrtd extends AtlasEZO {
    public async initAsync(deviceType): Promise<boolean> {
        try {
            this.stopPolling();
            // NAME,? always returns an empty string.  This doesn't work on RTD.
            //this.device.name = this.device.options.name = (typeof this.device.options.name === 'undefined' || this.device.options.name === '') ? deviceType.name : this.device.options.name;
            await this.getInfo();
            this.device.options.isProtocolLocked = await this.isProtocolLocked();
            await this.getLedEnabled();
            this.device.options.calibrationMode = await this.getCalibrated();
            //this.device.options.status = await this.getStatus();
            await this.getScale();
            await this.exportCalibration();
            this.device.options.readInterval = this.device.options.readInterval || deviceType.readings.temperature.interval.default;
            if (typeof this.device.options.name !== 'string' || this.device.options.name.length === 0) await this.setName(deviceType.name);
            else this.device.name = this.device.options.name;
            setTimeout(() => { this.pollDeviceInformation(); }, 500);
            setTimeout(() => { this.pollReadings(); }, 1000);
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
            if (typeof this.device.options.scale === 'undefined') await this.getScale();
            if (typeof opts.scale === 'string' && opts.scale.length > 0 && opts.scale.toLowerCase() !== this.device.options.scale.toLowerCase()) await this.setScale(opts.scale);
        }
        catch (err) { this.logError(err); Promise.reject(err); }
    }
    public async takeReadings(): Promise<boolean> {
        try {
            await this.readProbe();
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async getCalibrated(): Promise<boolean> {
        try {
            let result = await this.execCommand('Cal,?', 300);
            let arrDims = result.split(',');
            return Promise.resolve(utils.makeBool(arrDims[1]));
        }
        catch (err) { this.logError(err); }
    }
    public async getScale(): Promise<boolean> {
        try {
            let result = await this.execCommand('S,?', 300);
            let arrDims = result.split(',');
            if (typeof this.device.options.calibration === 'undefined') this.device.options.calibration = {};
            this.device.options.calibration.units = this.device.values.units = this.device.options.scale = (arrDims[1] || 'c').toUpperCase();
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
    }
    public async setScale(value: string): Promise<boolean> {
        try {
            await this.execCommand(`S,${value.toLowerCase()}`, 300);
            if (typeof this.device.options.calibration === 'undefined') this.device.options.calibration = {};
            this.device.options.calibration.units = this.device.values.units = this.device.options.scale = value.toUpperCase();
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async setCalibrationPoint(value: number): Promise<boolean> {
        try {
            await this.execCommand(`Cal,${value.toFixed(2)}`, 600);
            this.device.options.calPoint = value;
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async calibrate(data): Promise<I2cDevice> {
        try {
            this.suspendPolling = true;
            if (typeof data === 'undefined' || typeof data.options === 'undefined') return Promise.reject(`Could not calibrate EZO-RTD invalid data format. ${JSON.stringify(data)}`);
            if (typeof data.options.calPoint !== 'undefined') await this.setCalibrationPoint(parseFloat(data.options.calPoint));
            else { return Promise.reject(`Could not calibrate EZO-RTD no setpoint was provided. ${JSON.stringify(data)}`) }
            this.device.options.calibrationMode = await this.getCalibrated();
            return Promise.resolve(this.device);
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
        finally { this.suspendPolling = false; }
    }
    public async getName(): Promise<string> {
        try {
            let result = await this.execCommand('Name,?', 300);
            let arrDims = result.split(',');
            return Promise.resolve(arrDims[1] || '');
        }
        catch (err) { this.logError(err); }
    }
    public async setName(name: string): Promise<boolean> {
        try {
            this.device.options.name = this.device.name = this.escapeName(name);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async readProbe(): Promise<number> {
        try {
            let result = await this.execCommand('R', 600);
            let val = parseFloat(result);
            this.device.values.temperature = val;
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.device.values });
            return Promise.resolve(val);
        }
        catch (err) { this.logError(err); }
    }
    public async exportCalibration(): Promise<{ len: number, total: number, data: string[] }> {
        try {
            this.suspendPolling = true;
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
        finally { this.suspendPolling = false; }
    }
}


//*EZO-pH
//*EZO-ORP
//EZO-DO(Dissolved Oxygen)
//*EZO-EC(Conductivity)
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
import { I2cDevice, DeviceBinding } from "../boards/Controller";

export class AtlasEZO extends i2cDeviceBase {
    protected _timerRead: NodeJS.Timeout;
    protected _infoRead: NodeJS.Timeout;
    protected _suspendPolling: number = 0;
    protected _pollInformationInterval = 7000;
    protected logError(err, msg?: string) { logger.error(`${this.device.name} ${typeof msg !== 'undefined' ? msg + ' ' : ''}${typeof err !== 'undefined' ? err.message : ''}`); }
    protected createError(byte, command): Error {
        let err: Error;
        switch (byte) {
            case 255:
                err = new Error(`${this.device.address} ${command} No I2c data to send`);
                break;
            case 254:
                err = new Error(`${this.device.address} ${command} Still processing not ready`);
                break;
            case 2:
                err = new Error(`${this.device.address} ${command} Syntax error`);
                break;
        }
        return err;
    }
    protected escapeName(name: string): string { return name.substring(0, 15).replace(/\s+/g, '_'); }
    protected get version(): number { return typeof this.device !== 'undefined' && this.options !== 'undefined' && typeof this.device.info !== 'undefined' ? parseFloat(this.device.info.firmware) : 0 }
    protected processing = 0;
    protected _tries = 0;
    protected async tryCommand(command: string, timeout: number, length: number = 31): Promise<{ response: number, data?: string, error?: Error }> {
        try {
            this.suspendPolling = true;
            this._tries++;
            let w = await this.i2c.writeCommand(this.device.address, command);
            if (timeout > 0) {
                await new Promise<void>((resolve, reject) => { setTimeout(() => resolve(), timeout); });
                let value = await this.i2c.read(this.device.address, length);
                switch (value.buffer[0]) {
                    case 0:
                    case 1:
                        break;
                    case 254:
                        if (this._tries < 3) {
                            logger.warn(`${this.device.name} - Device not ready re-trying the command ${command} again: Retries ${this._tries - 1}.`)
                            await new Promise<void>((resolve, reject) => { setTimeout(() => resolve(), 600); });
                            return await this.tryCommand(command, timeout, length);
                        }
                    default:
                        this.hasFault = true;
                        return Promise.resolve({ response: value.buffer[0], error: this.createError(value.buffer[0], command) });
                }
                let data = value.buffer.toString('utf8', 1).replace(/^[\s\uFEFF\xA0\0]+|[\s\uFEFF\xA0\0]+$/g, '');
                logger.debug(`${this.device.name} command ${command} bytes written:${w} result:${data}`);
                this.hasFault = false;
                this.lastComm = new Date().getTime();
                return Promise.resolve({ response: value.buffer[0], data: data });
            }
            else {
                logger.debug(`${this.device.name} command ${command} bytes written:${w} without response`);
                this.hasFault = false;
                this.lastComm = new Date().getTime();
                return Promise.resolve({ response: 0, data: 'Reset' });
            }
        }
        catch (err) { this.hasFault = true; return Promise.resolve({ response: -1, error: err }); }
        finally { this.suspendPolling = false; }
    }
    protected async execCommand(command: string, timeout: number, length: number = 31): Promise<string> {
        try {
            // Wait until we get an open slot to start processing.  This will be indicated because the processing
            // flag will drop to 0.  Below is designed to wait at least 1.5 seconds for other commands to finish
            // before sending the command.
            while (this.processing > 0) {
                if (this.processing++ > 10) {
                    return Promise.reject(new Error(`${this.device.name}: Device busy could not send command ${command}`))
                }
                logger.debug(`${this.device.name}: Node busy waiting to send command ${command}`);
                await new Promise<void>((resolve, reject) => { setTimeout(() => resolve(), 150); });
            }
            this.processing = 1;
            this._tries = 0;
            let result = await this.tryCommand(command, timeout, length);
            return result.response <= 1 ? Promise.resolve(result.data) : Promise.reject(result.error);
            //let w = await this.i2c.writeCommand(this.device.address, command);
            //await new Promise((resolve, reject) => { setTimeout(() => resolve(), timeout); });
            //let value = await this.i2c.read(this.device.address, length);
            //// Check the first byte of the buffer.  This is the error code.
            //switch (value.buffer[0]) {
            //    case 1:
            //        break;
            //    case 0:
            //        break;
            //    default:
            //        let err = this.createError(value.buffer[0], command);
            //        return Promise.reject(err);
            //}
            //let data = value.buffer.toString('utf8', 1).replace(/^[\s\uFEFF\xA0\0]+|[\s\uFEFF\xA0\0]+$/g, '');
            //logger.info(`${this.device.name} command ${command} bytes written:${w} result:${data}`);
            //return Promise.resolve(data);
        }
        catch (err) { return Promise.reject(err); }
        finally { this.processing = 0; }
    }
    protected pollDeviceInformation() {
        try {
            if (this._infoRead) clearTimeout(this._infoRead);
            this._infoRead = null;
            if (!this.suspendPolling && this.device.isActive) {
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
            if (this.device.isActive) {
                if (!this.suspendPolling) {
                    (async () => {
                        try {
                            await this.takeReadings();
                        } catch (err) { this.logError(err, 'Error taking device readings'); }
                    })();
                }
                else logger.warn(`${this.device.name} Suspend Polling ${this._suspendPolling}`);
            }
        }
        catch (err) { this.logError(err, 'Error Polling Device Values'); }
        finally { this._timerRead = setTimeout(() => { this.pollReadings(); }, this.options.readInterval) }
    }
    public async takeReadings(): Promise<boolean> {
        try { return Promise.resolve(true); }
        catch (err) { this.logError(err, 'Error taking device readings'); }
    }
    public get suspendPolling(): boolean { return this._suspendPolling > 0; }
    public set suspendPolling(val: boolean) {
        //if(!val) logger.warn(`${this.device.name} Cancel Suspend Start ${this._suspendPolling} - End ${Math.max(0, this._suspendPolling + (val ? 1 : -1))}`);
        this._suspendPolling = Math.max(0, this._suspendPolling + (val ? 1 : -1));
    }
    public stopPolling() {
        this.suspendPolling = true;
        if (this._timerRead) clearTimeout(this._timerRead);
        if (this._infoRead) clearTimeout(this._infoRead);
        this._timerRead = this._infoRead = null;
        this._suspendPolling = 0;
    }
    public async resetDevice(dev): Promise<any> {
        try {
            this.stopPolling();
            await this.execCommand('Factory', -1);
            // Wait for 5 seconds then re-initialize
            await new Promise<void>((resolve, reject) => { setTimeout(() => resolve(), 10000); });
            let dt = this.device.getDeviceType();
            await this.initAsync(dt);
            return this.device;
        } catch (err) { }
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
            this.options.isProtocolLocked = val;
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
            this.device.name = this.options.name = name;
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async isProtocolLocked() {
        try {
            this.suspendPolling = true;
            let result = await this.execCommand('Plock,?', 300);
            let arrDims = result.split(',');
            return Promise.resolve(utils.makeBool(arrDims[1]));
        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
    }
    public async getStatus(): Promise<boolean> {
        try {
            this.suspendPolling = true;
            let result = await this.execCommand('Status', 300);
            if (this.i2c.isMock) return Promise.resolve(true);
            if (typeof result !== 'undefined') {
                let arrDims = result.split(',');
                this.device.info.vcc = parseFloat(arrDims[2] || '0');
                this.device.info.lastRestart = this.transformRestart((arrDims[1] || 'U').toUpperCase());
            }
            else {
                logger.warn(`${this.device.name} could not retrieve status result was empty`);
                return false;
            }
            return true;
        }
        catch (err) { this.logError(err, `${this.device.name} error getting device status:`); return Promise.resolve(false); }
        finally { this.suspendPolling = false; }
    }
    public async getLedEnabled(): Promise<boolean> {
        try {
            this.suspendPolling = true;
            let result = await this.execCommand('L,?', 300);
            let arrDims = result.split(',');
            this.options.ledEnabled = utils.makeBool(arrDims[1]);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
        finally { this.suspendPolling = false; }
    }
    public async changeAddress(newAddress: number): Promise<boolean> {
        try {
            this.suspendPolling = true;
            // First lets look for any other device at the new address.
            await this.execCommand(`12C,${newAddress}`, 300);
            await utils.wait(15000);
            this.device.address = newAddress;
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
        finally { this.suspendPolling = false; }
    }
    public async enableLed(enable: boolean): Promise<boolean> {
        try {
            this.suspendPolling = true;
            let result = await this.execCommand(`L,${enable ? '1' : '0'}`, 300);
            this.options.ledEnabled = enable;
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
        finally { this.suspendPolling = false; }
    }
    public async getInfo(): Promise<{ device: string, firmware: string }> {
        try {
            this.suspendPolling = true;
            let result = await this.execCommand('i', 300);
            let arrDims = result.split(',');
            if (typeof this.device.info === 'undefined') this.device.info = {};
            this.device.info.device = arrDims[1] || '';
            this.device.info.firmware = arrDims[2] || '';
            return Promise.resolve({ device: arrDims[1] || '', firmware: arrDims[2] || '' });
        }
        catch (err) { logger.error(`Error getting info ${typeof err !== 'undefined' ? err.message : ''}`); return Promise.reject(err); }
        finally { this.suspendPolling = false; }
    }
    public async getDeviceInformation(): Promise<boolean> {
        try {
            this.suspendPolling = true;
            await this.getStatus();
            webApp.emitToClients('i2cDeviceInformation', { bus: this.i2c.busNumber, address: this.device.address, options: { deviceInfo: this.device.info } });
        }
        catch (err) { logger.error(`Error retrieving device status: ${typeof err !== 'undefined' ? err.message : ''}`); return Promise.reject(err); }
        finally { this.suspendPolling = false; }
    }
    public async getCalibrated(): Promise<boolean> { return Promise.resolve(true); }
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
    public getValue(prop: string) { }
    public setValue(prop: string, value) { }
}
export class AtlasEZOorp extends AtlasEZO {
    public async initAsync(deviceType): Promise<boolean> {
        try {
            this.stopPolling();
            this.options.name = await this.getName();
            if (this.device.isActive) {
                await this.getInfo();
                await this.getLedEnabled();
                this.options.isProtocolLocked = await this.isProtocolLocked();
                await this.getCalibrated();
                this.options.calibration = await this.exportCalibration();
                this.options.readInterval = this.options.readInterval || deviceType.readings.orp.interval.default;
                if (typeof this.options.name !== 'string' || this.options.name.length === 0) await this.setName(deviceType.name);
                else this.device.name = this.options.name;
            }
            this.pollDeviceInformation();
            this.pollReadings();
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.resolve(false); }
        finally {
            setTimeout(() => { this.pollDeviceInformation(); }, 2000);
            setTimeout(() => { this.pollReadings(); }, 5000);
        }

    }
    public async setOptions(opts): Promise<any> {
        try {
            this.suspendPolling = true;
            if (typeof opts.name !== 'undefined' && this.device.name !== opts.name) await this.setName(opts.name);
            if (typeof opts.isProtocolLocked !== 'undefined' && this.options.isProtocolLocked !== opts.isProtocolLocked) await this.lockProtocol(utils.makeBool(opts.isProtocolLocked));
            if (typeof opts.ledEnabled !== 'undefined' && this.options.ledEnabled !== opts.ledEnabled) await this.enableLed(utils.makeBool(opts.ledEnabled));
            if (typeof opts.readInterval === 'number') this.options.readInterval = opts.readInterval;
        }
        catch (err) { this.logError(err); Promise.reject(err); }
        finally { this.suspendPolling = false };
    }
    public async takeReadings(): Promise<boolean> {
        try {
            this.suspendPolling = true;
            if (this._timerRead) clearTimeout(this._timerRead);
            await this.readProbe();
            this.emitFeeds();
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
    }
    public async getCalibrated(): Promise<boolean> {
        try {
            this.suspendPolling = true;
            let result = await this.execCommand('cal,?', 300);
            let arrDims = result.split(',');
            this.options.calibrationMode = utils.makeBool(arrDims[1]);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
    }
    public async setCalibrationPoint(value: number): Promise<boolean> {
        try {
            this.suspendPolling = true;
            await this.execCommand(`Cal,${Math.floor(value)}`, 900);
            this.options.calPoint = Math.floor(value);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
    }
    public async calibrate(data): Promise<I2cDevice> {
        try {
            this.suspendPolling = true; 
            if (typeof data === 'undefined' || typeof data.options === 'undefined') return Promise.reject(new Error(`Could not calibrate EZO-ORP invalid data format. ${JSON.stringify(data)}`));
            if (typeof data.options.calPoint !== 'undefined') await this.setCalibrationPoint(parseFloat(data.options.calPoint));
            else { return Promise.reject(new Error(`Could not calibrate EZO-ORP no setpoint was provided. ${JSON.stringify(data)}`)) }
            this.options.calibrationMode = await this.getCalibrated();
            return Promise.resolve(this.device);
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
        finally { this.suspendPolling = false; }
    }
    public async clearCalibration(): Promise<I2cDevice> {
        try {
            this.suspendPolling = true;
            await this.execCommand(`Cal,clear`, 300);
            await this.getCalibrated();
            return Promise.resolve(this.device);
        }
        catch (err) { this.logError(err); Promise.reject(err); }
        finally { this.suspendPolling = false; }
    }
    public async getName(): Promise<string> {
        try {
            this.suspendPolling = true;
            let result = await this.execCommand('Name,?', 300);
            let arrDims = result.split(',');
            return Promise.resolve(arrDims[1] || '');
        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
    }
    public async setName(name: string): Promise<boolean> {
        try {
            this.suspendPolling = true;
            await this.execCommand(`Name,${this.escapeName(name)}`, 300);
            this.options.name = this.device.name = this.escapeName(name);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
    }
    public async readProbe(): Promise<number> {
        try {
            this.suspendPolling = true;
            let result = await this.execCommand('R', 900);

            let val = this.i2c.isMock ? 666.66 + (Math.floor(Math.random() * 10000) / 100): parseFloat(result);
            this.values.orp = val;
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.values });
            return Promise.resolve(val);
        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
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
                if (val.indexOf('*DONE') !== -1) break;
            }
            return Promise.resolve(dims);

        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
    }
    public getValue(prop: string) {
        switch (prop) {
            case 'orp': { return this.values.orp; }
            case 'all': { return this.values; }
        }
    }
    public calcMedian(prop: string, values: any[]) {
        switch (prop) {
            case 'orp':
                return super.calcMedian(prop, values);
            case 'all':
                // Only the ORP reading is a median here.
                let arr = [];
                for (let i = 0; i < values.length; i++) { arr.push(values[i].orp); }
                return extend(true, {}, this.values, { orp: super.calcMedian(prop, arr) });
        }
    }
    public async getDeviceState(binding: string | DeviceBinding): Promise<any> {
        try {
            let bind = (typeof binding === 'string') ? new DeviceBinding(binding) : binding;
            // We need to know what value we are referring to.
            if (typeof bind.params[0] === 'string') return this.getValue(bind.params[0]);
            return this.values.orp;
        } catch (err) { return Promise.reject(err); }
    }
}
export class AtlasEZOpH extends AtlasEZO {
    public async initAsync(deviceType): Promise<boolean> {
        try {
            this.stopPolling();
            if (this.device.isActive) {
                this.options.name = await this.getName();
                await this.getInfo();
                this.options.isProtocolLocked = await this.isProtocolLocked();
                await this.getLedEnabled();
                await this.getExtendedScale();
                await this.getCalibrated();
                await this.getSlope();
                await this.getTempCompensation();
                this.options.calibration = await this.exportCalibration();
                this.options.readInterval = this.options.readInterval || deviceType.readings.pH.interval.default;
                if (typeof this.options.name !== 'string' || this.options.name.length === 0) await this.setName(deviceType.name);
                else this.device.name = this.escapeName(this.options.name);
            }
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.resolve(false); }
        finally {
            setTimeout(() => { this.pollDeviceInformation(); }, 2000);
            setTimeout(() => { this.pollReadings(); }, 5000);
        }
    }
    public async setOptions(opts): Promise<any> {
        try {
            this.suspendPolling = true;
            if (typeof opts.name !== 'undefined' && this.device.name !== opts.name) await this.setName(opts.name);
            if (typeof opts.isProtocolLocked !== 'undefined' && this.options.isProtocolLocked !== opts.isProtocolLocked) await this.lockProtocol(utils.makeBool(opts.isProtocolLocked));
            if (typeof opts.extendedScale !== 'undefined' && this.options.extendedScale !== opts.extendedScale) await this.setExtendedScale(utils.makeBool(opts.extendedScale));
            if (typeof opts.tempCompensation === 'number' && this.options.tempCompensation !== opts.tempCompensation) await this.setTempCompensation(opts.tempCompensation);
            if (typeof opts.ledEnabled !== 'undefined' && this.options.ledEnabled !== opts.ledEnabled) await this.enableLed(utils.makeBool(opts.ledEnabled));
            if (typeof opts.readInterval === 'number') this.options.readInterval = opts.readInterval;
            return Promise.resolve(this.options);
        }
        catch (err) { this.logError(err); Promise.reject(err); }
        finally { this.suspendPolling = false; }
    }
    public async takeReadings(): Promise<boolean> {
        try {
            this.suspendPolling = true;
            await this.readProbe();
            this.emitFeeds();
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
    }
    public async calibrate(data): Promise<I2cDevice> {
        try {
            this.suspendPolling = true;
            if (typeof data === 'undefined' || typeof data.options === 'undefined') return Promise.reject(new Error(`Could not calibrate EZO-PH invalid data format. ${JSON.stringify(data)}`));
            if (typeof data.options.calMidPoint !== 'undefined') await this.setCalibrationPoint('mid', parseFloat(data.options.calMidPoint));
            else if (typeof data.options.calLowPoint !== 'undefined') await this.setCalibrationPoint('low', parseFloat(data.options.calLowPoint));
            else if (typeof data.options.calHighPoint !== 'undefined') await this.setCalibrationPoint('high', parseFloat(data.options.calHighPoint));
            else { return Promise.reject(new Error(`Could not calibrate EZO-PH no setpoint was provided. ${JSON.stringify(data)}`)) }
            await this.getCalibrated();
            await this.getSlope();
            return Promise.resolve(this.device);
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
        finally { this.suspendPolling = false; }
    }
    public async readProbe(tempCompensation?: number): Promise<number> {
        try {
            this.suspendPolling = true;
            if (typeof tempCompensation !== 'undefined' && this.version < 2.12) {
                if (tempCompensation !== this.values.temperature) await this.setTempCompensation(tempCompensation);
            }
            let result = typeof tempCompensation !== 'undefined' && this.version >= 2.12 ? await this.execCommand(`RT,${tempCompensation.toFixed(1)}`, 900) : await this.execCommand('R', 900);
            let val = this.i2c.isMock ? 7.4 + (Math.floor(Math.random() * 100) / 1000) : parseFloat(result);
            this.values.pH = val;
            if (typeof tempCompensation !== 'undefined') this.values.temperature = tempCompensation;
            else await this.getTempCompensation();
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.values });
            return Promise.resolve(val);
        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
    }
    public async getExtendedScale(): Promise<boolean> {
        try {
            this.suspendPolling = true;
            if (this.version < 2.14) {
                // Prior to 2.14 this command did not exist.
                this.options.extendedScale = false;
                return Promise.resolve(true);
            }
            let result = await this.execCommand('pHext,?', 300);
            let arrDims = result.split(',');
            this.options.extendedScale = utils.makeBool(arrDims[1]);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
    }
    public async getCalibrated(): Promise<boolean> {
        try {
            this.suspendPolling = true;
            let result = await this.execCommand('cal,?', 300);
            let arrDims = result.split(',');
            this.options.calibrationMode = parseInt(arrDims[1] || '0', 10);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
    }
    public async setCalibrationPoint(point: string, value: number): Promise<boolean> {
        try {
            this.suspendPolling = true;
            await this.execCommand(`Cal,${point},${value.toFixed(2)}`, 900);
            let ptName = `cal${point.substring(0, 1).toUpperCase()}${point.substring(1).toLowerCase()}Point`;
            this.options[ptName] = value;
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
    }
    public async getName(): Promise<string> {
        try {
            this.suspendPolling = true;
            let result = await this.execCommand('Name,?', 300);
            let arrDims = result.split(',');
            return Promise.resolve(arrDims[1] || '');
        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
    }
    public async setName(name: string): Promise<boolean> {
        try {
            this.suspendPolling = true;
            await this.execCommand(`Name,${this.escapeName(name)}`, 300);
            this.device.name = this.options.name = this.escapeName(name);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
    }
    public async getSlope(): Promise<boolean> {
        try {
            this.suspendPolling = true;
            let result = await this.execCommand('Slope,?', 300);
            let arrDims = result.split(',');
            this.options.slope = { acid: parseFloat(arrDims[1] || '0'), base: parseFloat(arrDims[2] || '0'), mV: parseFloat(arrDims[3] || '0') }
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
    }
    public async getTempCompensation(): Promise<boolean> {
        try {
            this.suspendPolling = true;
            let result = await this.execCommand('T,?', 300);
            let arrDims = result.split(',');
            this.values.temperature = parseFloat(arrDims[1] || '25');
            this.values.tempUnits = 'C';
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.values });
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
    }
    public async setTempCompensation(value: number): Promise<boolean> {
        try {
            this.suspendPolling = true;
            await this.execCommand(`T,${value.toFixed(2)}`, 300);
            this.values.temperature = value;
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.values });
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
    }
    public async setExtendedScale(val: boolean): Promise<boolean> {
        try {
            this.suspendPolling = true;
            if (this.version < 2.14) {
                this.options.extendedScale = false;
                return Promise.resolve(true);
            }
            await this.execCommand('pHext,' + (val ? '1' : '0'), 300);
            this.options.extendedScale = val;
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
    }
    public async exportCalibration(): Promise<{ len: number, total: number, data: string[] }> {
        try {
            this.suspendPolling = true;
            if (this.version < 2.1) {
                // Could not export calibration prior to this version.
                return Promise.resolve({ len: 0, total: 0, data: [] });
            }
            let result = await this.execCommand('Export,?', 300);
            let arrDims = result.split(',');
            let dims = { len: parseInt(arrDims[1], 10), total: parseInt(arrDims[2], 10), data: [] };
            for (let i = 0; i <= dims.len; i++) {
                let val = await this.execCommand('Export', 300);
                dims.data.push(val);
                if (val.indexOf('*DONE') !== -1) break;

            }
            return Promise.resolve(dims);
        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
    }
    public getValue(prop: string) {
        switch (prop.toLowerCase()) {
            case 'phlevel': 
            case 'ph': { return this.values.pH; }
            case 'all': { return this.values; }
        }
    }
    public setValue(prop: string, value) {
        switch (prop) {
            case 'tempC':
            case 'tempF':
            case 'tempK':
                let temp = utils.convert.temperature.convertUnits(value, prop.substring(4), 'c');
                if (typeof temp === 'number') this.setTempCompensation(temp);
                break;
        }
    }
    public calcMedian(prop: string, values: any[]) {
        switch (prop.toLowerCase()) {
            case 'phlevel':
            case 'ph':
                return super.calcMedian(prop, values);
            case 'all':
                // Only the ORP reading is a median here.
                let arrPh = [];
                let arrTemp = [];
                for (let i = 0; i < values.length; i++) {
                    arrPh.push(values[i].pH); arrTemp.push(values[i].temperature);
                }
                return extend(true, {}, this.values, { pH: super.calcMedian(prop, arrPh), temperature: super.calcMedian(prop, arrTemp) });
        }
    }
    public async clearCalibration(): Promise<I2cDevice> {
        try {
            this.suspendPolling = true;
            await this.execCommand(`Cal,clear`, 300);
            await this.getCalibrated();
            return Promise.resolve(this.device);
        }
        catch (err) { this.logError(err); Promise.reject(err); }
        finally { this.suspendPolling = false; }
    }
    public async getDeviceState(binding: string | DeviceBinding): Promise<any> {
        try {
            let bind = (typeof binding === 'string') ? new DeviceBinding(binding) : binding;
            // We need to know what value we are referring to.
            if (typeof bind.params[0] === 'string') return this.getValue(bind.params[0]);
            return this.values.pH;
        } catch (err) { return Promise.reject(err); }
    }
}
export class AtlasEZOpmp extends AtlasEZO {
    public latchTimer: NodeJS.Timeout;
    public async initAsync(deviceType): Promise<boolean> {
        try {
            this.stopPolling();
            if (this.device.isActive) {
                this.dispense.units = 'mL';
                this._pollInformationInterval = 10000;
                this.options.name = await this.getName();
                await this.getInfo();
                this.options.isProtoLocked = await this.isProtocolLocked();
                await this.getLedEnabled();
                await this.getParameterInfo();
                if (!this.options.parameters.pumpVolume) await this.enableParameter('V', true);
                if (!this.options.parameters.pumpTotal) await this.enableParameter('TV', true);
                if (!this.options.parameters.pumpAbsolute) await this.enableParameter('ATV', true);
                await this.getCalibrated();
                if (typeof this.options.name !== 'string' || this.options.name.length === 0) await this.setName(deviceType.name);
                else this.device.name = this.escapeName(this.options.name);
                this.options.readInterval = this.options.readInterval || deviceType.readings.dispensed.interval.default;
                // Initialize the tank level before moving on.
                this.setTankAttributes({ level: this.tank.level || 0 });
            }
            this.pollDeviceInformation();
            // This device does not have readings to poll if the pump is not running so we will set a timeout to get the device
            // pumping information.  If it is running it will ask for it again.
            setTimeout(() => { this.getDispenseStatus() }, 500);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.resolve(false); }
    }
    public get dispense() { return typeof this.values.dispense === 'undefined' ? this.values.dispense = { units:'mL' } : this.values.dispense; }
    public get tank() { return typeof this.values.tank === 'undefined' ? this.values.tank = { level: 4, capacity: 4, units: 'gal', offset: 0 } : this.values.tank; }
    public getValue(prop: string) {
        switch (prop) {
            case 'tank': { return this.tank; }
            case 'dispense': { return this.dispense; }
            case 'dispensing': { return this.dispense.dispensing; }
            case 'mode': { return this.dispense.mode; }
            case 'maxRate': { return this.dispense.maxRate; }
            case 'totalVolume': { return this.dispense.totalVolume; }
            case 'flowRate': { return this.dispense.flowRate; }
            case 'dispenseTime': { return this.dispense.dispenseTime; }
            case 'paused': { return this.dispense.paused; }
            case 'all': { return this.values; }
            default:
                logger.debug(`EZO-PMP Asked for values ${prop}`);
                break;
        }
    }
    public setValue(prop: string, value) {
        switch (prop) {
        }
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
            this.device.name = this.options.name = this.escapeName(name);
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
            if (typeof this.options.parameters === 'undefined') this.options.parameters = {};
            this.options.parameters.pumpVolume = params.indexOf(',V') >= 0;
            this.options.parameters.pumpTotal = params.indexOf(',TV') >= 0;
            this.options.parameters.pumpAbsolute = params.indexOf(',ATV') >= 0;
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async enableParameter(param: string, enable:boolean = true): Promise<boolean> {
        try {
            await this.execCommand(`O,${param},${enable ? '1' : '0'}`, 300);
            switch (param) {
                case 'V':
                    this.options.parameters.pumpVolume = enable;
                    break;
                case 'TV':
                    this.options.parameters.pumpTotal = enable;
                    break;
                case 'ATV':
                    this.options.parameters.pumpAbsolute = enable;
                    break;
            }
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
    }
    public async getDispenseStatus(): Promise<{ dispensing: boolean, volume?: number, continuous: boolean, reverse: boolean, maxRate: number, mode: { name: string, desc: string } }> {
        try {
            if (!this.device.isActive) return this.dispense;
            if (this.suspendPolling) { this.suspendPolling = true; return Promise.resolve(this.dispense); }
            this.suspendPolling = true;
            let result = await this.execCommand('D,?', 300);
            let arrDims = result.split(',');
            let run = parseInt(arrDims[2] || '0', 10);
            if (isNaN(run)) run = 0;
            this.dispense.dispensing = run !== 0;
            this.dispense.reverse = run < 0;
            this.dispense.continuous = this.dispense.dispensing && arrDims[1].indexOf('*') !== -1;
            this.dispense.paused = utils.makeBool(this.dispense.paused);
            if (typeof this.dispense.mode === 'undefined') this.dispense.mode = { name: 'off', desc: 'Off' };
            let mode = 'off';
            if (this.dispense.continuous) mode = 'continuous';
            else if (this.dispense.dispensing || this.dispense.paused) mode = this.dispense.mode.name;
            if (mode.startsWith('vol')) this.dispense.volume = parseFloat(arrDims[1]);
            else this.dispense.volume = null;
            if (mode === 'off') {
                this.dispense.volume = null;
                this.dispense.flowRate = null;
                this.dispense.dispenseTime = null;
            }
            this.dispense.mode = this.transformDispenseMode(mode, this.dispense.paused);
            result = await this.execCommand('DC,?', 300);
            arrDims = result.split(',');
            this.dispense.maxRate = parseFloat(arrDims[1]);
            await this.getVolumeDispensed();
            this.calcTankLevel();
            this.emitFeeds();
            return Promise.resolve(this.dispense);
        }
        catch (err) { logger.error(new Error(`Could not get dispense status: ${typeof err !== 'undefined' ? err.message : ''}`)); }
        finally { if (this.dispense.dispensing) this._timerRead = setTimeout(() => { this.getDispenseStatus(); }, 1000); this.suspendPolling = false; }
    }
    public async getVolumeDispensed(): Promise<boolean> {
        try {
            if (typeof this.dispense.totalVolume === 'undefined') this.dispense.totalVolume = { total: 0, absolute: 0 };
            let vol = { total: 0, absolute: 0 };
            let result = await this.execCommand('TV,?', 300);
            let arrDims = result.split(',');
            this.dispense.totalVolume.total = parseFloat(arrDims[1]);
            result = await this.execCommand('ATV,?', 300);
            arrDims = result.split(',');
            this.dispense.totalVolume.absolute = parseFloat(arrDims[1]);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
    }
    public async stopDispense(): Promise<boolean> {
        try {
            if (this.latchTimer) clearTimeout(this.latchTimer);
            this.latchTimer = null;
            await this.execCommand('X', 300);
            this.values.mode = this.transformDispenseMode('off', false);
            this.values.paused = false;
            this.values.volume = null;
            this.values.flowRate = null;
            this.values.dispenseTime = null;
            this.values.dispensing = false;
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.values });
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
            this.values.paused = paused;
            this.values.mode = this.transformDispenseMode(this.values.mode.name, paused);
            await this.getDispenseStatus();
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.values });
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async dispenseContinuous(reverse: boolean = false): Promise<boolean> {
        try {
            if (this.dispense.dispensing === true) {
            }
            else {
                await this.execCommand(`D,${utils.makeBool(reverse) ? '-*' : '*'}`, 300);
                this.dispense.continuous = true;
                this.dispense.dispensing = true;
                this.dispense.reverse = reverse;
                this.dispense.paused = false;
                this.dispense.volume = null;
                this.dispense.dispenseTime = null;
                this.dispense.flowRate = null;
                this.dispense.mode = this.transformDispenseMode('continuous', false);
            }
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.values });
            await this.getDispenseStatus();
            return true;
        }
        catch (err) { this.logError(err); }
    }
    public async dispenseVolume(volume: number, minutes?:number): Promise<boolean> {
        try {
            if (this.dispense.dispensing === true) {
                await this.getVolumeDispensed();
            }
            else {
                typeof minutes === 'undefined' || minutes <= 0 ? await this.execCommand(`D,${volume.toFixed(2)}`, 300) : await this.execCommand(`D,${volume.toFixed(2)},${minutes.toFixed(2)}`, 300);
                this.dispense.dispensing = true;
                this.dispense.reverse = volume < 0;
                this.dispense.dispenseTime = typeof minutes !== 'undefined' ? minutes : null;
                this.dispense.paused = false;
                this.dispense.continuous = false;
                this.dispense.volume = volume;
                this.dispense.flowRate = null;
                this.dispense.mode = this.transformDispenseMode(typeof minutes !== 'undefined' ? 'volOverTime' : 'vol', false);
            }
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.values });
            await this.getDispenseStatus();
            return true;
        }
        catch (err) { this.logError(err); }
    }
    public async dispenseFlowRate(rate: number, minutes?: number): Promise<boolean> {
        try {
            if (this.dispense.dispensing === true) {
                await this.getVolumeDispensed();
            }
            else {
                typeof minutes === 'undefined' || minutes <= 0 ? await this.execCommand(`DC,${rate.toFixed(2)},*`, 300) : await this.execCommand(`DC,${rate.toFixed(2)},${minutes.toFixed(2)}`, 300);
                this.dispense.flowRate = rate;
                this.dispense.dispensing = true;
                this.dispense.continuous = false;
                this.dispense.reverse = rate < 0;
                this.dispense.dispenseTime = typeof minutes !== 'undefined' ? minutes : null;
                this.dispense.volume = null;
                this.dispense.paused = false;
                this.dispense.mode = this.transformDispenseMode(typeof minutes !== 'undefined' ? 'flowOverTime' : 'flowRate', false);
            }
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.values });
            this.getDispenseStatus();
            return true;
        }
        catch (err) { this.logError(err); }
    }
    public async startDispense(opts:any): Promise<boolean> {
        try {
            if (this.latchTimer) clearTimeout(this.latchTimer);
            this.latchTimer = null;
            if (typeof opts === 'undefined' || typeof opts.dispense === 'undefined') return Promise.reject(new Error('Cannot dispense EZO-PMP. Dispense options not provided'));
            let reverse = utils.makeBool(opts.dispense.reverse);
            let flowRate = (reverse) ? Math.abs(parseFloat(opts.dispense.flowRate)) * -1 : parseFloat(opts.dispense.flowRate);
            let volume = (reverse) ? Math.abs(parseFloat(opts.dispense.volume)) * -1 : parseFloat(opts.dispense.volume);
            if (this.dispense.dispensing !== true) this.dispense.startVolume = this.dispense.totalVolume.total || 0;
            switch (opts.dispense.method) {
                case 'continuous':
                    await this.dispenseContinuous(utils.makeBool(opts.dispense.reverse));
                    if (typeof opts.latch === 'number') this.latchTimer = setTimeout(() => { this.stopDispense(); }, opts.latch);
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
            return true;
        } catch (err) { this.logError(err); }
    }
    public async clearCalibration(): Promise<I2cDevice> {
        try {
            this.suspendPolling = true;
            await this.execCommand(`Cal,clear`, 300);
            await this.getCalibrated();
            return Promise.resolve(this.device);
        }
        catch (err) { this.logError(err); Promise.reject(err); }
        finally { this.suspendPolling = false; }
    }
    public async getCalibrated(): Promise<boolean> {
        try {
            let opts = { volume: false, time: false };
            let result = await this.execCommand('Cal,?', 300);
            let arrDims = result.split(',');
            let val = parseInt(arrDims[1] || '0');
            if (typeof this.options.calibration !== 'object') this.options.calibration = { volume: false, time: false };
            this.options.calibration.volume = (val & 0x0001) > 0;
            this.options.calibration.time = (val & 0x0002) > 0;
            return Promise.resolve(true);
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
            if (typeof data === 'undefined' || typeof data.options === 'undefined') return Promise.reject(new Error(`Could not calibrate EZO-PMP invalid data format. ${JSON.stringify(data)}`));
            if (typeof data.options.calPoint !== 'undefined') await this.setCalibration(parseFloat(data.options.calPoint));
            else { return Promise.reject(new Error(`Could not calibrate EZO-PMP no setpoint was provided. ${JSON.stringify(data)}`)) }
            await this.getCalibrated();
            return Promise.resolve(this.device);
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
    }
    public async clearDispensed(): Promise<boolean> {
        try {
            await this.execCommand('Clear', 300);
            if (typeof this.values.totalVolume === 'undefined') this.values.totalVolume = { total: 0, absolute: 0 }
            this.values.totalVolume.total = 0;
            this.values.totalVolume.absolute = 0;
            this.tank.totalOffset = this.tank.capacity - this.values.level;
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.values });
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async setTankAttributes(tank): Promise<any> {
        // The tank level is determined by how much volume is pumped from full.  The totalVolume values are used to determine this so we need to snapshot the
        // offset at the time the level is set.  The tank offset is what a full tank would be.
        // tankOffset = absVolume + capacity - tankLevel;
        
        try {
            if (typeof tank.units === 'string') this.tank.units = tank.units;
            if (typeof tank.capacity === 'number') this.tank.capacity = tank.capacity;
            if (typeof tank.level === 'number') {
                await this.getVolumeDispensed();
                //await this.clearDispensed();
                // absVolume = 0
                // capacity = 4
                // level = 3.8
                // offset = -0.2
                this.tank.level = tank.level;
                let units = this.tank.units;
                let capacity = this.toML(units, this.tank.capacity);
                let level = this.toML(units, tank.level);
                this.tank.offset = (this.dispense.totalVolume.total || 0) - capacity + level;
            }
            this.calcTankLevel();
            this.emitFeeds();
            return Promise.resolve(this.values);
        }
        catch (err) { this.logError(err); Promise.reject(err); }
    }
    private toML(units: string, val: number): number {
        let converted = val;
        switch (units.toLowerCase()) {
            case 'gal':
                converted = Math.round((val * 3785.41) * 10000) / 10000;
                break;
            case 'ounces':
            case 'oz':
                converted = Math.round((val * 29.5735) * 10000) / 10000;
                break;
            case 'quarts':
            case 'quart':
                converted = Math.round((val * 947.353) * 10000) / 10000;
                break;
            case 'pint':
            case 'pints':
                converted = Math.round((val * 473.176) * 10000) / 10000;
                break;
            case 'l':
                converted = val * 1000;
                break;
            case 'cl':
                converted = val * 100;
                break;
            
        }
        return converted;
    }
    private fromML(units: string, val: number): number {
        let converted = val;
        switch (units.toLowerCase()) {
            case 'gal':
                converted = Math.round((val * 0.000264172) * 10000) / 10000;
                break;
            case 'ounces':
            case 'oz':
                converted = Math.round((val * 0.033814) * 10000) / 10000;
                break;
            case 'quarts':
            case 'quart':
                converted = Math.round((val * 0.00105669) * 10000) / 10000;
                break;
            case 'pint':
            case 'pints':
                converted = Math.round((val * 0.00211338) * 10000) / 10000;
                break;
            case 'l':
                converted = Math.round((val * 0.001) * 10000) / 10000;
                break;
            case 'cl':
                converted = Math.round((val * .01) * 10000) / 10000;
                break;
        }
        return converted;
    }
    private calcTankLevel() {
        // The tank level equals capacity(mL) - pumped - offset;
        // capacity = 200
        // offset = 100
        // pumped = 120
        // so 20 has pumped from the capacity of the tank. So the tank level = capacity - (pumped - offset).
        if (typeof this.dispense.totalVolume === 'undefined') this.dispense.totalVolume = {};
        let tankLevel = 0;
        let offset = this.tank.offset || 0;
        let pumped = this.dispense.totalVolume.total || 0;
        tankLevel = pumped - offset;
        this.tank.level = Math.min(Math.max(this.tank.capacity - this.fromML(this.tank.units, tankLevel), 0), this.tank.capacity);
        webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.values });
    }
    public async setOptions(opts): Promise<any> {
        try {
            if (typeof opts.name !== 'undefined' && this.device.name !== opts.name) await this.setName(opts.name);
            if (typeof opts.isProtocolLocked !== 'undefined' && this.options.isProtocolLocked !== opts.isProtocolLocked) await this.lockProtocol(utils.makeBool(opts.isProtocolLocked));
            if (typeof opts.ledEnabled !== 'undefined' && this.options.ledEnabled !== opts.ledEnabled) await this.enableLed(utils.makeBool(opts.ledEnabled));
            if (typeof opts.readInterval === 'number') this.options.readInterval = opts.readInterval;
        }
        catch (err) { this.logError(err); Promise.reject(err); }
    }
    public async getDeviceState(binding: string | DeviceBinding): Promise<any> {
        try {
            let bind = (typeof binding === 'string') ? new DeviceBinding(binding) : binding;
            // We need to know what value we are referring to.
            if (typeof bind.params[0] === 'string') return this.getValue(bind.params[0]);
            return this.dispense.dispensing;
        } catch (err) { return Promise.reject(err); }
    }
    public async setDeviceState(binding: string | DeviceBinding, data: any): Promise<any> {
        try {
            if (data.state === true || data.isOn === true) {
                if (this.latchTimer) clearTimeout(this.latchTimer);
                this.latchTimer = null;

                // We are dosing.  Unlike the demand calc setpoint
                // we are not changing the original command.
                if (typeof data.dispense === 'undefined') data.dispense = { method: 'continuous' };
                await this.startDispense(data);
            }
            else {
                if (this.dispense.dispensing) await this.stopDispense();
            }
            return extend(true, { state: this.dispense.dispensing || false }, this.dispense);
        } catch (err) { return Promise.reject(err); }
    }
    public async closeAsync(): Promise<void> {
        try {
            await super.closeAsync();
            await this.stopDispense();
            return Promise.resolve();
        }
        catch (err) { return this.logError(err); }
    }


}
export class AtlasEZOprs extends AtlasEZO {
    public async initAsync(deviceType): Promise<boolean> {
        try {
            this.stopPolling();
            if (this.device.isActive) {
                this.options.name = await this.getName();
                await this.getInfo();
                this.options.isProtoLocked = await this.isProtocolLocked();
                if (typeof this.options.name !== 'string' || this.options.name.length === 0) await this.setName(deviceType.name);
                else this.device.name = this.options.name;
                await this.getLedEnabled();
                await this.getStatus();
                this.options.readInterval = this.options.readInterval || deviceType.readings.pressure.interval.default;
                await this.getUnits();
                await this.getDecPlaces();
                await this.getAlarm();
            }
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.resolve(false); }
        finally {
            setTimeout(() => { this.pollDeviceInformation() }, 3000);
            setTimeout(() => { this.pollReadings(); }, 5000);
        }
    }
    public async getName(): Promise<string> {
        try {
            this.suspendPolling = true;
            let result = await this.execCommand('Name,?', 300);
            let arrDims = result.split(',');
            return Promise.resolve(arrDims[1] || '');
        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
    }
    public getValue(prop: string) {
        switch (prop) {
            case 'pressure': { return this.values.pressure; }
            case 'all': { return this.values; }
        }
    }
    public calcMedian(prop: string, values: any[]) {
        switch (prop.toLowerCase()) {
            case 'pressure':
                return super.calcMedian(prop, values);
            case 'all':
                // Only the ORP reading is a median here.
                let arrPress = [];
                for (let i = 0; i < values.length; i++) { arrPress.push(values[i].pressure); }
                return extend(true, {}, this.values, { pressure: super.calcMedian(prop, arrPress) });
        }
    }
    public async setOptions(opts): Promise<any> {
        try {
            this.suspendPolling = true;
            if (typeof opts.name !== 'undefined' && this.device.name !== opts.name) await this.setName(opts.name);
            if (typeof opts.isProtocolLocked !== 'undefined' && this.options.isProtocolLocked !== opts.isProtocolLocked) await this.lockProtocol(utils.makeBool(opts.isProtocolLocked));
            if (typeof opts.ledEnabled !== 'undefined' && this.options.ledEnabled !== opts.ledEnabled) await this.enableLed(utils.makeBool(opts.ledEnabled));
            if (typeof this.options.alarm === 'undefined') this.options.alarm = { enable: false, pressure: null, tolerance: null };
            if (typeof opts.decPlaces !== 'undefined' && this.options.decPlaces !== opts.decPlaces) await this.setDecPlaces(opts.decPlaces);
            if (typeof opts.units !== 'undefined' && typeof opts.units.name !== 'undefined' && this.options.units.name !== opts.units.name) await this.setUnits(opts.units.name);
            if (typeof opts.alarm !== 'undefined' &&
                (this.options.alarm.enable !== opts.alarm.enable || this.options.alarm.pressure !== opts.alarm.pressure || this.options.alarm.tolerance !== opts.alarm.tolerance)) {
                await this.setAlarm(utils.makeBool(opts.alarm.enable), opts.alarm.pressure, opts.alarm.tolerance);
            }
            if (typeof opts.readInterval === 'number') this.options.readInterval = opts.readInterval;
        }
        catch (err) { this.logError(err); Promise.reject(err); }
        finally { this.suspendPolling = false; }
    }
    public async takeReadings(): Promise<boolean> {
        try {
            await this.readProbe();
            this.emitFeeds();
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async readProbe(): Promise<number> {
        try {
            this.suspendPolling = true;
            let result = '10.2';
            if (!this.i2c.isMock) result = await this.execCommand('R', 900);
            else {
                result = (10 + Math.random()).toFixed(2);
            }
            let val = parseFloat(result);
            this.values.pressure = val;
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.values });
            return Promise.resolve(val);
        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
    }
    public async setDecPlaces(decPlaces: number): Promise<boolean> {
        try {
            this.suspendPolling = true;
            await this.execCommand(`Dec,${decPlaces}`, 900);
            this.options.decPlaces = decPlaces;
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
    }
    public async getDecPlaces(): Promise<boolean> {
        try {
            this.suspendPolling = true;
            let result = await this.execCommand('Dec,?', 900);
            let arrDims = result.split(',');
            this.options.decPlaces = parseInt(arrDims[1] || '0', 10);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
    }
    public async getUnits(): Promise<boolean> {
        try {
            this.suspendPolling = true;
            let result = await this.execCommand('U,?', 300);
            let arrDims = result.split(',');
            let units = this.transformUnits((arrDims[1] || 'psi').toLowerCase());
            this.values.units = units;
            if (typeof this.options.alarm === 'undefined') this.options.alarm = {};
            this.options.alarm.units = units;
            this.options.units = units;
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
        finally { this.suspendPolling = false; }
    }
    public async setUnits(units: string): Promise<boolean> {
        try {
            this.suspendPolling = true;
            await this.execCommand(`U,${units}`, 300);
            if (typeof this.options.alarm === 'undefined') this.options.alarm = {};
            this.options.alarm.units = this.values.units = this.options.units = this.transformUnits(units);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
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
            if (typeof this.options.alarm === 'undefined') this.options.alarm = { enable: false, pressure: 0, tolerance: 0 };
            if (enable) {
                if (typeof pressure === 'undefined' || typeof tolerance === 'undefined') return Promise.reject(new Error('Alarm must include a pressure setting and tolerance.'));
                await this.execCommand(`Alarm,en,1`, 300);
                await this.execCommand(`Alarm,${pressure}`, 300);
                await this.execCommand(`Alarm,tol,${tolerance}`, 300);
                this.options.alarm.enable = enable;
                this.options.alarm.pressure = pressure;
                this.options.alarm.tolerance = tolerance;
            }
            else {
                await this.execCommand(`Alarm,en,0`, 300);
                this.options.alarm.enable = enable;
            }
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
    }
    public async getAlarm(): Promise<boolean> {
        try {
            this.suspendPolling = true;
            if (typeof this.options.alarm === 'undefined') this.options.alarm = { enable: false, pressure: 0, tolerance: 0 };
            let result = await this.execCommand('Alarm,?', 300);
            let arrDims = result.split(',');
            this.options.alarm.enable = arrDims.length > 2 ? utils.makeBool(arrDims[3]) : false;
            this.options.alarm.pressure = parseFloat(arrDims[1]);
            this.options.alarm.tolerance = parseFloat(arrDims[2]);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
        finally { this.suspendPolling = false; }
    }
    public async getDeviceState(binding: string | DeviceBinding): Promise<any> {
        try {
            let bind = (typeof binding === 'string') ? new DeviceBinding(binding) : binding;
            // We need to know what value we are referring to.
            if (bind.params.length > 0 && typeof bind.params[0] === 'string') return this.getValue(bind.params[0]);
            return this.values.pressure;
        } catch (err) { return Promise.reject(err); }
    }
    public async calibrate(data): Promise<I2cDevice> {
        try {
            this.suspendPolling = true;
            let value = data.calibration || 0;
            await this.execCommand(`factorycal,${value}`, 900);
            this.options.calPoint = Math.floor(value);
            return this.device;
        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
    }
}
export class AtlasEZOrtd extends AtlasEZO {
    public getValue(prop: string) {
        switch (prop) {
            case 'tempK':
                return utils.convert.temperature.convertUnits(this.values.temperature, this.values.units, 'k');
            case 'tempC':
                return utils.convert.temperature.convertUnits(this.values.temperature, this.values.units, 'c');
            case 'tempF':
                return utils.convert.temperature.convertUnits(this.values.temperature, this.values.units, 'f');
            case 'all':
                return this.values;
        }
    }
    public calcMedian(prop: string, values: any[]) {
        switch (prop.toLowerCase()) {
            case 'tempk':
            case 'tempc':
            case 'tempf':
                return super.calcMedian(prop, values);
            case 'all':
                // Only the ORP reading is a median here.
                let arrTemp = [];
                for (let i = 0; i < values.length; i++) { arrTemp.push(values[i].temperature); }
                return extend(true, {}, this.values, { temperature: super.calcMedian(prop, arrTemp) });
        }
    }
    public async initAsync(deviceType): Promise<boolean> {
        try {
            this.stopPolling();
            if (this.device.isActive) {
                // NAME,? always returns an empty string.  This doesn't work on RTD.
                //this.device.name = this.options.name = (typeof this.options.name === 'undefined' || this.options.name === '') ? deviceType.name : this.options.name;
                await this.getInfo();
                this.options.isProtocolLocked = await this.isProtocolLocked();
                await this.getLedEnabled();
                await this.getCalibrated();
                await this.getStatus();
                await this.getScale();
                this.options.calibration = await this.exportCalibration();
                this.options.readInterval = this.options.readInterval || deviceType.readings.temperature.interval.default;
                if (typeof this.options.name !== 'string' || this.options.name.length === 0) await this.setName(deviceType.name);
                else this.device.name = this.options.name;
            }
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.resolve(false); }
        finally {
            setTimeout(() => { this.pollDeviceInformation(); }, 2000);
            setTimeout(() => { this.pollReadings(); }, 5000);
        }
    }
    public async setOptions(opts): Promise<any> {
        try {
            if (typeof opts.name !== 'undefined' && this.device.name !== opts.name) await this.setName(opts.name);
            if (typeof opts.isProtocolLocked !== 'undefined' && utils.makeBool(this.options.isProtocolLocked) !== utils.makeBool(opts.isProtocolLocked)) await this.lockProtocol(utils.makeBool(opts.isProtocolLocked));
            if (typeof opts.ledEnabled !== 'undefined' && this.options.ledEnabled !== opts.ledEnabled) await this.enableLed(utils.makeBool(opts.ledEnabled));
            if (typeof opts.readInterval === 'number') this.options.readInterval = opts.readInterval;
            if (typeof this.options.scale === 'undefined') await this.getScale();
            if (typeof opts.scale === 'string' && opts.scale.length > 0 && opts.scale.toLowerCase() !== this.options.scale.toLowerCase()) await this.setScale(opts.scale);
        }
        catch (err) { this.logError(err); Promise.reject(err); }
    }
    public async takeReadings(): Promise<boolean> {
        try {
            await this.readProbe();
            this.emitFeeds();
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async getCalibrated(): Promise<boolean> {
        try {
            let result = await this.execCommand('Cal,?', 300);
            let arrDims = result.split(',');
            this.options.calibrationMode = utils.makeBool(arrDims[1]);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async getScale(): Promise<boolean> {
        try {
            let result = await this.execCommand('S,?', 300);
            let arrDims = result.split(',');
            if (typeof this.options.calibration === 'undefined') this.options.calibration = {};
            this.options.calibration.units = this.values.units = this.options.scale = (arrDims[1] || 'c').toUpperCase();
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
    }
    public async setScale(value: string): Promise<boolean> {
        try {
            await this.execCommand(`S,${value.toLowerCase()}`, 300);
            if (typeof this.options.calibration === 'undefined') this.options.calibration = {};
            this.options.calibration.units = this.values.units = this.options.scale = value.toUpperCase();
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async setCalibrationPoint(value: number): Promise<boolean> {
        try {
            await this.execCommand(`Cal,${value.toFixed(2)}`, 600);
            this.options.calPoint = value;
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async calibrate(data): Promise<I2cDevice> {
        try {
            this.suspendPolling = true;
            if (typeof data === 'undefined' || typeof data.options === 'undefined') return Promise.reject(new Error(`Could not calibrate EZO-RTD invalid data format. ${JSON.stringify(data)}`));
            if (typeof data.options.calPoint !== 'undefined') await this.setCalibrationPoint(parseFloat(data.options.calPoint));
            else { return Promise.reject(new Error(`Could not calibrate EZO-RTD no setpoint was provided. ${JSON.stringify(data)}`)) }
            this.options.calibrationMode = await this.getCalibrated();
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
            this.options.name = this.device.name = this.escapeName(name);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async readProbe(): Promise<number> {
        try {
            let result = await this.execCommand('R', 600);
            if (this.i2c.isMock) {
                result = utils.convert.temperature.convertUnits(72 + (Math.round((5 * Math.random()) * 100) / 100), 'f', this.values.units).toString();
            }
            else 
                result = await this.execCommand('R', 600);
            let val = parseFloat(result);
            this.values.temperature = val;
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.values });
            return Promise.resolve(val);
        }
        catch (err) { this.logError(err); }
    }
    public async exportCalibration(): Promise<{ len: number, total: number, data: string[], units: string }> {
        try {
            this.suspendPolling = true;
            let result = await this.execCommand('Export,?', 300);

            //info: Atlas_EZO-RTD command Export,? bytes written:8 result:?EXPORT,2,20
            let arrDims = result.split(',');
            let dims = { len: parseInt((arrDims[1] || '0'), 10), total: parseInt((arrDims[2] || '0'), 10), data: [], units: this.options.scale };
            for (let i = 0; i <= dims.len; i++) {
                let val = await this.execCommand('Export', 300);
                dims.data.push(val);
                if (val.indexOf('*DONE') !== -1) break;
            }
            return Promise.resolve(dims);
        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
    }
    public async clearCalibration(): Promise<I2cDevice> {
        try {
            this.suspendPolling = true;
            await this.execCommand(`Cal,clear`, 300);
            await this.getCalibrated();
            return Promise.resolve(this.device);
        }
        catch (err) { this.logError(err); Promise.reject(err); }
        finally { this.suspendPolling = false; }
    }
    public async getDeviceState(binding: string | DeviceBinding): Promise<any> {
        try {
            let bind = (typeof binding === 'string') ? new DeviceBinding(binding) : binding;
            // We need to know what value we are referring to.
            if (typeof bind.params[0] === 'string') return this.getValue(bind.params[0]);
            return this.values.temperature;
        } catch (err) { return Promise.reject(err); }
    }
}
export class AtlasEZOec extends AtlasEZO {
    public async initAsync(deviceType): Promise<boolean> {
        try {
            if (this.device.isActive) {
                this.stopPolling();
                this.options.name = await this.getName();
                await this.getInfo();
                await this.getLedEnabled();
                this.options.isProtocolLocked = await this.isProtocolLocked();
                await this.getCalibrated();
                await this.getProbeType();
                await this.getParameterInfo();
                await this.getTDSFactor();
                await this.getTempCompensation();
                await this.getStatus();
                this.options.calibration = await this.exportCalibration();
                this.options.readInterval = this.options.readInterval || deviceType.readings.conductivity.interval.default;
                if (typeof this.options.name !== 'string' || this.options.name.length === 0) await this.setName(deviceType.name);
                else this.device.name = this.options.name;
            }
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.resolve(false); }
        finally {
            setTimeout(() => { this.pollDeviceInformation(); }, 2000);
            setTimeout(() => { this.pollReadings(); }, 5000);
        }
    }
    public getValue(prop: string) {
        switch (prop) {
            case 'tdsFactor': { return this.values.tdsFactor; }
            case 'conductivity': { return this.values.conductivity; }
            case 'dissolvedSolids': { return this.values.dissolvedSolids; }
            case 'salinity': { return this.values.salinity; }
            case 'saltLevel': { return this.values.saltLevel; }
            case 'specificGravity': { return this.values.specificGravity; }
            case 'temperature': { return this.values.temperature; }
            case 'probeType': { return this.values.probeType; }
            case 'all': { return this.values; }
        }
    }
    public calcMedian(prop: string, values: any[]) {
        switch (prop.toLowerCase()) {
            case 'conductivity':
            case 'dissolvedsolids':
            case 'salinity':
            case 'saltlevel':
            case 'specificgravity':
            case 'temperature':
                return super.calcMedian(prop, values);
            case 'all':
                // Only the ORP reading is a median here.
                let arrCond = [];
                let arrDs = [];
                let arrSal = [];
                let arrSalt = [];
                let arrSg = [];
                let arrTemp = [];
                for (let i = 0; i < values.length; i++) {
                    let v = values[i];
                    arrCond.push(v.conductivity);
                    arrDs.push(v.dissolvedSolids);
                    arrSal.push(v.salinity);
                    arrSalt.push(v.saltLevel);
                    arrSg.push(v.specificGravity);
                }
                return extend(true, {}, this.values, {
                    conductivity: super.calcMedian(prop, arrCond),
                    dissolvedSolids: super.calcMedian(prop, arrDs),
                    salinity: super.calcMedian(prop, arrSal),
                    saltLevel: super.calcMedian(prop, arrSalt),
                    specificGravity: super.calcMedian(prop, arrSg),
                    temperature: super.calcMedian(prop, arrTemp)
                });
        }
    }
    public setValue(prop: string, value) {
        switch (prop) {
            case 'tempC':
            case 'tempF':
            case 'tempK':
                let temp = utils.convert.temperature.convertUnits(value, prop.substring(4), 'c');
                if(typeof temp === 'number') this.setTempCompensation(temp);
                break;
        }
    }
    public async setOptions(opts): Promise<any> {
        try {
            this.suspendPolling = true;
            if (typeof opts.name !== 'undefined' && this.device.name !== opts.name) await this.setName(opts.name);
            if (typeof opts.suspendTempFeed !== 'undefined' && this.options.suspendTempFeed !== opts.suspendTempFeed) await this.suspendTempFeed(utils.makeBool(opts.suspendTempFeed));
            if (typeof opts.isProtocolLocked !== 'undefined' && this.options.isProtocolLocked !== opts.isProcolLocked) await this.lockProtocol(utils.makeBool(opts.isProtocolLocked));
            if (typeof opts.tempCompensation === 'number' && this.options.tempCompensation !== opts.tempCompensation) await this.setTempCompensation(opts.tempCompensation);
            if (typeof opts.ledEnabled !== 'undefined' && this.options.ledEnabled !== opts.ledEnabled) await this.enableLed(utils.makeBool(opts.ledEnabled));
            if (typeof opts.readInterval === 'number') this.options.readInterval = opts.readInterval;
            if (typeof opts.tdsFactor === 'number' && !isNaN(parseFloat(opts.tdsFactor))) {
                if (parseFloat(opts.tdsFactor) !== this.options.tdsFactor) await this.setTDSFactor(parseFloat(opts.tdsFactor));
            }
            if (typeof opts.probeType === 'number' && !isNaN(parseFloat(opts.probeType))) {
                if (parseFloat(opts.probeType) !== this.options.probeType) await this.setProbeType(parseFloat(opts.probeType));
            }
            if (typeof this.device.options.parameters === 'undefined') this.device.options.parameters = { conductivity: false, dissolvedSolids: false, salinity: false, specificGravity: false };
            if (typeof opts.parameters !== 'undefined') await this.setParameterInfo(opts.parameters);
        }
        catch (err) { this.logError(err); Promise.reject(err); }
        finally { this.suspendPolling = false };
    }
    public async takeReadings(): Promise<boolean> {
        try {
            if (this._timerRead) clearTimeout(this._timerRead);
            await this.readProbe();
            this.emitFeeds();
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async getCalibrated(): Promise<boolean> {
        try {
            let result = await this.execCommand('Cal,?', 300);
            if (typeof result !== 'undefined') {
                let arrDims = result.split(',');
                this.options.calibrationMode = parseInt(arrDims[1] || '0', 10);
                if (typeof this.options.calibration === 'undefined') this.options.calibration = {};
                if (typeof this.options.calibration.points === 'undefined') this.options.calibration.points = { dry: false, single: null, low: null, high: null };
                if (this.options.calibrationMode === 2) {
                    this.options.calibration.points.single = null;
                    this.options.calibration.points.dry = true;
                }
                else if (this.options.calibrationMode === 1) {
                    this.options.calibration.points.dry = true;
                    this.options.calibration.points.high = null;
                }
                if (this.options.calibrationMode === 0) {
                    if (!utils.makeBool(this.options.suspendTempFeed)) this.options.calibration.points.single = this.options.calibration.points.low = this.options.calibration.points.high = null;
                    if (typeof this.options.calibration.points.dry === 'undefined') this.options.calibration.points.dry = false;
                }
            }
            else logger.warn(`${this.device.name} error getting calibration status result was undefined.`);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async setProbeType(value: number): Promise<boolean> {
        try {
            await this.execCommand(`K,${value.toFixed(1)}`, 300);
            this.options.probeType = this.values.probeType = value;
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async getProbeType(): Promise<boolean> {
        try {
            let result = await this.execCommand('K,?', 300);
            if (typeof result !== 'undefined') {
                let arrDims = result.split(',');
                this.options.probeType = this.values.probeType = parseFloat(arrDims[1] || '1');
            }
            else logger.warn(`${this.device.name} error getting probe type result was undefined`);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async getParameterInfo(): Promise<boolean> {
        try {
            if (!this.i2c.isMock) {
                let result = await this.execCommand('O,?', 300);
                if (typeof result !== 'undefined') {
                    let arrDims = result.toUpperCase().split(',');
                    if (typeof this.options.parameters === 'undefined') this.options.parameters = {};
                    this.options.parameters.conductivity = arrDims.indexOf('EC') >= 0;
                    this.options.parameters.dissolvedSolids = arrDims.indexOf('TDS') >= 0;
                    this.options.parameters.salinity = arrDims.indexOf('S') > 0;
                    this.options.parameters.specificGravity = arrDims.indexOf('SG') > 0;
                }
                else logger.warn(`${this.device.name} error getting parameter info result was undefined`);
            }
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async setParameterInfo(opts): Promise<boolean> {
        try {
            if (this.i2c.isMock) {
                if (typeof opts.conductivity !== 'undefined') this.options.parameters.conductivity = utils.makeBool(opts.conductivity);
                if (typeof opts.dissolvedSolids !== 'undefined') this.options.parameters.dissolvedSolids = utils.makeBool(opts.dissolvedSolids);
                if (typeof opts.salinity !== 'undefined') this.options.parameters.salinity = utils.makeBool(opts.salinity);
                if (typeof opts.specificGravity !== 'undefined') this.options.parameters.specificGravity = utils.makeBool(opts.specificGravity);
            }
            else {
                if (typeof opts.conductivity !== 'undefined' && utils.makeBool(opts.conductivity) !== this.options.parameters.conductivity) await this.execCommand(`O,EC,${utils.makeBool(opts.conductivity) ? '1' : '0'}`, 300);
                if (typeof opts.dissolvedSolids !== 'undefined' && utils.makeBool(opts.dissolvedSolids) !== this.options.parameters.dissolvedSolids) await this.execCommand(`O,TDS,${utils.makeBool(opts.dissolvedSolids) ? '1' : '0'}`, 300);
                if (typeof opts.salinity !== 'undefined' && utils.makeBool(opts.salinity) !== this.options.parameters.salinity) await this.execCommand(`O,S,${utils.makeBool(opts.salinity) ? '1' : '0'}`, 300);
                if (typeof opts.specificGravity !== 'undefined' && utils.makeBool(opts.specificGravity) !== this.options.parameters.specificGravity) await this.execCommand(`O,SG,${utils.makeBool(opts.specificGravity) ? '1' : '0'}`, 300);
                await this.getParameterInfo();
            }
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async suspendTempFeed(feed:boolean): Promise<boolean> {
        try {
            if (feed === true) {
                this.options.suspendTempFeed = true;
                await this.execCommand(`T,25`, 300);
                this.values.temperature = 25;
                webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.values });
            }
            else {
                this.options.suspendTempFeed = false;
            }
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async calibrate(data): Promise<I2cDevice> {
        try {
            this.suspendPolling = true;
            if (typeof data === 'undefined' || typeof data.options === 'undefined') return Promise.reject(new Error(`Could not calibrate EZO-EC invalid data format. ${JSON.stringify(data)}`));
            if (typeof data.options.calPointType == 'undefined') return Promise.reject(new Error(`Could not calibrate EZO-EC point type not provider. ${JSON.stringify(data)}`));
            if (data.options.calPointType === 'dry') await this.setCalibrationPoint('dry');
            else if (isNaN(parseFloat(data.options.calPoint))) return Promise.reject(new Error(`Could not calibrate EZO-EC ${data.options.calPointType} invalid value ${data.options.calPoint}. ${JSON.stringify(data)}`));
            else if (data.options.calPointType === 'single') await this.setCalibrationPoint('single', parseFloat(data.options.calPoint));
            else if (data.options.calPointType === 'low') await this.setCalibrationPoint('low', parseFloat(data.options.calPoint));
            else if (data.options.calPointType === 'high') await this.setCalibrationPoint('high', parseFloat(data.options.calPoint));
            else { await this.getCalibrated(); return Promise.reject(new Error(`Could not calibrate EZO-EC no setpoint was provided. ${JSON.stringify(data)}`)); }
            
            return Promise.resolve(this.device);
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
        finally { this.suspendPolling = false; }
    }
    public async setCalibrationPoint(point: string, value?: number): Promise<boolean> {
        try {
            point === 'single' ? await this.execCommand(`Cal,${typeof value !== 'undefined' ? value.toFixed(0) : ''}`, 900) :
                await this.execCommand(`Cal,${point}${typeof value !== 'undefined' ? ',' + value.toFixed(0) : ''}`, 900);
            if (typeof this.options.calibration === 'undefined') this.options.calibration = {};
            if (typeof this.options.calibration.points === 'undefined') this.options.calibration.points = {};
            if (point === 'dry') {
                this.options.calibration.points.dry = true;
                this.options.calibration.points.low = null;
                this.options.calibration.points.high = null;
                this.options.calibration.points.single = null;
            }
            else if (point === 'single') {
                this.options.calibration.points.dry = true;
                this.options.calibration.points.low = null;
                this.options.calibration.points.high = null;
                this.options.calibration.points.single = value;
                await this.getCalibrated();
            }
            else if (point === 'low') {
                this.options.calibration.points.dry = true;
                this.options.calibration.points.high = null;
                this.options.calibration.points.single = null;
                this.options.calibration.points.low = value;
            }
            else {
                this.options.calibration.points.dry = true;
                this.options.calibration.points.high = value;
                await this.getCalibrated();
            }
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async getTempCompensation(): Promise<boolean> {
        try {
            let result = this.i2c.isMock ? `T,${this.values.temperature || 25}` : await this.execCommand('T,?', 300);
            if (typeof result !== 'undefined') {
                let arrDims = result.split(',');
                this.values.temperature = parseFloat(arrDims[1] || '25');
                if (this.values.temperature < 0) await this.setTempCompensation(25);
            }
            else logger.warn(`${this.device.name} error getting temperature compensation result was undefined`);
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.values });
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async setTempCompensation(value: number): Promise<boolean> {
        try {
            if (!utils.makeBool(this.options.suspendTempFeed)) {
                if (!this.i2c.isMock) await this.execCommand(`T,${value.toFixed(1)}`, 300);
                this.values.temperature = value;
            }
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.values });
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async getTDSFactor(): Promise<boolean> {
        try {
            let result = await this.execCommand('TDS,?', 300);
            let arrDims = result.split(',');
            this.values.tdsFactor = this.options.tdsFactor = parseFloat(arrDims[1] || '.54');
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.values });
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async setTDSFactor(value: number): Promise<boolean> {
        try {
            await this.execCommand(`TDS,${value.toFixed(2)}`, 300);
            this.values.tdsFactor = this.options.tdsFactor = value;
            //webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.values });
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
            this.options.name = this.device.name = this.escapeName(name);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async readProbe(tempCompensation?: number): Promise<number> {
        try {
            if (typeof tempCompensation !== 'undefined' && this.version < 2.13 && !utils.makeBool(this.options.suspendTempFeed)) {
                if (tempCompensation !== this.values.temperature) await this.setTempCompensation(tempCompensation);
            }
            // If no output values are selected then we want to bail here because it will 
            //throw a no values error.
            if (!this.options.parameters.conductivity && !this.options.parameters.dissolvedSolids
                && !this.options.parameters.salinity && !this.options.parameters.specificGravity) {
                if (!this.i2c.isMock) return 0;
            }
            if (!this.i2c.isMock) {
                // This is the expected order of data coming from the probe.
                //EC,TDS,S,SG
                let result = typeof tempCompensation !== 'undefined' && this.version >= 2.13 && !utils.makeBool(this.options.suspendTempFeed) ? await this.execCommand(`RT,${tempCompensation.toFixed(1)}`, 900) : await this.execCommand('R', 600);
                let arrDims = result.split(',');
                this.values.conductivity = this.options.parameters.conductivity ? parseFloat(arrDims[0]) : null;
                this.values.dissolvedSolids = this.options.parameters.dissolvedSolids ? parseFloat(arrDims[1]) : null;
                this.values.salinity = this.options.parameters.salinity ? parseFloat(arrDims[2]) : null;
                this.values.specificGravity = this.options.parameters.specificGravity ? parseFloat(arrDims[3]) : null;
                if (typeof tempCompensation !== 'undefined') this.values.temperature = tempCompensation;
                if (!this.options.parameters.conductivity && this.options.parameters.dissolvedSolids) this.values.conductivity = this.options.tdsFactor !== 0 ? Math.round(this.values.dissolvedSolids / this.options.tdsFactor) : null;
                if (!this.options.parameters.dissolvedSolids) {
                    this.values.dissolvedSolids = isNaN(this.values.conductivity) ? null : this.values.conductivity * this.options.tdsFactor;
                }
                if (!this.options.parameters.salinity) {
                    this.values.salinity = isNaN(this.values.conductivity) ? null : this.toSalinity(this.values.conductivity, this.values.temperature);
                }
                this.values.saltLevel = this.values.salinity * 1000;
                if (!this.options.parameters.specificGravity) {
                    this.values.specificGravity = Math.round(this.toDensity(this.values.salinity, this.values.temperature) / 1000);
                }
                if (!utils.makeBool(this.options.suspendTempFeed)) await this.getTempCompensation();
            }
            else {
                if (typeof this.values.conductivity === 'undefined') this.values.conductivity = 6200;
                let chg = Math.round(Math.random() > .5 ? -(Math.random() * 20) : (Math.random() * 20));
                this.values.conductivity = Math.max(5700, Math.min(7700, this.values.conductivity + chg));
                this.values.dissolvedSolids = this.values.conductivity * this.options.tdsFactor;
                this.values.salinity = this.toSalinity(this.values.conductivity, this.values.temperature);
                this.values.saltLevel = this.values.salinity * 1000;
                this.values.specificGravity = Math.round((this.toDensity(this.values.salinity, this.values.temperature) / 1000) * 100) / 100;
            }
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.values });
            return this.values.conductivity;
        }
        catch (err) { this.logError(err); }
    }
    public async clearCalibration(): Promise<I2cDevice> {
        try {
            this.suspendPolling = true;
            await this.execCommand(`Cal,clear`, 300);
            await this.getCalibrated();
            this.options.calibration.points.dry = false;
            this.options.calibration.points.low = null;
            this.options.calibration.points.high = null;
            this.options.calibration.points.single = null;
            return Promise.resolve(this.device);
        }
        catch (err) { this.logError(err); Promise.reject(err); }
        finally { this.suspendPolling = false; }
    }
    public async exportCalibration(): Promise<{ len: number, total: number, data: string[], points:any }> {
        try {
            this.suspendPolling = true;
            let result = await this.execCommand('Export,?', 300);
            let arrDims = result.split(',');
            let dims = { len: parseInt(arrDims[1], 10), total: parseInt(arrDims[2], 10), data: [], points: this.options.calibration.points || {} };
            for (let i = 0; i <= dims.len; i++) {
                let val = await this.execCommand('Export', 300);
                dims.data.push(val);
                if (val.indexOf('*DONE') !== -1) break;
            }
            return Promise.resolve(dims);

        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
    }
    public toSalinity(cond: number, temp: number = 25): number {
        let salinity: number;
        // This only works for good temperature ranges.
        if (temp < 0 || temp > 30 || cond < 0) return null;
        // Set up the conversion factors
        let a0 = 0.008;
        let a1 = -0.1692;
        let a2 = 25.3851;
        let a3 = 14.0941;
        let a4 = -7.0261;
        let a5 = 2.7081;

        let b0 = 0.0005;
        let b1 = -0.0056;
        let b2 = -0.0066;
        let b3 = -0.0375;
        let b4 = 0.0636;
        let b5 = -0.0144;

        let c0 = 0.6766097;
        let c1 = 0.0200564;
        let c2 = 0.0001104259;
        let c3 = -0.00000069698;
        let c4 = 0.0000000010031;

        let r = cond / 42914;
        r /= (c0 + temp * (c1 + temp * (c2 + temp * (c3 + temp * c4))));

        let r2 = Math.sqrt(r);
        let ds = b0 + r2 * (b1 + r2 * (b2 + r2 * (b3 + r2 * (b4 + r2 * b5))));
        ds *= ((temp - 15.0) / (1.0 + 0.0162 * (temp - 15.0)));
        salinity = a0 + r2 * (a1 + r2 * (a2 + r2 * (a3 + r2 * (a4 + r2 * a5)))) + ds;
        
        // EZO-EC only reads conductivity for the ranges 0 - 42ppt for salinity.
        if (salinity < 0) return null; // We fell below our scale.
        else if (salinity > 42.0) return null; // We went above our scale.
        salinity = Math.round(salinity * 1000) / 1000;
        return salinity;
    }
    public toDensity(salinity: number, temp: number = 25): number {
        let density: number;
        let rho = 1000 * (1.0 - (temp + 288.9414) / (508929.2 * (temp + 68.12963)) * (Math.pow(temp - 3.9863, 2))); // Adjust for water temp;
        let factA = 0.824493 - 0.0040899 * temp + 0.000076438 * Math.pow(temp, 2) - 0.00000082467 * Math.pow(temp, 3) + 0.0000000053675 * Math.pow(temp, 4);
        let factB = -0.005724 + 0.00010227 * temp - 0.0000016546 * Math.pow(temp, 2);
        // Return it in 4 decimal places.
        return Math.round((rho + factA * salinity + factB * Math.pow(salinity, (3 / 2)) + 0.00048314 * Math.pow(salinity, 2)) * 1000) / 1000;
    }
    public async getDeviceState(binding: string | DeviceBinding): Promise<any> {
        try {
            let bind = (typeof binding === 'string') ? new DeviceBinding(binding) : binding;
            // We need to know what value we are referring to.
            if (bind.params.length > 0 && typeof bind.params[0] === 'string') return this.getValue(bind.params[0]);
            return this.values.conductivity;
        } catch (err) { return Promise.reject(err); }
    }
}
export class AtlasEZOhum extends AtlasEZO {
    public async initAsync(deviceType): Promise<boolean> {
        try {
            this.stopPolling();
            if (this.device.isActive) {
                this.options.readInterval = this.options.readInterval || deviceType.readings.humidity.interval.default;
                this.options.name = await this.getName();
                await this.getInfo();
                await this.getLedEnabled();
                this.options.isProtocolLocked = await this.isProtocolLocked();
                await this.getParameterInfo();
                await this.getAlarm();
                if (typeof this.options.name !== 'string' || this.options.name.length === 0) await this.setName(deviceType.name);
                else this.device.name = this.options.name;
            }
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.resolve(false); }
        finally {
            setTimeout(() => { this.pollDeviceInformation(); }, 2000);
            setTimeout(() => { this.pollReadings(); }, 5000);
        }
    }
    public getValue(prop: string) {
        switch (prop) {
            case 'temperature': { return this.values.temperature; }
            case 'humidity': { return this.values.humidity; }
            case 'dewpoint': { return this.values.dewpoint; }
            case 'units': { return this.values.units; }
            case 'all': { return this.values; }
        }
    }
    public calcMedian(prop: string, values: any[]) {
        switch (prop) {
            case 'temperature':
            case 'humidity':
            case 'dewpoint':
                return super.calcMedian(prop, values);
            case 'all':
                // Only the ORP reading is a median here.
                let arrTemp = [];
                let arrHum = [];
                let arrDew = [];
                for (let i = 0; i < values.length; i++) { arrTemp.push(values[i].temperature); arrHum.push(values[i].humidity); arrDew.push(values[i].dewpoint); }
                return extend(true, {}, this.values, {
                    temperature: super.calcMedian(prop, arrTemp), humidity: super.calcMedian(prop, arrHum), dewpoint: super.calcMedian(prop, arrDew)
                });
        }
    }

    public setValue(prop: string, value) {
        switch (prop) {
        }
    }
    public async changeAddress(newAddress: number): Promise<boolean> {
        try {
            this.suspendPolling = true;
            // First lets look for any other device at the new address.
            await this.execCommand(`12C,${newAddress}`, -1);
            await utils.wait(15000);
            this.device.address = newAddress;
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
        finally { this.suspendPolling = false; }
    }
    public async setOptions(opts): Promise<any> {
        try {
            this.suspendPolling = true;
            if (typeof opts.name !== 'undefined' && this.device.name !== opts.name) await this.setName(opts.name);
            if (typeof opts.isProtocolLocked !== 'undefined' && this.options.isProtocolLocked !== opts.isProtocolLocked) await this.lockProtocol(utils.makeBool(opts.isProtocolLocked));
            if (typeof opts.ledEnabled !== 'undefined' && this.options.ledEnabled !== opts.ledEnabled) await this.enableLed(utils.makeBool(opts.ledEnabled));
            if (typeof opts.readInterval === 'number') this.options.readInterval = opts.readInterval;
            if (typeof opts.units === 'string' && ['C', 'F'].includes(opts.units.toUpperCase())) { await this.setUnits(opts.units); }
            if (typeof this.options.alarm === 'undefined') this.options.alarm = { enableHumidity: false, enableDewpoint: false, humidity: null, dewpoint:null, tolerance: null };
            if (typeof this.options.parameters === 'undefined') this.options.parameters = { humidity: false, temperature: false, dewpoint: false };
            if (typeof opts.parameters !== 'undefined') await this.setParameterInfo(opts.parameters);
            if (typeof opts.alarm !== 'undefined') {
                if (opts.alarm.enableHumidity) {
                    await this.setAlarm(1, opts.alarm.humidity, opts.alarm.tolerance);
                }
                else if (opts.alarm.enableDewpoint) {
                    await this.setAlarm(2, opts.alarm.humidity, opts.alarm.tolerance);
                }
                else {
                    await this.setAlarm(0, opts.alarm.humidity, opts.alarm.tolerance);
                }
            }
        }
        catch (err) { this.logError(err); Promise.reject(err); }
        finally { this.suspendPolling = false };
    }
    public async takeReadings(): Promise<boolean> {
        try {
            if (this._timerRead) clearTimeout(this._timerRead);
            await this.readProbe();
            this.emitFeeds();
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async setUnits(value: string): Promise<boolean> {
        try {
            if (!['C', 'F'].includes(value.toUpperCase())) return Promise.reject(new Error(`Cannot set units to ${value}`));
            let units = this.values.units || 'C';
            this.values.units = value.toUpperCase();
            this.options.units = value.toUpperCase();
            this.values.temperature = typeof this.values.temperature === 'number' ? utils.convert.temperature.convertUnits(this.values.temperature, units, value) : null;
            this.values.dewpoint = typeof this.values.dewpoint === 'number' ? utils.convert.temperature.convertUnits(this.values.dewpoint, units, value) : null;
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.values });
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public async getParameterInfo(): Promise<boolean> {
        try {
            this.suspendPolling = true;
            let result = await this.execCommand('O,?', 300);
            let arrDims = result.toUpperCase().split(',');
            if (typeof this.options.parameters === 'undefined') this.options.parameters = {};

            this.options.parameters.humidity = arrDims.indexOf('HUM') >= 0;
            this.options.parameters.temperature = arrDims.indexOf('T') >= 0;
            this.options.parameters.dewpoint = arrDims.indexOf('DEW') > 0;
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
    }
    public async setParameterInfo(opts): Promise<boolean> {
        try {
            this.suspendPolling = true;
            if (typeof opts.humidity !== 'undefined' && utils.makeBool(opts.humidity) !== this.options.parameters.humidity) await this.execCommand(`O,HUM,${utils.makeBool(opts.humidity) ? '1' : '0'}`, 300);
            if (typeof opts.temperature !== 'undefined' && utils.makeBool(opts.temperature) !== this.options.parameters.temperature) await this.execCommand(`O,T,${utils.makeBool(opts.temperature) ? '1' : '0'}`, 300);
            if (typeof opts.dewpoint !== 'undefined' && utils.makeBool(opts.dewpoint) !== this.options.parameters.dewpoint) await this.execCommand(`O,Dew,${utils.makeBool(opts.dewpoint) ? '1' : '0'}`, 300);
            await this.getParameterInfo();
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
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
            this.suspendPolling = true;
            await this.execCommand(`Name,${this.escapeName(name)}`, 300);
            this.options.name = this.device.name = this.escapeName(name);
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
    }
    public async readProbe(): Promise<number> {
        try {
            this.suspendPolling = true;
            // This is the expected order of data coming from the probe.
            //HUM,T,Dew
            if (!this.options.parameters.humidity && !this.options.parameters.temperature && !this.options.parameters.dewpoint) {
                if (!this.i2c.isMock) return Promise.resolve(0);
            }
            let result = await this.execCommand('R', 300);
            let units = typeof this.values.units !== 'undefined' ? this.values.units : this.values.units = 'C';
            if (!this.i2c.isMock) {
                let arrDims = result.split(',');
                this.values.humidity = this.options.parameters.humidity ? parseFloat(arrDims[0]) : null;
                this.values.temperature = this.options.parameters.temperature ? utils.convert.temperature.convertUnits(parseFloat(arrDims[1]), 'C', units) : null;
                if (this.options.parameters.dewpoint) {
                    let ndx = (typeof arrDims[2] === 'string' && arrDims[2].toLowerCase() === 'dew') ? 3 : 2;
                    this.values.dewpoint = this.options.parameters.dewpoint ? utils.convert.temperature.convertUnits(parseFloat(arrDims[ndx]), 'C', units) : null;
                }
            }
            else {
                let chg = Math.random() < .5 ? -Math.random() : Math.random();
                this.values.humidity = Math.round(Math.max(10, Math.min(100, (this.values.humidity || 30) + chg)) * 100) / 100;
                let t = Math.round(Math.max(Math.min(40, utils.convert.temperature.convertUnits(this.values.temperature || 25, units, 'C') + chg), 10) * 1000) / 1000;
                this.values.temperature = utils.convert.temperature.convertUnits(t, 'C', units);
                this.values.dewpoint = utils.convert.temperature.convertUnits(t - 7, 'C', units);
            }
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.values });
            return Promise.resolve(this.values.conductivity);
        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
    }
    public async setAlarm(alarmType: number, level?: number, tolerance?: number): Promise<boolean> {
        try {
            this.suspendPolling = true;
            if (isNaN(alarmType) || alarmType < 0 || alarmType > 2) return Promise.reject(new Error(`Could not set Humidity alarm type:${alarmType} level:${level} tolerance:${tolerance}`));
            if (typeof this.options.alarm === 'undefined') this.options.alarm = { enableHumidity: false, enableDewpoint: false, humidity: null, dewpoint: null, tolerance: 0 };
            let at = this.device.options.alarm.enableHumidity ? 1 : this.device.options.alarm.enableDewpoint ? 2 : 0;
            if (alarmType === 0) {
                await this.execCommand(`Auto,en,0`, 300);
                await this.getAlarm();
            }
            else {
                if (isNaN(level) || isNaN(tolerance) || alarmType < 0 || alarmType > 2) return Promise.reject(new Error(`Could not set Humidity alarm type:${alarmType} level:${level} tolerance:${tolerance}`));
                if (alarmType !== at || tolerance !== this.device.options.alarm.tolerance ||
                    (alarmType === 1 && level !== this.device.options.alarm.humidity) ||
                    (alarmType === 2 && level !== this.device.options.alarm.dewpoint)) {
                    await this.execCommand(`Auto,en,${alarmType}`, 300);
                    await this.execCommand(`Auto,${level.toFixed(2)}`, 300);
                    await this.execCommand(`Auto,tol,${tolerance.toFixed(2)}`, 300);
                    await this.getAlarm();
                }
            }
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
    }
    public async getAlarm(): Promise<boolean> {
        try {
            this.suspendPolling = true;
            if (typeof this.options.alarm === 'undefined') this.options.alarm = { enableHumidity: false, enableDewpoint: false, humidity: null, dewpoint: null, tolerance: null };
            let result = await this.execCommand('Auto,?', 300);
            let arrDims = result.split(',');
            if (arrDims.length < 4 || parseInt(arrDims[3], 10) == 0) {
                this.options.alarm.enableHumidity = this.options.alarm.enableDewpoint = false;
                this.options.alarm.humidity = this.options.alarm.dewpoint = this.options.alarm.tolerance = null;
            }
            else {
                let type = parseInt(arrDims[3], 10);
                if (type === 1) {
                    this.options.alarm.enableHumidity = true;
                    this.options.alarm.enableDewpoint = false;
                    this.options.alarm.humidity = parseFloat(arrDims[1]);
                    this.options.alarm.tolerance = parseFloat(arrDims[2]);
                }
                else if (type == 2) {
                    this.options.alarm.enableHumidity = false;
                    this.options.alarm.enableDewpoint = true;
                    this.options.alarm.dewpoint = parseFloat(arrDims[1]);
                    this.options.alarm.tolerance = parseFloat(arrDims[2]);
                }
                else {
                    this.options.alarm.enableHumidity = this.options.alarm.enableDewpoint = false;
                    this.options.alarm.humidity = this.options.alarm.dewpoint = this.options.alarm.tolerance = null;
                }
            }
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
        finally { this.suspendPolling = false; }
    }
    public async getDeviceState(binding: string | DeviceBinding): Promise<any> {
        try {
            let bind = (typeof binding === 'string') ? new DeviceBinding(binding) : binding;
            // We need to know what value we are referring to.
            if (bind.params.length > 0 && typeof bind.params[0] === 'string') return this.getValue(bind.params[0]);
            return this.values.humidity;
        } catch (err) { return Promise.reject(err); }
    }
}
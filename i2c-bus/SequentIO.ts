//MEGA-IND
//MEGA-IO
import { logger } from "../logger/Logger";
import { vMaps, valueMap, utils } from "../boards/Constants";
import { setTimeout, clearTimeout } from "timers";
import * as extend from "extend";
import { Buffer } from "buffer";
import { i2cDeviceBase } from "./I2cBus";
import { webApp } from "../web/Server";
import { I2cDevice, DeviceBinding } from "../boards/Controller";

export class SequentIO extends i2cDeviceBase {
    protected _timerRead: NodeJS.Timeout;
    protected _infoRead: NodeJS.Timeout;
    protected _suspendPolling: number = 0;
    protected _pollInformationInterval = 30000;
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

    public get relays() { return typeof this.values.relays === 'undefined' ? this.values.relays = [] : this.values.relays; }
    public set relays(val) { this.values.relays = val; }
    public get in4_20() { return typeof this.values.inputs === 'undefined' ? this.values.inputs = { in4_20: [] } : typeof this.values.inputs.in4_20 === 'undefined' ? this.values.inputs.in4_20 = [] : this.values.inputs.in4_20; }
    public get in0_10() { return typeof this.values.inputs === 'undefined' ? this.values.inputs = { in0_10: [] } : typeof this.values.inputs.in0_10 === 'undefined' ? this.values.inputs.in0_10 = [] : this.values.inputs.in0_10; }
    public get inOpt() { return typeof this.values.inputs === 'undefined' ? this.values.inputs = { inOpt: [] } : typeof this.values.inputs.inOpt === 'undefined' ? this.values.inputs.inOpt = [] : this.values.inputs.inOpt; }
    public get out4_20() { return typeof this.values.outputs === 'undefined' ? this.values.outputs = { out4_20: [] } : typeof this.values.outputs.out4_20 === 'undefined' ? this.values.outputs.out4_20 = [] : this.values.outputs.out4_20; }
    public get out0_10() { return typeof this.values.outputs === 'undefined' ? this.values.outputs = { out0_10: [] } : typeof this.values.outputs.out0_10 === 'undefined' ? this.values.outputs.out0_10 = [] : this.values.outputs.out0_10; }
    public get outDrain() { return typeof this.values.outputs === 'undefined' ? this.values.outputs = { outDrain: [] } : typeof this.values.outputs.outDrain === 'undefined' ? this.values.outputs.outDrain = [] : this.values.outputs.outDrain; }
    // Get the information from the board.
    protected async getFwVer() {
        try {

        } catch (err) { logger.error(`Error getting firmware version ${err.message}`); }
    }
    protected async getRaspVolts() {
        try {

        } catch (err) { logger.error(`Error getting Raspberry Pi voltage: ${err.message}`); }
    }
    protected async getSourceVolts() {
        try {

        } catch (err) { logger.error(`Error getting source voltage: ${err.message}`); }
    }
    protected async getCpuTemp() {
        try {

        } catch (err) { logger.error(`Error getting CPU temperature: ${err.message}`); }
    }
    protected async get0_10Input(id) {
        try {

        } catch (err) { logger.error(`Error getting 0-10 input ${id}: ${err.message}`); }
    }
    protected async get0_10Output(id) {
        try {

        } catch (err) { logger.error(`Error getting 0-10 output ${id}: ${err.message}`); }
    }
    protected async set0_10Output(id) {
        try {

        } catch (err) { logger.error(`Error setting 0-10 output ${id}: ${err.message}`); }
    }
    protected async set4_20Output(id) {
        try {

        } catch (err) { logger.error(`Error setting 4-20 output ${id}: ${err.message}`); }
    }
    protected async set4_20Input(id) {
        try {

        } catch (err) { logger.error(`Error setting 4-20 input ${id}: ${err.message}`); }
    }
    protected async get4_20Output(id) {
        try {

        } catch (err) { logger.error(`Error getting 4-20 output ${id}: ${err.message}`); }
    }
    protected async setRS485Mode(mode) {
        try {

        } catch (err) { logger.error(`Error setting RS485 mode ${mode}: ${err.message}`); }
    }
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
            if (!this.suspendPolling && this.device.isActive) {
                this.takeReadings();
            }
        }
        catch (err) { this.logError(err, 'Error Polling Device Values'); }
        finally { this._timerRead = setTimeout(() => { this.pollReadings(); }, this.options.readInterval) }
    }
    public async takeReadings(): Promise<boolean> {
        try { return Promise.resolve(true); }
        catch (err) { this.logError(err, 'Error taking device readings'); }
    }

    public get suspendPolling(): boolean { if (this._suspendPolling > 0) logger.warn(`${this.device.name} Suspend Polling ${this._suspendPolling}`); return this._suspendPolling > 0; }
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
    public async getStatus(): Promise<boolean> {
        try {
            //this.suspendPolling = true;
            //let result = await this.execCommand('Status', 300);
            //if (this.i2c.isMock) return Promise.resolve(true);
            //let arrDims = result.split(',');
            //this.device.info.vcc = parseFloat(arrDims[2] || '0');
            //this.device.info.lastRestart = this.transformRestart((arrDims[1] || 'U').toUpperCase());
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err, `Error getting device status:`); return Promise.reject(err); }
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
    public async closeAsync(): Promise<void> {
        try {
            await this.stopPolling();
            await super.closeAsync();
            return Promise.resolve();
        }
        catch (err) { return this.logError(err); }
    }
    public getValue(prop: string) { }
    public setValue(prop: string, value) { }
}
export class SequentMegaIO extends SequentIO {
    public async initAsync(deviceType): Promise<boolean> {
        try {
            this.stopPolling();
            this.pollDeviceInformation();
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
            if (typeof data === 'undefined' || typeof data.options === 'undefined') return Promise.reject(`Could not calibrate EZO-ORP invalid data format. ${JSON.stringify(data)}`);
            if (typeof data.options.calPoint !== 'undefined') await this.setCalibrationPoint(parseFloat(data.options.calPoint));
            else { return Promise.reject(`Could not calibrate EZO-ORP no setpoint was provided. ${JSON.stringify(data)}`) }
            this.options.calibrationMode = await this.getCalibrated();
            return Promise.resolve(this.device);
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
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
export class SequentMegaIND extends SequentIO {
    public async initAsync(deviceType): Promise<boolean> {
        try {
            this.stopPolling();
            if (typeof this.device.options.name !== 'string' || this.device.options.name.length === 0) this.device.name = this.device.options.name = deviceType.name;
            else this.device.name = this.device.options.name;
            await this.getInfo();
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); return Promise.resolve(false); }
        finally {
            setTimeout(() => { this.pollDeviceInformation(); }, 2000);
            setTimeout(() => { this.pollReadings(); }, 5000);
        }
    }
    public async getInfo(): Promise<boolean> {
        try {
            this.suspendPolling = true;
            this.device.info.firmware = await this.getFwVer();
            this.device.info.sourceVolts = await this.getSourceVolts();
            this.device.info.raspiVolts = await this.getRaspVolts();
            return true;
        }
        catch (err) { logger.error(`Error getting info ${typeof err !== 'undefined' ? err.message : ''}`); return Promise.reject(err); }
        finally { this.suspendPolling = false; }
    }
    public async setOptions(opts): Promise<any> {
        try {
            this.suspendPolling = true;
            return Promise.resolve(this.options);
        }
        catch (err) { this.logError(err); Promise.reject(err); }
        finally { this.suspendPolling = false; }
    }
    public getValue(prop: string) {
        //switch (prop.toLowerCase()) {
        //    case 'phlevel': 
        //    case 'ph': { return this.values.pH; }
        //    case 'all': { return this.values; }
        //}
    }
    public setValue(prop: string, value) {
        //switch (prop) {
        //    case 'tempC':
        //    case 'tempF':
        //    case 'tempK':
        //        let temp = utils.convert.temperature.convertUnits(value, prop.substring(4), 'c');
        //        if (typeof temp === 'number') this.setTempCompensation(temp);
        //        break;
        //}
    }
    public calcMedian(prop: string, values: any[]) {
        //switch (prop.toLowerCase()) {
        //    case 'phlevel':
        //    case 'ph':
        //        return super.calcMedian(prop, values);
        //    case 'all':
        //        // Only the ORP reading is a median here.
        //        let arrPh = [];
        //        let arrTemp = [];
        //        for (let i = 0; i < values.length; i++) {
        //            arrPh.push(values[i].pH); arrTemp.push(values[i].temperature);
        //        }
        //        return extend(true, {}, this.values, { pH: super.calcMedian(prop, arrPh), temperature: super.calcMedian(prop, arrTemp) });
        //}
    }
    public async getDeviceState(binding: string | DeviceBinding): Promise<any> {
        try {
            let bind = (typeof binding === 'string') ? new DeviceBinding(binding) : binding;
            // We need to know what value we are referring to.
            if (typeof bind.params[0] === 'string') return this.getValue(bind.params[0]);
            return this.values;
        } catch (err) { return Promise.reject(err); }
    }
}

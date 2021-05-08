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
    public get inputs(): any { return typeof this.values.inputs === 'undefined' ? this.values.inputs = {} : this.values.inputs; }
    public get outputs(): any { return typeof this.values.outputs === 'undefined' ? this.values.outputs = {} : this.values.outputs; }
    public get rs485() { return typeof this.options.rs485 === 'undefined' ? this.options.rs485 = { mode: 0, baud: 1200, stopBits: 1, parity: 0, address: 0 } : this.options.rs485; }
    public get in4_20(): any[] { return typeof this.inputs.in4_20 === 'undefined' ? this.inputs.in4_20 = [] : this.inputs.in4_20; }
    public get in0_10(): any[] { return typeof this.inputs.in0_10 === 'undefined' ? this.inputs.in0_10 = [] : this.inputs.in0_10; }
    public get inOpt(): any[] { return typeof this.inputs.inOpt === 'undefined' ? this.inputs.inOpt = [] : this.inputs.inOpt; }
    public get out4_20(): any[] { return typeof this.outputs.out4_20 === 'undefined' ? this.outputs.out4_20 = [] : this.outputs.out4_20; }
    public get out0_10(): any[] { return typeof this.outputs.out0_10 === 'undefined' ? this.outputs.out0_10 = [] : this.outputs.out0_10; }
    public get outDrain(): any[] { return typeof this.outputs.outDrain === 'undefined' ? this.outputs.outDrain = [] : this.outputs.outDrain; }
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
    protected async takeReadings(): Promise<boolean> { return true; }
    protected pollReadings() {
        try {
            if (this._timerRead) clearTimeout(this._timerRead);
            this._timerRead == null;
            if (!this.suspendPolling && this.device.isActive) {
                (async () => {
                    await this.takeReadings().catch(err => { logger.error(err); });
                })();
            }
        }
        catch (err) { this.logError(err, 'Error Polling Device Values'); }
        finally { this._timerRead = setTimeout(async () => { await this.pollReadings(); }, this.options.readInterval) }
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
export class SequentMegaIND extends SequentIO {
    protected ensureIOChannels(label, arr, count) {
        try {
            for (let i = 1; i <= count; i++) {
                if (typeof arr.find(elem => elem.id === i) === 'undefined') arr.push({ id: i, name: `Channel #${i}`, isActive: false });
            }
            arr.sort((a, b) => { return a.id - b.id });
            arr.length = count;
        } catch (err) { logger.error(`${this.device.name} error setting up I/O channels`)}
    }
    public async initAsync(deviceType): Promise<boolean> {
        try {
            this.stopPolling();
            if (typeof this.options.readInterval === 'undefined' || this.options.readInterval < 1000) this.options.readInterval = 5000;
            if (typeof this.device.options.name !== 'string' || this.device.options.name.length === 0) this.device.name = this.device.options.name = deviceType.name;
            else this.device.name = this.device.options.name;
            this.device.info.firmware = await this.getFwVer();
            await this.getInfo();
            // Set up all the I/O channels.  We want to create a values data structure for all potential inputs and outputs.
            this.ensureIOChannels('IN 0-10', this.in0_10, 4);
            this.ensureIOChannels('OUT 0-10', this.out0_10, 4);
            this.ensureIOChannels('IN 4-20', this.in4_20, 4);
            this.ensureIOChannels('OUT 4-20', this.out4_20, 4);
            this.ensureIOChannels('IN Optical', this.inOpt, 4);
            this.ensureIOChannels('OUT Open Drain', this.outDrain, 4);
            await this.getRS485Mode();
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
            await this.getSourceVolts();
            await this.getRaspVolts();
            await this.getCpuTemp();
            return true;
        }
        catch (err) { logger.error(`Error getting info ${typeof err !== 'undefined' ? err.message : ''}`); return Promise.reject(err); }
        finally { this.suspendPolling = false; }
    }
    protected async readIOChannels(arr, fn) {
        try {
            for (let i = 0; i < arr.length; i++) {
                try {
                    if (arr[i].isActive !== true) continue; // Don't read inactive channels.
                    await fn.call(this, arr[i].id);
                } catch (err) { }
            }
        } catch (err) { }
    }
    public async takeReadings(): Promise<boolean> {
        try {
            // Read all the active inputs and outputs.
            await this.readIOChannels(this.in0_10, this.get0_10Input);
            await this.readIOChannels(this.out0_10, this.get0_10Output);
            await this.readIOChannels(this.in4_20, this.get4_20Input);
            await this.readIOChannels(this.out4_20, this.get4_20Output);
            await this.readIOChannels(this.outDrain, this.getDrainOutput);
            // Read all the digital inputs.
            return true;
        }
        catch (err) { this.logError(err, 'Error taking device readings'); }
    }

    /*
      114:B = CPU Temp
      115:W = Source mV
      117:W = Raspberry Pi mV
      120:B = Firmware major
      121:B = Firmware minor
    */
    protected async getCpuTemp() {
        try {
            this.info.cpuTemp = await this.i2c.readWord(this.device.address, 114) / 1000;
        } catch (err) { logger.error(`${this.device.name} error getting cpu temp: ${err.message}`); }
    }
    protected async getSourceVolts() {
        try {
            this.info.volts = await this.i2c.readWord(this.device.address, 115) / 1000;
        } catch (err) { logger.error(`${this.device.name} error getting source voltage: ${err.message}`); }
    }
    protected async getRaspVolts() {
        try {
            this.info.raspiVolts = await this.i2c.readWord(this.device.address, 117) / 1000;
        } catch (err) { logger.error(`${this.device.name} error getting Raspberry Pi voltage: ${err.message}`); }
    }
    protected async getFwVer() {
        try {
            let major = await this.i2c.readByte(this.device.address, 120);
            let minor = await this.i2c.readByte(this.device.address, 121);
            this.info.fwVersion = `${major + minor / 100.0}`;
        } catch (err) { logger.error(`${this.device.name} error getting firmware version: ${err.message}`); }
    }
    protected async get0_10Input(id) {
        try {
            let val = await this.i2c.readWord(this.device.address, 28 + (2 * (id - 1))) / 1000;
            this.in0_10[id - 1].value = val;
        } catch (err) { logger.error(`${this.device.name} error getting 0-10 input ${id}: ${err.message}`); }
    }
    protected async get0_10Output(id) {
        try {
            let val = await this.i2c.readWord(this.device.address, 4 + (2 * (id - 1))) / 1000;
            this.out0_10[id - 1].value = val;
        } catch (err) { logger.error(`${this.device.name} error getting 0-10 output ${id}: ${err.message}`); }
    }
    protected async get0_10pmInput(id) {
        try {
            let val = await this.i2c.readWord(this.device.address, 36 + (2 * (id - 1))) / 1000 - 10;
        } catch (err) { logger.error(`${this.device.name} error getting 0-10 output ${id}: ${err.message}`); }
    }
    protected async getDrainOutput(id) {
        try {
            let val = await this.i2c.readWord(this.device.address, 36 + (2 * (id - 1))) / 100;
            this.outDrain[id - 1].value = val;
        } catch (err) { logger.error(`${this.device.name} error getting open drain output ${id}: ${err.message}`); }
    }
    protected async set0_10Output(id, val) {
        try {
            if (val < 0 || val > 10) throw new Error(`Value must be between 0 and 10`);
            await this.i2c.writeWord(this.device.address, 4 + (2 * (id - 1)), val * 1000);
            this.out0_10[id - 1].value = val;
        } catch (err) { logger.error(`${this.device.name} error setting 0-10 output ${id}: ${err.message}`); }
    }
    protected async get4_20Input(id) {
        try {
            let val = await this.i2c.readWord(this.device.address, 44 + (2 * (id - 1))) / 1000;
            this.in4_20[id - 1].value = val;
        } catch (err) { logger.error(`${this.device.name} error setting 4-20 output ${id}: ${err.message}`); }
    }
    protected async get4_20Output(id) {
        try {
            let val = await this.i2c.readWord(this.device.address, 12 + (2 * (id - 1))) / 1000;
            this.out4_20[id - 1].value = val;
        } catch (err) { logger.error(`${this.device.name} error getting 4-20 output ${id}: ${err.message}`); }
    }
    protected async set4_20Input(id, val) {
        try {
            if (val < 4 || val > 20) throw new Error(`Value must be between 4 and 20`);
            await this.i2c.writeWord(this.device.address, 44 + (2 * (id - 1)), val * 1000);
            this.in4_20[id - 1].value = val;
        } catch (err) { logger.error(`${this.device.name} error setting 4-20 input ${id}: ${err.message}`); }
    }
    protected async set4_20Output(id, val) {
        try {
            if (val < 4 || val > 20) throw new Error(`Value must be between 4 and 20`);
            await this.i2c.writeWord(this.device.address, 12 + (2 * (id - 1)), val * 1000);
            this.out4_20[id - 1].value = val;
        } catch (err) { logger.error(`${this.device.name} error setting 4-20 input ${id}: ${err.message}`); }
    }
    protected async getRS485Mode() {
        try {
            let ret: { bytesRead: number, buffer: Buffer } = await this.i2c.readI2cBlock(this.device.address, 65, 5);
            //{ bytesRead: 5, buffer: <Buffer 00 96 00 41 01 > }
            // [0, 150, 0, 65, 1]
            // This should be
            // mode: 1
            // baud: 38400
            // stopBits: 1
            // parity: 0
            // address: 1
            // It is returned from the buffer in packed bits.
            // Sequent folks are braindead here in that they bit encoded
            // this on uneven boundaries.
            //typedef struct
            //__attribute__((packed))
            //{
            //    unsigned int mbBaud: 24;
            //    unsigned int mbType: 4;
            //    unsigned int mbParity: 2;
            //    unsigned int mbStopB: 2;
            //    unsigned int add: 8;
            //} ModbusSetingsType;
            this.rs485.baud = ret.buffer.readUInt16LE(0) + (ret.buffer.readUInt8(0) << 24);
            let byte = ret.buffer.readUInt8(3);
            this.rs485.mode = byte & 0x0F;
            this.rs485.parity = (byte & 0x30) >> 5;
            this.rs485.stopBits = (byte & 0xC0) >> 7;
            this.rs485.address = ret.buffer.readUInt8(4);
        } catch (err) { logger.error(`${this.device.name} error getting RS485 port settings: ${err.message}`); }
    }

    protected async setRS485Mode(mode) {
        try {

        } catch (err) { logger.error(`${this.device.name} error setting RS485 mode ${mode}: ${err.message}`); }
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

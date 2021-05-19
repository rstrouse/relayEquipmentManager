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
    public get inDigital(): any[] { return typeof this.inputs.inDigital === 'undefined' ? this.inputs.inDigital = [] : this.inputs.inDigital; }
    public get out4_20(): any[] { return typeof this.outputs.out4_20 === 'undefined' ? this.outputs.out4_20 = [] : this.outputs.out4_20; }
    public get out0_10(): any[] { return typeof this.outputs.out0_10 === 'undefined' ? this.outputs.out0_10 = [] : this.outputs.out0_10; }
    public get outDrain(): any[] { return typeof this.outputs.outDrain === 'undefined' ? this.outputs.outDrain = [] : this.outputs.outDrain; }
    public get calibration(): any { return typeof this.calibration === 'undefined' ? this.info.calibration = {} : this.info.calibration; }
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
            // Not sure what we wanto to poll here but I assume wdt and rtc when we get around to it.
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
    public getValue(prop: string, val?: any) { return super.getValue(prop, val); }
    public setValue(prop: string, value) { }
    public async readWord(register: number): Promise<number> {
        try {
            let ret: { bytesRead: number, buffer: Buffer } = this.i2c.isMock ? {
                bytesRead: 2,
                buffer: Buffer.from([Math.round(256 * Math.random()), Math.round(256 * Math.random())])
            } : await this.i2c.readI2cBlock(this.device.address, register, 2);
            if (ret.bytesRead !== 2) return Promise.reject(`${this.device.name} error reading word from register ${register} bytes: ${ret.bytesRead}`);
            return ret.buffer.readUInt8(0) + 256 * ret.buffer.readUInt8(1);
        } catch (err) { }
    }
}
export class SequentMegaIND extends SequentIO {
    protected calDefinitions = {
        in0_10: { name: '0-10v input', idOffset: 9 },
        out0_10: { name: '0-10v output', idOffset: 1 },
        in4_20: { name: '4-20mA input', idOffset: 17 },
        out4_20: { name: '4-20mA output', idOffset: 5 },
        in0_10pm: { name: '+- 10v input', idOffset: 13 }
    }
    protected ensureIOChannels(label, arr, count) {
        try {
            for (let i = 1; i <= count; i++) {
                if (typeof arr.find(elem => elem.id === i) === 'undefined') arr.push({ id: i, name: `${label} #${i}`, enabled: false });
            }
            arr.sort((a, b) => { return a.id - b.id });
            arr.length = count;
        } catch (err) { logger.error(`${this.device.name} error setting up I/O channels`)}
    }
    public async initAsync(deviceType): Promise<boolean> {
        try {
            this.stopPolling();
            if (typeof this.options.readInterval === 'undefined') this.options.readInterval = 3000;
            this.options.readInterval = Math.max(500, this.options.readInterval);
            if (typeof this.device.options.name !== 'string' || this.device.options.name.length === 0) this.device.name = this.device.options.name = deviceType.name;
            else this.device.name = this.device.options.name;
            this.device.info.firmware = await this.getFwVer();
            await this.getInfo();
            // Set up all the I/O channels.  We want to create a values data structure for all potential inputs and outputs.
            this.ensureIOChannels('IN 0-10', this.in0_10, 4);
            this.ensureIOChannels('OUT 0-10', this.out0_10, 4);
            this.ensureIOChannels('IN 4-20', this.in4_20, 4);
            this.ensureIOChannels('OUT 4-20', this.out4_20, 4);
            this.ensureIOChannels('IN Digital', this.inDigital, 4);
            this.ensureIOChannels('OUT Open Drain', this.outDrain, 4);
            await this.getRS485Port();
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
                    if (arr[i].enabled !== true) continue; // Don't read inactive channels.
                    await fn.call(this, arr[i].id);
                } catch (err) { }
            }
        } catch (err) { }
    }
    public async takeReadings(): Promise<boolean> {
        try {
            // Read all the active inputs and outputs.
            await this.readDigitalInput();
            await this.readIOChannels(this.in0_10, this.get0_10Input);
            await this.readIOChannels(this.out0_10, this.get0_10Output);
            await this.readIOChannels(this.in4_20, this.get4_20Input);
            await this.readIOChannels(this.out4_20, this.get4_20Output);
            await this.readIOChannels(this.outDrain, this.getDrainOutput);
            // Read all the digital inputs.
            this.emitFeeds();
            return true;
        }
        catch (err) { this.logError(err, 'Error taking device readings'); }
    }

    /*
      44:W = in4-20 Start
      114:B = CPU Temp
      115:W = Source mV
      117:W = Raspberry Pi mV
      120:B = Firmware major
      121:B = Firmware minor

    */
    protected async getCpuTemp() {
        try {
            this.info.cpuTemp = (this.i2c.isMock) ? 24.123 : await this.i2c.readWord(this.device.address, 114) / 1000;
        } catch (err) { logger.error(`${this.device.name} error getting cpu temp: ${err.message}`); }
    }
    protected async getSourceVolts() {
        try {
            this.info.volts = (this.i2c.isMock) ? 5.123 : await this.i2c.readWord(this.device.address, 115) / 1000;
        } catch (err) { logger.error(`${this.device.name} error getting source voltage: ${err.message}`); }
    }
    protected async getRaspVolts() {
        try {
            this.info.raspiVolts = (this.i2c.isMock) ? 5.023 : await this.i2c.readWord(this.device.address, 117) / 1000;
        } catch (err) { logger.error(`${this.device.name} error getting Raspberry Pi voltage: ${err.message}`); }
    }
    protected async getFwVer() {
        try {
            if (this.i2c.isMock) {
                this.info.fwVersion = `1.0 Mock`;
            }
            else {
                let major = await this.i2c.readByte(this.device.address, 120);
                let minor = await this.i2c.readByte(this.device.address, 121);
                this.info.fwVersion = `${major + minor / 100.0}`;
            }
        } catch (err) { logger.error(`${this.device.name} error getting firmware version: ${err.message}`); }
    }
    protected async getCalibrationStatus(): Promise<number> {
        try {
            this.suspendPolling = true;
            // Sequent is really dissapointing with this.  They made this about a million times harder to determine which registers
            // map to which value.  Unless I decided to rebuild their repo and dump the values, I have to decipher there header file... booo!
            //CALIBRATION_KEY = 0xAA = 170
            //RESET_CALIBRATION_KEY = 0x55 = 85
            //60w: I2C_MEM_CALIB_VALUE = 60,
            //62w: I2C_MEM_CALIB_CHANNEL = I2C_MEM_CALIB_VALUE + 2, //0-10V out [1,4]; 0-10V in [5, 12]; R 1K in [13, 20]; R 10K in [21, 28]
            //63b: I2C_MEM_CALIB_KEY, //set calib point 0xaa; reset calibration on the channel 0x55
            //64b: I2C_MEM_CALIB_STATUS,
            let val = (this.i2c.isMock) ? (typeof this.calibration.status !== 'undefined' ? this.calibration.status.val : 1) : this.i2c.readByte(this.device.address, 171);
            switch (val) {
                case 0:
                    this.calibration.status = { val: val, name: 'cal', desc: 'Calibration in progress' };
                    break;
                case 1:
                    this.calibration.status = { val: val, name: 'complete', desc: 'Calibration complete' };
                    break;
                case 2:
                    this.calibration.status = { val: val, name: 'error', desc: 'Calibration Error' };
                    break;
                default:
                    this.calibration.status = { val: val, name: 'unknown', desc: 'Unknown calibration status' };
                    break;
            }
            return val;
        } catch (err) { return Promise.reject(`${this.device.name} error getting calibration status: ${err.message}`); }
        finally { this.suspendPolling = false; }
    }
    protected async resetCal0_10Input(id) {
        try {
            this.suspendPolling = true;
            let io = this.in0_10[id - 1];
            await this.resetCalibration(io, io.plusMinus === true ? this.calDefinitions.in0_10pm : this.calDefinitions.in0_10);
        } catch (err) { logger.error(`${this.device.name} error resetting calibration 0-10v input: ${err.message}`); }
        finally { this.suspendPolling = false; }
    }
    protected async resetCal0_10Output(id) {
        try {
            this.suspendPolling = true;
            await this.resetCalibration(this.out0_10[id - 1], this.calDefinitions.out0_10);
        } catch (err) { logger.error(`${this.device.name} error resetting calibration 0-10v input: ${err.message}`); }
        finally { this.suspendPolling = false; }
    }
    protected async resetCal4_20Input(id) {
        try {
            this.suspendPolling = true;
            await this.resetCalibration(this.in4_20[id - 1], this.calDefinitions.in4_20);
        } catch (err) { logger.error(`${this.device.name} error resetting calibration 4-20mA input: ${err.message}`); }
        finally { this.suspendPolling = false; }
    }
    protected async resetCal4_20Output(id) {
        try {
            this.suspendPolling = true;
            await this.resetCalibration(this.out4_20[id - 1], this.calDefinitions.out4_20);
        } catch (err) { logger.error(`${this.device.name} error resetting calibration 4-20mA output: ${err.message}`); }
        finally { this.suspendPolling = false; }
    }

    protected async calibrate0_10Output(id, val) {
        try {
            this.suspendPolling = true;
            await this.calibrateChannel(this.out0_10[id - 1], this.calDefinitions.out0_10, val);
        } catch (err) { logger.error(`${this.device.name} error calibrating 0-10v output: ${err.message}`); }
        finally { this.suspendPolling = false; }
    }
    protected async calibrate0_10Input(id, val) {
        try {
            this.suspendPolling = true;
            let io = this.in0_10[id - 1];
            await this.calibrateChannel(io, io.plusMinus === true ? this.calDefinitions.in0_10pm : this.calDefinitions.in0_10, val);
        } catch (err) { logger.error(`${this.device.name} error calibrating 0-10v input: ${err.message}`); }
        finally { this.suspendPolling = false; }
    }
    protected async calibrate4_20Input(id, val) {
        try {
            this.suspendPolling = true;
            await this.calibrateChannel(this.in4_20[id - 1], this.calDefinitions.in4_20, val);
        } catch (err) { logger.error(`${this.device.name} error calibrating 4-20mA input: ${err.message}`); }
        finally { this.suspendPolling = false; }
    }
    protected async calibrate4_20Output(id, val) {
        try {
            this.suspendPolling = true;
            await this.calibrateChannel(this.out4_20[id - 1], this.calDefinitions.out4_20, val);
        } catch (err) { logger.error(`${this.device.name} error calibrating 4-20mA input: ${err.message}`); }
        finally { this.suspendPolling = false; }
    }
    protected async calibrateChannel(channel, cal, val) {
        try {
            this.suspendPolling = true;
            let v = Math.ceil(cal * 1000);
            let buff = Buffer.from([Math.floor(v / 256), cal - Math.floor(v / 256), channel.id + cal.idOffset, 170]);
            await this.i2c.writeI2cBlock(this.device.address, 60, buff, 4);
            await utils.wait(100); // Wait for 100ms to let our write take effect.
            await this.getCalibrationStatus();
        } catch (err) { logger.error(`${this.device.name} error calibrating ${cal.name}: ${err.message}`); }
        finally { this.suspendPolling = false; }
    }
    protected async resetCalibration(channel, cal) {
        try {
            this.suspendPolling = true;
            let buff = Buffer.from([0, 0, channel.id + cal.idOffset, 85]);
            await this.i2c.writeI2cBlock(this.device.address, 60, buff, 4);
            await utils.wait(100); // Wait for 100ms to let our write take effect.
            await this.getCalibrationStatus();
        } catch (err) { logger.error(`${this.device.name} error resetting calibration ${cal.name}: ${err.message}`); }
        finally { this.suspendPolling = false; }

    }
    protected async readDigitalInput() {
        try {
            // These are a bitmask so the shoudl be read in one shot.
            let val = (this.i2c.isMock) ? 255 * Math.random() : await this.i2c.readByte(this.device.address, 3);
            // Set all the state values
            let ch = this.inDigital;
            for (let i = 0; i < ch.length; i++) {
                ch[i].value = (1 << i) & val;
            }
        } catch (err) { logger.error(`${this.device.name} error getting digital inputs: ${err.message}`); }
    }
    protected async get0_10Input(id) {
        try {
            // 0-10v
            // Ch1: 28
            // Ch2: 30
            // Ch3: 32
            // Ch4: 34
            // +-10v
            // Ch1: 36
            // Ch2: 38
            // Ch3: 40
            // Ch4: 42
            let io = this.in0_10[id - 1];
            let val = (this.i2c.isMock) ? 10 * Math.random() : await this.readWord(((io.plusMinus === true) ? 28 : 36) + (2 * (id - 1))) / 1000;
            if (io.plusMinus === true) val -= 10;
            if (io.value !== val) {
                io.value = val;
                webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: { inputs: { in0_10: [io] } } });
            }
        } catch (err) { logger.error(`${this.device.name} error getting 0-10 input ${id}: ${err.message}`); }
    }
    protected async get0_10Output(id) {
        try {
            let val = (this.i2c.isMock) ? this.out0_10[id - 1].value || 0 : await this.i2c.readWord(this.device.address, 4 + (2 * (id - 1))) / 1000;
            let io = this.out0_10[id - 1];
            if (io.value !== val) {
                io.value = val;
                webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: { outputs: { out0_10: [io] } } });
            }
        } catch (err) { logger.error(`${this.device.name} error getting 0-10 output ${id}: ${err.message}`); }
    }
    protected async getDrainOutput(id) {
        try {
            // Ch1: 20
            // Ch2: 22
            // Ch3: 24
            // Ch4: 26
            let val = await this.readWord(20 + (2 * (id - 1))) / 100;
            let io = this.outDrain[id - 1];
            if (io.value !== val) {
                io.value = val;
                webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: { outputs: { outDrain: [io] } } });
            }
        } catch (err) { logger.error(`${this.device.name} error getting open drain output ${id}: ${err.message}`); }
    }
    protected async setDrainOutput(id, val) {
        try {
            // Ch1: 20
            // Ch2: 22
            // Ch3: 24
            // Ch4: 26
            if (val < 0 || val > 100) throw new Error('Value must be between 0 and 100');
            if (!this.i2c.isMock) await this.i2c.writeWord(this.device.address, 20 + (2 * (id - 1)), val);
        } catch (err) { logger.error(`${this.device.name} error writing Open Drain output ${id}: ${err.message}`); }

    }
    protected async set0_10Output(id, val) {
        try {
            // Ch1: 4
            // Ch2: 6
            // Ch3: 8
            // Ch4: 10
            if (val < 0 || val > 10) throw new Error(`Value must be between 0 and 10`);
            if(!this.i2c.isMock) await this.i2c.writeWord(this.device.address, 4 + (2 * (id - 1)), val * 1000);
            this.out0_10[id - 1].value = val;
            let io = this.out0_10[id - 1];
            if (io.value !== val) {
                io.value = val;
                webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: { outputs: { out0_10: [io] } } });
            }
        } catch (err) { logger.error(`${this.device.name} error setting 0-10 output ${id}: ${err.message}`); }
    }
    protected async get4_20Input(id) {
        try {
            // Ch1: 44
            // Ch2: 46
            // Ch3: 48
            // Ch4: 50
            let val = await this.readWord(44 + (2 * (id - 1))) / 1000;
            let io = this.in4_20[id - 1];
            if (io.value !== val) {
                io.value = val;
                webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: { inputs: { in4_20: [io] } } });
            }

        } catch (err) { logger.error(`${this.device.name} error getting 4-20 input ${id}: ${err.message}`); }
    }
    protected async get4_20Output(id) {
        try {
            // Ch1: 12
            // Ch2: 14
            // Ch3: 16
            // Ch4: 18
            let val = await this.readWord(12 + (2 * (id - 1))) / 1000;
            let io = this.out4_20[id - 1];
            if (io.value !== val) {
                io.value = val;
                webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: { outputs: { out4_20: [io] } } });
            }
        } catch (err) { logger.error(`${this.device.name} error getting 4-20 output ${id}: ${err.message}`); }
    }
    protected async set4_20Input(id, val) {
        try {
            if (val < 4 || val > 20) throw new Error(`Value must be between 4 and 20`);
            if(!this.i2c.isMock) await this.i2c.writeWord(this.device.address, 44 + (2 * (id - 1)), val * 1000);
            this.in4_20[id - 1].value = val;
            let io = this.in4_20[id - 1];
            if (io.value !== val) {
                io.value = val;
                webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: { inputs: { in4_20: [io] } } });
            }
        } catch (err) { logger.error(`${this.device.name} error setting 4-20 input ${id}: ${err.message}`); }
    }
    protected async set4_20Output(id, val) {
        try {
            if (val < 4 || val > 20) throw new Error(`Value must be between 4 and 20`);
            if(!this.i2c.isMock) await this.i2c.writeWord(this.device.address, 12 + (2 * (id - 1)), val * 1000);
            let io = this.out4_20[id - 1];
            if (io.value !== val) {
                io.value = val;
                webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: { outputs: { out4_20: [io] } } });
            }
        } catch (err) { logger.error(`${this.device.name} error setting 4-20 input ${id}: ${err.message}`); }
    }
    protected packRS485Port(port): Buffer {
        let buffer = Buffer.from([0, 0, 0, 0, 0]);
        buffer.writeUInt16LE(port.baud & 0x00FFFF, 0);
        buffer.writeUInt8((port.baud & 0xFF00000) >> 24, 2);
        buffer.writeUInt8(((port.stopBits & 0x0F) << 6) + ((port.parity & 0x0F) << 4) + (port.mode & 0xFF), 3);
        buffer.writeUInt8(port.address, 4);
        return buffer
    }
    protected async getRS485Port() {
        try {
            let ret: { bytesRead: number, buffer: Buffer } = this.i2c.isMock ?
                { bytesRead: 5, buffer: this.packRS485Port(extend(true, { mode: 0, baud: 38400, stopBits: 1, parity: 0, address: 1 }, this.rs485)) } : await this.i2c.readI2cBlock(this.device.address, 65, 5);
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
            this.rs485.baud = ret.buffer.readUInt16LE(0) + (ret.buffer.readUInt8(2) << 24);
            let byte = ret.buffer.readUInt8(3);
            this.rs485.mode = byte & 0x0F;
            this.rs485.parity = (byte & 0x30) >> 4;
            this.rs485.stopBits = (byte & 0xC0) >> 6;
            this.rs485.address = ret.buffer.readUInt8(4);
        } catch (err) { logger.error(`${this.device.name} error getting RS485 port settings: ${err.message}`); }
    }

    protected async setRS485Port(port) {
        try {
            let p = extend(true, { mode: 1, baud: 38400, parity: 0, stopBits: 1, address: 1 }, this.rs485, port);
            if (p.baud > 920600 || p.baud < 1200) {
                logger.error(`${this.device.name} cannot set rs485 port baud rate to ${p.baud} [1200, 920600]`); return;
            }
            if (p.stopBits < 1 || p.stopBits > 2) {
                logger.error(`${this.device.name} cannot set rs485 port stop bits to ${p.stopBits} [1,2]`); return;
            }
            if (p.parity > 2 || p.parity < 0) {
                logger.error(`${this.device.name} cannot set rs485 port parity to ${p.stopBits} [0=none,1=even,2=odd]`); return;
            }
            if (p.address < 1 || p.address > 255) {
                logger.error(`${this.device.name} cannot set MODBUS address to ${p.address} [1,255]`); return;
            }
            if (p.mode > 1 || p.mode < 0) {
                logger.error(`${this.device.name} cannot set rs485 port mode to ${p.mode} [0 = pass thru, 1 = MODBUS RTU (slave)]`); return;
            }
            // Now we have to put together a buffer.  Just use brute force packing no need for a library.
            let buffer = this.packRS485Port(p);
            if (!this.i2c.isMock) await this.i2c.writeI2cBlock(this.device.address, 65, 5, buffer);
            this.rs485.mode = p.mode;
            this.rs485.baud = p.baud;
            this.rs485.stopBits = p.stopBits;
            this.rs485.parity = p.parity;
            this.rs485.address = p.address;
        } catch (err) { logger.error(`${this.device.name} error setting RS485 port: ${err.message}`); }
    }
    protected checkDiff(source, target) {
        if (typeof source !== typeof target) return true;
        if (Array.isArray(source)) {
            if (!Array.isArray(target)) return true;
            if (source.length !== target.length) return true;
            for (let i = 0; i < source.length; i++) {
                if(this.checkDiff(source[i], target[i])) return true;
            }
        }
        switch ((typeof source).toLowerCase()) {
            case 'bigint':
            case 'null':
            case 'symbol':
            case 'number':
            case 'string':
                return source !== target;
            case 'boolean':
                return utils.makeBool(source) != utils.makeBool(target);
            case 'object':
                for (let s in source) {
                    let val = source[s];
                    let tval = target[s];
                    if (typeof val === 'undefined') return true;
                    if (this.checkDiff(val, tval)) return true;
                }
                return false;
        }
    }
    protected async setIOChannelOptions(arr, target) {
        try {
            for (let i = 0; i < arr.length; i++) {
                let t = target.find(elem => elem.id == arr[i].id);
                if (typeof t !== 'undefined') {
                    utils.setObjectProperties(arr[i], t);
                }
            }
        } catch (err) { return Promise.reject(err); }
    }
    public async setOptions(opts): Promise<any> {
        try {
            this.suspendPolling = true;
            if (typeof opts.name !== 'undefined' && this.device.name !== opts.name) this.options.name = this.device.name = opts.name;
            if (typeof opts.rs485 !== 'undefined' && this.checkDiff(this.rs485, opts.rs485)) this.setRS485Port(opts.rs485);
            return Promise.resolve(this.options);
        }
        catch (err) { this.logError(err); Promise.reject(err); }
        finally { this.suspendPolling = false; }
    }
    public async setValues(vals): Promise<any> {
        try {
            this.suspendPolling = true;
            if (typeof vals.inputs !== 'undefined') {
                if (typeof vals.inputs.in0_10 !== 'undefined') await this.setIOChannelOptions(vals.inputs.in0_10, this.in0_10);
                if (typeof vals.inputs.in4_20 !== 'undefined') await this.setIOChannelOptions(vals.inputs.in4_20, this.in4_20);
                if (typeof vals.inputs.inDigital !== 'undefined') await this.setIOChannelOptions(vals.inputs.inDigital, this.inDigital);
            }
            if (typeof vals.outputs !== 'undefined') {
                if (typeof vals.outputs.out0_10 !== 'undefined') await this.setIOChannelOptions(vals.outputs.out0_10, this.out0_10);
                if (typeof vals.outputs.out4_20 !== 'undefined') await this.setIOChannelOptions(vals.outputs.out4_20, this.out4_20);
                if (typeof vals.outputs.outDrain !== 'undefined') await this.setIOChannelOptions(vals.outputs.outDrain, this.outDrain);
            }
            return Promise.resolve(this.options);
        }
        catch (err) { this.logError(err); Promise.reject(err); }
        finally { this.suspendPolling = false; }

    }
    public getValue(prop: string) {
        // Steps to getting to our value.
        // 1. Determine whether input or output.
        // 2. Determine which array we are coming from.
        // 3. Map the IO number to the value.
        let p = prop.toLowerCase();
        switch (p) {
            case 'cputempc':
                return this.info.cpuTemp;
            case 'cputempf':
                return utils.convert.temperature.convertUnits(this.info.cpuTemp, 'C', 'F');
            case 'cputempk':
                return utils.convert.temperature.convertUnits(this.info.cpuTemp, 'C', 'K');
            case 'inputvoltage':
                return this.info.volts;
            case 'pivoltage':
                return this.info.rapsiVolts;
            case 'fwversion':
                return this.info.fwVersion;
            default:
                let iarr;
                if (p.startsWith('out4_20')) iarr = this.out4_20;
                else if (p.startsWith('in4_20')) iarr = this.in4_20;
                else if (p.startsWith('out0_10')) iarr = this.out0_10;
                else if (p.startsWith('in0_10')) iarr = this.in0_10;
                else if (p.startsWith('inDigital')) iarr = this.inDigital;
                else if (p.startsWith('outDrain')) iarr = this.outDrain;
                if (typeof iarr === 'undefined') {
                    logger.error(`${this.device.name} error getting I/O channel ${prop}`);
                    return;
                }
                let parr = p.split('.');

                let sord = p[parr[0].length - 1];
                let ord = parseInt(sord, 10);
                if (isNaN(ord) || ord <= 0 || ord >= 4) {
                    logger.error(`${this.device.name} error getting I/O ${prop} channel ${sord} out of range.`);
                    return;
                }
                let chan = iarr[ord - 1];
                return (parr.length > 1) ? super.getValue(parr[1], chan) : chan;
        }
    }
    public setValue(prop: string, value) {
        let p = prop.toLowerCase();
        switch (p) {
            default:
                let sord = p[p.length - 1];
                let ord = parseInt(sord, 10);
                if (isNaN(ord) || ord <= 0 || ord >= 4) {
                    logger.error(`${this.device.name} error setting I/O ${prop} channel ${sord} out of range.`);
                    return;
                }
                if (p.startsWith('out4_20')) this.set4_20Output(ord, value);
                else if (p.startsWith('out0_10')) this.set0_10Output(ord, value);
                else if (p.startsWith('outDrain')) this.setDrainOutput(ord, value);
                else logger.error(`${this.device.name} error setting I/O channel ${prop} invalid I/O type.`);
                break;
        }
    }
    public calcMedian(prop: string, values: any[]) {
        let p = prop.toLowerCase();
        switch (p) {
            case 'cputempc':
            case 'cputempf':
            case 'cputempk':
            case 'inputvoltage':
            case 'pivoltage':
                return super.calcMedian(prop, values);
            case 'fwversion':
                return this.info.fwVersion;
            default:
                // Determine whether this is an object.
                if (p.startsWith('in') || p.startsWith('out')) {
                    if (values.length > 0 && typeof values[0] === 'object') {
                        let io = this.getValue(prop);
                        if (typeof io !== 'undefined') {
                            let vals = [];
                            for (let i = 0; i < values.length; i++) vals.push(values[i].value);
                            return extend(true, {}, io, { value: super.calcMedian(prop, vals) })
                        }
                    }
                    else return super.calcMedian(prop, values);
                }
                else logger.error(`${this.device.name} error calculating median value for ${prop}.`);
        }
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

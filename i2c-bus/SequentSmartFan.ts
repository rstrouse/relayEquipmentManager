//SMART FAN
import * as fs from 'fs';
import { logger } from "../logger/Logger";
import { vMaps, valueMap, utils } from "../boards/Constants";
import { setTimeout, clearTimeout } from "timers";
import * as extend from "extend";
import { Buffer } from "buffer";
import { i2cDeviceBase } from "./I2cBus";
import { webApp } from "../web/Server";
import { I2cDevice, DeviceBinding, cont, GpioPin } from "../boards/Controller";
export class SequentSmartFan extends i2cDeviceBase {
    protected regs = {
        I2C_MEM_FAN_POWER: 0,
        I2C_MEM_BLINK_OFF: 1,
        I2C_MEM_INT_TEMP: 2,
        I2C_MEM_INT_TEMP_FS: 3,
        I2C_MEM_TEMP_SAFETY: 4,
        I2C_MEM_TIME_TO_STOP_SET: 5, //2bytes
        I2C_MEM_TIME_TO_STOP_REM: 7,

        hwVersion: 100,
        hwVersion_minor: 101,
        fwVersion: 102,
        fwVersion_minor: 103,

        SLAVE_BUFF_SIZE: 108
    };
    protected powerPin: GpioPin;
    protected cliVer:number = 1;
    protected _timerRead: NodeJS.Timeout;
    protected _infoRead: NodeJS.Timeout;
    protected _suspendPolling: number = 0;
    protected _pollInformationInterval = 3000;
    protected logError(err, msg?: string) { logger.error(`${this.device.name} ${typeof msg !== 'undefined' ? msg + ' ' : ''}${typeof err !== 'undefined' ? err.message : ''}`); }
    protected get version(): number { return typeof this.device !== 'undefined' && this.options !== 'undefined' && typeof this.device.info !== 'undefined' ? parseFloat(this.device.info.firmware) : 0 }
    protected processing = 0;
    protected get fanCurve(): { curve: string, linear: { start: number, end: number, min: number }, exp: { start: number, min: number, ramp: string }, log: { start: number, min: number, ramp: string } } {
        if (typeof this.options.fanCurve === 'undefined') {
            this.options.fanCurve = { curve: this.cliVer < 4 ? 'custom' : 'linear' };
        }
        if (typeof this.options.fanCurve.linear === 'undefined') this.options.fanCurve.linear = {
            start: Math.round(utils.convert.temperature.convertUnits(30, 'C', this.options.units)),
            end: Math.round(utils.convert.temperature.convertUnits(70, 'C', this.options.units)),
            min: 0
        };
        if (typeof this.options.fanCurve.exp === 'undefined') this.options.fanCurve.exp = {
            start: utils.convert.temperature.convertUnits(30, 'C', this.options.units),
            min: 0,
            ramp: 'slow'
        };
        if (typeof this.options.fanCurve.log === 'undefined') this.options.fanCurve.log = {
            start: utils.convert.temperature.convertUnits(30, 'C', this.options.units),
            min: 0,
            ramp: 'slow'
        };
        return this.options.fanCurve;
    }
    protected changeUnits(from: string, to: string) {
        //if (from === to) return;
        //console.log(`Changing units from ${from} to ${to}`);
        let fc = this.fanCurve;
        let ct = utils.convert.temperature.convertUnits;
        //console.log(fc);
        this.options.fanCurve.linear.start = utils.convert.temperature.convertUnits(fc.linear.start, from, to);
        this.options.fanCurve.linear.end = utils.convert.temperature.convertUnits(fc.linear.end, from, to);
        this.options.fanCurve.exp.start = utils.convert.temperature.convertUnits(fc.exp.start, from, to);
        this.options.fanCurve.log.start = utils.convert.temperature.convertUnits(fc.log.start, from, to);
        //console.log(fc);
        this.options.fanSafeTemp = ct(this.options.fanSafeTemp, from, to);
        this.values.cpuTemp = ct(this.values.cpuTemp, from, to);
        this.values.fanTemp = ct(this.values.fanTemp, from, to);
        this.options.units = this.values.units = to;
        webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.values });
    }
    public evalFanPower: Function;
    public async initAsync(deviceType): Promise<boolean> {
        try {
            if (deviceType.id === 1002) this.cliVer = 4;
            if (typeof this.options.fanCurve === 'undefined' || typeof this.options.fanCurve === 'string') {
                this.options.fanCurve = undefined;
                let fc = this.fanCurve;
                logger.info(`Setting ${this.device.name} inital curves ${fc.curve}`);
            }
            
            this.stopPolling();
            if (typeof this.options.readInterval === 'undefined') this.options.readInterval = 3000;
            this.options.readInterval = Math.max(500, this.options.readInterval);
            if (typeof this.device.options.name !== 'string' || this.device.options.name.length === 0) this.device.name = this.device.options.name = deviceType.name;
            else this.device.name = this.device.options.name;
            if (typeof this.device.options.units === 'undefined') {
                this.device.options.units = this.device.values.units = 'C';
            }
            if (typeof this.options.fanPowerFn !== 'undefined' && this.options.fanPowerFn.length > 0)
                this.evalFanPower = new Function('options', 'values', 'info', this.options.fanPowerFn);
            if (this.device.isActive) {
                await this.getHwFwVer();
                // If this is a cliVer >= 4 we need to export a gpio pin for the fan control.  Another stupid present from Sequent.
                if (this.cliVer >= 4) {
                    this.powerPin = await cont.gpio.setPinAsync(1, 32,
                        {
                            isActive: true,
                            name: `${this.device.name} Power`, direction: 'output',
                            isInverted: false, initialState: 'off', debounceTimeout: 0
                        }
                    );
                }
                await this.getFanPower();
                await this.getFanBlink();
                await this.getFanSafeTemp();
                await this.getStatus();
            }
        }
        catch (err) { this.logError(err); return Promise.resolve(false); }
        finally {
            // setTimeout(() => { this.pollDeviceInformation(); }, 2000);
            setTimeout(() => { this.pollReadings(); }, 5000);
        }
    }
    public async setOptions(opts): Promise<any> {
        try {
            this.suspendPolling = true;
            if (typeof opts.name !== 'undefined' && this.device.name !== opts.name) this.options.name = this.device.name = opts.name;
            if (typeof opts.fanSafeTemp !== 'undefined' && opts.fanSafeTemp !== this.options.fanSafeTemp) await this.setFanSafeTemp(opts.fanSafeTemp);
            if (typeof opts.blink !== 'undefined' && opts.blink !== this.options.blink) await this.setFanBlink(opts.blink);
            if (typeof opts.readInterval !== 'undefined') this.options.readInterval = opts.readInterval;
            if (typeof opts.useCPUTemp !== 'undefined') this.options.useCPUTemp = opts.useCPUTemp;
            if (typeof opts.fanCurve !== 'undefined') {
                let fc = this.fanCurve;
                if (typeof opts.fanCurve.curve !== 'undefined') fc.curve = opts.fanCurve.curve;
                if (typeof opts.fanCurve.linear !== 'undefined') {
                    let curve = opts.fanCurve.linear;
                    if (typeof curve.start !== 'undefined') fc.linear.start = curve.start;
                    if (typeof curve.end !== 'undefined') fc.linear.end = curve.end;
                    if (typeof curve.min !== 'undefined') fc.linear.min = curve.min;
                }
                if (typeof opts.fanCurve.exp !== 'undefined') {
                    let curve = opts.fanCurve.exp;
                    if (typeof curve.start !== 'undefined') fc.exp.start = curve.start;
                    if (typeof curve.ramp !== 'undefined') fc.exp.ramp = curve.ramp;
                    if (typeof curve.min !== 'undefined') fc.exp.min = curve.min;
                }
                if (typeof opts.fanCurve.log !== 'undefined') {
                    let curve = opts.fanCurve.log;
                    if (typeof curve.start !== 'undefined') fc.log.start = curve.start;
                    if (typeof curve.ramp !== 'undefined') fc.log.ramp = curve.ramp;
                    if (typeof curve.min !== 'undefined') fc.log.min = curve.min;
                }
            }
            if (typeof opts.units !== 'undefined' && this.options.units !== opts.units) this.setUnits(opts.units);

            if (typeof opts.fanPowerFn !== 'undefined' && opts.fanPowerFn !== this.options.fanPowerFn) {
                this.evalFanPower = new Function('options', 'values', 'info', opts.fanPowerFn);
                this.options.fanPowerFn = opts.fanPowerFn;
            }
            return this.options;
        }
        catch (err) { this.logError(err); Promise.reject(err); }
        finally { this.suspendPolling = false; }
    }
    public setUnits(value: string): Promise<boolean> {
        try {
            if (!['C', 'F', 'K'].includes(value.toUpperCase())) return Promise.reject(new Error(`Cannot set units to ${value}`));
            let prevUnits = this.values.units || 'C';
            this.changeUnits(prevUnits, value);
        }
        catch (err) { this.logError(err); }
    }
    protected async getHwFwVer() {
        try {
            if (this.i2c.isMock) {
                this.info.fwVersion = this.cliVer >= 4 ? `1.0 Mock` : '1.0 Mock';
                this.info.hwVersion = this.cliVer >= 4 ? `4.0 Mock` : '0.1 Mock';
            }
            else if (this.cliVer >= 4) {
                this.info.hwVersion = `4.0`;
                this.info.fwVersion = '1.0';
            }
            else {
                let fwBuf = await this.i2c.readI2cBlock(this.device.address, this.regs.fwVersion, 2);
                if (fwBuf.bytesRead === 2) {
                    let hwBuf = await this.i2c.readI2cBlock(this.device.address, this.regs.hwVersion, 2);
                    let hw = hwBuf.buffer.toJSON().data;
                    let fw = fwBuf.buffer.toJSON().data;
                    this.info.hwVersion = `${hw[0] + (hw[1] > 0 ? hw[1] / 100.0 : '.00')}`;
                    this.info.fwVersion = `${fw[0] + (fw[1] > 0 ? fw[1] / 100.0 : '.00')}`;
                }
                else {
                    // Sequent did it again.  The completely revised the smart fan so it does not return this information on later
                    // versions.
                    this.info.hwVersion = `4.0`;
                    this.info.fwVersion = '1.0';
                    this.cliVer = 4;
                }
            }
        } catch (err) { logger.error(`${this.device.name} error getting firmware version: ${err.message}`); }
    }
    protected async getFanPower() {
        try {
            if (this.i2c.isMock) return; // Don't get the fan power from the register in this case
            if (this.cliVer >= 4) {
                // On version 4 the PWM fan power is not returned in the same way.  We are reading the device register for this.
                let buff = await this.i2c.read(this.device.address, 1);
                if (buff.bytesRead === 1) {
                    let pwr = buff.buffer.readUInt8(0);
                    logger.verbose(`${this.device.name} getFanPower = ${pwr}`);
                    this.values.fanPower = Math.round((255 - pwr) / 2.55);
                }
                else {
                    this.values.fanPower = 0;
                }
            }
            else {
                let fanPower = (this.i2c.isMock) ? Math.round(Math.random() * 100) : await this.i2c.readByte(this.device.address, this.regs.I2C_MEM_FAN_POWER);
                this.values.fanPower = fanPower;
            }

        } catch (err) { logger.error(`${this.device.name} error getting fan power: ${err.message}`); }
    }
    protected calcFanPower(): number {
        let val: number = 0, _val: number = 0;
        if (this.fanCurve.curve === 'custom') {
            val = _val = typeof this.evalFanPower === 'function' ? Math.round(this.evalFanPower(this.options, this.values, this.info)) : 0;
            if (isNaN(val)) {
                logger.error(`Sequent Smart Fan: Result of expression is isNaN.  Function evaluated is ${this.evalFanPower.toString()}`);
                val = 0;
            }
        }
        else if (this.fanCurve.curve === 'linear') {
            let curve = this.fanCurve.linear;
            let slope = (curve.end - curve.start) * .01;
            _val = (slope * (this.values.cpuTemp - curve.start)) + (curve.min || 0);
            _val = Math.max(Math.min(_val, 100), 0);
            val = Math.max(_val, curve.min);
        }
        else if (this.fanCurve.curve === 'log') {
            let curve = this.fanCurve.log;
            let b = 1.06;
            let temp = utils.convert.temperature.convertUnits(this.values.cpuTemp, this.values.units, 'C');
            let start = utils.convert.temperature.convertUnits(curve.start, this.values.units, 'C');

            switch (curve.ramp) {
                case 'slow':
                    b = 1.08;
                case 'medium':
                    b = 1.06;
                case 'fast':
                    b = 1.04;
            }
            _val = Math.log(Math.max(.001, temp - start)) / Math.log(b);
            //_val = (Math.log(Math.max(.001, this.values.cpuTemp - curve.start)) * (1 / Math.log(b)));
            _val = Math.max(Math.min(_val, 100), 0);
            val = Math.max(_val, curve.min);
        }
        else if (this.fanCurve.curve === 'exp') {
            let curve = this.fanCurve.exp;
            let temp = utils.convert.temperature.convertUnits(this.values.cpuTemp, this.values.units, 'C');
            let start = utils.convert.temperature.convertUnits(curve.start, this.values.units, 'C');
            if (temp > start) {
                let b = 1.07;
                switch (curve.ramp) {
                    case 'slow':
                        b = 1.07;
                        break;
                    case 'medium':
                        b = 1.1;
                        break;
                    case 'fast':
                        b = 1.15;
                        break;
                }
                _val = Math.pow(b, (this.values.cpuTemp - curve.start)) + curve.min - 1;
            }
            else
                _val = 0;
            _val = Math.max(Math.min(_val, 100), 0);
            val = Math.max(_val, curve.min)
        }
        this.values.fanPowerFnVal = _val;
        return Math.round(Math.max(Math.min(val, 100), 0));
    }
    protected async setFanPower() {
        try {
            let val = this.calcFanPower();
            if (val !== this.values.fanPower) {
                if (this.cliVer < 4) {
                    let buffer = Buffer.from([val]);
                    buffer.writeUInt8(val, 0);
                    if (!this.i2c.isMock)
                        await this.i2c.writeI2cBlock(this.device.address, this.regs.I2C_MEM_FAN_POWER, 1, buffer);
                    else
                        this.values.fanPower = val;
                }
                else {
                    // Sequent occupies a gpio pin to turn on and off the fan.
                    let pwr = Math.round(255 - Math.min(val * 2.55, 255));
                    if (typeof this.powerPin !== 'undefined') await this.powerPin.setPinStateAsync(val > 0);
                    let buffer = Buffer.from([pwr]);
                    logger.verbose(`${this.device.name} setFanPower = ${pwr} val = ${val}`);
                    if (!this.i2c.isMock)
                        await this.i2c.writeI2cBlock(this.device.address, this.regs.I2C_MEM_FAN_POWER, 1, buffer);
                    else {
                        this.values.fanPower = val;
                    }
                }
            }
        }
        catch (err) { logger.error(`${this.device.name} error setting fan power: ${err.message}`); }
    }
    protected async getFanTemp() {
        try {
            let fanTemp: number;
            let cpuTemp: number;
            if (this.i2c.isMock) {
                fanTemp = utils.convert.temperature.convertUnits(72 + (Math.round((5 * Math.random()) * 100) / 100), 'f', this.values.units)
                cpuTemp = this.getCpuTemp();
            }
            else {
                if (this.cliVer >= 4) {
                    fanTemp = cpuTemp = this.getCpuTemp();
                }
                else {
                    fanTemp = await this.i2c.readByte(this.device.address, this.regs.I2C_MEM_INT_TEMP);
                    fanTemp = utils.convert.temperature.convertUnits(fanTemp, 'C', this.values.units);
                    cpuTemp = this.getCpuTemp();
                }
            }
            this.values.fanTemp = fanTemp;
            this.values.cpuTemp = cpuTemp;
            let ct = utils.convert.temperature.convertUnits;
            this.values.fanTempF = ct(fanTemp, this.values.units, 'F');
            this.values.fanTempC = ct(fanTemp, this.values.units, 'C');
            this.values.fanTempK = ct(fanTemp, this.values.units, 'K');
            this.values.cpuTempF = ct(cpuTemp, this.values.units, 'F');
            this.values.cpuTempC = ct(cpuTemp, this.values.units, 'C');
            this.values.cpuTempK = ct(cpuTemp, this.values.units, 'K');
        } catch (err) { logger.error(`${this.device.name} error getting fan temperature: ${err.message}`); }
    }
    protected getCpuTemp(): number {
        try {
            // Keep the prior version working the same way.
            if (this.cliVer < 4 && !this.options.useCPUTemp && !this.i2c.isMock) return this.info.cpuTemp;
            if (this.i2c.isMock) {
                return utils.convert.temperature.convertUnits(72 + (Math.round((5 * Math.random()) * 100) / 100), 'f', this.values.units);
            }
            if (fs.existsSync('/sys/class/thermal/thermal_zone0/temp')) {
                let buffer = fs.readFileSync('/sys/class/thermal/thermal_zone0/temp');
                return utils.convert.temperature.convertUnits(parseInt(buffer.toString().trim(), 10) / 1000, 'C', this.values.units);
            }
        } catch (err) { logger.error(`${this.device.name} error getting cpu temp: ${err.message}`); }
    }
    protected async getFanSafeTemp() {
        try {
            if (!this.i2c.isMock) {
                let fanSafeTemp =
                    await this.i2c.readByte(this.device.address, this.regs.I2C_MEM_INT_TEMP_FS);
                fanSafeTemp = utils.convert.temperature.convertUnits(fanSafeTemp, 'C', this.values.units);
                this.options.fanSafeTemp = fanSafeTemp;

            }
        } catch (err) { logger.error(`${this.device.name} error getting fan safe temperature: ${err.message}`); }
    }
    protected async setFanSafeTemp(val: number) {
        try {
            let lower = Math.round(utils.convert.temperature.convertUnits(30, 'C', this.values.units));
            let upper = Math.round(utils.convert.temperature.convertUnits(80, 'C', this.values.units));
            if (val < lower || val > upper) throw new Error(`Value must be between ${lower} and ${upper}`);
            if (!this.i2c.isMock) {
                let tempC = utils.convert.temperature.convertUnits(val, this.values.units, 'C');
                let buffer = Buffer.from([0]);
                buffer.writeUInt8(tempC, 0);
                await this.i2c.writeI2cBlock(this.device.address, this.regs.I2C_MEM_INT_TEMP_FS, 1, buffer);
            }
            this.options.fanSafeTemp = val;
        }
        catch (err) { logger.error(`${this.device.name} error setting fan safe temperature: ${err.message}`); }
    }
    protected async getFanBlink() {
        try {
            if (!this.i2c.isMock && this.cliVer < 4) {
                let blink = !utils.makeBool(await this.i2c.readByte(this.device.address, this.regs.I2C_MEM_BLINK_OFF));
                this.options.blink = blink;

            }
        } catch (err) { logger.error(`${this.device.name} error getting blink: ${err.message}`); }
    }
    protected async setFanBlink(val: boolean) {
        try {
            if (!this.i2c.isMock && this.cliVer < 4) {
                let buffer = Buffer.from([0]);
                buffer.writeUInt8(val ? 0 : 1, 0); // inverse blink logic
                await this.i2c.writeI2cBlock(this.device.address, this.regs.I2C_MEM_BLINK_OFF, 1, buffer);
            }
            this.options.blink = utils.makeBool(val);
        }
        catch (err) { logger.error(`${this.device.name} error setting fan blink: ${err.message}`); }
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
    protected async takeReadings(): Promise<boolean> {
        try {
            let _values = JSON.parse(JSON.stringify(this.values));
            await this.getFanTemp();
            await this.setFanPower(); //not a reading; but set the value and then make sure it is set properly.
            await this.getFanPower();
            if (this.values.fanPower !== _values.fanPower || this.values.fanTemp !== _values.fanTemp || this.values.fanPowerFnVal !== _values.fanPowerFnVal) {
                webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.values });
            }
            this.emitFeeds();
            return true;
        }
        catch (err) { this.logError(err, 'Error taking device readings'); }
    }
    protected pollReadings() {
        try {
            if (this._timerRead) clearTimeout(this._timerRead);
            this._timerRead == null;
            if (!this.suspendPolling && this.device.isActive) {
                (async () => {
                    await this.takeReadings()
                        .catch(err => { logger.error(err); });
                })();


            }
        }
        catch (err) { this.logError(err, 'Error Polling Device Values'); }
        finally { this._timerRead = setTimeout(() => { this.pollReadings(); }, this.options.readInterval) }
    }
    public get suspendPolling(): boolean { if (this._suspendPolling > 0) logger.warn(`${this.device.name} Suspend Polling ${this._suspendPolling}`); return this._suspendPolling > 0; }
    public set suspendPolling(val: boolean) {
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
            this.suspendPolling = true;
            return true;
        }
        catch (err) { logger.error(`Error getting info ${typeof err !== 'undefined' ? err.message : ''}`); return Promise.reject(err); }
        finally { this.suspendPolling = false; }
    }
    public async getDeviceInformation(): Promise<boolean> {
        try {
            this.suspendPolling = true;
            await this.getStatus();
            webApp.emitToClients('i2cDeviceInformation', { bus: this.i2c.busNumber, address: this.device.address, info: this.device.info });
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
    public getValue(prop: string) {
        let p = prop.toLowerCase();
        switch (p) {
            case 'cputempc':
                return utils.convert.temperature.convertUnits(this.getCpuTemp(), this.values.units, 'C');
            case 'cputempf':
                return utils.convert.temperature.convertUnits(this.getCpuTemp(), this.values.units, 'F');
            case 'cputempk':
                return utils.convert.temperature.convertUnits(this.getCpuTemp(), this.values.units, 'K');
            case 'fantempc':
                return utils.convert.temperature.convertUnits(this.values.fanTemp, this.values.units, 'C');
            case 'fantempf':
                return utils.convert.temperature.convertUnits(this.values.fanTemp, this.values.units, 'F');
            case 'fantempk':
                return utils.convert.temperature.convertUnits(this.values.fanTemp, this.values.units, 'K');
            case 'fwversion':
                return this.info.fwVersion;
            default:
                return this.values[prop];
        }
    }
    public calcMedian(prop: string, values: any[]) {
        let p = prop.toLowerCase();
        switch (p) {
            case 'cputempc':
            case 'cputempf':
            case 'cputempk':
            case 'fantempc':
            case 'fantempf':
            case 'fantempk':
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
    public setValue(prop: string, value) {
        let p = prop.toLowerCase();
        if (prop.includes('temp')) {

            if (prop.slice(-1) === this.options.units) { this.info.cpuTemp = value; }
            else {
                this.info.cpuTemp = utils.convert.temperature.convertUnits(value, prop.slice(-1), this.options.units);
            }
            webApp.emitToClients('i2cDeviceInformation', { bus: this.i2c.busNumber, address: this.device.address, info: this.device.info });
        }

        // switch (p) {
        //     default:

        //         break;
        // }
    }
    public async getDeviceState(binding: string | DeviceBinding): Promise<any> {
        try {
            let bind = (typeof binding === 'string') ? new DeviceBinding(binding) : binding;
            // We need to know what value we are referring to.
            if (typeof bind.params[0] === 'string') return this.getValue(bind.params[0]);
            return this.values;
        } catch (err) { return Promise.reject(err); }
    }
    public async setValues(vals): Promise<any> {
        try {
            this.suspendPolling = true;
            return Promise.resolve(this.values);
        }
        catch (err) { this.logError(err); Promise.reject(err); }
        finally { this.suspendPolling = false; }
    }
    // public getDeviceDescriptions(dev) {

    // }
}

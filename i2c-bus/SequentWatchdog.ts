//SMART FAN
import { logger } from "../logger/Logger";
import { vMaps, valueMap, utils } from "../boards/Constants";
import { setTimeout, clearTimeout } from "timers";
import * as extend from "extend";
import { Buffer } from "buffer";
import { i2cDeviceBase } from "./I2cBus";
import { webApp } from "../web/Server";
import { I2cDevice, DeviceBinding } from "../boards/Controller";
import { exec as _exec } from 'child_process';

export class SequentWatchdog extends i2cDeviceBase {
    protected regs = {
        I2C_WDT_RELOAD_ADD: 0,
        I2C_WDT_INTERVAL_SET_ADD: 1,
        I2C_WDT_INTERVAL_GET_ADD: 3,
        I2C_WDT_INIT_INTERVAL_SET_ADD: 5,
        I2C_WDT_INIT_INTERVAL_GET_ADD: 7,
        I2C_WDT_RESET_COUNT_ADD: 9,
        I2C_WDT_CLEAR_RESET_COUNT_ADD: 11,
        I2C_5V_IN_ADD: 12,
        I2C_POWER_OFF_INTERVAL_SET_ADD: 14,
        I2C_POWER_OFF_INTERVAL_GET_ADD: 18,
        I2C_VBAT_ADD: 22,
        I2C_5V_OUT_ADD: 24,
        I2C_TEMP_ADD: 26,
        I2C_CHARGE_STAT_ADD: 27,
        I2C_POWER_OFF_ON_BATTERY_ADD: 28,
        I2C_POWER_SW_USAGE_ADD: 29,
        I2C_POWER_SW_STATUS_ADD: 30,
        SLAVE_BUFF_SIZE: 31
    };
    protected _timerRead: NodeJS.Timeout;
    protected _infoRead: NodeJS.Timeout;
    protected _suspendPolling: number = 0;
    protected _pollInformationInterval = 3000;
    protected logError(err, msg?: string) { logger.error(`${this.device.name} ${typeof msg !== 'undefined' ? msg + ' ' : ''}${typeof err !== 'undefined' ? err.message : ''}`); }
    protected get version(): number { return typeof this.device !== 'undefined' && this.options !== 'undefined' && typeof this.device.info !== 'undefined' ? parseFloat(this.device.info.firmware) : 0 }
    protected processing = 0;
    public evalScript: Function;
    public exec = _exec;
    public async initAsync(deviceType): Promise<boolean> {
        try {
            this.stopPolling();
            if (typeof this.options.readInterval === 'undefined') this.options.readInterval = 3000;
            this.options.readInterval = Math.max(500, this.options.readInterval);
            if (typeof this.device.options.name !== 'string' || this.device.options.name.length === 0) this.device.name = this.device.options.name
            if (typeof this.device.name === 'undefined') this.device.name = deviceType.name;
            else this.device.name = this.device.options.name;
            if (typeof this.device.options.units === 'undefined') {
                this.device.options.units = this.device.values.units = 'C';
            }
            if (typeof this.options.scriptFn !== 'undefined' && this.options.scriptFn.length > 0)
                this.evalScript = new Function('options', 'values', 'info', 'exec', this.options.scriptFn);
            if (this.device.isActive) {
                // options
                await this.getDeviceInformation();
                // readings
                await this.takeReadings();
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
            if (typeof opts.units !== 'undefined' && this.options.units !== opts.units) this.setUnits(opts.units);
            if (typeof opts.readInterval !== 'undefined') this.options.readInterval = opts.readInterval;
            if (typeof opts.period !== 'undefined' && opts.period !== this.options.period) await this.setPeriod(opts.period);
            if (typeof opts.defaultPeriod !== 'undefined' && opts.defaultPeriod !== this.options.defaultPeriod) await this.setDefaultPeriod(opts.defaultPeriod);
            if (typeof opts.offInterval !== 'undefined' && opts.offInterval !== this.options.offInterval) await this.setOffInterval(opts.offInterval);
            if (typeof opts.rePowerOnBattery !== 'undefined' && opts.rePowerOnBattery !== this.options.rePowerOnBattery) await this.setRePowerOnBattery(opts.rePowerOnBattery);
            if (typeof opts.powerButtonEnabled !== 'undefined' && opts.powerButtonEnabled !== this.options.powerButtonEnabled) await this.setPowerButtonEnabled(opts.powerButtonEnabled);
            if (typeof opts.scriptFn !== 'undefined' && this.options.scriptFn !== opts.scriptFn){
                this.options.scriptFn = opts.scriptFn;
                this.evalScript = new Function('options', 'values', 'info', 'exec', this.options.scriptFn);
            }
            // options
            return this.options;
        }
        catch (err) { this.logError(err); Promise.reject(err); }
        finally { this.suspendPolling = false; }
    }
    public setUnits(value: string): Promise<boolean> {
        try {
            if (!['C', 'F', 'K'].includes(value.toUpperCase())) return Promise.reject(new Error(`Cannot set units to ${value}`));
            let prevUnits = this.values.units || 'C';
            this.options.units = this.values.units = value.toUpperCase();
            this.values.temp = utils.convert.temperature.convertUnits(this.values.temp, prevUnits, this.values.units);
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.values });
        }
        catch (err) { this.logError(err); }
    }
    private hwFwCheck(): boolean {
        if (this.info.hwVersion === `Super Watchdog` && this.info.fwVersion > 0x10) {
            return true;
        }
        return false;
    }
    protected async getHwFwVer() {
        try {
            if (this.i2c.isMock) {
                this.info.fwVersion = `1.0 Mock`;
                this.info.hwVersion = `Mock Watchdog`
            }
            else {
                let hw = await this.i2c.readByte(this.device.address, this.regs.I2C_WDT_RELOAD_ADD);
                let fw = await this.i2c.readByte(this.device.address, this.regs.I2C_CHARGE_STAT_ADD);
                this.info.hwVersion = hw === 1 ? `Super Watchdog` : `Watchdog`;
                this.info.fwVersion = fw & 0xF0;
            }
        } catch (err) { logger.error(`${this.device.name} error getting firmware version: ${err.message}`); }
    }
    protected async reload() {
        let WDT_RELOAD_KEY = 0xCA;
        try {
            if (!this.i2c.isMock) {
                let buffer = Buffer.from([0]);
                buffer.writeUInt8(WDT_RELOAD_KEY, 0);
                await this.i2c.writeI2cBlock(this.device.address, this.regs.I2C_WDT_RELOAD_ADD, 1, buffer);
            }
        } catch (err) { logger.error(`${this.device.name} error setting reload: ${err.message}`); }

    }
    protected async getPeriod() {
        try {
            let period = (this.i2c.isMock) ? Math.round(Math.random() * 100) : await this.i2c.readWord(this.device.address, this.regs.I2C_WDT_INTERVAL_GET_ADD);
            this.options.period = period;

        } catch (err) { logger.error(`${this.device.name} error getting period: ${err.message}`); }
    }
    protected async setPeriod(val: number) {
        try {
            let WDT_PERIOD_MAX = 0xffff;
            let WDT_DISABLE_PERIOD = 65001;
            if (val < this.options.readInterval/1000 + 1){
               throw new Error(`${this.device.name} error setPeriod time (${val}s) must be shorter than polling interval (${this.options.readInterval/1000}s + 1s).`);
            }
            if (val >= 0 && val <= WDT_PERIOD_MAX && val !== this.options.period) {
                let buffer = Buffer.from([0, 0]);
                buffer.writeUInt16LE(val === 0 ? WDT_DISABLE_PERIOD : val, 0);
                await this.i2c.writeI2cBlock(this.device.address, this.regs.I2C_WDT_INTERVAL_SET_ADD, 2, buffer);
                this.options.period = val;
            }
        }
        catch (err) { logger.error(`${this.device.name} error setting period: ${err.message}`); }
    }
    protected async getDefaultPeriod() {
        try {
            let defaultPeriod = (this.i2c.isMock) ? Math.round(Math.random() * 100) : await this.i2c.readWord(this.device.address, this.regs.I2C_WDT_INIT_INTERVAL_GET_ADD);
            this.options.defaultPeriod = defaultPeriod;

        } catch (err) { logger.error(`${this.device.name} error getting defaultPeriod: ${err.message}`); }
    }
    protected async setDefaultPeriod(val: number) {
        try {
            let WDT_DEFAULT_PERIOD_MIN = 11;
            let WDT_DEFAULT_PERIOD_MAX = 64999;
            if (val < this.options.readInterval/1000 + 1){
                throw new Error(`${this.device.name} error setDefaultPeriod time (${val}s) must be shorter than polling interval (${this.options.readInterval/1000}s + 1s).`);
            }
            if (val >= WDT_DEFAULT_PERIOD_MIN && val <= WDT_DEFAULT_PERIOD_MAX && val !== this.options.defaultPeriod) {
                if (!this.i2c.isMock){
                    let buffer = Buffer.from([0, 0]);
                    buffer.writeUInt16LE(val, 0);
                    await this.i2c.writeI2cBlock(this.device.address, this.regs.I2C_WDT_INIT_INTERVAL_SET_ADD, 2, buffer);
                }
                this.options.defaultPeriod = val;
            }
        }
        catch (err) { logger.error(`${this.device.name} error setting defaultPeriod: ${err.message}`); }
    }
    protected async getOffInterval() {
        try {
            if (!this.i2c.isMock) {
                let offInterval =
                    await this.i2c.readWord(this.device.address, this.regs.I2C_POWER_OFF_INTERVAL_GET_ADD);
                    
                    this.options.offInterval = offInterval;
                }
        } catch (err) { logger.error(`${this.device.name} error getting off interval: ${err.message}`); }
    }
    protected async setOffInterval(val: number) {
        try {
            let WDT_MAX_POWER_OFF_INTERVAL = 31 * 24 * 3600;
            if (val < 2 || val > WDT_MAX_POWER_OFF_INTERVAL) throw new Error(`Value must be between 2 and ${WDT_MAX_POWER_OFF_INTERVAL}`);
            if (!this.i2c.isMock) {
                let buffer = Buffer.from([0, 0, 0, 0]);
                buffer.writeUInt8(val, 0);
                buffer.writeUInt8(val >> 8, 1);
                buffer.writeUInt8(val >> 16, 2);
                buffer.writeUInt8(val >> 24, 3);
                await this.i2c.writeI2cBlock(this.device.address, this.regs.I2C_POWER_OFF_INTERVAL_SET_ADD, 4, buffer);
            }
            this.options.offInterval = val;
        }
        catch (err) { logger.error(`${this.device.name} error setting off interval: ${err.message}`); }
    }
    protected async getResetCount() {
        try {
            if (!this.i2c.isMock) {
                let watchdogRestarts =
                    await this.i2c.readWord(this.device.address, this.regs.I2C_WDT_RESET_COUNT_ADD);
                this.values.watchdogRestarts = watchdogRestarts;
            }
        } catch (err) { logger.error(`${this.device.name} error getting reset count: ${err.message}`); }
    }
    protected async clearResetCount() {
        try {
            let WDT_RESET_COUNT_KEY = 0xBE;
            let buffer = Buffer.from([0,0]);
            buffer.writeUInt16LE(WDT_RESET_COUNT_KEY, 0);
            await this.i2c.writeI2cBlock(this.device.address, this.regs.I2C_WDT_CLEAR_RESET_COUNT_ADD, 2, buffer);
            await this.getResetCount();
            // webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.values });
            return this.device;
        }
        catch (err) { logger.error(`${this.device.name} error setting defaultPeriod: ${err.message}`); }
    }
    protected async getTemp() {
        try {
            let temp: number;
            if (this.i2c.isMock) {
                temp = utils.convert.temperature.convertUnits(72 + (Math.round((5 * Math.random()) * 100) / 100), 'f', this.values.units)
            }
            else {
                temp = await this.i2c.readByte(this.device.address, this.regs.I2C_TEMP_ADD);
                temp = utils.convert.temperature.convertUnits(temp, 'C', this.values.units);
            }
            this.values.temp = temp;

        } catch (err) { logger.error(`${this.device.name} error getting fan temperature: ${err.message}`); }
    }
    protected async getSourceVolts() {
        try {
            this.values.sourceVolts = (this.i2c.isMock) ? 24.0 + Math.random() : await this.i2c.readWord(this.device.address, this.regs.I2C_5V_IN_ADD) / 1000;
        } catch (err) { logger.error(`${this.device.name} error getting input source voltage: ${err.message}`); }
    }
    protected async getRaspVolts() {
        try {
            this.values.raspiVolts = (this.i2c.isMock) ? 5.0 + Math.random() : await this.i2c.readWord(this.device.address, this.regs.I2C_5V_OUT_ADD) / 1000;
        } catch (err) { logger.error(`${this.device.name} error getting output/Raspberry Pi voltage: ${err.message}`); }
    }
    protected async getBatteryVolts() {
        try {
            this.values.batteryVolts = (this.i2c.isMock) ? 5.0 + Math.random() : await this.i2c.readWord(this.device.address, this.regs.I2C_VBAT_ADD) / 1000;
        } catch (err) { logger.error(`${this.device.name} error getting battery voltage: ${err.message}`); }
    }
    protected async getChargeStatus() {
        try {
            let _status = (this.i2c.isMock) ? Math.round((Math.random() * 4) - 1) : await this.i2c.readByte(this.device.address, this.regs.I2C_CHARGE_STAT_ADD);
            switch (_status & 0x0f) {
                case 0:
                    this.values.chargeStatus = "Off";
                    break;
                case 1:
                    this.values.chargeStatus = "Charge Complete";
                    break;
                case 2:
                    this.values.chargeStatus = "Charging";
                    break;
                case 3:
                    this.values.chargeStatus = "Fault";
                    break;
                default:
                    this.values.chargeStatus = `Unknown: ${_status}`;
                    break
            }
        } catch (err) { logger.error(`${this.device.name} error getting charge status: ${err.message}`); }
    }
    protected async getRePowerOnBattery() {
        try {
            let rePowerOnBat: number;
            if (this.i2c.isMock) {
                rePowerOnBat = Math.round(Math.random());
            }
            else if (this.hwFwCheck()) {

                rePowerOnBat = await this.i2c.readByte(this.device.address, this.regs.I2C_POWER_OFF_ON_BATTERY_ADD);
                rePowerOnBat = rePowerOnBat >= 1 ? 0 : 1;

            }
            this.options.rePowerOnBattery = utils.makeBool(rePowerOnBat);

        } catch (err) { logger.error(`${this.device.name} error getting repower on battery: ${err.message}`); }
    }
    protected async setRePowerOnBattery(val: boolean) {
        try {
            if (!this.i2c.isMock && this.hwFwCheck()) {
                let buffer = Buffer.from([0]);
                buffer.writeUInt8(val ? 0 : 1, 0); // inverse logic
                await this.i2c.writeI2cBlock(this.device.address, this.regs.I2C_POWER_OFF_ON_BATTERY_ADD, 1, buffer);
            }
            this.options.rePowerOnBattery = val;
        }
        catch (err) { logger.error(`${this.device.name} error setting fan blink: ${err.message}`); }
    }

    protected async getPowerButtonEnabled() {
        try {
            if (!this.i2c.isMock && this.hwFwCheck()) {
                let pbEnabled = utils.makeBool((0x01 & await this.i2c.readByte(this.device.address, this.regs.I2C_POWER_SW_USAGE_ADD)));
                this.options.powerButtonEnabled = pbEnabled;
            }
            else { this.options.powerButtonEnabled = false; }
        } catch (err) { logger.error(`${this.device.name} error getting power button enabled: ${err.message}`); }
    }
    protected async setPowerButtonEnabled(val: boolean) {
        try {
            if (!this.i2c.isMock && this.hwFwCheck()) {
                    let buffer = Buffer.from([0]);
                    buffer.writeUInt8(val ? 1 : 0, 0); // inverse logic
                    await this.i2c.writeI2cBlock(this.device.address, this.regs.I2C_POWER_SW_USAGE_ADD, 1, buffer);
            }
            this.options.powerButtonEnabled = utils.makeBool(val);
        }
        catch (err) { logger.error(`${this.device.name} error setting power button enabled ${err.message}`); }
    }
    protected async getPowerButton() {
        try {
            if (!this.i2c.isMock && this.hwFwCheck()) {
                let pbs = utils.makeBool((0x01 & await this.i2c.readByte(this.device.address, this.regs.I2C_POWER_SW_STATUS_ADD)));
                this.options.powerButton = pbs;
            }
            else { this.options.powerButton = false; }
        } catch (err) { logger.error(`${this.device.name} error getting power button (clear state/push): ${err.message}`); }
    }
    protected async setPowerButton(val: boolean) {
        try {
            if (!this.i2c.isMock && this.hwFwCheck()) {
                let chargeVal = await this.i2c.readWord(this.device.address, this.regs.I2C_CHARGE_STAT_ADD);
                if ((chargeVal & 0xf0) <= 0x10) {
                    let buffer = Buffer.from([0]);
                    buffer.writeUInt8(val ? 1 : 0, 0);
                    await this.i2c.writeI2cBlock(this.device.address, this.regs.I2C_POWER_SW_STATUS_ADD, 1, buffer);
                }
            }
            this.options.powerButton = utils.makeBool(val);
        }
        catch (err) { logger.error(`${this.device.name} error setting power button (emulated push): ${err.message}`); }
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
    protected async runScript(){
        try{
            if (typeof this.evalScript === 'function'){
                this.values.scriptFnVal = await this.evalScript(this.options, this.values, this.info, this.exec);
            }
        }
        catch (err){
            logger.error(`${this.device.name} error running user script: 
            ${err}
            ${this.options.scriptFn.toString()}`);
            this.values.scriptFnVal = err;
        }
    }
    protected async takeReadings(): Promise<boolean> {
        try {
            let _values = JSON.parse(JSON.stringify(this.values));
            await this.reload();
            await this.getTemp();
            await this.getSourceVolts();
            await this.getRaspVolts();
            await this.getBatteryVolts();
            await this.getChargeStatus();
            await this.getResetCount();

            await this.runScript();

            if (this.values.temp !== _values.temp || this.values.sourceVolts !== _values.sourceVolts || this.values.batteryVolts !== _values.batteryVolts || this.values.batteryVolts == _values.batteryVolts || this.values.chargeStatus !== _values.chargeStatus || this.values.chargeStatus !== _values.chargeStatus || this.values.scriptFnVal !== _values.scriptFnVal) {
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
    public async getDeviceInformation() {
        try {
            this.suspendPolling = true;
            try { await this.getHwFwVer(); } catch (err) { logger.error(`${this.device.name} error retrieving hardware and firmware versions ${err.message}`); }
            try { await this.getStatus(); } catch (err) { logger.error(`${this.device.name} error retrieving getStatus ${err.message}`); }
            try { await this.getPeriod(); } catch (err) { logger.error(`${this.device.name} error retrieving getPeriod ${err.message}`); }
            try { await this.getDefaultPeriod(); } catch (err) { logger.error(`${this.device.name} error retrieving getDefaultPeriod ${err.message}`); }
            try { await this.getPowerButtonEnabled(); } catch (err) { logger.error(`${this.device.name} error retrieving getPowerButtonEnabled ${err.message}`); }
            try { await this.getPowerButton(); } catch (err) { logger.error(`${this.device.name} error retrieving getPowerButton ${err.message}`); }
            try { await this.getOffInterval(); } catch (err) { logger.error(`${this.device.name} error retrieving getOffInterval ${err.message}`); }
            try { await this.getRePowerOnBattery(); } catch (err) { logger.error(`${this.device.name} error retrieving getRePowerOnBattery ${err.message}`); }
            webApp.emitToClients('i2cDeviceInformation', { bus: this.i2c.busNumber, address: this.device.address, info: this.device.info });
        }
        catch (err) { logger.error(`Error retrieving device status: ${typeof err !== 'undefined' ? err.message : ''}`); }
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
            case 'tempc':
                return utils.convert.temperature.convertUnits(this.info.Temp, this.values.units, 'C');
            case 'tempf':
                return utils.convert.temperature.convertUnits(this.info.Temp, this.values.units, 'F');
            case 'tempk':
                return utils.convert.temperature.convertUnits(this.info.Temp, this.values.units, 'K');

            default:
                return this.values[prop];
        }
    }
    public calcMedian(prop: string, values: any[]) {
        let p = prop.toLowerCase();
        switch (p) {
            case 'tempc':
            case 'tempf':
            case 'tempk':
            case 'inputvoltage':
            case 'pivoltage':
            case 'raspiVolts':
                return super.calcMedian(prop, values);
            case 'fwversion':
                return this.info.fwVersion;
            case 'chargeStatus':
                return this.values.chargeStatus;
            case 'sourceVolts':
                return this.values.sourceVolts;
            case 'batteryVolts':
                return this.values.batteryVolts;
            case 'watchdogRestarts':
                return this.values.watchdogRestarts;
            case 'scriptResult':
            case 'scriptFnVal':
                return this.values.scriptFnVal;
            default:

        }
    }
    public setValue(prop: string, value) {

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

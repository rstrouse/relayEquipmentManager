import { clearTimeout, setTimeout } from "timers";
import { utils } from "../boards/Constants";
import { Controller, DeviceBinding } from "../boards/Controller";
import { logger } from "../logger/Logger";
import { webApp } from "../web/Server";
import { OneWireDeviceBase } from "./OneWireBus";

export class OneWireTemperature extends OneWireDeviceBase {

    protected _timerRead: NodeJS.Timeout;
    protected _infoRead: NodeJS.Timeout;
    protected _suspendPolling: number = 0;
    protected _pollInformationInterval = 3000;
    public async initAsync(deviceType: any): Promise<boolean> {
        try {
            await super.initAsync(deviceType);
            if (typeof this.options.units === 'undefined' || this.options.units !== this.values.units) this.options.units = this.values.units = 'C';
            if (typeof this.options.calibration === 'undefined') this.options.calibration = 0;
            
            let _opts = JSON.parse(JSON.stringify(this.options));
            // options
            await this.getDeviceInformation();
            // readings
            // if prev options don't match what we have stored (due to restart), write them back
            await this.setOptions(_opts);
            await this.takeReadings();
        }
        catch (err) { this.logError(err); return Promise.resolve(false); }
        finally {
            // setTimeout(() => { this.pollDeviceInformation(); }, 2000);
            setTimeout(() => { this.pollReadings(); }, 5000);
        }

    }
    protected logError(err, msg?: string) { logger.error(`${this.device.name} ${typeof msg !== 'undefined' ? msg + ' ' : ''}${typeof err !== 'undefined' ? err.message : ''}`); }
    protected createError(byte, command): Error {
        let err: Error;
        switch (byte) {
            case 255:
                err = new Error(`${this.device.address} ${command} No 1-Wire data to send`);
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
    protected checkDiff(source, target) {
        if (typeof source !== typeof target) return true;
        if (Array.isArray(source)) {
            if (!Array.isArray(target)) return true;
            if (source.length !== target.length) return true;
            for (let i = 0; i < source.length; i++) {
                if (this.checkDiff(source[i], target[i])) return true;
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
    public async setOptions(opts: any): Promise<any> {
        await super.setOptions(opts);
        try {
            if (typeof opts.name !== 'undefined' && opts.name !== this.device.name || opts.name !== this.options.name) this.device.name = this.options.name = opts.name;
            if (typeof opts.calibration !== this.options.calibration) this.options.calibration = opts.calibration;
            if (typeof opts.readInterval === 'number') this.options.readInterval = opts.readInterval;
            this.options.readInterval = Math.max(1000, this.options.readInterval);
            if (typeof opts.units !== 'undefined' && this.options.units !== opts.units) await this.setUnits(opts.units);
            // RSG - need to figure out permissions to make this work.
            try {

                if (typeof opts.resolution !== 'undefined' && opts.resolution !== this.options.resolution) {
                    await this.setResolution(opts.resolution);
                }
            }
            catch (err) { logger.error(`${this.device.name} - EXPECTED - cannot set resolution.  ${err}`) }
            // RSG - need to figure out permissions to make this work.
            try {
                if (typeof opts.alarmLow !== 'undefined' && typeof opts.alarmHigh !== 'undefined' && opts.alarmLow !== this.options.alarmLow || opts.alarmHigh !== this.options.alarmHigh) {
                    await this.setAlarms(opts.alarmLow, opts.alarmHigh)
                }
            }
            catch (err) { throw(err)}
            return Promise.resolve(this);
        }
        catch (err) {
            let eStr = `${this.device.name} Error setting options: ${err}`;
            logger.error(eStr);
            return Promise.reject(eStr);
        }
    }


    protected async getTemperature() {
        try {
            if (Controller.isMock()) {
                this.values.temp = Math.round(utils.convert.temperature.convertUnits(19.0 + Math.random(), 'c', this.values.units) * 1000) / 1000;
            }
            else {
                let t = await this.readFile(`temperature`);
                this.values.temp = utils.convert.temperature.convertUnits((parseInt(t, 10) / 1000 + this.options.calibration || 0) , 'c', this.values.units);
            }
        } catch (err) { logger.error(`${this.device.name} error getting temp: ${err.message}`); }
    }
    protected async getAlarms() {
        try {
            if (Controller.isMock()) {
                this.options.alarmLow = Math.round(utils.convert.temperature.convertUnits(15, 'c', this.values.units));
                this.options.alarmHigh = Math.round(utils.convert.temperature.convertUnits(95, 'c', this.values.units));
            }
            else {
                let a = await this.readFile(`alarms`);
                let alarms = a.split(' ');
                this.options.alarmLow = Math.round(utils.convert.temperature.convertUnits(parseInt(alarms[0], 10), 'c', this.values.units));
                this.options.alarmHigh = Math.round(utils.convert.temperature.convertUnits(parseInt(alarms[1], 10), 'c', this.values.units));
            }
        } catch (err) { logger.error(`${this.device.name} error getting alarms: ${err.message}`); }
    }
    public async alarmSearch() {
        // to implement; is an alarm triggered?
    }
    protected async setAlarms(alarmLow: number, alarmHigh: number) {
        try {
            let lowLimit = Math.round(utils.convert.temperature.convertUnits(-100, 'C', this.values.units));
            let highLimit = Math.round(utils.convert.temperature.convertUnits(100, 'C', this.values.units));
            // let alarms = alarmLow.split(' ').map(el => utils.convert.temperature.convertUnits(parseInt(el, 10), this.values.units, 'C'));
            let alarmLowC = utils.convert.temperature.convertUnits(alarmLow, this.values.units, 'C');
            let alarmHighC = utils.convert.temperature.convertUnits(alarmHigh, this.values.units, 'C');
            if (isNaN(alarmLowC) || isNaN(alarmHighC) || alarmLowC < lowLimit || alarmLowC > highLimit || alarmHighC < lowLimit || alarmHighC > highLimit && alarmLowC < alarmHighC) return Promise.reject(`${this.device.name} alarms must be between ${lowLimit} and ${highLimit} celsius.  Value provided: ${alarmLow} and ${alarmHigh}`);
            if (Controller.isMock()) {
                this.options.alarmLow = alarmLow;
                this.options.alarmHigh = alarmHigh;
            }
            else {
                await this.writeFile(`alarms`, `${alarmLowC} ${alarmHighC}`);
                await this.getAlarms();
            }

        } catch (err) { logger.error(`${this.device.name} error getting conversion time: ${err.message}`); }
    }
    protected async getConvTime() {
        try {
            if (Controller.isMock()) {
                this.info.convTime = 750;
            }
            else {
                let ct = await this.readFile(`conv_time`);
                this.info.convTime = parseInt(ct, 10);
            }

        } catch (err) { logger.error(`${this.device.name} error getting conversion time: ${err.message}`); }
    }
    protected async getExtPower() {
        try {
            if (Controller.isMock()) {
                this.info.extPower = 750;
            }
            else {
                let ct = await this.readFile(`ext_power`);
                let ctVal = parseInt(ct, 10);
                this.info.extPower = ctVal ? 'External Power' : 'Parasitic Power';
            }

        } catch (err) { logger.error(`${this.device.name} error getting conversion time: ${err.message}`); }
    }
    protected async getResolution() {
        try {
            if (Controller.isMock()) {
                this.options.resolution = 12;
            }
            else {
                let r = await this.readFile(`resolution`);
                this.options.resolution = parseInt(r, 10);
            }

        } catch (err) { logger.error(`${this.device.name} error getting conversion time: ${err.message}`); }
    }
    protected async setResolution(val: number) {
        try {
            if (val < 9 || val > 12) return Promise.reject(`${this.device.name} resolution must be between 9-12 bits.  Value provided: ${val}`);
            if (Controller.isMock()) {
                this.options.resolution = val;
            }
            else {
                await this.writeFile(`resolution`, val);
                await this.getResolution();
                await this.getConvTime();
                webApp.emitToClients('oneWireDataValues', { bus: this.oneWire.busNumber, address: this.device.address, values: this.values });
            }

        } catch (err) { return Promise.reject(err); }
    }
    public async setUnits(value: string): Promise<boolean> {
        try {
            if (!['C', 'F', 'K'].includes(value.toUpperCase())) return Promise.reject(new Error(`Cannot set units to ${value}`));
            let prevUnits = this.values.units || 'C';
            this.options.units = this.values.units = value.toUpperCase();
            this.values.temp = utils.convert.temperature.convertUnits(this.values.temp, prevUnits, this.values.units) + this.options.calibration;
            this.options.alarmLow = Math.round(utils.convert.temperature.convertUnits(this.options.alarmLow, 'c', this.values.units));
            this.options.alarmHigh = Math.round(utils.convert.temperature.convertUnits(this.options.alarmHigh, 'c', this.values.units));
            await this.setAlarms(this.options.alarmLow, this.options.alarmHigh);
            webApp.emitToClients('oneWireDataValues', { id: this.device.id, typeId: this.device.typeId, values: this.values });
        }
        catch (err) { this.logError(err); return Promise.reject(err); }
    }

    protected pollDeviceInformation() {
        try {
            if (this._infoRead) clearTimeout(this._infoRead);
            this._infoRead = null;
            if (!this.suspendPolling && this.device.isActive) {
                (async () => {
                    await this.getDeviceInformation();
                })();
            }
        }
        catch (err) { this.logError(err, 'Error Polling Device Information'); }
        finally { this._infoRead = setTimeout(() => { this.pollDeviceInformation(); }, this._pollInformationInterval); }
    }
    protected async takeReadings(): Promise<boolean> {
        await this.getTemperature();
        webApp.emitToClients('oneWireDataValues', { bus: this.oneWire.busNumber, address: this.device.address, values: this.values });
        this.emitFeeds();
        return true;
    }
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
        finally { this._timerRead = setTimeout(async () => { await this.pollReadings(); }, this.options.readInterval || 3000) }
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
    public async getDeviceInformation(): Promise<boolean> {
        try {
            this.suspendPolling = true;
            await this.getAlarms();
            await this.getConvTime();
            await this.getExtPower();
            await this.getResolution();
            webApp.emitToClients('oneWireDeviceInformation', { bus: this.oneWire.busNumber, address: this.device.address, info: this.device.info });
            this.hasFault = false;
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


    public calcMedian(prop: string, values: any[]) {
        let p = prop.toLowerCase();
        switch (p) {
            case 'cputempc':
            case 'cputempf':
            case 'cputempk':
                return super.calcMedian(prop, values);
            default:
                return super.calcMedian(prop, values);
        }
    }

    public setValue(prop: string, value) {
        return;
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

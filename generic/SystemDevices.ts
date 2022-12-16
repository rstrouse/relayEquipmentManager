import { logger } from "../logger/Logger";
import { DeviceBinding } from "../boards/Controller";
import { setTimeout, clearTimeout } from "timers";
import { utils } from "../boards/Constants";

import * as fs from 'fs';
import { GenericDeviceBase } from "./genericDevices";
import { webApp } from "../web/Server";

export class CPUTempDevice extends GenericDeviceBase {
    protected _timerRead: NodeJS.Timeout;
    protected _infoRead: NodeJS.Timeout;
    protected _suspendPolling: number = 0;
    protected _pollInformationInterval = 3000;
    protected logError(err, msg?: string) { logger.error(`${this.device.name} ${typeof msg !== 'undefined' ? msg + ' ' : ''}${typeof err !== 'undefined' ? err.message : ''}`); }
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
    public async setOptions(opts): Promise<any> {
        try {
            this.suspendPolling = true;
            if (typeof opts.name !== 'undefined' && this.device.name !== opts.name) this.options.name = this.device.name = opts.name;
            if (typeof opts.units !== 'undefined') this.setUnits(opts.units);
            if (typeof opts.readInterval === 'number') this.options.readInterval = opts.readInterval;
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
            webApp.emitToClients('genericDataValues', { id: this.device.id, typeId: this.device.typeId, values: this.values });
        }
        catch (err) { this.logError(err); }
    }
    public async initAsync(deviceType): Promise<boolean> {
        try {
            this.stopPolling();
            if (typeof this.options.readInterval === 'undefined') this.options.readInterval = 3000;
            this.options.readInterval = Math.max(500, this.options.readInterval);
            if (typeof this.device.options.name !== 'string' || this.device.options.name.length === 0) this.device.name = this.device.options.name = deviceType.name;
            else this.device.name = this.device.options.name;
            if (typeof this.device.options.units === 'undefined') {
                this.device.options.units = this.device.values.units = 'C';
            }
            if (typeof this.device.values.units === 'undefined' || this.device.values.units !== this.device.options.units) { this.device.values.units = this.device.options.units; }

        }
        catch (err) { this.logError(err); return Promise.resolve(false); }
        finally {
            // setTimeout(() => { this.pollDeviceInformation(); }, 2000);
            setTimeout(() => { this.pollReadings(); }, this.options.readInterval || 3000);
        }
    }

    protected async getCpuTemp() {
        try {
            if (this.isMock) {
                this.values.temp = utils.convert.temperature.convertUnits(72 + (Math.round((5 * Math.random()) * 100) / 100), 'f', this.values.units);
            }
            if (fs.existsSync('/sys/class/thermal/thermal_zone0/temp')) {
                let buffer = fs.readFileSync('/sys/class/thermal/thermal_zone0/temp');
                this.values.temp = utils.convert.temperature.convertUnits(parseInt(buffer.toString().trim(), 10) / 1000, 'C', this.values.units);
            }
        } catch (err) { logger.error(`${this.device.name} error getting cpu temp: ${err.message}`); }
    }

    // protected pollDeviceInformation() {
    //     try {
    //         if (this._infoRead) clearTimeout(this._infoRead);
    //         this._infoRead = null;
    //         if (!this.suspendPolling && this.device.isActive) {
    //             this.getDeviceInformation();
    //         }
    //     }
    //     catch (err) { this.logError(err, 'Error Polling Device Information'); }
    //     finally { this._infoRead = setTimeout(() => { this.pollDeviceInformation(); }, this._pollInformationInterval); }
    // }
    protected async takeReadings(): Promise<boolean> {
        try {
            await this.getCpuTemp();
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
                    await this.takeReadings().catch(err => { logger.error(`Error polling generic device ${this.device.name}: ${err.message}`); });
                })();
                webApp.emitToClients('genericDataValues', { id: this.device.id, typeId: this.device.typeId, values: this.values });
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

    public async closeAsync(): Promise<void> {
        try {
            await this.stopPolling();
            await super.closeAsync();
            return Promise.resolve();
        }
        catch (err) { return this.logError(err); }
    }

    public getValue(prop: string) {
        if (prop === 'all') { return this.values; }
        let p = prop.toLowerCase();
        if (prop === 'temp') return this.values.temp;

        if (`temp${this.options.units.toLowerCase()}` === p) return this.values.temp;
        else if (prop.includes('temp')) {
            return utils.convert.temperature.convertUnits(this.values.temp, this.options.units, p.slice(-1));
        }
        else return this.values;
    }
    public calcMedian(prop: string, values: any[]) {
        let p = prop.toLowerCase();
        switch (p) {
            case 'units':
                return this.values.units;
            case 'all': {
                let temps = [];
                for (let i = 0; i < values.length; i++) {
                    temps.push(values[i].temp)
                };
                return {
                    units: values[0].units,
                    temp: super.calcMedian(prop, temps)
                }
            }
            case 'temp':
            case 'tempf':
            case 'tempc':
            case 'tempk':
            default:
                return super.calcMedian(prop, values);

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
    public async setValues(vals): Promise<any> {
        try {
            this.suspendPolling = true;

            return Promise.resolve(this.values);
        }
        catch (err) { this.logError(err); Promise.reject(err); }
        finally { this.suspendPolling = false; }
    }
}
export class ixianPhDevice extends GenericDeviceBase {
    protected _timerRead: NodeJS.Timeout;
    protected _infoRead: NodeJS.Timeout;
    protected _suspendPolling: number = 0;
    protected _pollInformationInterval = 3000;
    protected logError(err, msg?: string) { logger.error(`${this.device.name} ${typeof msg !== 'undefined' ? msg + ' ' : ''}${typeof err !== 'undefined' ? err.message : ''}`); }
    protected async takeReadings(): Promise<boolean> {
        try {
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
                    await this.takeReadings().catch(err => { logger.error(`Error polling generic device ${this.device.name}: ${err.message}`); });
                })();
                webApp.emitToClients('genericDataValues', { id: this.device.id, typeId: this.device.typeId, values: this.values });
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

    public async closeAsync(): Promise<void> {
        try {
            await this.stopPolling();
            await super.closeAsync();
            return Promise.resolve();
        }
        catch (err) { return this.logError(err); }
    }
    public calcPh(input: number): number {
        // ((ph/14) * 16) + 4 = mA
        // (ph/14) * 16 = mA - 4
        // ph / 14 = (mA - 4) / 16
        // ph = ((ma - 4) / 16) * 14;
        return Math.round((14 * ((input - 4) / 16)) * 1000) / 1000;

    }
    public getValue(prop: string) {
        if (prop.toLowerCase() === 'ph') return this.values.temp;
        else return this.values;
    }
    public calcMedian(prop: string, values: any[]) {
        let p = prop.toLowerCase();
        switch (p) {
            case 'all': {
                let ph = [];
                for (let i = 0; i < values.length; i++) {
                    ph.push(values[i].ph);
                };
                return { ph: super.calcMedian(prop, ph) };
            }
            case 'ph':
            default:
                return super.calcMedian(prop, values);

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
    public async setValues(vals): Promise<any> {
        try {
            this.suspendPolling = true;
            return Promise.resolve(this.values);
        }
        catch (err) { this.logError(err); Promise.reject(err); }
        finally { this.suspendPolling = false; }
    }

}


import { logger } from "../logger/Logger";
import { GenericDeviceController, cont, GenericDevice, DeviceBinding, Feed } from "../boards/Controller";
import { setTimeout, clearTimeout } from "timers";
import { AnalogDevices, IDevice, DeviceStatus } from "../devices/AnalogDevices";
import { utils } from "../boards/Constants";
import { webApp } from "../web/Server";
import { PromisifiedBus } from "i2c-bus";
import { GenericDeviceFactory } from "./GenericFactory";
import { connBroker, ServerConnection } from "../connections/Bindings";
import * as extend from "extend";
import { Buffer } from "buffer";
import * as path from 'path';
import * as fs from 'fs';
import { CPUTempDevice } from "./SystemDevices";

export class genericController {
    constructor() { }
    public devices: GenericDeviceBase[] = [];
    public async addDevice(dev: GenericDevice) {
        try {
            let dt = dev.getDeviceType();
            let device = await GenericDeviceBase.factoryCreate(this, dev);
            if (typeof device !== 'undefined') this.devices.push(device);
            else logger.error(`Factory error creating device for ${dev.name}`);
        }
        catch (err) { return Promise.reject(err); }
    }
    public async removeDevice(id: number) {
        try {
            for (let i = this.devices.length - 1; i >= 0; i--) {
                let dev = this.devices[i];
                if (typeof dev !== 'undefined' && dev && typeof dev.closeAsync === 'function') await dev.closeAsync();
                this.devices.splice(i, 1);
            }
        } catch (err) { logger.error(`Error removing generic device: ${err.message}`); return Promise.reject(err); }
    }
    public async initAsync(dc: GenericDeviceController) {
        try {
            logger.info(`Initializing Generic Devices`);
            for (let i = 0; i < dc.devices.length; i++) {
                let dev = dc.devices.getItemByIndex(i);
                await this.addDevice(dev).catch(err => { logger.error(`Error adding generic device ${dev.name}: ${err.message }`); });  }
            logger.info(`Generic Devices Initialized`);
        } catch (err) { logger.error(`Error initializing Generic Devices: ${err.message}`); }
    }
    public async resetAsync(bus): Promise<void> {
        try {
            await this.closeAsync();
            await this.initAsync(bus);
            return Promise.resolve();
        } catch (err) { logger.error(`Error resetting generic devices: ${err.message}`); }
    }
    public async closeAsync(): Promise<void> {
        try {
            logger.info(`Closing ${this.devices.length} devices.`);
            for (let i = 0; i < this.devices.length; i++) {
                await this.devices[i].closeAsync();
            }
            this.devices.length = 0;
            logger.info(`Closed Generic Devices`);
            return Promise.resolve();
        } catch (err) { logger.error(`Error closing generic devices: ${err.message}`); }
    }
    public setDeviceValue(deviceId: number, prop: string, value) {
        let device = this.devices.find(elem => elem.device.id === deviceId);
        if (typeof device !== 'undefined') device.setValue(prop, value);
    }
    public resetDeviceFeeds(deviceId: number) {
        let device = this.devices.find(elem => elem.device.id === deviceId);
        if (typeof device !== 'undefined') device.initFeeds();
    }
    public resetDeviceTriggers(deviceId: number) {
        let device = this.devices.find(elem => elem.device.id === deviceId);
        if (typeof device !== 'undefined') {
            device.resetTriggers();
        }
    }
}
export class GenericDeviceBase implements IDevice {
    public static async factoryCreate(gdc: genericController|CPUTempDevice, dev: GenericDevice): Promise<GenericDeviceBase> {
        try {
            let dt = dev.getDeviceType();
            if (typeof dt === 'undefined') return Promise.reject(new Error(`Cannot initialize Generic device id${dev.id}: Device type not found ${dev.typeId}`));
            let d = await GenericDeviceFactory.createDevice(dt.module, dt.deviceClass, gdc, dev);
            if (typeof d !== 'undefined') {
                d.category = dt.category;
                d.initialized = false;
                webApp.emitToClients('genericDeviceStatus', { id: dev.id, status: d.status, intialized: d.initialized, device: dev.getExtended() });
                if (await d.initAsync(dt)) {
                    d.initialized = true;
                    logger.info(`Device ${dt.name} initialized for generic device ${dev.id} - ${dev.name}`);
                    webApp.emitToClients('genericDeviceStatus', { id: dev.id, status: d.status, intialized: d.initialized, device: dev.getExtended() });
                }
            }
            return Promise.resolve(d);
        }
        catch (err) { logger.error(`Error creating generic device factoryCreate: ${err.message}`); }
    }
    constructor(gdc: genericController, dev: GenericDevice) {
        this.device = dev;
        this.initFeeds();
    }
    public feeds: Feed[] = [];
    public readable: boolean = false;
    public writable: boolean = false;
    public status: string;
    public category: string;
    public initialized: boolean = false;
    public hasFault: boolean = false;
    public device: GenericDevice;
    public lastComm: number;
    public get deviceStatus(): DeviceStatus { return { name: this.device.name, category: this.category, hasFault: utils.makeBool(this.hasFault), status: this.status, lastComm: this.lastComm, protocol: 'generic', busNumber: 1, address: undefined } }
    public get isMock(): boolean { 
        try {
            //console.log(process.platform);
            switch (process.platform) {
                case 'linux':
                    return false
                default:
                   return true;
            }
        } catch (err) { console.log(err); }
    }
    public async closeAsync(): Promise<void> {
        try {
            logger.info(`Stopped Generic Device ${this.device.id}: ${this.device.name}`);
        }
        catch (err) { logger.error(`Error stopping genteric device: ${this.device.name}: ${err.message}`); return Promise.resolve(); }
    }
    public get id(): number { return typeof this.device !== 'undefined' ? this.device.id : undefined; }
    public async initAsync(deviceType: any): Promise<boolean> { 
        this.category = deviceType.category; 
        if (typeof this.device.name === 'undefined') this.device.name = typeof (this.device.options.name !== 'undefined') ? this.device.options.name : deviceType.name;
        return Promise.resolve(true); }
    public async callCommand(cmd: any): Promise<any> {
        try {
            if (typeof cmd.name !== 'string') return Promise.reject(new Error(`Invalid command ${cmd.name}`));
            if (typeof this[cmd.name] !== 'function') return Promise.reject(new Error(`Command function not found ${cmd.name}`));
            let res = await this[cmd.name].apply(this, cmd.params);
            return Promise.resolve(res);
        }
        catch (err) { return Promise.reject(err); }
    }
    public async resetDevice(device: any): Promise<any> {
        try {
            if (typeof device !== 'undefined') {
                if (typeof device.options !== 'undefined') await this.setOptions(device.options);
                if (typeof device.values !== 'undefined') await this.setValues(device.values);
            }
        }
        catch (err) { logger.error(`Error resetting device: ${err.message}`); }
    }
    public async setOptions(opts: any): Promise<any> {
        try {
            this.device.options = opts;
            if (typeof opts.name !== 'undefined' && this.device.name !== opts.name) this.options.name = this.device.name = opts.name;
            //if (typeof this.device.options.name !== 'string' || this.device.options.name.length === 0) this.device.name = this.device.options.name
            return Promise.resolve(this);
        }
        catch (err) { logger.error(`Error setting generic device options: ${err.message}`); }
    }
    public async setValues(vals: any): Promise<any> { 

        this.device.values = vals;
        return Promise.resolve(this); }
    public initFeeds() {
        this.feeds = [];
        for (let i = 0; i < this.device.feeds.length; i++) {
            let f = this.device.feeds.getItemByIndex(i);
            if(f.id > 0) this.feeds.push(new Feed(f));
        }
    }
    public async resetTriggers() {
        try {
            // Get all the connections we are dealing with.
            let conns: ServerConnection[] = [];
            for (let i = 0; i < this.device.triggers.length; i++) {
                let trigger = this.device.triggers.getItemByIndex(i);
                if (typeof conns.find(elem => elem.connectionId === trigger.sourceId) === 'undefined') conns.push(connBroker.findServer(trigger.sourceId));
            }
            for (let i = 0; i < conns.length; i++) {
                let conn = conns[i];
                conn.resetDeviceTriggers(`generic:${this.device.typeId}:${this.device.id}`);
            }
        } catch (err) { return logger.error(`Error resetting trigger for device.`); }
    }
    public getValue(prop) {
        try {
            let replaceSymbols = /(?:\]\.|\[|\.)/g
            let _prop = prop.replace(replaceSymbols, ',').split(',');
            let val = this.device.values;
            if (_prop.length === 1 && _prop[0] !== 'all') {
                for (let i = 0; i < _prop.length; i++) {
                    val = val[_prop[i]];
                }
            }
            return val;
        } catch (err) { logger.error(`${this.device.name} error getting device value ${prop}: ${err.message}`); }
    }
    public setValue(prop, value) {
        let replaceSymbols = /(?:\]\.|\[|\.)/g
        let _prop = prop.indexOf(',') > -1 ? prop.replace(replaceSymbols, ',').split(',') : prop;
        //let obj = this.device.values;
        // for (let i = 0; i < _prop.length; i++) {
        //     obj = obj[_prop[i]];
        // }
        // obj = value;
        this.device.values[_prop] = value;
        // Execute a function, load a module, or ...
        let dt = this.device.getDeviceType();
        if (typeof dt.convertValue !== 'undefined') {
            let fn = new Function("maps", "device", dt.convertValue);
            fn(AnalogDevices.maps, this.device);
        }
        webApp.emitToClients('genericDataValues', { id: this.device.id, typeId: this.device.typeId, values: this.values });
        this.emitFeeds();
    }
    public calcMedian(prop, values: any[]) {
        let arr = [];
        for (let i = 0; i < values.length; i++) {
            if (typeof values[i] === 'number') arr.push(values[i]);
        }
        if (arr.length > 0) {
            let mid = Math.floor(arr.length / 2);
            let nums = [...arr].sort((a, b) => a - b);
            return arr.length % 2 !== 0 ? nums[mid] : ((nums[mid - 1] + nums[mid]) / 2);
        }
        return arr[0];
    }
    public async emitFeeds() {
        try {
            for (let i = 0; i < this.feeds.length; i++) {
                await this.feeds[i].send(this);
            }
        } catch (err) { logger.error(`Error emitting feeds for generic device ${this.device.name}: ${err.message}`); }
    }
    public get values() { return this.device.values; }
    public get options() { return this.device.options; }
    public get info() { return this.device.info; }
    public getDeviceDescriptions(dev) {
        let desc = [];
        desc.push({ type: 'generic', isActive: this.device.isActive, name: this.device.name, binding: `generic:${this.device.typeId}:${this.id}`, category: typeof dev !== 'undefined' ? dev.category : 'unknown', feeds: this.device.feeds.get() });
        return desc;
    }
    public async feedDeviceValue(binding: string | DeviceBinding, data: any): Promise<any> {
        try {
            let bind = (typeof binding === 'string') ? new DeviceBinding(binding) : binding;
            let props = Object.getOwnPropertyNames(data);
            for (let i = 0; i < props.length; i++) {
                await this.setValue(props[i], data[props[i]]);
            }
            return this.values;
        } catch (err) { return Promise.reject(err); }
    }
    public async setDeviceState(binding: string | DeviceBinding, data: any): Promise<any> {
        try {
            let bind = (typeof binding === 'string') ? new DeviceBinding(binding) : binding;
            if (typeof data === 'object'){
                for (var key in data){
                    this.setValue(key, data[key]);
                }
            }
            return this.getDeviceState(bind);
        } catch (err) { return Promise.reject(err); }
    }
    public async getDeviceState(binding: string | DeviceBinding): Promise<any> {
        try {
            let bind = (typeof binding === 'string') ? new DeviceBinding(binding) : binding;
            return this.values;
        } catch (err) { return Promise.reject(err); }
    }
}
export let gdc = new genericController();
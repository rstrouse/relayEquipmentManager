import { execSync } from 'child_process';
import * as fs from 'fs';
import { setTimeout } from 'timers';
import { utils } from '../boards/Constants';
import { cont, Controller, DeviceBinding, Feed, OneWireBus, OneWireController, OneWireDevice } from '../boards/Controller';
import { connBroker, ServerConnection } from '../connections/Bindings';
import { DeviceStatus, IDevice } from '../devices/AnalogDevices';
import { logger } from '../logger/Logger';
import { webApp } from '../web/Server';
import { OneWireDeviceFactory } from './OneWireFactory';
// import { exec } from 'child_process';
const util = require('util');
const exec = util.promisify(require('child_process').exec);


export class oneWireController {
    //public oneWireBus;
    public buses: oneWireBus[] = [];
    constructor() {
        /*         try {
                    console.log(process.platform);
                    switch (process.platform) {
                        case 'linux':
                            this.oneWireBus = require('i2c-bus');
                            break;
                        default:
                            this.oneWireBus = new MockOneWire();
                            break;
                    }
                } catch (err) { console.log(err); } */
    }
    public async initAsync(oneWire: OneWireController): Promise<void> {
        try {
            logger.info(`Initializing 1-Wire Interface`);
            oneWire.detected = await this.findBuses();
            //console.log(i2c.detected);
            for (let i = 0; i < oneWire.buses.length; i++) {
                let bus = oneWire.buses.getItemByIndex(i);
                if (!bus.isActive) continue;
                let ibus = new oneWireBus();
                await ibus.initAsync(bus);
                this.buses.push(ibus);
                // push the path for mock 1-Wire buses
                if (typeof oneWire.detected[i] === 'undefined') {
                    let _detected = JSON.parse(JSON.stringify(oneWire.detected));
                    _detected.push({
                        path: `/Mock/OneWire/Bus/${bus.busNumber}`,
                        "driver": "Mock Driver",
                        "name": `oneWire-${bus.busNumber}`,
                        "busNumber": bus.busNumber
                    })
                    oneWire.detected = _detected;
                }
            }
            return Promise.resolve();
        } catch (err) { logger.error(err); }
    }
    public async closeAsync(): Promise<void> {
        try {
            for (let i = 0; i < this.buses.length; i++) {
                await this.buses[i].closeAsync();
            }
            this.buses.length = 0;
            return Promise.resolve();
        }
        catch (err) { logger.error(err); }
    }
    public async resetAsync(oneWire): Promise<void> {
        try {
            await this.closeAsync();
            await this.initAsync(oneWire);
            return Promise.resolve();
        } catch (err) { logger.error(err); }
    }
    public async findBuses(): Promise<any[]> {
        let buses = [];
        try {
            logger.info(`Detecting 1-Wire Buses`);

            if (Controller.isMock()) {
                let bus1: any = {};
                bus1.path = `/sys/devices/mock/w1_bus_master1`;
                bus1.name = `mock_w1_bus_master1`;
                bus1.busNumber = 1;
                buses.push(bus1);
                let bus2: any = {};
                bus2.path = `/sys/devices/mock/w1_bus_master2`;
                bus2.name = `mock_w1_bus_master2`;
                bus2.busNumber = 2;
                buses.push(bus2);
                let bus3: any = {};
                bus3.path = `/sys/devices/mock/w1_bus_master3`;
                bus3.name = `mock_w1_bus_master3`;
                bus3.busNumber = 3;
                buses.push(bus3);
                return Promise.resolve(buses);
            }

            try {
                let oneWireInterfaceBuf = execSync("lsmod | grep w1_gpio");
                let oneWireInterface = oneWireInterfaceBuf.toString();
                logger.info(`oneWireInterface: ${oneWireInterface}`);
                if (!oneWireInterface.includes('w1_gpio')) {
                    logger.warn(`1-Wire interface not loaded on os.  Please enable through OS config to use 1-Wire devices.`);
                    return Promise.reject(`1-Wire interface not loaded on os.  Please enable through OS config.`);
                };
            }
            catch (err) {
                logger.silly(`stderr: ${err}`);
                return Promise.reject(`1-Wire interface not loaded on os.  Please enable through OS config. ${err}`);
            }

            if (fs.existsSync(`/sys/bus/w1/devices`)) {
                logger.info(`Detecting 1-Wire Buses at /sys/bus/w1/devices`);

                let dirs = fs.readdirSync('/sys/devices/', { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory())
                    .filter(dirent => dirent.name.includes('w1_bus_master'))
                    .map(dirent => dirent.name);
                if (dirs.length === 0) {
                    logger.debug(`No 1-Wire Slave Devices Found`);
                }
                for (let i = 0; i < dirs.length; i++) {
                    //let dir = dirs[i];
                    let bus: any = {};
                    bus.path = `/sys/devices/${dirs[i]}`;
                    bus.name = dirs[i];
                    bus.busNumber = parseInt(dirs[i].slice(-1), 10);
                    buses.push(bus);
                    /* if (dir === '.' || dir === '...') continue;
                    if (fs.existsSync(`/sys/bus/w1/devices/w1_bus_master1/w1_master_slaves/${dir}/name`)) {
                        // Read out the name for the device.
                        logger.info(`Detecting 1-Wire Buses /sys/bus/w1/devices/w1_bus_master1/${dir}`);
                        bus.driver = fs.readFileSync(`/sys/bus/w1/devices/w1_bus_master1/w1_master_slaves/${dir}/name`, { flag: 'r' }).toString().trim();
                        bus.path = `/sys/bus/w1/devices/w1_bus_master1/w1_master_slaves/${dir}`;
                        bus.name = dir;
                        // bus.busNumber = parseInt(dir.replace('i2c-', ''), 10);
                        buses.push(bus);
                    }
                    else if (fs.existsSync(`/sys/bus/w1/devices/w1_bus_master1/w1_master_slaves/${dir}/device/name`)) {
                        // Read out the name for the device.
                        bus.driver = fs.readFileSync(`/sys/bus/w1/devices/w1_bus_master1/w1_master_slaves/${dir}/name`, { flag: 'r' }).toString().trim();
                        bus.path = `/sys/bus/w1/devices/w1_bus_master1/w1_master_slaves/${dir}`;
                        bus.name = dir;
                        // bus.busNumber = parseInt(dir.replace('i2c-', ''), 10);
                        buses.push(bus);
                    }
                    else if (fs.existsSync(`/sys/bus/w1/devices/w1_bus_master1/w1_master_slaves/${dir}/device`)) {
                        // Non-ISA devices.
                        let ddirs = fs.readdirSync(`/sys/bus/w1/devices/w1_bus_master1/w1_master_slaves/${dir}/device`);
                        for (let j = 0; j < ddirs.length; j++) {
                            let ddir = ddirs[j];
                            logger.info(`Detecting 1-Wire Buses /sys/bus/w1/devices/w1_bus_master1/w1_master_slaves/${dir}/device/${ddir}`);
                            if (!ddir.toLowerCase().startsWith('i2c-')) continue;
                            if (fs.existsSync(`/sys/bus/w1/devices/w1_bus_master1/w1_master_slaves/${dir}/device/${ddir}/name`)) {
                                bus.driver = fs.readFileSync(`/sys/bus/w1/devices/w1_bus_master1/w1_master_slaves/${dir}/device/${ddir}/name`).toString().trim();
                                bus.path = `/sys/bus/w1/devices/w1_bus_master1/w1_master_slaves/${dir}/device/${ddir}`;
                                bus.name = ddir;
                                // bus.busNumber = parseInt(ddir.replace(/i2c-/gi, ''), 10);
                                buses.push(bus);
                            }
                        }
                    } */
                }
            }
            return Promise.resolve(buses);
        } catch (err) { logger.error(err); Promise.reject(err); }
    }
    public setDeviceValue(busId: number, deviceId: number, prop: string, value) {
        let bus = this.buses.find(elem => elem.busId === busId);
        if (typeof bus !== 'undefined') bus.setDeviceValue(deviceId, prop, value);

    }
    public resetDeviceFeeds(busId: number, deviceId: number) {
        let bus = this.buses.find(elem => elem.busId === busId);
        if (typeof bus !== 'undefined') bus.resetDeviceFeeds(deviceId);
    }
    public resetDeviceTriggers(busId: number, deviceId: number) {
        let bus = this.buses.find(elem => elem.busId === busId);
        if (typeof bus !== 'undefined') bus.resetDeviceTriggers(deviceId);
        else logger.error(`Could not find bus id ${busId}`);
    }

}
export class oneWireBus {
    //private _opts;
    //private _oneWireBus: OneWireBusCommands | MockOneWireBus;
    public devices: OneWireDeviceBase[] = [];
    public busNumber: number;
    public busId: number;
    public get busPath() { return `/sys/bus/w1/devices/w1_bus_master${this.busNumber}`; }
    constructor() { }
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
    public setCommSuccess(address: string) {
        let dev = this.devices.find(elem => elem.device.address === address);
        if (typeof dev !== 'undefined') { dev.lastComm = new Date().getTime(); dev.hasFault = false; dev.status = '' }
    }
    public setCommFailure(address: string, err: Error) {
        let dev = this.devices.find(elem => elem.device.address === address);
        if (typeof dev !== 'undefined') { dev.hasFault = true; dev.status = `Comm failure: ${typeof err !== 'undefined' ? err.message : 'Unspecified error'}` }
    }
    public async scanBus(): Promise<{ address: string, name: string, product: number, manufacturer: number }[]> {
        try {
            logger.info(`Scanning 1-Wire Bus #${this.busNumber}`);
            let addrsRaw = '';
            if (Controller.isMock()) { addrsRaw = `28-${this.busNumber}00000000001\n28-${this.busNumber}00000000002\n`; }
            else {
                addrsRaw = await fs.promises.readFile(`${this.busPath}/w1_master_slaves`, 'utf8');
            }
            if (!addrsRaw) {
                logger.warn(`No slave devices found on 1-Wire Bus #${this.busNumber}`);
                return [];
            }
            let addrs = addrsRaw.split('\n').filter(elem => elem.length === 15);

            console.log(addrs);
            let devs = [];
            let cdev = { address: '0', manufacturer: 0, product: 0, name: 'Unknown' };
            let bus = cont.oneWire.buses.getItemByBusNumber(this.busNumber);
            for (let i = 0; i < addrs.length; i++) {
                try {
                    let d = bus.devices.getItemByAddress(addrs[i]);
                    d.name = addrs[i];
                    if (!Controller.isMock()) {
                        try {
                            let slave = await fs.promises.readFile(`${this.busPath}/${d.name}/w1_slave`);
                        }
                        catch (err) {
                            logger.silly(`Phantom 1-wire device ${d.name} found.  Skipping.`);
                            continue;
                        }
                    }
                    logger.info(`Found 1-Wire device ${d.name} on bus #${this.busNumber}.`);
                    cdev = { address: addrs[i], manufacturer: 0, product: 0, name: d.name };
                    devs.push(cdev);
                    //let o = await this._i2cBus.deviceId(addrs[i]);
                    // cdev.name = d.name;
                }
                catch (err) {
                    logger.silly(`Error Executing deviceId for address ${cdev.address}: ${err.message}`);
                }
            }

            for (let i = 0; i < bus.devices.length; i++) {
                let d = bus.devices.getItemByIndex(i);
                if (typeof d.address !== 'string') {
                    setTimeout(() => { bus.devices.removeItemById(d.id); }, 50);
                    continue;
                }
                let addr = devs.find(elem => elem.address === d.address);
                if (typeof addr === 'undefined') {
                    logger.info(`Adding 1-Wire device that could not be scanned ${d.address}.`);
                    devs.push({ address: d.address, manufacturer: 0, product: 0, name: d.name || 'Unknown' });
                }
            }
            devs.sort((a, b) => { return a.address - b.address })
            bus.addresses = devs;
            return devs;
        }
        catch (err) { logger.error(`Error Scanning 1-Wire Bus #${this.busNumber}: ${err.message}`); }
    }
    public async addDevice(dev: OneWireDevice) {
        try {
            let dt = dev.getDeviceType();
            let device = await OneWireDeviceBase.factoryCreate(this, dev);
            if (typeof device !== 'undefined') this.devices.push(device);
        }
        catch (err) { return Promise.reject(err); }

    }
    public async initAsync(bus: OneWireBus) {
        try {
            this.busId = bus.id;
            this.busNumber = bus.busNumber;
            logger.info(`Initializing 1-Wire Bus #${bus.busNumber}`);
            //this._oneWireBus = await OneWireBusCommands.openBus(bus.busNumber);
            //bus.functions = await this.i2cFuncs();
            bus.addresses = await this.scanBus();
            for (let i = 0; i < bus.devices.length; i++) {
                let dev = bus.devices.getItemByIndex(i);
                await this.addDevice(dev).catch(err => { logger.error(err); });
            }
            logger.info(`1-Wire Bus #${bus.busNumber} Initialized`);
        } catch (err) { logger.error(err); }
    }

    public async read(address: string, path: string): Promise<string> {
        try {
            let out = await fs.promises.readFile(path)
            // let buffer: Buffer = Buffer.alloc(length);
            // let ret = await this.i2cRead(address, length, buffer);
            let ret = out.toString();;
            this.setCommSuccess(address);
            return Promise.resolve(ret);
        }
        catch (err) { return Promise.reject(err); }
    }
    public async resetAsync(bus): Promise<void> {
        try {
            await this.closeAsync();
            await this.initAsync(bus);
            return Promise.resolve();
        } catch (err) { logger.error(err); }
    }
    public async closeAsync(): Promise<void> {
        try {
            logger.info(`Closing ${this.devices.length} 1-Wire devices.`);
            for (let i = 0; i < this.devices.length; i++) {
                await this.devices[i].closeAsync();
            }
            this.devices.length = 0;
            logger.info(`Closed 1-Wire Bus #${this.busNumber}`);
            return Promise.resolve();
        } catch (err) { logger.error(err); }
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

export class OneWireDeviceBase implements IDevice {
    public static async factoryCreate(oneWire, dev: OneWireDevice): Promise<OneWireDeviceBase> {
        try {
            let dt = dev.getDeviceType();
            if (typeof dt === 'undefined') return Promise.reject(new Error(`Cannot initialize 1-Wire device id${dev.id} on Bus ${oneWire.busNumber}: Device type not found ${dev.typeId}`));
            let d = await OneWireDeviceFactory.createDevice(dt.module, dt.deviceClass, oneWire, dev);
            if (typeof d !== 'undefined') {
                d.category = dt.category;
                d.initialized = false;
                webApp.emitToClients('oneWireDeviceStatus', { busNumber: oneWire.busNumber, id: dev.id, address: dev.address, status: d.status, intialized: d.initialized, device: dev.getExtended() });
                if (await d.initAsync(dt)) {
                    d.initialized = true;
                    logger.info(`Device ${dt.name} initialized for 1-Wire bus #${oneWire.busNumber} address ${dev.address}`);
                    webApp.emitToClients('oneWireDeviceStatus', { busNumber: oneWire.busNumber, id: dev.id, address: dev.address, status: d.status, intialized: d.initialized, device: dev.getExtended() });
                }
            }
            return Promise.resolve(d);
        }
        catch (err) { logger.error(err); }
    }
    constructor(oneWire, dev: OneWireDevice) {
        this.oneWire = oneWire;
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
    public oneWire: oneWireBus;
    public device: OneWireDevice;
    public lastComm: number;
    public get deviceStatus(): DeviceStatus { return { name: this.device.name, category: this.category, hasFault: utils.makeBool(this.hasFault), status: this.status, lastComm: this.lastComm, protocol: 'oneWire', busNumber: this.oneWire.busNumber, address: this.device.address } }
    public get devicePath() { return `${this.oneWire.busPath}/${this.device.address}`; };
    public async closeAsync(): Promise<void> {
        try {
            logger.info(`Stopped 1-Wire ${this.device.name}`);
            return Promise.resolve();
        }
        catch (err) { logger.error(err); return Promise.resolve(); }
    }
    public async initAsync(deviceType: any): Promise<boolean> {
        this.category = deviceType.category;
        if (typeof this.options.readInterval === 'undefined') this.options.readInterval = 3000;
        if (typeof this.options.name === 'undefined') this.options.name = this.device.name;
        // this.getDeviceInformation();
        return Promise.resolve(true);
    }
    public async getDeviceInformation() { return Promise.resolve(true); }
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
            if (typeof opts.name !== 'undefined') this.options.name = opts;
            return Promise.resolve(this);
        }
        catch (err) { logger.error(err); }
    }
    public async setValues(vals: any): Promise<any> { return Promise.resolve(this); }
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
                conn.resetDeviceTriggers(`oneWire:${this.oneWire.busId}:${this.device.id}`);
            }
        } catch (err) { return logger.error(`Error resetting trigger for device.`); }
    }
    public getValue(prop, val?: any) {
        try {
            switch (prop) {
                case 'tempK':
                    return utils.convert.temperature.convertUnits(this.values.temp, this.values.units, 'k');
                case 'tempC':
                    return utils.convert.temperature.convertUnits(this.values.temp, this.values.units, 'c');
                case 'tempF':
                    return utils.convert.temperature.convertUnits(this.values.temp, this.values.units, 'f');
                case 'temp':
                    return this.values.temp;
                case 'all':
                    return this.values;
            }
        } catch (err) { logger.error(`${this.device.name} error getting device value ${prop}: ${err.message}`); }
    }
    public setValue(prop, value) {
        let replaceSymbols = /(?:\]\.|\[|\.)/g
        let _prop = prop.replace(replaceSymbols, ',').split(',');
        let obj = this.device.values;
        for (let i = 0; i < prop.length; i++) {
            obj = obj[_prop[i]];
        }
        obj = value;
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
        } catch (err) { logger.error(err); }
    }
    public get values() { return this.device.values; }
    public get options() { return this.device.options; }
    public get info() { return this.device.info; }
    public getDeviceDescriptions(dev) {
        let desc = [];
        desc.push({ type: 'oneWire', isActive: this.device.isActive, name: this.device.name, binding: `oneWire:${this.oneWire.busId}:${this.device.id}`, category: typeof dev !== 'undefined' ? dev.category : 'unknown', feeds: this.device.feeds.get() });
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
            return this.getDeviceState(bind);
        } catch (err) { return Promise.reject(err); }
    }
    public async getDeviceState(binding: string | DeviceBinding): Promise<any> {
        try {
            let bind = (typeof binding === 'string') ? new DeviceBinding(binding) : binding;
            return this.values;
        } catch (err) { return Promise.reject(err); }
    }
    public async readFile(file: string): Promise<string> {
        try {
            this.hasFault = false;
            return await fs.promises.readFile(`${this.devicePath}/${file}`, { encoding: 'utf8' });
        }
        catch (err) {
            this.hasFault = true;
            return Promise.reject(new Error(err));
        }
    }
    public async writeFile(file: string, data: any): Promise<void> {
        try {
            let res = execSync(`echo ${data} | tee -a ${this.devicePath}/${file}`);
            console.log(`result: ${res}`);
            this.hasFault = false;
        }
        catch (err) {
            this.hasFault = true;
            return Promise.reject(new Error(err));
        }
    }
}

export let oneWire = new oneWireController();
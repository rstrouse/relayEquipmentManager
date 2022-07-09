import { logger } from "../logger/Logger";
import { I2cController, cont, I2cBus, I2cDevice, DeviceBinding, ConfigItem, Feed } from "../boards/Controller";
import { setTimeout, clearTimeout } from "timers";
import { AnalogDevices, IDevice, DeviceStatus } from "../devices/AnalogDevices";
import { utils } from "../boards/Constants";
import { webApp } from "../web/Server";
import { PromisifiedBus } from "i2c-bus";
import { i2cDeviceFactory } from "./i2cFactory";
import { connBroker, ServerConnection } from "../connections/Bindings";
import * as extend from "extend";
import { Buffer } from "buffer";
import * as path from 'path';
import * as fs from 'fs';

export class i2cController {
    public i2cBus;
    public buses: i2cBus[] = [];
    constructor() {
        try {
            console.log(process.platform);
            switch (process.platform) {
                case 'linux':
                    this.i2cBus = require('i2c-bus');
                    break;
                default:
                    this.i2cBus = new mockI2c();
                    break;
            }
        } catch (err) { console.log(err); }
    }
    public async initAsync(i2c: I2cController): Promise<void> {
        try {
            logger.info(`Initializing i2c Interface`);
            i2c.detected = await this.findBuses();
            //console.log(i2c.detected);
            for (let i = 0; i < i2c.buses.length; i++) {
                let bus = i2c.buses.getItemByIndex(i);
                if (!bus.isActive) continue;
                let ibus = new i2cBus();
                await ibus.initAsync(bus);
                this.buses.push(ibus);
                // push the path for mock i2c buses
                if (typeof i2c.detected[i] === 'undefined') {
                    let _detected = JSON.parse(JSON.stringify(i2c.detected));
                    _detected.push({
                        path: `/Mock/I2C/Bus/${bus.busNumber}`,
                        "driver": "Mock Driver",
                        "name": `i2c-${bus.busNumber}`,
                        "busNumber": bus.busNumber
                    })
                    i2c.detected = _detected;
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
    public async resetAsync(i2c): Promise<void> {
        try {
            await this.closeAsync();
            await this.initAsync(i2c);
            return Promise.resolve();
        } catch (err) { logger.error(err); }
    }
    public async findBuses(): Promise<any[]> {
        let buses = [];
        try {
            logger.info(`Detecting i2c Buses`);
            if (fs.existsSync(`/proc/bus/i2c`)) {
                logger.info(`Detecting i2c Buses /proc/bus/i2c`);
                let fd = fs.openSync(`/proc/bus/i2c`, 'r');
                let buff = Buffer.alloc(120);
                let pos = 0;
                let read = 0;
                do {
                    read = fs.readSync(fd, buff, 0, 120, pos);
                    let bus: any = {};
                    if (read > 0) {
                        // The data is tab delimited.
                        let arr = buff.toString().split('\t');
                        bus.driver = arr[0].trim();
                        bus.name = arr[1].trim();
                        bus.type = arr[2].trim();
                        bus.busNumber = parseInt(bus.name.replace('i2c-', ''), 10);
                        bus.path = `/proc/bus/i2c/${bus.name}`;
                        buses.push(bus);
                    }
                    pos += read;
                } while (read === 120);
            } else if (fs.existsSync(`/sys/class/i2c-dev`)) {
                let dirs = fs.readdirSync('/sys/class/i2c-dev');
                for (let i = 0; i < dirs.length; i++) {
                    let dir = dirs[i];
                    let bus: any = {};
                    if (dir === '.' || dir === '...') continue;
                    logger.info(`Detecting i2c Buses /sys/class/i2c-dev/${dir}`);
                    if (fs.existsSync(`/sys/class/i2c-dev/${dir}/name`)) {
                        // Read out the name for the device.
                        bus.driver = fs.readFileSync(`/sys/class/i2c-dev/${dir}/name`, { flag: 'r' }).toString().trim();
                        bus.path = `/sys/class/i2c-dev/${dir}`;
                        bus.name = dir;
                        bus.busNumber = parseInt(dir.replace('i2c-', ''), 10);
                        buses.push(bus);
                    }
                    else if (fs.existsSync(`/sys/class/i2c-dev/${dir}/device/name`)) {
                        // Read out the name for the device.
                        bus.driver = fs.readFileSync(`/sys/class/i2c-dev/${dir}/name`, { flag: 'r' }).toString().trim();
                        bus.path = `/sys/class/i2c-dev/${dir}`;
                        bus.name = dir;
                        bus.busNumber = parseInt(dir.replace('i2c-', ''), 10);
                        buses.push(bus);
                    }
                    else if (fs.existsSync(`/sys/class/i2c-dev/${dir}/device`)) {
                        // Non-ISA devices.
                        let ddirs = fs.readdirSync(`/sys/class/i2c-dev/${dir}/device`);
                        for (let j = 0; j < ddirs.length; j++) {
                            let ddir = ddirs[j];
                            logger.info(`Detecting i2c Buses /sys/class/i2c-dev/${dir}/device/${ddir}`);
                            if (!ddir.toLowerCase().startsWith('i2c-')) continue;
                            if (fs.existsSync(`/sys/class/i2c-dev/${dir}/device/${ddir}/name`)) {
                                bus.driver = fs.readFileSync(`/sys/class/i2c-dev/${dir}/device/${ddir}/name`).toString().trim();
                                bus.path = `/sys/class/i2c-dev/${dir}/device/${ddir}`;
                                bus.name = ddir;
                                bus.busNumber = parseInt(ddir.replace(/i2c-/gi, ''), 10);
                                buses.push(bus);
                            }
                        }
                    }
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
export class i2cBus {
    //private _opts;
    private _i2cBus: PromisifiedBus | mockI2cBus;
    public devices: i2cDeviceBase[] = [];
    public busNumber: number;
    public busId: number;
    constructor() { }
    public get isMock(): boolean { return utils.makeBool(this._i2cBus.isMock); }
    public setCommSuccess(address: number) {
        let dev = this.devices.find(elem => elem.device.address === address);
        if (typeof dev !== 'undefined') { dev.lastComm = new Date().getTime(); dev.hasFault = false; dev.status = '' }
    }
    public setCommFailure(address: number, err: Error) {
        let dev = this.devices.find(elem => elem.device.address === address);
        if (typeof dev !== 'undefined') { dev.hasFault = true; dev.status = `Comm failure: ${typeof err !== 'undefined' ? err.message : 'Unspecified error'}` }
    }
    public async scanBus(start: number = 0x03, end: number = 0x77): Promise<{ address: number, name: string, product: number, manufacturer: number }[]> {
        try {
            logger.info(`Scanning i2c Bus #${this.busNumber}`);
            let addrs = await this._i2cBus.scan(start, end);
            let t = await this._i2cBus.scan(0x3F)
            console.log(addrs);
            let devs = [];
            let cdev = { address: 0, manufacturer: 0, product: 0, name: 'Unknown' };
            let bus = cont.i2c.buses.getItemByBusNumber(this.busNumber);
            for (let i = 0; i < addrs.length; i++) {
                try {
                    let d = bus.devices.getItemByAddress(addrs[i]);
                    logger.info(`Found I2C device ${d.name || 'Unknown'} at address: ${addrs[i]} - (0x${addrs[i].toString(16)})`);
                    cdev = { address: addrs[i], manufacturer: 0, product: 0, name: d.name || 'Unknown' };
                    devs.push(cdev);
                    //let o = await this._i2cBus.deviceId(addrs[i]);
                    cdev.name = d.name || 'Unknown';
                }
                catch (err) {
                    logger.silly(`Error Executing deviceId for address ${cdev.address}: ${err.message}`);
                }
            }
            
            for (let i = 0; i < bus.devices.length; i++) {
                let d = bus.devices.getItemByIndex(i);
                if (typeof d.address !== 'number') {
                    setTimeout(() => { bus.devices.removeItemById(d.id); }, 50);
                    continue;
                }
                let addr = devs.find(elem => elem.address === d.address);
                if (typeof addr === 'undefined') {
                    logger.info(`Adding I2C device that could not be scanned ${d.address} - (0x${d.address.toString(16)})`);
                    devs.push({ address: d.address, manufacturer: 0, product: 0, name: d.name || 'Unknown' });
                }
            }
            devs.sort((a, b) => { return a.address - b.address })
            bus.addresses = devs;
            return devs;
        }
        catch (err) { logger.error(`Error Scanning i2c Bus #${this.busNumber}: ${err.message}`); }
    }
    public async addDevice(dev: I2cDevice) {
        try {
            let dt = dev.getDeviceType();
            let device = await i2cDeviceBase.factoryCreate(this, dev);
            if (typeof device !== 'undefined') this.devices.push(device);
        }
        catch (err) { return Promise.reject(err); }

    }
    public async initAsync(bus: I2cBus) {
        try {
            this.busId = bus.id;
            this.busNumber = bus.busNumber;
            logger.info(`Initializing i2c Bus #${bus.busNumber}`);
            this._i2cBus = await i2c.i2cBus.openPromisified(bus.busNumber, {});
            bus.functions = await this._i2cBus.i2cFuncs();
            bus.addresses = await this.scanBus();
            for (let i = 0; i < bus.devices.length; i++) {
                let dev = bus.devices.getItemByIndex(i);
                await this.addDevice(dev).catch(err => { logger.error(err); });
            }
            logger.info(`i2c Bus #${bus.busNumber} Initialized`);
        } catch (err) { logger.error(err); }
    }
    public async readByte(addr: number, cmd: number): Promise<number> {
        try {
            let byte = await this._i2cBus.readByte(addr, cmd);
            this.setCommSuccess(addr);
            return Promise.resolve(byte);
        }
        catch (err) { return Promise.reject(err); }
    }
    public async readWord(addr: number, cmd: number): Promise<number> {
        try {
            let word = await this._i2cBus.readWord(addr, cmd);
            this.setCommSuccess(addr);
            return Promise.resolve(word);
        }
        catch (err) { return Promise.reject(err); }
    }
    public async readI2cBlock(address: number, reg: number, length: number): Promise<{ bytesRead: number, buffer: Buffer }> {
        try {
            let buffer = Buffer.allocUnsafe(length);
            let ret = await this._i2cBus.readI2cBlock(address, reg, length, buffer);
            this.setCommSuccess(address);
            return Promise.resolve(ret)
        }
        catch (err) { return Promise.reject(err); }
    }
    public async writeI2cBlock(address: number, reg: number, length: number, command: Buffer) {
        try {

            let ret = await this._i2cBus.writeI2cBlock(address, reg, length, command);
            this.setCommSuccess(address);
            return Promise.resolve(ret)
        }
        catch (err) { return Promise.reject(err); }
    }
    public async writeCommand(address: number, command: string | number | Buffer, length?: number): Promise<number> {
        try {
            let ret = { bytesWritten: -1 };
            if (typeof command === 'string') {
                if (typeof length === 'undefined') length = command.length;
                ret = await this._i2cBus.i2cWrite(address, command.length, Buffer.from(command));
            }
            else if (typeof command === 'number') {
                if (typeof length === 'undefined') length = 1;
                let buffer = Buffer.allocUnsafe(length);
                switch (length) {
                    case 1:
                        buffer.writeUInt8(command, 0);
                        break;
                    case 2:
                        buffer.writeInt16BE(command, 0);
                        break;
                    case 4:
                        buffer.writeInt32BE(command, 0);
                        break;
                    default:
                        return Promise.reject(new Error(`Error writing I2c ${command}.  Improper length specified for number.`));
                        break;
                }
                ret = await this._i2cBus.i2cWrite(address, length, buffer);
            }
            else if (typeof command === 'object' && Buffer.isBuffer(command)) {
                if (typeof length === 'undefined') length = command.length;
                ret = await this._i2cBus.i2cWrite(address, length, command);
            }
            else {
                let err = new Error(`Error writing I2c ${command}.  Invalid type for command.`);
                logger.error(err);
                return Promise.reject(err);
            }
            if (ret.bytesWritten !== length) {
                let err = new Error(`Error writing I2c ${command}.  Mismatch on bytes written ${ret.bytesWritten}.`);
                logger.error(err);
                return Promise.reject(err);
            }
            this.setCommSuccess(address);
            return Promise.resolve(ret.bytesWritten);
        }
        catch (err) { return Promise.reject(err); }
    }
    public async read(address: number, length: number): Promise<{ bytesRead: number, buffer: Buffer }> {
        try {
            let buffer: Buffer = Buffer.alloc(length);
            buffer.fill(0);
            let ret = await this._i2cBus.i2cRead(address, length, buffer);
            this.setCommSuccess(address);
            return Promise.resolve(ret);
        }
        catch (err) { return Promise.reject(err); }
    }
    public async write(address: number, length: number, buffer: Buffer): Promise<{ bytesWritten: number, buffer: Buffer }> {
        try {
            let ret = await this._i2cBus.i2cWrite(address, length, buffer);
            this.setCommSuccess(address);
            return ret;
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
            logger.info(`Closing ${this.devices.length} i2c devices.`);
            for (let i = 0; i < this.devices.length; i++) {
                await this.devices[i].closeAsync();
            }
            this.devices.length = 0;
            await this._i2cBus.close();
            logger.info(`Closed i2c Bus #${this.busNumber}`);
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

const i2cBits = {
    I2C_FUNC_I2C: 0x00000001,
    I2C_FUNC_10BIT_ADDR: 0x00000002,
    I2C_FUNC_PROTOCOL_MANGLING: 0x00000004,
    I2C_FUNC_SMBUS_PEC: 0x00000008,
    I2C_FUNC_SMBUS_BLOCK_PROC_CALL: 0x00008000,
    I2C_FUNC_SMBUS_QUICK: 0x00010000,
    I2C_FUNC_SMBUS_READ_BYTE: 0x00020000,
    I2C_FUNC_SMBUS_WRITE_BYTE: 0x00040000,
    I2C_FUNC_SMBUS_READ_BYTE_DATA: 0x00080000,
    I2C_FUNC_SMBUS_WRITE_BYTE_DATA: 0x00100000,
    I2C_FUNC_SMBUS_READ_WORD_DATA: 0x00200000,
    I2C_FUNC_SMBUS_WRITE_WORD_DATA: 0x00400000,
    I2C_FUNC_SMBUS_PROC_CALL: 0x00800000,
    I2C_FUNC_SMBUS_READ_BLOCK_DATA: 0x01000000,
    I2C_FUNC_SMBUS_WRITE_BLOCK_DATA: 0x02000000,
    I2C_FUNC_SMBUS_READ_I2C_BLOCK: 0x04000000,
    I2C_FUNC_SMBUS_WRITE_I2C_BLOCK: 0x08000000
}

class mockI2cFuncs {
    public i2c: boolean = false;
    public tenBitAddr: boolean = false;
    public protocolMangling: boolean = false;
    public smbusPec: boolean = false;
    public smbusBlockProcCall: boolean = false;
    public smbusQuick: boolean = false;
    public smbusReceiveByte: boolean = false;
    public smbusSendByte: boolean = false;
    public smbusReadByte: boolean = false;
    public smbusWriteByte: boolean = false;
    public smbusReadWord: boolean = false;
    public smbusWriteWord: boolean = false;
    public smbusProcCall: boolean = false;
    public smbusReadBlock: boolean = false;
    public smbusWriteBlock: boolean = false;
    public smbusReadI2cBlock: boolean = false;
    public smbusWriteI2cBlock: boolean = false;
    constructor(i2cFuncBits) {
        this.i2c = !!(i2cFuncBits & i2cBits.I2C_FUNC_I2C);
        this.tenBitAddr = !!(i2cFuncBits & i2cBits.I2C_FUNC_10BIT_ADDR);
        this.protocolMangling = !!(i2cFuncBits & i2cBits.I2C_FUNC_PROTOCOL_MANGLING);
        this.smbusPec = !!(i2cFuncBits & i2cBits.I2C_FUNC_SMBUS_PEC);
        this.smbusBlockProcCall = !!(i2cFuncBits & i2cBits.I2C_FUNC_SMBUS_BLOCK_PROC_CALL);
        this.smbusQuick = !!(i2cFuncBits & i2cBits.I2C_FUNC_SMBUS_QUICK);
        this.smbusReceiveByte = !!(i2cFuncBits & i2cBits.I2C_FUNC_SMBUS_READ_BYTE);
        this.smbusSendByte = !!(i2cFuncBits & i2cBits.I2C_FUNC_SMBUS_WRITE_BYTE);
        this.smbusReadByte = !!(i2cFuncBits & i2cBits.I2C_FUNC_SMBUS_READ_BYTE_DATA);
        this.smbusWriteByte = !!(i2cFuncBits & i2cBits.I2C_FUNC_SMBUS_WRITE_BYTE_DATA);
        this.smbusReadWord = !!(i2cFuncBits & i2cBits.I2C_FUNC_SMBUS_READ_WORD_DATA);
        this.smbusWriteWord = !!(i2cFuncBits & i2cBits.I2C_FUNC_SMBUS_WRITE_WORD_DATA);
        this.smbusProcCall = !!(i2cFuncBits & i2cBits.I2C_FUNC_SMBUS_PROC_CALL);
        this.smbusReadBlock = !!(i2cFuncBits & i2cBits.I2C_FUNC_SMBUS_READ_BLOCK_DATA);
        this.smbusWriteBlock = !!(i2cFuncBits & i2cBits.I2C_FUNC_SMBUS_WRITE_BLOCK_DATA);
        this.smbusReadI2cBlock = !!(i2cFuncBits & i2cBits.I2C_FUNC_SMBUS_READ_I2C_BLOCK);
        this.smbusWriteI2cBlock = !!(i2cFuncBits & i2cBits.I2C_FUNC_SMBUS_WRITE_I2C_BLOCK);
    }
}
class mockI2c {
    public openPromisified(busNumber, options): Promise<mockI2cBus> {
        return new Promise<mockI2cBus>((resolve, reject) => {
            setTimeout(() => { resolve(new mockI2cBus(busNumber, options)); }, 100);
        });
    }
}
class mockI2cBus {
    public busNumber: number;
    public isMock = true;
    public options;
    private isOpen: boolean;
    private funcs = new mockI2cFuncs(3);
    constructor(busNumber, options) { this.busNumber = busNumber; this.options = options; }
    public bus() { return {}; }
    public close(): Promise<void> { return Promise.resolve(); }
    public i2cFuncs(): Promise<mockI2cFuncs> { return Promise.resolve(this.funcs); }
    public scanSync(startAddr: number = 3, endAddr: number = 115): Promise<number[]> { return Promise.resolve([15 + this.busNumber, 19 + this.busNumber, 97 + this.busNumber, 98 + this.busNumber, 99 + this.busNumber, 100 + this.busNumber, 101 + this.busNumber, 102 + this.busNumber, 105 + this.busNumber]); }
    public scan(startAddr: number = 3, endAddr: number = 115): Promise<number[]> { return Promise.resolve([15 + this.busNumber, 19 + this.busNumber, 97 + this.busNumber, 98 + this.busNumber, 99 + this.busNumber, 100 + this.busNumber, 101 + this.busNumber, 102 + this.busNumber, 105 + this.busNumber]); }
    public deviceId(addr: number): Promise<{ manufacturer: number, product: number, name: string }> { return Promise.resolve({ manufacturer: 0, product: 0, name: 'Mock product' }); }
    public i2cRead(addr: number, length: number, buffer: Buffer): Promise<{ bytesRead: number, buffer: Buffer }> { return Promise.resolve({ bytesRead: length, buffer: buffer }); }
    public i2cWrite(addr: number, length: number, buffer: Buffer): Promise<{ bytesWritten: number, buffer: Buffer }> { return Promise.resolve({ bytesWritten: length, buffer: buffer }); }
    public readByte(addr: number, cmd: number): Promise<number> { return Promise.resolve(0); }
    public readWord(addr: number, cmd: number): Promise<number> { return Promise.resolve(0); }
    public readI2cBlock(addr: number, cmd: number, length: number, buffer: Buffer): Promise<{ bytesRead: number, buffer: Buffer }> { return Promise.resolve({ bytesRead: length, buffer: buffer }); }
    public receiveByte(addr: number): Promise<number> { return Promise.resolve(0); }
    public sendByte(addr: number, byte: number): Promise<void> { return Promise.resolve(); }
    public writeByte(addr: number, cmd: number, byte: number): Promise<void> { return Promise.resolve(); }
    public writeWord(add: number, cmd: number, word: number): Promise<void> { return Promise.resolve(); }
    public writeQuick(add: number, bit: number): Promise<void> { return Promise.resolve(); }
    public writeI2cBlock(addr: number, cmd: number, length: number, buffer: Buffer): Promise<{ bytesWritten: number, buffer: Buffer }> { return Promise.resolve({ bytesWritten: length, buffer: buffer }); }
}
export class i2cDeviceBase implements IDevice {
    public static async factoryCreate(i2c, dev: I2cDevice): Promise<i2cDeviceBase> {
        try {
            let dt = dev.getDeviceType();
            if (typeof dt === 'undefined') return Promise.reject(new Error(`Cannot initialize I2c device id${dev.id} on Bus ${i2c.busNumber}: Device type not found ${dev.typeId}`));
            let d = await i2cDeviceFactory.createDevice(dt.module, dt.deviceClass, i2c, dev);
            if (typeof d !== 'undefined') {
                d.category = dt.category;
                d.initialized = false;
                webApp.emitToClients('i2cDeviceStatus', { busNumber: i2c.busNumber, id: dev.id, address: dev.address, status: d.status, intialized: d.initialized, device: dev.getExtended() });
                if (await d.initAsync(dt)) {
                    d.initialized = true;
                    logger.info(`Device ${dt.name} initialized for i2c bus #${i2c.busNumber} address ${dev.address}`);
                    webApp.emitToClients('i2cDeviceStatus', { busNumber: i2c.busNumber, id: dev.id, address: dev.address, status: d.status, intialized: d.initialized, device: dev.getExtended() });
                }
            }
            return Promise.resolve(d);
        }
        catch (err) { logger.error(err); }
    }
    constructor(i2c, dev: I2cDevice) {
        this.i2c = i2c;
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
    public i2c;
    public device: I2cDevice;
    public lastComm: number;
    public get deviceStatus(): DeviceStatus { return { name: this.device.name, category: this.category, hasFault: utils.makeBool(this.hasFault), status: this.status, lastComm: this.lastComm, protocol: 'i2c', busNumber: this.i2c.busNumber, address: this.device.address } }
    public async closeAsync(): Promise<void> {
        try {
            logger.info(`Stopped I2c ${this.device.name}`);
            return Promise.resolve();
        }
        catch (err) { logger.error(err); return Promise.resolve(); }
    }
    public async initAsync(deviceType: any): Promise<boolean> { this.category = deviceType.category; return Promise.resolve(true); }
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
                conn.resetDeviceTriggers(`i2c:${this.i2c.busId}:${this.device.id}`);
            }
        } catch (err) { return logger.error(`Error resetting trigger for device.`); }
    }
    public getValue(prop, val?: any) {
        try {
            let replaceSymbols = /(?:\]\.|\[|\.)/g
            let _prop = prop.replace(replaceSymbols, ',').split(',');
            let v = typeof val !== 'undefined' ? val : this.device.values;
            for (let i = 0; i < _prop.length; i++) {
                v = v[_prop[i]];
            }
            return v;
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
        desc.push({ type: 'i2c', isActive: this.device.isActive, name: this.device.name, binding: `i2c:${this.i2c.busId}:${this.device.id}`, category: typeof dev !== 'undefined' ? dev.category : 'unknown', feeds: this.device.feeds.get() });
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
}
export let i2c = new i2cController();
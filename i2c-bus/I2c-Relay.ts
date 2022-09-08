import { logger } from "../logger/Logger";
import { vMaps, valueMap, utils } from "../boards/Constants";
import { setTimeout, clearTimeout } from "timers";
import * as extend from "extend";
import { Buffer } from "buffer";
import { i2cDeviceBase } from "./I2cBus";
import { webApp } from "../web/Server";
import { I2cDevice, DeviceBinding } from "../boards/Controller";
import { isArray } from "util";
import { LatchTimers } from "../devices/AnalogDevices";

export class i2cRelay extends i2cDeviceBase {
    protected static controllerTypes = [
        { name: 'mcp23017', desc: 'MCP23017 Based', options: { idType: 'bit', maxRelays: 16 }},
        { name: 'mcp23008', desc: 'MCP23008 Based', options: { idType: 'bit', maxRelays: 8 } },
        { name: 'pcf8574', desc: 'PCF8574 Based', options: { idType: 'pcf857x', maxRelays: 8 }},
        { name: 'pcf8575', desc: 'PCF8575 Based', options: { idType: 'pcf857x', maxRelays: 16 } },
        { name: 'seeed', desc: 'Seeed Studio', options: { idType: 'bit', maxRelays: 8}},
        { name: 'dockerPi4', desc: 'Docker Pi 4', options: { idType: 'ordinal', maxRelays: 4 } },
        { name: 'sequent4', desc: 'Sequent 4', options: { idType: 'sequent4', maxRelays: 4 }   },
        { name: 'sequent8', desc: 'Sequent 8 v2.x', options: { idType: 'sequent8', maxRelays: 8 } },
        { name: 'sequent8v3', desc: 'Sequent 8 v3.0+', options: {idType: 'sequent8', maxRelays: 8 }},
        { name: 'sequent8IND', desc: 'Sequent 8 IND', options: { idType: 'sequent8', maxRelays: 8 }}
    ]
    protected static commandBytes = {
        mcp23017: {
            read: [0x12, 0x13],
            write: [0x14, 0x15],
            config: [
                { name: 'IODIRA', register: 0x00, desc: 'I/O direction for 1-8' },
                { name: 'IODIRB', register: 0x01, desc: 'I/O direction for 9-16' },
                { name: 'IPOLA', register: 0x02, desc: 'Input polarity for 1-8' },
                { name: 'IPOLB', register: 0x03, desc: 'Input polarity for 9-16' },
                { name: 'GPINTENA', register: 0x04, desc: 'Interrupt on-change for 1-8' },
                { name: 'GPINTENB', register: 0x05, desc: 'Interrupt on-change for 9-16' },
                { name: 'DEFVALA', register: 0x06, desc: 'Default interrupt value for 1-8' },
                { name: 'DEFVALB', register: 0x07, desc: 'Default interrupt value for 9-16' },
                { name: 'INTCONA', register: 0x08, desc: 'Interrupt control register for 1-8.  If 0 then interrupt fired on change else it is fired when matches DEFVAL' },
                { name: 'INTCONB', register: 0x09, desc: 'Interrupt control register for 9-16.  If 0 then interrupt fired on change else it is fired when matches DEFVAL' },
                { name: 'IOCONA', register: 0x0a, desc: 'I/O control 1-8 per mcp23017 datasheet.  This determines whether in byte mode or sequential mode' },
                { name: 'IOCONB', register: 0x0b, desc: 'I/O control 9-16 per mcp23017 datasheet.  This determines whether in byte mode or sequential mode' },
                { name: 'GPPUA', register: 0x0c, desc: 'Pull up resistor for 1-8' },
                { name: 'GPPUB', register: 0x0d, desc: 'Pull up resistor for 9-16' },
                { name: 'INTFA', register: 0x0e, desc: 'Interrupt condition for 1-8' },
                { name: 'INTFB', register: 0x0f, desc: 'Interrupt condition for 9-16' },
                { name: 'INTCAPA', register: 0x10, desc: 'Interrupt capture at the time the interrupt occurred for 1-8' },
                { name: 'INTCAPB', register: 0x11, desc: 'Interrupt capture at the time the interrupt occurred for 9-16' },
                { name: 'OLATA', register: 0x14, desc: 'Output latches for 1-8' },
                { name: 'OLATB', register: 0x15, desc: 'Output latches for 9-16' }
            ]
        },
        mcp23008: {
            read: [0x09],
            write: [0x0a],
            config: [
                { name: 'IODIR', register: 0x00, desc: 'I/O directions for 1-8' },
                { name: 'IOPOL', register: 0x01, desc: 'Input polarity for 1-8' },
                { name: 'GPINTEN', register: 0x02, desc: 'Interrupt on change for 1-8' },
                { name: 'DEFVAL', register: 0x03, desc: 'Default interrupt value for 1-8' },
                { name: 'INTCON', register: 0x04, desc: 'Interrupt control register for 1-8.  If 0 then interrupt fired on change else it is fired when matches DEFVAL' },
                { name: 'IOCON', register: 0x05, desc: 'I/O control per mcp23008 datasheet.  This determines whether in byte mode or sequential mode' },
                { name: 'GPPU', register: 0x06, desc: 'Pull up resistor for 1-8' },
                { name: 'INTF', register: 0x07, desc: 'Interrupt condition for 1-8' },
                { name: 'INTCAP', register: 0x08, desc: 'Interrupt capture at the time the interrupt occurred for 1-8' },
                { name: 'OLAT', register: 0x0a, desc: 'Output latches for 1-8' },
            ]
        },
        sequent4: {
            read: [0x01],
            write: [0x01],
            config: [
                {name:'CFG', register: 0x03, desc: 'Configuration register for the relay'}
            ]
        },
        sequent8: {
            state: [0x01],
            write: [0x01],
            config: [
                { name: 'CFG', register: 0x03, desc: 'Configuration register for the relay' }
            ]
        },
        sequent8v3: {
            state: [0x01],
            write: [0x01],
            config: [
                { name: 'CFG', register: 0x03, desc: 'Configuration register for the relay' }
            ]
        },
        sequent8IND: {
            state: [0x01],
            write: [0x01],
            config: [
                { name: 'CFG', register: 0x03, desc: 'Configuration register for the relay' }
            ]
        },
        pcf8574: {
            read: [], write: [], config: [
                { name: 'P0x', register: 0x00, desc: 'I/O value 1-8' }
            ]
        }, // There are no configuration, read, or write bytes for the PCF series
        pcf8575: {
            read: [], write: [], config: [
                { name: 'P0x', register: 0x00, desc: 'I/O value 1-8' },
                { name: 'P1x', register: 0x00, desc: 'I/O value 9-16' }
            ]
        },
        seeed: { read: [0x06], write: [0x06], config: [] }
    };
    protected _latchTimers = {};
    protected latches = new LatchTimers();
    protected _relayBitmask1 = 0;
    protected _relayBitmask2 = 0;
    public get relays() { return typeof this.values.relays === 'undefined' ? this.values.relays = [] : this.values.relays; }
    public set relays(val) { this.values.relays = val; }
    protected getReadCommandByte(ord: number): number {
        let arr = i2cRelay.commandBytes[this.device.options.controllerType];
        return typeof arr !== 'undefined' && typeof arr.read !== 'undefined' && arr.read.length > ord ? arr.read[ord] : undefined;
    }
    protected getWriteCommandByte(ord: number): number {
        let arr = i2cRelay.commandBytes[this.device.options.controllerType];
        return typeof arr !== 'undefined' && typeof arr.write !== 'undefined' && arr.write.length > ord ? arr.write[ord] : undefined;
    }
    protected async initRegisters() {
        try {
            switch (this.device.options.controllerType) {
                case 'pcf8574':
                case 'pcf8575':
                    // There are no config registers for the is IO extender but we will be pushing these on the interface.
                    let cb = i2cRelay.commandBytes[this.device.options.controllerType] || { state: [], init: [], config: [] };
                    if (typeof this.device.info.registers === 'undefined') this.device.info.registers = [];
                    let regP0 = this.device.info.registers.find(elem => elem.name === 'P0x');
                    if (typeof regP0 === 'undefined') {
                        regP0 = extend({ name: 'P0x', register: 0x00, desc: 'I/0 value 1-8', value: 0x00 }, cb.config.find(elem => elem.name === 'P0x'));
                        this.device.info.registers.push(regP0);
                    }
                    for (let i = 0; i < 8 && i < this.relays.length; i++) {
                        let relay = this.relays[i];
                        if (relay.enabled && relay.state === true) regP0.value |= (1 << (relay.id - 1));
                    }
                    if (this.device.options.controllerType === 'pcf8575') {
                        // There are no configuration registers to initialize for these.
                        let regP1 = this.device.info.registers.find(elem => elem.name === 'P1x');
                        if (typeof regP1 === 'undefined') {
                            regP0 = extend({ name: 'P1x', register: 0x00, desc: 'I/0 value 9-16', value: 0x00 }, cb.config.find(elem => elem.name === 'P1x'));
                            this.device.info.registers.push(regP0);
                        }
                        for (let i = 8; i < 16 && i < this.relays.length; i++) {
                            let relay = this.relays[i];
                            if (relay.enabled && relay.state === true) regP1.value |= (1 << (relay.id - 8));
                        }
                    }
                    break;
                case 'mcp23017':
                    // Set the registers to output for all the relays we have.
                    {
                        // Set byte mode for I/O control.
                        //await this.sendCommand([0x0a, 0x00]);
                        // Bit value of 0 = output (what we need to control a relay) and bit value 1 = input.
                        await this.readConfigRegisters();
                        
                        let regA = this.device.info.registers.find(elem => elem.name === 'IODIRA') || { value: 0x00 };
                        let regB = this.device.info.registers.find(elem => elem.name === 'IODIRB') || { value: 0x00 };
                        if (this.i2c.isMock) { regA.value = 0xFF; regB.value = 0xFF; }
                        for (let i = 0; i < this.relays.length; i++) {
                            let relay = this.relays[i];
                            if (utils.makeBool(relay.enabled)) {
                                // Set the bit to 0 for output.
                                (i < 8) ? regA.value &= ~(1 << i) : regB.value &= ~(1 << (i - 8));
                            }
                        }
                        logger.info(`Setting config register ${regA.name} ${regA.value}`);
                        logger.info(`Setting config register ${regB.name} ${regB.value}`);
                        await this.sendCommand([regA.register, regA.value]);
                        await this.sendCommand([regB.register, regB.value]);
                        if(!this.i2c.isMock) await this.readConfigRegisters();
                    }
                    break;
                case 'mcp23008':
                    await this.readConfigRegisters();
                    {
                        let reg = this.device.info.registers.find(elem => elem.name === 'IODIR') || { value: 0x00 };
                        if (this.i2c.isMock) reg.value = 0xFF;
                        for (let i = 0; i < this.relays.length; i++) {
                            let relay = this.relays[i];
                            if (utils.makeBool(relay.enabled)) {
                                reg.value &= ~(1 << i);
                            }
                        }
                        await this.sendCommand([reg.register, reg.value]);
                        if (!this.i2c.isMock) await this.readConfigRegisters();
                    }
                    break;
                case 'sequent8':
                case 'sequent4':
                case 'sequent8IND':
                case 'sequent8v3':
                    {
                        await this.readConfigRegisters();
                        let reg = this.device.info.registers.find(elem => elem.name === 'CFG') || { value: 0x00 };
                        if (reg.value !== 0) {
                            await this.sendCommand([reg.register, 0]);
                            await this.readConfigRegisters();
                        }
                    }
                    break;
                default:
                    break;
            }
            webApp.emitToClients('i2cDeviceInformation', { bus: this.i2c.busNumber, address: this.device.address, options: { deviceInfo: this.device.info } });

        } catch (err) { logger.error(`Error Initializing ${this.device.name} registers.`); this.hasFault = true; }
    }
    protected async readConfigRegisters() {
        try {
            let cb = i2cRelay.commandBytes[this.device.options.controllerType] || { state: [], init: [] };
            switch (this.device.options.controllerType) {
                default:
                    this.device.info.registers = [];
                    for (let i = 0; i < cb.config.length; i++) {
                        let cfg = cb.config[i];
                        let byte = await this.readCommand(cfg.register);
                        this.device.info.registers.push(extend({}, cfg, { value: byte }));
                    }
                    break;
            }

        } catch (err) { logger.error(`Error Initializing ${this.device.name} registers.`); this.hasFault = true; }

    }
    protected _timerRead: NodeJS.Timeout;
    protected toHexString(bytes: number[]) { return bytes.reduce((output, elem) => (output + '0x' + ('0' + elem.toString(16)).slice(-2)) + ' ', ''); }
    protected async sendCommand(command: number[]): Promise<{ bytesWritten: number, buffer: Buffer }> {
        try {
            let buffer = Buffer.from(command);
            let w = await this.i2c.writeCommand(this.device.address, buffer);
            logger.debug(`Executed send command ${this.toHexString(command)} bytes written:${w}`);
            this.hasFault = false;
            return Promise.resolve(w);
        }
        catch (err) { logger.error(`${this.device.address} ${command}: ${err.message}`); this.hasFault = true; }
    }
    protected async readCommand(command: number): Promise<number> {
        try {
            let r = await this.i2c.readByte(this.device.address, command);
            logger.debug(`${this.device.address} - ${this.device.name} Executed read command ${'0x' + ('0' + command.toString(16)).slice(-2)} byte read:${'0x' + ('0' + r.toString(16)).slice(-2)}`);
            this.hasFault = false;
            return Promise.resolve(r);
        }
        catch (err) {
            logger.error(`${this.device.address} - ${this.device.name} Bus #${this.i2c.busNumber} Read Command: ${ err.message }`); this.hasFault = true; }
    }
    protected async readBuffer(bytes:number): Promise<{ bytesRead: number, buffer: Buffer }> {
        try {
            let r: { bytesRead: number, buffer: Buffer } = await this.i2c.read(this.device.address, bytes);
            logger.debug(`${this.device.address} - ${this.device.name} Executed read buffer 0x${this.device.address.toString(16)} ${r.bytesRead} [${r.buffer.join(',')}]`);
            return r;
        } catch(err) { logger.error(`${this.device.address} - ${this.device.name} Bus #${this.i2c.busNumber} ReadBuffer: ${err.message}`); this.hasFault = true; }
    }
    protected async writeBuffer(bytes: number, buffer: Buffer): Promise<{ bytesWritten: number, buffer: Buffer }> {
        try {
            let r: { bytesWritten: number, buffer: Buffer } = await this.i2c.write(this.device.address, bytes, buffer);
            logger.debug(`${this.device.address} - ${this.device.name} Executed write buffer 0x${this.device.address.toString(16)} ${ r.bytesWritten }[${ r.buffer.join(',') }]`);
            return r;
        } catch (err) { logger.error(`${this.device.address} - ${this.device.name} Bus #${this.i2c.busNumber} ReadBuffer: ${err.message}`); this.hasFault = true; }
    }

    protected async readWord(): Promise<number> {
        try {
            let r = await this.readBuffer(2);
            return r.buffer.readUInt16LE();
        }
        catch (err) { logger.error(`${this.device.address} - ${this.device.name} Bus #${this.i2c.busNumber} ReadWord: ${err.message}`); this.hasFault = true; }
    }
    protected async readByte(): Promise<number> {
        try {
            let r = await this.readBuffer(1);
            return r.buffer.readUInt8();
        }
        catch (err) { logger.error(`${this.device.address} - ${this.device.name} Bus #${this.i2c.busNumber} ReadByte: ${err.message}`); this.hasFault = true; }
    }
    protected async writeWord(word: number): Promise<{ bytesWritten: number, buffer: Buffer }> {
        try {
            let buffer = Buffer.from([word & 0xFF, (word >> 8) & 0xFF]);
            let r = await this.writeBuffer(2, buffer);
            return r;
        }
        catch (err) { logger.error(`${this.device.address} writeWord: ${err.message}`); this.hasFault = true; }
    }
    protected async writeByte(byte: number): Promise<{ bytesWritten: number, buffer: Buffer }> {
        try {
            let buffer = Buffer.from([byte & 0xFF]);
            let r = await this.writeBuffer(1, buffer);
            return r;
        }
        catch (err) { logger.error(`${this.device.address} writeByte: ${err.message}`); this.hasFault = true; }
    }

    public async emitFeeds() {
        try {
            for (let i = 0; i < this.feeds.length; i++) {
                await this.feeds[i].send(this);
            }
        } catch (err) { logger.error(err); }
    }
    public getValue(prop: string) : any {
        let name = prop.toLowerCase();
        if (name === 'relayvalall') {
            let vals = [];
            for (let i = 0; i < this.relays.length; i++) {
                vals.push(this.relays[i].state);
            }
            return vals;
        }
        else if (name.startsWith('relayval')) {
            let ord = parseInt(name.substring(8), 10);
            if (!isNaN(ord) && this.relays.length > ord) {
                logger.verbose(`Get Relay Value ${this.relays[ord - 1].state}`)
                return this.relays[ord - 1].state;
            }
            else {
                logger.error(`Error getting ${this.device.name} relay value for ${prop}`);
            }
        }
        else if (name.startsWith('relayobj')) {
            let ord = parseInt(name.substring(8), 10);
            if (!isNaN(ord) && this.relays.length > ord) {
                return this.relays[ord - 1];
            }
            else {
                logger.error(`Error getting ${this.device.name} relay object for ${prop}`);
            }
        }
    }
    public async stopReadContinuous() {
        if (typeof this._timerRead !== 'undefined')
            clearTimeout(this._timerRead);
        return Promise.resolve();
    }
    public async readContinuous(): Promise<boolean> {
        try {
            if (this._timerRead) clearTimeout(this._timerRead);
            if (this.device.isActive) await this.readAllRelayStates();
            this._timerRead = setTimeout(() => { this.readContinuous(); }, this.device.options.readInterval || 500);
            return Promise.resolve(true);
        }
        catch (err) { logger.error(err); }
    }
    protected makeStartupBitmasks(orig: number[]) {
        let bytes = [];
        for (let i = 0; i < this.relays.length; i++) {
            let r = this.relays[i];
            let ord = Math.floor((r.id - 1) / 8);
            if (ord + 1 > bytes.length) bytes.push(0);
            let state = false;
            
            let bm = (1 << (((r.id - (ord * 8)) - 1)));
            if (r.initState === 'on') state = true;
            else if (r.initState === 'off') state = false;
            else if (r.initState === 'last') state = utils.makeBool(r.state);
            else {
                if (orig.length > ord) {
                    state = (orig[ord] & bm) > 0;
                    if (r.invert === true) state = !state;
                }
            }
            let target = r.invert === true ? !utils.makeBool(state) : utils.makeBool(state);
            if (target) bytes[ord] |= bm;
        }
        return bytes;
    }
    protected async initRelayStates() {
        this.relays.sort((a, b) => { return a.id - b.id; });
        try {
            let bytes: number[] = [];
            let orig: number[] = [];
            switch (this.options.idType) {
                case 'sequent8':
                    // 8relind-rpi -- sequent8IND
                    //relayMaskRemap = [0x01, 0x04, 0x40, 0x10, 0x20, 0x80, 0x08, 0x02]
                    //relayChRemap = [0, 2, 6, 4, 5, 7, 3, 1]
                    
                    // 8relay-rpi -- sequent8v3
                    //relayMaskRemap = [0x01, 0x04, 0x02, 0x08, 0x40, 0x10, 0x20, 0x80]
                    //relayChRemap = [0, 2, 1, 3, 6, 4, 5, 7]

                    // relay8-rpi -- sequent8 
                    //relayMaskRemap = [0x01, 0x02, 0x04, 0x08, 0x80, 0x40, 0x20, 0x10]
                    //relayChRemap = [0, 1, 2, 3, 7, 6, 5, 4]
                    let map = [0x01, 0x02, 0x04, 0x08, 0x80, 0x40, 0x20, 0x10];
                    switch (this.options.controllerType) {
                        case 'sequent8v3':
                            map = [0x01, 0x04, 0x02, 0x08, 0x40, 0x10, 0x20, 0x80];
                            break;
                        case 'sequent8IND':
                            map = [0x01, 0x04, 0x40, 0x10, 0x20, 0x80, 0x08, 0x02];
                            break;
                    }
                    orig.push(this.decodeSequent(await this.readCommand(0x00), map));
                    bytes = this.makeStartupBitmasks(orig);
                    await this.sendCommand([0x01, this.encodeSequent(bytes[0], map)]);
                    if (this.i2c.isMock) this._relayBitmask1 = this.encodeSequent(bytes[0], map);
                    break;
                case 'sequent4':
                    orig.push(this.decodeSequent(await this.readCommand(0x00), [0x80, 0x40, 0x20, 0x10]));
                    bytes = this.makeStartupBitmasks(orig);
                    await this.sendCommand([0x01, this.encodeSequent(bytes[0], [0x80, 0x40, 0x20, 0x10])]);
                    if (this.i2c.isMock) this._relayBitmask1 = this.encodeSequent(bytes[0], [0x80, 0x40, 0x20, 0x10]);
                    break;
                case 'pcf857x':
                    {
                        this.relays.sort((a, b) => { return a.id - b.id; });
                        let bitmask = 0;
                        if (this.i2c.isMock) {
                            let regP0 = this.device.info.registers.find(elem => elem.name === 'P0x');
                            let regP1 = this.device.info.registers.find(elem => elem.name === 'P1x');
                            if (typeof regP0 !== 'undefined') bitmask = regP0.value;
                            if (typeof regP1 !== 'undefined') bitmask |= (regP1.value << 8);
                        }
                        else
                            bitmask = this.options.controllerType === 'pcf8574' ? await this.readByte() : await this.readWord();
                        orig.push(bitmask & 0xFF);
                        orig.push((bitmask >> 8) & 0xFF);
                        bytes = this.makeStartupBitmasks(orig);
                        if (this.i2c.isMock) {
                            this._relayBitmask1 = bytes[0];
                            if (bytes.length > 1) {
                                this._relayBitmask2 = bytes[1];
                            }
                        }
                        else if (this.options.controllerType === 'pcf8574') {
                            await this.writeByte(bytes[0]);
                        }
                        else {
                            await this.writeWord((bytes[1] << 8) + (bytes[0] & 0xFF));
                        }
                        webApp.emitToClients('i2cDeviceInformation', { bus: this.i2c.busNumber, address: this.device.address, info: { registers: this.device.info.registers } });
                        await this.readAllRelayStates();
                    }
                    break;
                case 'bit':
                    this.relays.sort((a, b) => { return a.id - b.id; });
                    for (let i = 0; i < this.relays.length; i++) {
                        let relay = this.relays[i];
                        // Get the byte map data from the controller.
                        let ord = Math.floor((relay.id - 1) / 8);
                        if (ord + 1 > orig.length) {
                            let cmdByte = this.getReadCommandByte(ord);
                            orig.push(await this.readCommand(cmdByte));
                        }
                    }
                    bytes = this.makeStartupBitmasks(orig);
                    for (let i = 0; i < bytes.length; i++) {
                        await this.sendCommand([this.getWriteCommandByte(i), bytes[i]]);
                        if (this.i2c.isMock) {
                            this[`_relayBitmask${i + 1}`] = bytes[i];
                            await this.readAllRelayStates();
                        }
                    }
                    break;
                default:
                    for (let i = 0; i < this.relays.length; i++) {
                        let r = this.relays[i];
                        let state = false;
                        if (r.initState === 'on') state = true;
                        else if (r.initState === 'off') state = false;
                        else if (r.initState === 'last') state = utils.makeBool(r.state);
                        else {
                            let byte = await this.readCommand(r.id);
                            state = byte > 0
                        }
                        if (r.invert === true) state = !state;
                        await this.sendCommand([r.id, state ? 255 : 0]);
                        if (this.i2c.isMock) r.state = state;
                    }
                    break;
            }
        } catch (err) { logger.error(`Error initializing relay states ${this.device.name}`); }
    }
    public async initAsync(deviceType): Promise<boolean> {
        try {
            let ctype = i2cRelay.controllerTypes.find(elem => this.options.controllerType === elem.name);
            if (typeof ctype !== 'undefined') {
                this.options.maxRelays = ctype.options.maxRelays;
                this.options.idType = ctype.options.idType;
                if (this.relays.length !== this.options.maxRelays) {
                    for (let i = 0; i < this.options.maxRelays; i++) {
                        if (typeof this.relays[i] === 'undefined') this.relays.push({ name: `Relay #${i + 1}`, enabled: false, state: false });
                    }
                    this.relays.length = this.options.maxRelays;
                }
            }
            if (this._timerRead) clearTimeout(this._timerRead);
            if (typeof this.device.options === 'undefined') this.device.options = {};
            // Temporary for now so we can move all the relays from the options object to values.
            if (typeof this.device.options.relays !== 'undefined' &&
                (typeof this.device.values.relays === 'undefined' || this.device.values.relays.length === 0)) {
                this.relays = this.device.options.relays;
                this.device.options.relays = undefined;
            }
            if (typeof this.device.options.name !== 'string' || this.device.options.name.length === 0) this.device.name = this.device.options.name = deviceType.name;
            else this.device.name = this.device.options.name;
            if (typeof this.device.options.idType === 'undefined' || this.device.options.idType.length === 0) this.device.options.idType = 'bit';
            if (this.device.isActive) {
                await this.initRegisters();
                await this.initRelayStates();
            }
            this.readContinuous();
            return Promise.resolve(true);
        }
        catch (err) { logger.error(err); return Promise.resolve(false); }
    }
    public async readAllRelayStates(): Promise<boolean> {
        try {
            switch (this.device.options.idType) {
                case 'sequent4':
                    {
                        let byte = await this.readCommand(0x03);
                        if (byte !== 0) {
                            await this.sendCommand([0x03, 0x00]);
                            await this.sendCommand([0x01, 0x00]);
                        }
                        byte = await this.readCommand(0x00);
                        if (this.i2c.isMock) byte = this._relayBitmask1;
                        byte = this.decodeSequent(byte, [0x80, 0x40, 0x20, 0x10]);
                        this.relays.sort((a, b) => { return a.id - b.id; });
                        for (let i = 0; i < this.relays.length; i++) {
                            let relay = this.relays[i];
                            let state = utils.makeBool(byte & (1 << (relay.id - 1)));
                            if (relay.invert === true) state = !state;
                            if (state !== relay.state) {
                                relay.state = state;
                                webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, relayStates: [relay] });
                            }
                        }
                    }
                    break;
                case 'sequent8':
                    {
                        let byte = await this.readCommand(0x03);
                        if (byte !== 0) {
                            await this.sendCommand([0x03, 0x00]);
                            await this.sendCommand([0x01, 0x00]);
                        }
                        byte = await this.readCommand(0x00);
                        let map = [0x01, 0x02, 0x04, 0x08, 0x80, 0x40, 0x20, 0x10];
                        switch (this.options.controllerType) {
                            case 'sequent8v3':
                                map = [0x01, 0x04, 0x02, 0x08, 0x40, 0x10, 0x20, 0x80];
                                break;
                            case 'sequent8IND':
                                map = [0x01, 0x04, 0x40, 0x10, 0x20, 0x80, 0x08, 0x02];
                                break;
                        }

                        if (this.i2c.isMock) byte = this._relayBitmask1;
                        byte = this.decodeSequent(byte, map);
                        this.relays.sort((a, b) => { return a.id - b.id; });
                        for (let i = 0; i < this.relays.length; i++) {
                            let relay = this.relays[i];
                            let state = utils.makeBool(byte & (1 << (relay.id - 1)));
                            if (relay.invert === true) state = !state;
                            if (state !== relay.state) {
                                relay.state = state;
                                webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, relayStates: [relay] });
                            }
                        }
                    }
                    break;
                case 'pcf857x':
                    {
                        let bitmask = this.i2c.isMock ? ((this._relayBitmask2 || 0) << 8)  + this._relayBitmask1 : this.options.controllerType === 'pcf8574' ? await this.readByte() : await this.readWord();
                        this.relays.sort((a, b) => { return a.id - b.id; });
                        for (let i = 0; i < this.relays.length; i++) {
                            let relay = this.relays[i];
                            if (!utils.makeBool(relay.enabled)) continue;
                            let state = ((1 << i) & bitmask) > 0;
                            if (relay.invert === true) state = !state;
                            if (state !== relay.state) {
                                relay.state = state;
                                webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, relayStates: [relay] });
                            }
                        }
                        let regP0 = this.device.info.registers.find(elem => elem.name === 'P0x') || { value: 0x00 };
                        let regP1 = this.device.info.registers.find(elem => elem.name === 'P1x') || { value: 0x00 };
                        if (regP0.value !== (bitmask & 0xFF) || regP1.value !== (bitmask & 0xFF00) >> 8) {
                            regP0.value = bitmask & 0xFF;
                            regP1.value = (bitmask & 0xFF00) >> 8;
                            webApp.emitToClients('i2cDeviceInformation', { bus: this.i2c.busNumber, address: this.device.address, info: { registers: this.device.info.registers } });
                        }
                    }
                    break;
                case 'bit':
                    let bmVals = [];
                    // Force a sort so that it gets the correct address.
                    this.relays.sort((a, b) => { return a.id - b.id; });
                    for (let i = 0; i < this.relays.length; i++) {
                        let relay = this.relays[i];
                        if (!utils.makeBool(relay.enabled)) continue;
                        // Get the byte map data from the controller.
                        let bmOrd = Math.floor((relay.id - 1) / 8);
                        let cmdByte = this.getReadCommandByte(bmOrd);
                        if (bmOrd + 1 > bmVals.length) {
                            if (this.i2c.isMock) bmVals.push(bmOrd === 0 ? this._relayBitmask1 : this._relayBitmask2);
                            else bmVals.push(await this.readCommand(cmdByte));
                        }
                        let byte = bmVals[bmOrd];
                        let state = utils.makeBool((byte & 1 << ((relay.id - (bmOrd * 8)) - 1)));
                        if (relay.invert === true) state = !state;
                        if (state !== relay.state) {
                            relay.state = state;
                            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, relayStates:[relay] });
                        }
                    }
                    break;
                default:
                    for (let i = 0; i < this.relays.length; i++) {
                        await this.readRelayState(this.relays[i]);
                    }
                    break;
            }
            return Promise.resolve(true);
        }
        catch (err) { return Promise.reject(err); }
    }
    public async readRelayState(relay): Promise<boolean> {
        let byte: number;
        let cmdByte = relay.id;
        try {
            switch (this.options.idType) {
                case 'sequent4':
                    {
                        let byte = await this.readCommand(0x03);
                        if (byte !== 0) {
                            await this.sendCommand([0x03, 0x00]);
                            await this.sendCommand([0x01, 0x00]);
                        }
                        // These come in the high nibble. Shift them to the low nibble.
                        byte = await this.readCommand(0x00);
                        if (this.i2c.isMock) byte = this._relayBitmask1;
                        byte = this.decodeSequent(byte, [0x80, 0x40, 0x20, 0x10]);
                        byte = byte & (1 << (relay.id - 1));
                    }
                    break;
                case 'sequent8':
                    {
                        let map = [0x01, 0x02, 0x04, 0x08, 0x80, 0x40, 0x20, 0x10];
                        switch (this.options.controllerType) {
                            case 'sequent8v3':
                                map = [0x01, 0x04, 0x02, 0x08, 0x40, 0x10, 0x20, 0x80];
                                break;
                            case 'sequent8IND':
                                map = [0x01, 0x04, 0x40, 0x10, 0x20, 0x80, 0x08, 0x02];
                                break;
                        }
                        let byte = await this.readCommand(0x03);
                        if (byte !== 0) {
                            await this.sendCommand([0x03, 0x00]);
                            await this.sendCommand([0x01, 0x00]);
                        }
                        // These come in the high nibble. Shift them to the low nibble.
                        byte = await this.readCommand(0x00);
                        if (this.i2c.isMock) byte = this._relayBitmask1;
                        byte = this.decodeSequent(byte, map);
                        byte = byte & (1 << (relay.id - 1));
                    }
                    break;
                case 'pcf857x':
                    {
                        let bitmask = this.i2c.isMock ? ((this._relayBitmask2 || 0) << 8) + this._relayBitmask1 : this.options.controllerType === 'pcf8574' ? await this.readByte() : await this.readWord();
                        byte = bitmask & (1 << (relay.id - 1));
                        let regP0 = this.device.info.registers.find(elem => elem.name === 'P0x') || { value: 0x00 };
                        let regP1 = this.device.info.registers.find(elem => elem.name === 'P1x') || { value: 0x00 };
                        regP0.value = bitmask & 0xFF;
                        regP1.value = (bitmask & 0xFF00) >> 8;
                        webApp.emitToClients('i2cDeviceInformation', { bus: this.i2c.busNumber, address: this.device.address, info: { registers: this.device.info.registers } });
                    }
                    break;
                case 'bit':
                    let bmOrd = Math.floor((relay.id - 1) / 8);
                    cmdByte = this.getReadCommandByte(bmOrd);
                    byte = await this.readCommand(cmdByte);
                    if (this.i2c.isMock) byte = bmOrd === 0 ? this._relayBitmask1 : this._relayBitmask2;
                    byte = byte & 1 << ((relay.id - (bmOrd * 8) - 1));
                    break;
                default:
                    byte = await this.readCommand(relay.id);
                    break;
            }
            if (typeof byte !== 'undefined') {
                let b = utils.makeBool(byte);
                if (relay.invert === true) b = !b;
                if (relay.state !== b) {
                    relay.state = b;
                    webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, relayStates: [relay] });
                }
            }
            return Promise.resolve(true);
        }
        catch (err) { return Promise.reject(err); }
    }
    public async setOptions(opts): Promise<any> {
        try {
            await this.stopReadContinuous();
            if (typeof opts.name !== 'undefined' && this.device.name !== opts.name) this.device.options.name = this.device.name = opts.name;
            if (typeof opts.readInterval === 'number') this.device.options.readInterval = opts.readInterval;
            if (typeof opts.relays !== 'undefined') {
                this.relays = opts.relays;
                await this.initRegisters();
            }
            if (typeof opts.controllerType !== 'undefined') this.device.options.controllerType = opts.controllerType;
            if (typeof opts.idType !== 'undefined') this.device.options.idType = opts.idType;
            this.readContinuous();
            Promise.resolve(this.device.options);
        }
        catch (err) { logger.error(err); Promise.reject(err); }
    }
    protected async setRelayOptions(arr) {
        try {
            for (let i = 0; i < arr.length; i++) {
                let t = this.relays.find(elem => elem.id == arr[i].id);
                if (typeof t !== 'undefined') {
                    utils.setObjectProperties(arr[i], t);
                }
            }
        } catch (err) { return Promise.reject(err); }
    }
    public async setValues(vals): Promise<any> {
        try {
            await this.stopReadContinuous();
            if (typeof vals.relays !== 'undefined') {
                this.relays = vals.relays;
                await this.initRegisters();
            }
            this.readContinuous();
            Promise.resolve(this.device.values);
        }
        catch (err) { logger.error(err); Promise.reject(err); }
    }
    public async closeAsync(): Promise<void> {
        try {
            this.initialized = false;
            await this.stopReadContinuous();
            await this.latches.close(true);
            await super.closeAsync();
            return;
        }
        catch (err) { return Promise.reject(err); }
    }
    protected encodeSequent(byte, map) { // To the IO byte
        let val = 0;
        for (let i = 0; i < map.length; i++) {
            if ((byte & (1 << i)) !== 0) val = val + map[i];
        }
        return val;
    }
    protected decodeSequent(byte, map) { // From the IO byte
        let val = 0;
        for (let i = 0; i < map.length; i++) {
            if ((byte & map[i]) !== 0)
                val = val + (1 << i);
        }
        return val;
    }
    public setValue(prop: string, value) {
        switch (prop) {
            case 'relayState':
                this.setRelayState(value);
                break;
        }
    }
    public async setRelayState(opts): Promise<{ id: number, name: string, state: boolean }> {
        try {
            let relay = this.relays.find(elem => { return elem.id === opts.id });
            let oldState = relay.state;
            let command: number[] = [];
            if (typeof relay === 'undefined') {
                return Promise.reject(new Error(`${this.device.name} - Invalid Relay id: ${opts.id}`));
            }
            let newState = utils.makeBool(opts.state);
            // Make the relay command.
            switch (this.options.idType) {
                case 'sequent8':
                    {
                        await this.readAllRelayStates();
                        let byte = 0x00;
                        // Byte is the current data from the relay board and the relays are in the lower 4 bits.
                        for (let i = 0; i < this.relays.length; i++) {
                            let r = this.relays[i];
                            let current = r.invert === true ? !utils.makeBool(r.state) : utils.makeBool(r.state);
                            if (relay.id === r.id) {
                                let target = r.invert === true ? !utils.makeBool(newState) : utils.makeBool(newState);
                                if (target) byte |= (1 << (r.id - 1));
                            }
                            else if (current)
                                byte |= (1 << (r.id - 1));
                        }
                        let map = [0x01, 0x02, 0x04, 0x08, 0x80, 0x40, 0x20, 0x10];
                        switch (this.options.controllerType) {
                            case 'sequent8v3':
                                map = [0x01, 0x04, 0x02, 0x08, 0x40, 0x10, 0x20, 0x80];
                                break;
                            case 'sequent8IND':
                                map = [0x01, 0x04, 0x40, 0x10, 0x20, 0x80, 0x08, 0x02];
                                break;
                        }
                        await this.sendCommand([0x01, this.encodeSequent(byte, map)]);
                        if (this.i2c.isMock) this._relayBitmask1 = this.encodeSequent(byte, map);
                        if (relay.state !== newState) {
                            relay.state = newState;
                            relay.tripTime = new Date().getTime();
                        }
                    }
                    break;
                case 'sequent4':
                    {
                        await this.readAllRelayStates();
                        let byte = 0x00;
                        // Byte is the current data from the relay board and the relays are in the lower 4 bits.
                        for (let i = 0; i < this.relays.length; i++) {
                            let r = this.relays[i];
                            let current = r.invert === true ? !utils.makeBool(r.state) : utils.makeBool(r.state);
                            if (relay.id === r.id) {
                                let target = r.invert === true ? !utils.makeBool(newState) : utils.makeBool(newState);
                                if(target) byte |= (1 << (r.id - 1));
                            }
                            else if (current)
                                byte |= (1 << (r.id - 1));
                        }
                        await this.sendCommand([0x01, this.encodeSequent(byte, [0x80, 0x40, 0x20, 0x10])]);
                        if (this.i2c.isMock) this._relayBitmask1 = this.encodeSequent(byte, [0x80, 0x40, 0x20, 0x10]);
                        if (relay.state !== newState) {
                            relay.state = newState;
                            relay.tripTime = new Date().getTime();
                        }
                    }
                    break;
                case 'pcf857x':
                    {
                        await this.readAllRelayStates();
                        let bitmask = 0x0000;
                        for (let i = 0; i < this.relays.length; i++) {
                            let r = this.relays[i];
                            let current = r.invert === true ? !utils.makeBool(r.state) : utils.makeBool(r.state);
                                if (relay.id === r.id) {
                                    let target = r.invert === true ? !utils.makeBool(newState) : utils.makeBool(newState);
                                    if (target) bitmask |= (1 << (r.id - 1));
                                }
                                else if (current)
                                bitmask |= (1 << (r.id - 1));
                        }
                        if (this.i2c.isMock) {
                            this._relayBitmask1 = bitmask & 0xFF;
                            if (this.options.controllerType !== 'pcf8574') this._relayBitmask2 = (bitmask & 0xFF00) >> 8;

                        }
                        else this.options.controllerType === 'pcf8574' ? await this.writeByte(bitmask) : await this.writeWord(bitmask);
                        if (relay.state !== newState) {
                            relay.state = newState;
                            relay.tripTime = new Date().getTime();
                        }
                    }
                    break;
                case 'bit':
                    // Make sure we have all the relay states up to date.
                    // MCP23017 uses 0x12 for port A (bmOrd 0) and 0x13 for port B (bmOrd 1).
                    // MCP23008 uses 0x09 for port A (bmOrd 0)
                    if (await this.readAllRelayStates()) {
                        let bmOrd = Math.floor((relay.id - 1) / 8);
                        let cmdByte = this.getWriteCommandByte(bmOrd);
                        let byte = 0x00;
                        for (let i = bmOrd * 8; i < this.relays.length && i < (bmOrd * 8) + 8; i++) {
                            let r = this.relays[i];
                            let current = r.invert === true ? !utils.makeBool(r.state) : utils.makeBool(r.state);
                            if (relay.id === r.id) {
                                let target = r.invert === true ? !utils.makeBool(newState) : utils.makeBool(newState);
                                if (target) byte |= (1 << (((r.id - (bmOrd * 8)) - 1)));
                            }
                            else if (current) {
                                byte |= (1 << (((r.id - (bmOrd * 8)) - 1)));
                            }
                        }
                        if (typeof cmdByte !== 'undefined') command.push(cmdByte);
                        command.push(byte);
                        if (this.i2c.isMock) bmOrd === 0 ? this._relayBitmask1 = byte : this._relayBitmask2 = byte;
                    }
                    break;
                default:
                    command.push(relay.id);
                    command.push((relay.invert === true ? !utils.makeBool(opts.state) : utils.makeBool(opts.state)) ? 255 : 0);
                    break;
            }
            if (command.length > 0) {
                await this.sendCommand(command);
                if (relay.state !== newState) {
                    relay.tripTime = new Date().getTime();
                }
                relay.state = newState;
            }
            if (relay.state !== oldState) webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, relayStates: [relay] });
            await this.emitFeeds();
            return Promise.resolve(relay);
        }
        catch (err) { return Promise.reject(err) };
    }
    public getDeviceDescriptions(dev) {
        let desc = [];
        let category = typeof dev !== 'undefined' ? dev.category : 'unknown';
        for (let i = 0; i < this.relays.length; i++) {
            let relay = this.relays[i];
            desc.push({ type: 'i2c', isActive: this.device.isActive, name: relay.name, binding: `i2c:${this.i2c.busId}:${this.device.id}:${relay.id}`, category: category });
        }
        return desc;
    }
    public async setDeviceState(binding: string | DeviceBinding, data: any): Promise<any> {
        try {
            
            let bind = (typeof binding === 'string') ? new DeviceBinding(binding) : binding;
            // We need to know what relay we are referring to.
            // i2c:1:24:3
            let relayId = parseInt(bind.params[0], 10);
            if (isNaN(relayId)) return Promise.reject(new Error(`setDeviceState: Invalid relay Id ${bind.params[0]}`));
            let relay = this.relays.find(elem => elem.id === relayId);
            if (typeof relay === 'undefined') return Promise.reject(new Error(`setDeviceState: Could not find relay Id ${bind.params[0]}`));
            if (!relay.enabled) return Promise.reject(new Error(`setDeviceState: Relay [${relay.name}] is not enabled.`));
            let latch = (typeof data.latch !== 'undefined') ? parseInt(data.latch, 10) : -1;
            if (isNaN(latch)) return Promise.reject(new Error(`setDeviceState: Relay [${relay.name}] latch data is invalid ${data.latch}.`));
            this.latches.clearLatch(relayId);
            await this.readRelayState(relay);
            // Now that the relay has been read lets set its state.
            let newState;
            switch (typeof data) {
                case 'boolean':
                    newState = data;
                    break;
                case 'number':
                    newState = data === 1 ? true : data === 0 ? false : relay.state;
                    break;
                case 'string':
                    switch (data.toLowerCase()) {
                        case 'tripped':
                        case 'true':
                        case 'on':
                        case '1':
                            newState = true;
                        case 'untripped':
                        case 'false':
                        case '0':
                        case 'off':
                            newState = false;
                            break;
                    }
                    break;
                case 'object':
                    if (Array.isArray(data) && data.length > 0) {
                        this.stopReadContinuous();
                        let nOffs = 0;
                        let nOns = 0;
                        // This is a sequence.
                        // [{isOn: true, timeout: 1000}, {isOn: false, timeout: 1000}]
                        let onDelay = relay.sequenceOnDelay || 0;
                        let offDelay = relay.sequenceOffDelay || 0;
                        for (let i = 0; i < data.length; i++) {
                            let seq = data[i];
                            let state = utils.makeBool(seq.state || seq.isOn);
                            if (!state) nOffs++;
                            else nOns++;
                            await this.setRelayState({ id: relayId, state: state });
                            //logger.info(`Sequencing relay: ${ relay.name } state: ${ state } delay: ${ seq.timeout + (state ? onDelay : offDelay) }`)
                            if (seq.timeout) await utils.wait(seq.timeout + (state ? onDelay : offDelay));
                            newState = state;
                        }
                        logger.info(`Sent a total of Ons:${nOns} and Offs:${nOffs} to relay`);
                        this.readContinuous();
                    }
                    else {
                        if (typeof data.state !== 'undefined') newState = utils.makeBool(data.state);
                        else if (typeof data.isOn !== 'undefined') newState = utils.makeBool(data.isOn);
                        else if (typeof data.isDiverted !== 'undefined') newState = utils.makeBool(data.isDiverted);
                        else newState = false;
                    }
                    break;
                default:
                    newState = typeof data.state !== 'undefined' ? utils.makeBool(data.state) : typeof data.isOn !== 'undefined' ? utils.makeBool(data.isOn) : false;
                    break;
            }
            let oldState = relay.state;
            if (newState !== oldState) {
                await this.setRelayState({ id: relayId, state: newState });
            }
            if (latch > 0) {
                this.latches.setLatch(relayId, async () => {
                    try {
                        await this.setRelayState({ id: relayId, state: !newState })
                        logger.warn(`Relay Latch timer expired ${relay.name}: ${latch}ms`);
                    } catch (err) { logger.error(`Error processing latch timer`); }
                }, latch);
                //let _lt = this._latchTimers[ordId];
                //if (typeof _lt !== 'undefined') clearTimeout(_lt);
                //this._latchTimers[ordId] = setTimeout(() => {
                //    this.setRelayState({ id: relayId, state: !newState });
                //}, latch);
            }
            return extend(true, {}, relay, { oldState: oldState, latchDuration: new Date().getTime() - relay.tripTime });
        } catch (err) { return Promise.reject(err); }
    }
    public async getDeviceState(binding: string | DeviceBinding): Promise<any> {
        try {
            let bind = (typeof binding === 'string') ? new DeviceBinding(binding) : binding;
            // We need to know what relay we are referring to.
            // i2c:1:24:3
            let relayId = parseInt(bind.params[0], 10);
            if (isNaN(relayId)) return Promise.reject(new Error(`getDeviceState: Invalid relay Id ${bind.params[0]}`));
            let relay = this.relays.find(elem => elem.id === relayId);
            if (typeof relay === 'undefined') return Promise.reject(new Error(`getDeviceState: Could not find relay Id ${bind.params[0]}`));
            if (!relay.enabled) return Promise.reject(new Error(`getDeviceState: Relay [${relay.name}] is not enabled.`));
            await this.readRelayState(relay);
            // Now that the relay has been read lets set its state.
            return relay.state;
        } catch (err) { return Promise.reject(err); }
    }
}
export class i2cRelayMulti extends i2cRelay {

}

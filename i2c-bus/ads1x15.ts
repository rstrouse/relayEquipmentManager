import { logger } from "../logger/Logger";
import { vMaps, valueMap, utils } from "../boards/Constants";
import { setTimeout, clearTimeout } from "timers";
import * as extend from "extend";
import { Buffer } from "buffer";
import { i2cDeviceBase } from "./I2cBus";
import { webApp } from "../web/Server";
import { I2cDevice, DeviceBinding } from "../boards/Controller";
import { send } from "process";

export class ads1x15 extends i2cDeviceBase {
    public get channels() { return typeof this.options.channels === 'undefined' ? this.options.channels = [] : this.options.channels; }
    public set channels(val) { this.options.channels = val; }
    private suspendPolling: boolean = false;
    private config(channel: any): number {
        channel.mux = ads1x15.mux[channel.id - 1];
        // config = 0 | 64 | 
        // 0x0183 = 387 // No comparator | 1600 samples per second | single-shot mode
        // gain = 1024
        // mux = 16384
        // START_CONVERSION = 32768
        // config = 50563

        // ADS1X15_REG_CONFIG_CQUE_NONE    (0x0003) 3 OK
        // ADS1X15_REG_CONFIG_CLAT_NONLAT  (0x0000) 0
        // ADS1X15_REG_CONFIG_CPOL_ACTVLOW (0x0000) 0
        // ADS1X15_REG_CONFIG_CMODE_TRAD   (0x0000) 0
        // ADS1X15_REG_CONFIG_MODE_SINGLE  (0x0100) 256 OK
        // 
        // RATE_ADS1015_1600SPS            (0x0080) 128 m_dataRate OK
        // GAIN_TWOTHIRDS                  (0x0000) 0 m_gain
        // ADS1X15_REG_CONFIG_PGA_2_048V   (0x0400) 1024 m_gain
        
        // ADS1X15_REG_CONFIG_MUX_SINGLE_0 (0x4000) 16384 OK
        // ADS1X15_REG_CONFIG_OS_SINGLE    (0x8000) 32768 OK



        let config = this.device.options.comparatorReadings // Set comparator readings (or disable)
            | this.device.options.comparatorLatchingMode    // Set latching mode
            | this.device.options.comparatorActiveMode      // Set active/ready mode
            | this.device.options.comparatorMode            // Set comparator mode
            | this.device.options.mode                      // Set operation mode (single, continuous)
            | this.device.options.sps                       // Set sample per seconds
            //| channel.pgaMask                               // Set PGA/voltage range
            | ads1x15.mux[channel.id - 1]                   // Set mux (channel or differential bit)
            | ads1x15.registers['SINGLE'];                   // Set 'start single-conversion' bit

        if (this.options.deviceType !== 'ads1015') config |= channel.pgaMask;
        return config;
    }
    protected static spsToMilliseconds = {
        ads1015: {
            128: 1000 / 128,
            250: 1000 / 250,
            490: 1000 / 490,
            920: 1000 / 920,
            1600: 1000 / 1600,
            2400: 1000 / 2400,
            3300: 1000 / 3300,
        },
        ads1115: {
            8: 1000 / 8,
            16: 1000 / 16,
            32: 1000 / 32,
            64: 1000 / 64,
            128: 1000 / 128,
            250: 1000 / 250,
            475: 1000 / 475,
            860: 1000 / 860,
        }
    };

    // Pointer Register
    protected static registers = {
        'CONVERT': 0x00,
        'CONFIG': 0x01,
        'LOWTHRESH': 0x02,
        'HITHRESH': 0x03,
        'SINGLE': 0x8000    // Write: Set to start a single-conversion
    }

    // Config Register

    // noinspection JSUnusedLocalSymbols
    private static OS_BUSY = 0x0000;      // Read: Bit = 0 when conversion is in progress
    // noinspection JSUnusedLocalSymbols
    private static OS_NOTBUSY = 0x8000;   // Read: Bit = 1 when device is not performing a conversion
    private static mux = {
        // 'DIFF_0_1': 0x0000, // Differential P = AIN0, N = AIN1 (default)
        // 'DIFF_0_3': 0x1000, // Differential P = AIN0, N = AIN3
        // 'DIFF_1_3': 0x2000, // Differential P = AIN1, N = AIN3
        // 'DIFF_2_3': 0x3000, // Differential P = AIN2, N = AIN3
        0: 0x4000, // Single-ended AIN0
        1: 0x5000, // Single-ended AIN1
        2: 0x6000, // Single-ended AIN2
        3: 0x7000  // Single-ended AIN3
    }
    public pga: valueMap = new valueMap([
        [6.144, { name: '6.144v', desc: '6.144v', pgaMask: 0x0000 }],
        [4.096, { name: '4.096v', desc: '4.196v', pgaMask: 0x0200 }],
        [2.048, { name: '2.048v', desc: '2.048v', pgaMask: 0x0400 }], // default
        [1.024, { name: '1.024v', desc: '1.024v', pgaMask: 0x0600 }],
        [0.512, { name: '0.512v', desc: '0.512v', pgaMask: 0x0800 }],
        [0.256, { name: '0.256v', desc: '0.256v', pgaMask: 0x0A00 }]
    ]);
    private static mode = {
        'CONTINUOUS': 0x0000, // Continuous conversion mode
        'SINGLE': 0x0100, // Power-down single-shot mode (default)
    }

    private static sps = {
        ads1015: {
            128: 0x0000, // 128 samples per second
            250: 0x0020, // 250 samples per second
            490: 0x0040, // 490 samples per second
            920: 0x0060, // 920 samples per second
            1600: 0x0080, // 1600 samples per second (default)
            2400: 0x00A0, // 2400 samples per second
            3300: 0x00C0, // 3300 samples per second (also 0x00E0)
            default: 0x0080
        },
        ads1115: {
            8: 0x0000, // 8 samples per second
            16: 0x0020, // 16 samples per second
            32: 0x0040, // 32 samples per second
            64: 0x0060, // 64 samples per second
            128: 0x0080, // 128 samples per second
            250: 0x00A0, // 250 samples per second (default)
            475: 0x00C0, // 475 samples per second
            860: 0x00E0, // 860 samples per second
            default: 0x00A0
        }
    }
    private static comparatorMode = {
        'TRADITIONAL': 0x0000, // Traditional comparator with hysteresis (default)
        'WINDOW': 0x0010, // Window comparator
    }
    private static comparatorActiveMode = {
        'ACTVLOW': 0x0000, // ALERT/RDY pin is low when active (default)
        'ACTVHI': 0x0008, // ALERT/RDY pin is high when active
    }
    private static latch = {
        'NONLATCH': 0x0000, // Non-latching comparator (default)
        'LATCH': 0x0004, // Latching comparator
    }

    private static comparatorQueue = {
        '1CONV': 0x0000, // Assert ALERT/RDY after one conversions
        '2CONV': 0x0001, // Assert ALERT/RDY after two conversions
        '4CONV': 0x0002, // Assert ALERT/RDY after four conversions
        'NONE': 0x0003, // Disable the comparator and put ALERT/RDY in high state (default)
    }
    private static thresholdValues = {
        'ads1015': 2048.0,  // 2^(12-1) // 12bit, -2048 to 2047
        'ads1115': 32768.0  // 2^(16-1) // 16bit, -32768 to 32767
    }
    private static CONFIG_DEFAULT = 0x8583;  // Stop/Reset continuous readings

    protected _timerRead: NodeJS.Timeout;
    protected toHexString(bytes: number[]) { return bytes.reduce((output, elem) => (output + '0x' + ('0' + elem.toString(16)).slice(-2)) + ' ', ''); }
    protected logError(err, msg?: string) { logger.error(`${this.device.name} ${typeof msg !== 'undefined' ? msg + ' ' : ''}${typeof err !== 'undefined' ? err.message : ''}`); }
    protected async sendCommand(command: number[]): Promise<{ bytesWritten: number, buffer: Buffer }> {
        try {
            let buffer = Buffer.from(command);
            let w = await this.i2c.writeCommand(this.device.address, buffer);
            return Promise.resolve(w);
        }
        catch (err) { logger.error(err); }
    }
    protected async readCommand(command: number): Promise<number[]> {
        try {
            let r = await this.i2c.readI2cBlock(this.device.address, 0, 2);  // read val
            return Promise.resolve(r.buffer.toJSON().data);
        }
        catch (err) { logger.error(`${this.device.name} Read Command: ${err.message}`); }
    }
    public async stopRead() {
        if (typeof this._timerRead !== 'undefined')
            clearTimeout(this._timerRead);
        return Promise.resolve();
    }
    public async readContinuous(): Promise<boolean> {
        try {
            if (this._timerRead) clearTimeout(this._timerRead);
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.values });
            this._timerRead = setTimeout(() => { this.readContinuous(); }, this.device.options.readInterval || 500);
            return Promise.resolve(true);
        }
        catch (err) { logger.error(err); }
    }
    public async initAsync(deviceType): Promise<boolean> {
        try {
            if (this._timerRead) clearTimeout(this._timerRead);
            if (typeof this.options.adcType === 'undefined') this.options.adcType = 'ads1115';
            if (typeof this.options.readInterval === 'undefined') this.options.readInterval = 5000;
            if (typeof this.device.options === 'undefined') this.device.options = {};
            if (typeof this.device.options.comparatorReadings === 'undefined') this.device.options.comparatorReadings = ads1x15.comparatorQueue['NONE'];
            if (typeof this.device.options.comparatorLatchingMode === 'undefined') this.device.options.comparatorLatchingMode = ads1x15.latch['NONLATCH'];
            if (typeof this.device.options.comparatorActiveMode === 'undefined') this.device.options.comparatorActiveMode = ads1x15.comparatorActiveMode['ACTVLOW'];
            if (typeof this.device.options.comparatorMode === 'undefined') this.device.options.comparatorMode = ads1x15.comparatorMode['TRADITIONAL'];
            if (typeof this.device.options.mode === 'undefined') this.device.options.mode = ads1x15.mode['SINGLE'];
            //if (typeof this.device.options.mux === 'undefined') this.device.options.mux = ads1x15.mux['SINGLE_3'];
            if (typeof this.device.values.channels === 'undefined') this.device.values.channels = [];
            if (typeof this.device.name === 'undefined') this.device.name = this.options.name = this.options.adcType.toUpperCase();
            if (typeof this.device.options.adcType !== 'undefined') {
                this.device.options.sps = ads1x15.sps[this.device.options.adcType].default; //[this.device.options.adcType === 'ads1015' ? 250 : 1600];
                this.pollReadings();
            }
            return Promise.resolve(true);
        }
        catch (err) { logger.error(err); return Promise.resolve(false); }
        finally {
            if (this.device.options.adcType !== 'undefined') setTimeout(() => { this.pollReadings(); }, 5000);
        }
    }
    protected pollReadings() {
        try {
            if (this._timerRead) clearTimeout(this._timerRead);
            this._timerRead == null;
            if (!this.suspendPolling) {
                this.takeReadings();
            }
        }
        catch (err) { this.logError(err, 'Error Polling Device Values'); }
        finally { this._timerRead = setTimeout(() => { this.pollReadings(); }, this.options.readInterval) }
    }
    private timeout(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    private getSPSTimeout() {
        try {
            return ads1x15.spsToMilliseconds[this.device.options.adcType][this.device.options.sps] * 2 + 1; //+ this.spsExtraDelay;
        } catch (err) { logger.error(`${this.device.name} error calculating SPSTimeout: ${err.message}`); }
    }
    private async sendInit(channel: any): Promise<boolean> {
        try {
            let config = this.config(channel);
            logger.info(`${this.options.name}:${channel} Sending Config ${config}`)
            channel.config = config;
            let w = await this.sendCommand([ads1x15.registers['CONFIG'], (config >> 8) & 0xFF, config & 0xFF]);
            await this.timeout(this.getSPSTimeout());
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
    }
    public getValue(prop) {
        let obj = this.device.values;
        let p = prop;
        if (prop.startsWith('ch')) {
            obj = this.device.values.channels[parseInt(prop[2], 10) - 1];
            p = prop.substring(4);
        }
        try {
            let replaceSymbols = /(?:\]\.|\[|\.)/g
            let _prop = p.replace(replaceSymbols, ',').split(',');
            let val = obj;
            for (let i = 0; i < _prop.length; i++) {
                val = val[_prop[i]];
            }
            return val;
        } catch (err) { logger.error(`${this.device.name} error getting device value ${prop}: ${err.message}`); }
    }

    public async takeReadings(): Promise<boolean> {
        try {
            this.suspendPolling = true;
            let pArr = [];
            if (typeof this.device.options.channels === 'undefined') return;
            let channels = this.device.options.channels;
            for (let i = 0; i < channels.length; i++) {
                if (typeof channels[i].pga === 'undefined') channels[i].pga = 2.048;
                if (channels[i].enabled) {
                    await this.sendInit(channels[i]);
                    let r: number[];
                    if (this.i2c.isMock) r = [Math.round(Math.random() * (this.device.options.adcType === 'ads1015' ? 15 : 127)), Math.round(Math.random() * 256)];
                    else r = await this.readCommand(ads1x15.registers['CONVERT'])
                    let value = this.convertValue(r);
                    // voltage = value / max * pga = e.g. 29475 / 65355 * 1024

                    // 21,265 = value
                    // 65355 = max
                    // 4.096 = pga
                    // 21,265 / 32,767 * 4.096
                    let voltage = this.getVoltageFromValue(value, channels[i].pga);
                    let valElem = this.device.values.channels.find(elem => { return elem.id === channels[i].id });
                    if (typeof valElem !== 'undefined') {
                        valElem.value = value;
                        valElem.voltage = voltage;
                        valElem.rawBytes = r;
                        valElem.maxValue = this.device.options.adcType === 'ads1015' ? 1 << 12 : 1 << 16;
                    }
                    else {
                        let res = { id: channels[i].id, value: value, voltage: voltage, maxValue: this.device.options.adcType === 'ads1015' ? 1 << 12 : 1 << 16 };
                        this.device.values.channels.push(res);
                    }
                    this.device.values.channels.sort((a, b) => { return a.id - b.id; });
                }
                else {
                    let valElem = this.device.values.channels.find(elem => { return elem.id === channels[i].id });
                    if (typeof valElem === 'undefined') {
                        this.device.values.channels.push({ id: channels[i].id });
                    }
                }
            }
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.device.values });
            this.emitFeeds();
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
    }
    private convertValue(bytes: number[]) {
        //let value = ((bytes[0] & 0xff) << 8) | ((bytes[1] & 0xff));
        let value = (bytes[0] * 256) + bytes[1];
        if (this.device.options.adcType === 'ads1015') {
            value = (value >> 4);
            if (value > 0x07FF) value |= 0xF000;
        }
        logger.silly(`${this.options.name} Convert Value ${bytes[0]}:${bytes[1]} --> ${value}`);
        return value;
        //if (this.device.options.adcType === 'ads1015') {
        //    let value = ((bytes[0] & 0xff) << 4) | ((bytes[1] & 0xff) >> 4);
        //    logger.silly(`${this.options.name} Convert Value ${bytes[0]}:${bytes[1]} --> ${value} || ${((bytes[0] & 0xFF) << 4) | (bytes[1] & 0xFF)}`);
        //    if ((value & 0x800) !== 0) {
        //        value -= 1 << 12;
        //    }
        //    return value;
        //} else {
        //    let value = ((bytes[0] & 0xff) << 8) | ((bytes[1] & 0xff));
        //    if ((value & 0x8000) !== 0) {
        //        value -= 1 << 16;
        //    }
        //    return value;
        //}
    }
    private getVoltageFromValue(value, pga) {
        let max = ads1x15.thresholdValues[this.device.options.adcType];
        // positive values must be 1 less than max range value (e.g. full scale of 12 bit ADC => 2^(12-1)-1 => -2048 to 2047)
        max = value > 0 ? max - 1 : max;
        logger.silly(`${this.options.name} Convert Voltage ${value} / ${max} * ${pga} = ${value / max * pga}`);
        return value / max * pga; // value / mx = % of scale, scale * pga = Volts
    }

    public async setOptions(opts): Promise<any> {
        try {
            await this.stopRead();
            if (typeof opts.name !== 'undefined' && this.device.name !== opts.name) this.device.options.name = this.device.name = opts.name;
            if (this.device.options.name === '') this.device.options.name = this.device.options.adcType === 'ads1015' ? 'ADS1015' : 'ADS1115';
            if (typeof opts.readInterval === 'number') this.device.options.readInterval = opts.readInterval;
            if (typeof opts.adcType !== 'undefined') {
                this.device.options.adcType = opts.adcType;
                this.device.options.sps = ads1x15.sps[this.device.options.adcType].default; //[this.device.options.adcType === 'ads1015' ? 250 : 1600];
            }
            if (typeof opts.channels !== 'undefined') this.device.options.channels = opts.channels;
            for (let c of opts.channels) {

                c.pgaMask = this.pga.get(c.pga).pgaMask;
            }
            this.channels.sort((a, b) => { return a.id - b.id; });
            this.pollReadings();
            Promise.resolve(this.device.options);
        }
        catch (err) { logger.error(err); Promise.reject(err); }
    }
    public async setValues(vals): Promise<any> {
        try {
            await this.stopRead();
            // RSG - Don't set anything here; values with ADC should only come from the readings
            this.pollReadings();
            Promise.resolve(this.device.values);
        }
        catch (err) { logger.error(err); Promise.reject(err); }
    }
    public async closeAsync(): Promise<void> {
        try {
            await this.stopRead();
            await super.closeAsync();
            return Promise.resolve();
        }
        catch (err) { return Promise.reject(err); }
    }
    public getDeviceDescriptions(dev) {
        let desc = [];
        let category = typeof dev !== 'undefined' ? dev.category : 'unknown';
        for (let i = 0; i < this.channels.length; i++) {
            let chan = this.channels[i];
            desc.push({ type: 'i2c', isActive: this.device.isActive, name: chan.name, binding: `i2c:${this.i2c.busId}:${this.device.id}:${chan.id}`, category: category });
        }
        return desc;
    }
}
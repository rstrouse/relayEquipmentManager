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
        return this.device.options.comparatorReadings // Set comparator readings (or disable)
            | this.device.options.comparatorLatchingMode    // Set latching mode
            | this.device.options.comparatorActiveMode      // Set active/ready mode
            | this.device.options.comparatorMode            // Set comparator mode
            | this.device.options.mode                      // Set operation mode (single, continuous)
            | this.device.options.sps                       // Set sample per seconds
            | channel.pga                                   // Set PGA/voltage range
            | ads1x15.mux[channel.id - 1]                       // Set mux (channel or differential bit)
            | ads1x15.registers['SINGLE']                   // Set 'start single-conversion' bit
        // 62243 total [243,35]
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
        'DIFF_0_1': 0x0000, // Differential P = AIN0, N = AIN1 (default)
        'DIFF_0_3': 0x1000, // Differential P = AIN0, N = AIN3
        'DIFF_1_3': 0x2000, // Differential P = AIN1, N = AIN3
        'DIFF_2_3': 0x3000, // Differential P = AIN2, N = AIN3
        0: 0x4000, // Single-ended AIN0
        1: 0x5000, // Single-ended AIN1
        2: 0x6000, // Single-ended AIN2
        3: 0x7000 // Single-ended AIN3
    }
    public pga: valueMap = new valueMap([
        [0x0000, { name: '6.144v', desc: '6.144v' }],
        [0x0200, { name: '4.096v', desc: '4.196v' }],
        [0x0400, { name: '2.048v', desc: '2.048v' }], // default
        [0x0600, { name: '1.024v', desc: '1.024v' }],
        [0x0800, { name: '0.512v', desc: '0.512v' }],
        [0x0A00, { name: '0.256v', desc: '0.256v' }]
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
            // let w = await this.i2c.writeI2cBlock(this.device.address, this.ADS1015_REG_POINTER_CONFIG, 2, buffer);
            // NEED =>   this.i2c.write(this.address, ADS1015_REG_POINTER_CONFIG, Buffer.from(bytes), (
            logger.debug(`Executed send command ${this.toHexString(command)} bytes written:${w}`);
            return Promise.resolve(w);
        }
        catch (err) { logger.error(err); }
    }
    protected async readCommand(command: number): Promise<Buffer> {
        try {
            // let r = await this.i2c.readBytes(this.device.address, command);
            let r = await this.i2c.readWord(this.device.address, command);
            return Promise.resolve(r);
        }
        catch (err) { logger.error(`${this.device.name} Read Command: ${err}`); }
    }
    public async stopRead() {
        if (typeof this._timerRead !== 'undefined')
            clearTimeout(this._timerRead);
        return Promise.resolve();
    }
    public async readContinuous(): Promise<boolean> {
        try {
            if (this._timerRead) clearTimeout(this._timerRead);
            // TODO: Add the byte sequence to read from the ADC.

            // read from channel 3
            // this.values.channels[0].val = Math.random() * 100;

            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.values });
            this._timerRead = setTimeout(() => { this.readContinuous(); }, this.device.options.readInterval || 500);
            return Promise.resolve(true);
        }
        catch (err) { logger.error(err); }
    }
    public async initAsync(deviceType): Promise<boolean> {
        try {
            if (this._timerRead) clearTimeout(this._timerRead);
            if (typeof this.options.readInterval === 'undefined') this.options.readInterval = 1000;
            if (typeof this.device.options === 'undefined') this.device.options = {};
            if (typeof this.device.options.comparatorReadings === 'undefined') this.device.options.comparatorReadings = ads1x15.comparatorQueue['NONE'];
            if (typeof this.device.options.comparatorLatchingMode === 'undefined') this.device.options.comparatorLatchingMode = ads1x15.latch['NONLATCH'];
            if (typeof this.device.options.comparatorActiveMode === 'undefined') this.device.options.comparatorActiveMode = ads1x15.comparatorActiveMode['ACTVLOW'];
            if (typeof this.device.options.comparatorMode === 'undefined') this.device.options.comparatorMode = ads1x15.comparatorMode['TRADITIONAL'];
            if (typeof this.device.options.mode === 'undefined') this.device.options.mode = ads1x15.mode['SINGLE'];
            if (typeof this.device.options.mux === 'undefined') this.device.options.mux = ads1x15.mux['SINGLE_3'];
            if (typeof this.device.values.channels === 'undefined') this.device.values.channels = [];
            if (typeof this.device.options.adcType !== 'undefined') {

                // let w = await this.sendCommand([ads1x15.registers['CONFIG'], (this.config >> 8) & 0xFF, this.config & 0xFF]);
                // await this.timeout(ads1x15[this.device.options.adcType][this.device.options.sps]);
                // logger.debug(`${this.device.name} - Sent device config.  Wrote ${w} bytes.`)
                // // this.readContinuous();
                this.pollReadings();
            }
            return Promise.resolve(true);
        }
        catch (err) { logger.error(err); return Promise.resolve(false); }
        finally {
            // setTimeout(() => { this.pollDeviceInformation(); }, 2000);
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
        if (this.device.options.adcType === 'ads1015') {
            return ads1x15.spsToMilliseconds[this.device.options.adcType][this.device.options.sps] + 1; //+ this.spsExtraDelay;
        } else {
            return ads1x15.spsToMilliseconds[this.device.options.adcType][this.device.options.sps] + 1; //+ this.spsExtraDelay;
        }
    }
    private async sendInit(channel: any): Promise<boolean> {
        try {
            this.suspendPolling = true;
            let config = this.config(channel);
            let w = await this.sendCommand([ads1x15.registers['CONFIG'], (config >> 8) & 0xFF, config & 0xFF]);
            logger.debug(`Wrote ${this.device.options.name} config (${config}) bytes ${w}`)
            await this.timeout(this.getSPSTimeout());
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
    }

    public async takeReadings(): Promise<boolean> {
        try {
            this.suspendPolling = true;
            let pArr = [];
            if (typeof this.device.options.channels === 'undefined') return;
            let channels = this.device.options.channels;
            for (let i = 0; i < channels.length; i++) {
                if (typeof channels[i].pga === 'undefined') channels[i].pga = this.pga.getValue('2.048v');
                if (channels[i].enabled) {
                    await this.sendInit(channels[i]);
                    let r: Buffer;
                    if (this.i2c.isMock) r = Buffer.from([Math.random() * 4, Math.random() * 100])
                    else r = await this.readCommand(ads1x15.registers['CONVERT'])
                    let value = this.convertValue(r.toJSON().data);
                    let voltage = this.getVoltageFromValue(value, channels[i].pga);
                    let psi = Math.max(0,((voltage - channels[i].inducerOffset) * channels[i].psiPerVolt)).toFixed(2);
                    let valElem = this.device.values.channels.find(elem => { return elem.id === channels[i].id });
                    if (typeof valElem !== 'undefined') {
                        valElem.value = value;
                        valElem.voltage = voltage.toFixed(2);
                        valElem.psi = psi;
                    }
                    else {
                        let res = { id: channels[i].id, value, voltage: voltage.toFixed(2), psi };
                        this.device.values.channels.push(res);
                    }
                    this.device.values.channels.sort((a, b) => { return a.id - b.id; });
                }
                else {
                    let valElem = this.device.values.channels.find(elem => { return elem.id === channels[i].id });
                    if (typeof valElem === 'undefined') {
                        this.device.values.channels.push({ id: channels[i].id});
                    }
                }
            }
            webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.device.values });
            // logger.debug(`${this.device.name} - Read Channel 3.  Results: ${r} ${JSON.stringify(r)}`)
            // }
            this.emitFeeds();
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
    }
    private convertValue(bytes: number[]) {
        if (this.device.options.adcType === 'adc1015') {
            let value = ((bytes[0] & 0xff) << 4) | ((bytes[1] & 0xff) >> 4);
            if ((value & 0x800) !== 0) {
                value -= 1 << 12;
            }
            return value;
        } else {
            let value = ((bytes[0] & 0xff) << 8) | ((bytes[1] & 0xff));
            if ((value & 0x8000) !== 0) {
                value -= 1 << 16;
            }
            return value;
        }
    }
    private getVoltageFromValue(value, pga) {
        let max = ads1x15.thresholdValues[this.device.options.adcType];
        // positive values must be 1 less than max range value (e.g. full scale of 12 bit ADC => 2^(12-1)-1 => -2048 to 2047)
        max = value > 0 ? max - 1 : max;
        return value / max * pga; // value / mx = % of scale, scale * pga = Volts
    }

    public async setOptions(opts): Promise<any> {
        try {
            await this.stopRead();
            if (typeof opts.name !== 'undefined' && this.device.name !== opts.name) this.device.options.name = this.device.name = opts.name;
            if (typeof opts.readInterval === 'number') this.device.options.readInterval = opts.readInterval;
            if (typeof opts.adcType !== 'undefined') {
                this.device.options.adcType = opts.adcType;
                this.device.options.sps = ads1x15.sps[this.device.options.adcType][this.device.options.adcType === 'ads1015' ? 1600 : 16];
            }
            if (typeof opts.channels !== 'undefined') this.device.options.channels = opts.channels;
            for (let c of opts.channels) {
                if (typeof c.pga === 'undefined') c.pga = this.pga.getValue('2.048v');
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
            //if (typeof vals.channels !== 'undefined') this.device.values.channels = vals.channels
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
// Special processing for ADS1115 adc.
export class ads1115 extends ads1x15 {

}
// Special processing for the ADS1105 adc
export class ads1015 extends ads1x15 {

}

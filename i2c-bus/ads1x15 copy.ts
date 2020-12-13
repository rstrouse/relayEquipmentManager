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
    public get channels() { return typeof this.values.channels === 'undefined' ? this.values.channels = [] : this.values.channels; }
    public set channels(val) { this.values.channels = val; }
    private suspendPolling: boolean = false;
    // Pointer Register
    private ADS1015_REG_POINTER_CONVERT = 0x00;
    private ADS1015_REG_POINTER_CONFIG = 0x01;
    private ADS1015_REG_POINTER_LOWTHRESH = 0x02;
    private ADS1015_REG_POINTER_HITHRESH = 0x03;

    // Config Register
    private ADS1015_REG_CONFIG_OS_SINGLE = 0x8000;    // Write: Set to start a single-conversion
    // noinspection JSUnusedLocalSymbols
    private ADS1015_REG_CONFIG_OS_BUSY = 0x0000;      // Read: Bit = 0 when conversion is in progress
    // noinspection JSUnusedLocalSymbols
    private ADS1015_REG_CONFIG_OS_NOTBUSY = 0x8000;   // Read: Bit = 1 when device is not performing a conversion

    private ADS1015_REG_CONFIG_MUX_DIFF_0_1 = 0x0000; // Differential P = AIN0, N = AIN1 (default)
    private ADS1015_REG_CONFIG_MUX_DIFF_0_3 = 0x1000; // Differential P = AIN0, N = AIN3
    private ADS1015_REG_CONFIG_MUX_DIFF_1_3 = 0x2000; // Differential P = AIN1, N = AIN3
    private ADS1015_REG_CONFIG_MUX_DIFF_2_3 = 0x3000; // Differential P = AIN2, N = AIN3

    private ADS1015_REG_CONFIG_MUX_SINGLE_0 = 0x4000; // Single-ended AIN0
    private ADS1015_REG_CONFIG_MUX_SINGLE_1 = 0x5000; // Single-ended AIN1
    private ADS1015_REG_CONFIG_MUX_SINGLE_2 = 0x6000; // Single-ended AIN2
    private ADS1015_REG_CONFIG_MUX_SINGLE_3 = 0x7000; // Single-ended AIN3

    private ADS1015_REG_CONFIG_PGA_6_144V = 0x0000; // +/-6.144V range
    private ADS1015_REG_CONFIG_PGA_4_096V = 0x0200; // +/-4.096V range
    private ADS1015_REG_CONFIG_PGA_2_048V = 0x0400; // +/-2.048V range (default)
    private ADS1015_REG_CONFIG_PGA_1_024V = 0x0600; // +/-1.024V range
    private ADS1015_REG_CONFIG_PGA_0_512V = 0x0800; // +/-0.512V range
    private ADS1015_REG_CONFIG_PGA_0_256V = 0x0A00; // +/-0.256V range

    private ADS1015_REG_CONFIG_MODE_CONTIN = 0x0000; // Continuous conversion mode
    private ADS1015_REG_CONFIG_MODE_SINGLE = 0x0100; // Power-down single-shot mode (default)

    private ADS1015_REG_CONFIG_DR_128SPS = 0x0000; // 128 samples per second
    private ADS1015_REG_CONFIG_DR_250SPS = 0x0020; // 250 samples per second
    private ADS1015_REG_CONFIG_DR_490SPS = 0x0040; // 490 samples per second
    private ADS1015_REG_CONFIG_DR_920SPS = 0x0060; // 920 samples per second
    private ADS1015_REG_CONFIG_DR_1600SPS = 0x0080; // 1600 samples per second (default)
    private ADS1015_REG_CONFIG_DR_2400SPS = 0x00A0; // 2400 samples per second
    private ADS1015_REG_CONFIG_DR_3300SPS = 0x00C0; // 3300 samples per second (also 0x00E0)

    private ADS1115_REG_CONFIG_DR_8SPS = 0x0000; // 8 samples per second
    private ADS1115_REG_CONFIG_DR_16SPS = 0x0020; // 16 samples per second
    private ADS1115_REG_CONFIG_DR_32SPS = 0x0040; // 32 samples per second
    private ADS1115_REG_CONFIG_DR_64SPS = 0x0060; // 64 samples per second
    private ADS1115_REG_CONFIG_DR_128SPS = 0x0080; // 128 samples per second
    private ADS1115_REG_CONFIG_DR_250SPS = 0x00A0; // 250 samples per second (default)
    private ADS1115_REG_CONFIG_DR_475SPS = 0x00C0; // 475 samples per second
    private ADS1115_REG_CONFIG_DR_860SPS = 0x00E0; // 860 samples per second

    private ADS1015_REG_CONFIG_CMODE_TRAD = 0x0000; // Traditional comparator with hysteresis (default)
    private ADS1015_REG_CONFIG_CMODE_WINDOW = 0x0010; // Window comparator

    private ADS1015_REG_CONFIG_CPOL_ACTVLOW = 0x0000; // ALERT/RDY pin is low when active (default)
    private ADS1015_REG_CONFIG_CPOL_ACTVHI = 0x0008; // ALERT/RDY pin is high when active

    private ADS1015_REG_CONFIG_CLAT_NONLAT = 0x0000; // Non-latching comparator (default)
    private ADS1015_REG_CONFIG_CLAT_LATCH = 0x0004; // Latching comparator

    private ADS1015_REG_CONFIG_CQUE_1CONV = 0x0000; // Assert ALERT/RDY after one conversions
    private ADS1015_REG_CONFIG_CQUE_2CONV = 0x0001; // Assert ALERT/RDY after two conversions
    private ADS1015_REG_CONFIG_CQUE_4CONV = 0x0002; // Assert ALERT/RDY after four conversions
    private ADS1015_REG_CONFIG_CQUE_NONE = 0x0003; // Disable the comparator and put ALERT/RDY in high state (default)

    private ADS1015_REG_CONFIG_DEFAULT = 0x8583;  // Stop/Reset continuous readings

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
    public async stopReadContinuous() {
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
            if (typeof this.device.options.comparatorReadings === 'undefined') this.device.options.comparatorReadings = this.ADS1015_REG_CONFIG_CQUE_NONE; 
            if (typeof this.device.options.comparatorLatchingMode === 'undefined') this.device.options.comparatorLatchingMode = this.ADS1015_REG_CONFIG_CLAT_NONLAT;
            if (typeof this.device.options.comparatorActiveMode === 'undefined') this.device.options.comparatorActiveMode = this.ADS1015_REG_CONFIG_CPOL_ACTVLOW;
            if (typeof this.device.options.comparatorMode === 'undefined') this.device.options.comparatorMode = this.ADS1015_REG_CONFIG_CMODE_TRAD;
            if (typeof this.device.options.mode === 'undefined') this.device.options.mode = this.ADS1015_REG_CONFIG_MODE_SINGLE;
            if (typeof this.device.options.sps === 'undefined') this.device.options.sps = this.ADS1115_REG_CONFIG_DR_16SPS; // 32 (160?)
            if (typeof this.device.options.pga === 'undefined') this.device.options.pga = this.ADS1015_REG_CONFIG_PGA_4_096V;
            if (typeof this.device.options.mux === 'undefined') this.device.options.mux = this.ADS1015_REG_CONFIG_MUX_SINGLE_3; //28627 (16384?)
            this.device.options.config = this.device.options.comparatorReadings        // Set comparator readings (or disable)
                | this.device.options.comparatorLatchingMode    // Set latching mode
                | this.device.options.comparatorActiveMode      // Set active/ready mode
                | this.device.options.comparatorMode            // Set comparator mode
                | this.device.options.mode                      // Set operation mode (single, continuous)
                | this.device.options.sps                       // Set sample per seconds
                | this.device.options.pga                       // Set PGA/voltage range
                | this.device.options.mux                       // Set mux (channel or differential bit)
                | this.ADS1015_REG_CONFIG_OS_SINGLE      // Set 'start single-conversion' bit
            // 62243 total [243,35]

            let options = {};

            // this.device.options.isDifferential = false;
            // this.device.options.mode = this.ADS1015_REG_CONFIG_MODE_SINGLE;

            // let bytes = [(this.device.options.config >> 8) & 0xFF, this.device.options.config & 0xFF]


            let w = await this.sendCommand([this.ADS1015_REG_POINTER_CONFIG, (this.device.options.config >> 8) & 0xFF, this.device.options.config & 0xFF]);
            await this.timeout(64);
            logger.debug(`${this.device.name} - Sent device config.  Wrote ${w} bytes.`)
            // this.readContinuous();
            this.pollReadings();
            return Promise.resolve(true);
        }
        catch (err) { logger.error(err); return Promise.resolve(false); }
        finally {
            // setTimeout(() => { this.pollDeviceInformation(); }, 2000);
            setTimeout(() => { this.pollReadings(); }, 5000);
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
    public async takeReadings(): Promise<boolean> {
        try {
            this.suspendPolling = true;
            if (this._timerRead) clearTimeout(this._timerRead);
                this.device.options.mode = this.ADS1015_REG_CONFIG_MODE_SINGLE;

                let bytes = [(this.device.options.config >> 8) & 0xFF, this.device.options.config & 0xFF]

                // let w = await this.sendCommand(bytes);
                // logger.debug(`${this.device.name} - Sent device config.  Wrote ${w} bytes.`)
                // NEED 63.5ms delay
                // await bus.i2cWrite(addr, 1, Buffer.alloc(1, register))
                let w = await this.sendCommand([this.ADS1015_REG_POINTER_CONFIG, (this.device.options.config >> 8) & 0xFF, this.device.options.config & 0xFF]);
                await this.timeout(64);
                
                let r = await this.readCommand(this.ADS1015_REG_POINTER_CONVERT);
                // need to convert value here before saving
                console.log(JSON.stringify(r));
                //this.device.values.channels[3].val = r;
                webApp.emitToClients('i2cDataValues', { bus: this.i2c.busNumber, address: this.device.address, values: this.values });
                logger.debug(`${this.device.name} - Read Channel 3.  Results: ${r} ${JSON.stringify(r)}`)
                // }
            this.emitFeeds();
            return Promise.resolve(true);
        }
        catch (err) { this.logError(err); }
        finally { this.suspendPolling = false; }
    }
    public async setOptions(opts): Promise<any> {
        try {
            await this.stopReadContinuous();
            if (typeof opts.name !== 'undefined' && this.device.name !== opts.name) this.device.options.name = this.device.name = opts.name;
            if (typeof opts.readInterval === 'number') this.device.options.readInterval = opts.readInterval;
            if (typeof opts.adcType !== 'undefined') this.device.options.adcType = opts.adcType;
            this.readContinuous();
            Promise.resolve(this.device.options);
        }
        catch (err) { logger.error(err); Promise.reject(err); }
    }
    public async setValues(vals): Promise<any> {
        try {
            await this.stopReadContinuous();
            if (typeof vals.channels !== 'undefined') this.channels = vals.channels;
            this.readContinuous();
            Promise.resolve(this.device.values);
        }
        catch (err) { logger.error(err); Promise.reject(err); }
    }
    public async closeAsync(): Promise<void> {
        try {
            await this.stopReadContinuous();
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

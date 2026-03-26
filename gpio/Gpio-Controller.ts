import * as fs from "fs";
const extend = require('extend');
import { execSync } from 'child_process';

import { setTimeout, clearTimeout } from "timers";
import { logger } from "../logger/Logger";
import { webApp } from "../web/Server";
import { vMaps, utils } from "../boards/Constants";
import { cont, DeviceBinding, GpioPin, Feed } from "../boards/Controller";
import { IDevice, DeviceStatus, LatchTimer } from "../devices/AnalogDevices";

import { connBroker, ServerConnection } from "../connections/Bindings";
import { BackendContext, BackendPinAddress, GpioBackend, GpioPlatformInfo, getGpioPlatformInfo, selectGpioBackend } from "./Gpio-Backends";

// Add types for clarity
export interface SysfsStatus {
    sysfsAvailable: boolean;
    sysfsWritable: boolean;
    onoffAccessible: boolean;
    libgpiodAccessible: boolean;
    hasGpioCharacterDevice: boolean;
    platform: string;
    isRaspberryPi: boolean;
    osInfo: string | null;
    osCodename: string | null;
    backendId: string | null;
    backendName: string | null;
    backendReason: string;
    recommendations: string[];
}

export interface SysfsEnableResult {
    success: boolean;
    message: string;
    requiresReboot: boolean;
    manualInstructions: string[];
}

export class GpioController {
    constructor(data) { }
    public pins: gpioPinComms[] = [];
    private backend: GpioBackend = null;
    private backendReason: string = "";
    private platformInfo: GpioPlatformInfo;

    private get backendContext(): BackendContext {
        return {
            controllerType: cont.controllerType?.name || "raspi",
            pinouts: cont.pinouts
        };
    }

    private getBackendAddress(pinDef: GpioPin, pinout: any): BackendPinAddress {
        if (this.backend) {
            return this.backend.resolveAddress(pinDef, pinout, this.backendContext);
        }
        return { gpio: pinout.gpioId, source: "pinout.gpioId" };
    }

    private createGpioInstance(pinDef: GpioPin, pinout: any, direction: string, edge: string, opts?: any) {
        const address = this.getBackendAddress(pinDef, pinout);
        if (this.backend) {
            if (address.gpio !== Number(pinout.gpioId)) {
                logger.debug(`Translated pin ${pinDef.headerId}-${pinDef.id} GPIO ${pinout.gpioId} -> backend line ${address.gpio} (${address.source})`);
            }
            return this.backend.createGpio(address, direction, edge, opts);
        }
        return new MockGpio(pinout.gpioId, direction, edge, opts);
    }

    private resolvePinoutByGpioId(gpioId: number): { pinout: any; pinDef: GpioPin } | undefined {
        const headers = cont.pinouts?.headers || [];
        for (let i = 0; i < headers.length; i++) {
            const header = headers[i];
            for (let k = 0; k < (header.pins || []).length; k++) {
                const pinout = header.pins[k];
                if (pinout.type === "gpio" && Number(pinout.gpioId) === Number(gpioId)) {
                    let pinDef = cont.gpio.pins.getPinById(header.id, pinout.id, false);
                    if (typeof pinDef !== "undefined") return { pinout, pinDef };
                    return {
                        pinout,
                        pinDef: new GpioPin({
                            id: pinout.id,
                            headerId: header.id,
                            direction: "output",
                            isInverted: false,
                            isActive: true,
                            state: "off"
                        })
                    };
                }
            }
        }
        return undefined;
    }
    
    /**
     * Attempt to enable sysfs GPIO on Bookworm systems
     */
    private async enableSysfsGpio(): Promise<boolean> {
        try {
            logger.info('Attempting to enable sysfs GPIO interface...');
            
            // Check if we're on a Raspberry Pi
            if (!fs.existsSync('/proc/device-tree/model')) {
                logger.info('Not on a Raspberry Pi, skipping sysfs GPIO enable');
                return false;
            }
            
            const model = fs.readFileSync('/proc/device-tree/model', 'utf8').trim();
            if (!model.includes('Raspberry Pi')) {
                logger.info('Not on a Raspberry Pi, skipping sysfs GPIO enable');
                return false;
            }
            
            // Check if we're on Bookworm or newer
            try {
                const osRelease = fs.readFileSync('/etc/os-release', 'utf8');
                if (!osRelease.includes('bookworm') && !osRelease.includes('bullseye')) {
                    logger.info('Not on Bookworm/Bullseye, sysfs GPIO should already be available');
                    return true;
                }
            } catch (err) {
                logger.warn('Could not read /etc/os-release, assuming older OS');
                return true;
            }
            
            // Try to enable sysfs GPIO using raspi-config
            try {
                logger.info('Attempting to enable sysfs GPIO using raspi-config...');
                execSync('raspi-config nonint do_gpio 0', { stdio: 'pipe' });
                logger.info('Successfully enabled sysfs GPIO via raspi-config');
                return true;
            } catch (err) {
                logger.warn(`raspi-config failed: ${err.message}`);
            }
            
            // Try to enable via device tree overlay
            try {
                logger.info('Attempting to enable sysfs GPIO via device tree...');
                execSync('echo "dtoverlay=gpio-no-irq" | sudo tee -a /boot/config.txt', { stdio: 'pipe' });
                logger.info('Added gpio-no-irq overlay to /boot/config.txt (reboot required)');
                return false; // Requires reboot
            } catch (err) {
                logger.warn(`Device tree overlay failed: ${err.message}`);
            }
            
            // Try to enable via sysfs directly
            try {
                logger.info('Attempting to enable sysfs GPIO directly...');
                execSync('echo 1 | sudo tee /sys/class/gpio/export', { stdio: 'pipe' });
                execSync('echo out | sudo tee /sys/class/gpio/gpio1/direction', { stdio: 'pipe' });
                execSync('echo 1 | sudo tee /sys/class/gpio/unexport', { stdio: 'pipe' });
                logger.info('Successfully enabled sysfs GPIO directly');
                return true;
            } catch (err) {
                logger.warn(`Direct sysfs enable failed: ${err.message}`);
            }
            
            logger.error('All methods to enable sysfs GPIO failed');
            return false;
            
        } catch (err) {
            logger.error(`Error enabling sysfs GPIO: ${err.message}`);
            return false;
        }
    }
    
    /**
     * Initialize GPIO with sysfs detection and enabling
     */
    public init() {
        this.platformInfo = getGpioPlatformInfo();
        const selection = selectGpioBackend(this.platformInfo);
        this.backend = selection.backend;
        this.backendReason = selection.reason;
        if (!this.backend) {
            logger.error(`No compatible GPIO backend found. ${selection.reason}`);
            if (this.platformInfo.osCodename === "trixie") {
                logger.error("Raspberry Pi OS Trixie requires a libgpiod backend. Install @bratbit/onoff and restart.");
            }
            throw new Error(`GPIO startup failed: ${selection.reason}`);
        }
        logger.info(`Using GPIO backend: ${this.backend.displayName}`);
        logger.info(`GPIO backend selection reason: ${selection.reason}`);
        this.initPins();
        return this;
    }
    public async stopAsync() {
        logger.info(`Stopping GPIO Controller`);
        try {
            for (let i = this.pins.length - 1; i >= 0; i--) {
                await this.pins[i].closeAsync();
                //this.pins[i].gpio.unexport();
                this.pins.splice(i, 1);
            }
            return this;
        } catch (err) { logger.error(`Error stopping GPIO controller :${err.message}`); }
    }
    public async reset() {
        await this.stopAsync();
        await this.init();
    }
    private translateState(direction: string, state: string) {
        switch (state) {
            case 'on':
                return (direction === 'out') ? 'high' : direction;
                break;
            case 'off':
                return (direction === 'out') ? 'low' : direction;
                break;
            default:
                return direction;
        }
    }
    public resetPinTriggers(headerId: number, pinId: number) {
        let pin = this.pins.find(elem => elem.pinId === pinId && elem.headerId === headerId);
        if (typeof pin !== 'undefined') pin.resetTriggers();
    }
    public resetDeviceFeeds(headerId: number, pinId: number) {
        let pin = this.pins.find(elem => elem.pinId === pinId && elem.headerId === headerId);
        if (typeof pin !== 'undefined') pin.resetFeeds();
    }
    public initPin(pinDef: GpioPin): gpioPinComms {
        let pin = this.pins.find(elem => elem.pinId === pinDef.id && elem.headerId === pinDef.headerId);
        let dir = pinDef.direction.gpio;
        let opts = { activeLow: pinDef.isInverted, reconfigureDirection: false };
        let pinoutHeader = cont.pinouts.headers.find(elem => elem.id === pinDef.headerId);
        if (typeof pinoutHeader !== 'undefined') {
            let pinout = pinoutHeader.pins.find(elem => elem.id === pinDef.id);
            if (typeof pinout !== 'undefined') {
                if (!pinDef.isActive) {
                    if (cont.gpio.isExported(pinout.gpioId)) {
                        try {
                            let p = this.createGpioInstance(pinDef, pinout, dir, "none", opts);
                            p.unexport();
                        }
                        catch (err) { logger.error(`Unable to unexport pin ${pinDef.headerId}-${pinDef.id}: ${err.message}`); }
                        cont.gpio.setUnexported(pinout.gpioId);
                        if (typeof pin !== 'undefined') pin.gpio = undefined;
                        let ndx = this.pins.findIndex(elem => elem.gpioId === pinout.gpioId);
                        if (ndx !== -1) this.pins.splice(ndx, 1);
                        logger.info(`Unexported Gpio pin#${pinDef.headerId}-${pinDef.id} ${pinout.gpioId}`);
                    }
                }
                else {
                    if (typeof pin === 'undefined') {
                        pin = new gpioPinComms(pinDef.headerId, pinDef.id, pinout.gpioId);
                        this.pins.push(pin);
                    }
                    else if (typeof pin.gpio !== 'undefined') {
                        if (dir !== pin.gpio.direction()) {
                            opts.reconfigureDirection = true;
                        }
                        pin.gpio.unwatchAll();
                    }
                    pin.label = pinDef.name;
                    if (dir === 'in' && pinDef.debounceTimeout > 0) opts['debounceTimeout'] = pinDef.debounceTimeout;
                    let state = pinDef.initialState === 'last' ? pinDef.state.name : pinDef.initialState || pinDef.state.name;
                    let stateDir = this.translateState(dir, state);
                    const edge = dir === "in" ? "both" : "none";
                    const address = this.getBackendAddress(pinDef, pinout);
                    logger.info(`Configuring Pin #${pinDef.id} Gpio #${pinout.gpioId}:${stateDir} (backend ${address.gpio}) on Header ${pinDef.headerId} Edge: ${edge}. ${JSON.stringify(opts)}`);
                    pin.gpio = this.createGpioInstance(pinDef, pinout, stateDir, edge, opts);
                    logger.info(`Pin #${pinDef.id} Gpio #${pinout.gpioId}:${pinDef.direction.gpio} on Header ${pinDef.headerId} Configured.`);
                    cont.gpio.setExported(pinout.gpioId);
                    pin.initFeeds();
                    if (dir === 'in') {
                        pin.gpio.read().then(result => {
                            pinDef.state = result;
                            pin.gpio.watch((err, value) => {
                                if (err) logger.error(`Watch callback error GPIO Pin# ${pinDef.headerId}-${pinDef.id}`);
                                else {
                                    pinDef.state = value;
                                    cont.gpio.emitFeeds(pin.headerId, pin.pinId);
                                    webApp.emitToClients('gpioPin', { pinId: pin.pinId, headerId: pin.headerId, gpioId: pin.gpioId, state: value, label: pin.label });
                                }
                            });
                        });
                    }
                    cont.gpio.emitFeeds(pin.headerId, pin.pinId);
                    pin.initialized = true;
                }
            }
            else logger.error(`Pin #${pinDef.id} does not exist on Header ${pinDef.headerId}.`)
        }
        else logger.error(`Cannot find Pin #${pinDef.id} on Header ${pinDef.headerId}.  Header does not exist on this board.`)
        return pin;
    }
    public initPins() {
        logger.info(`Initializing GPIO Pins ${cont.gpio.pins.length}`);
        let prevExported = [...cont.gpio.exported];
        let exported = [];
        let useGpio = this.backend !== null;
        for (let i = 0; i < cont.gpio.pins.length; i++) {
            let pinDef = cont.gpio.pins.getItemByIndex(i);
            let pin = this.initPin(pinDef);
            if (typeof pin !== 'undefined' && pinDef.isActive) exported.push(pin.gpioId);
            //if (!pinDef.isActive) continue;
            //let pinoutHeader = pinouts.headers.find(elem => elem.id === pinDef.headerId);
            //if (typeof pinoutHeader !== 'undefined') {
            //    let pinout = pinoutHeader.pins.find(elem => elem.id === pinDef.id);
            //    if (typeof pinout !== 'undefined') {
            //        let pin = this.pins.find(elem => elem.pinId === pinDef.id && elem.headerId === pinDef.headerId);
            //        if (typeof pin === 'undefined') {
            //            pin = new gpioPinComms(pinDef.headerId, pinDef.id, pinout.gpioId);
            //            this.pins.push(pin);
            //            if (useGpio) {
            //                logger.info(`Configuring Pin #${pinDef.id} Gpio #${pinout.gpioId}:${pinDef.direction.gpio} on Header ${pinDef.headerId}.`);
            //                pin.gpio = new gp(pinout.gpioId, this.translateState(pinDef.direction.gpio, pinDef.state.name), 'none', { activeLow: pinDef.isInverted, reconfigureDirection: false });
            //                logger.info(`Pin #${pinDef.id} Gpio #${pinout.gpioId}:${pinDef.direction.gpio} on Header ${pinDef.headerId} Configured.`);
            //            }
            //            else {
            //                logger.info(`Configuring Mock Pin #${pinDef.id} Gpio #${pinout.gpioId}:${pinDef.direction.gpio} on Header ${pinDef.headerId}.`);
            //                pin.gpio = new MockGpio(pinout.gpioId, this.translateState(pinDef.direction.gpio, pinDef.state.name), 'none', { activeLow: pinDef.isInverted, reconfigureDirection: false });
            //            }
            //            cont.gpio.setExported(pinout.gpioId);
            //            exported.push(pinout.gpioId);
            //            pin.gpio.read().then((value) => {
            //                pin.state = value;
            //                webApp.emitToClients('gpioPin', { pinId: pin.pinId, headerId: pin.headerId, gpioId: pin.gpioId, state: pin.state });
            //            }).catch(err => logger.error(err));
            //        }
            //    }
            //    else
            //        logger.error(`Pin #${pinDef.id} does not exist on Header ${pinDef.headerId}.`)
            //}
            //else
            //    logger.error(`Cannot find Pin #${pinDef.id} for Header ${pinDef.headerId}.  Header does not exist on this board.`)
        }
        // Unexport any pins that we have previously been exported.
        for (let i = 0; i < prevExported.length; i++) {
            if (exported.find(elem => elem === prevExported[i]) === undefined) {
                let p;
                if (useGpio) {
                    logger.info(`Unexporting unused Gpio #${prevExported[i]}`);
                    const mapped = this.resolvePinoutByGpioId(prevExported[i]);
                    if (typeof mapped !== "undefined") {
                        p = this.createGpioInstance(mapped.pinDef, mapped.pinout, "out", "none", { activeLow: false, reconfigureDirection: false });
                    }
                    else {
                        logger.warn(`Could not resolve pinout mapping for previously exported GPIO ${prevExported[i]}. Falling back to mock unexport.`);
                        p = new MockGpio(prevExported[i], "out");
                    }
                }
                else {
                    logger.info(`Unexporting Mock unused Gpio #${prevExported[i]}`);
                    p = new MockGpio(prevExported[i], 'out');
                }
                p.unexport();
                cont.gpio.setUnexported(prevExported[i]);
            }
        }
    }
    public readPinAsync(headerId: number, pinId: number): Promise<number> {
        let pin = this.pins.find(elem => elem.headerId === headerId && elem.pinId === pinId);
        if (typeof pin === 'undefined') throw new Error(`Invalid Pin #${headerId}-${pinId}. Could not find pin in controller`);
        return new Promise<number>(async (resolve, reject) => {
            try {
                let val = await pin.gpio.read();
                resolve(val);
            }
            catch (err) { reject(err); }
        });
    }
    public async writePinAsync(headerId: number, pinId: number, val: number, latch?: number): Promise<void> {
        try {
            let pin = this.pins.find(elem => elem.headerId === headerId && elem.pinId === pinId);
            if (typeof pin === 'undefined') return Promise.reject(new Error(`Invalid pin. Could not find pin in controller. ${headerId}:${pinId}`));
            return await pin.writePinAsync(val, latch);
        }
        catch (err) { Promise.reject(err); }
    }
    public get pinStates() {
        let states = [];
        for (let i = 0; i < this.pins.length; i++) {
            let pin = this.pins[i];
            states.push({
                headerId: pin.headerId,
                pinId: pin.pinId,
                gpioId: pin.gpioId,
                state: pin.state
            });
        }
        return states;
    }

    /**
     * Get sysfs GPIO status and recommendations
     */
    public async getSysfsStatus(): Promise<SysfsStatus> {
        const platform = getGpioPlatformInfo();
        const selection = selectGpioBackend(platform);
        const status: SysfsStatus = {
            sysfsAvailable: platform.sysfsAvailable,
            sysfsWritable: platform.sysfsWritable,
            onoffAccessible: platform.onoffAccessible,
            libgpiodAccessible: platform.libgpiodAccessible,
            hasGpioCharacterDevice: platform.hasGpioCharacterDevice,
            platform: platform.platform,
            isRaspberryPi: platform.isRaspberryPi,
            osInfo: platform.osInfo,
            osCodename: platform.osCodename,
            backendId: selection.backend?.id || null,
            backendName: selection.backend?.displayName || null,
            backendReason: selection.reason,
            recommendations: []
        };
        try {
            if (selection.backend) {
                status.recommendations.push(`GPIO backend selected: ${selection.backend.displayName}.`);
            } else {
                status.recommendations.push(`No GPIO backend selected: ${selection.reason}`);
            }
            if (status.osCodename === "trixie") {
                if (!status.libgpiodAccessible) {
                    status.recommendations.push("Raspberry Pi OS Trixie requires a libgpiod backend. Install @bratbit/onoff and ensure /dev/gpiochip* is accessible.");
                }
                if (!selection.backend) {
                    status.recommendations.push("Sysfs GPIO cannot be relied on in Trixie. Migrate to libgpiod.");
                }
            }
            else if (!status.sysfsWritable && status.isRaspberryPi) {
                status.recommendations.push("Sysfs GPIO is not writable. On Bookworm/Bullseye you can try: sudo raspi-config > Interface Options > GPIO.");
            }
            if (status.hasGpioCharacterDevice && !status.libgpiodAccessible) {
                status.recommendations.push("GPIO character devices exist but a libgpiod Node backend is unavailable. Install project dependencies.");
            }
            if (status.recommendations.length === 0) {
                status.recommendations.push('GPIO interface appears to be working correctly.');
            }
        } catch (err) {
            status.recommendations.push(`Error checking GPIO status: ${err.message}`);
        }
        return status;
    }

    /**
     * Attempt to enable sysfs GPIO and return result
     */
    public async enableSysfs(): Promise<SysfsEnableResult> {
        const platform = getGpioPlatformInfo();
        const result: SysfsEnableResult = {
            success: false,
            message: '',
            requiresReboot: false,
            manualInstructions: []
        };
        try {
            if (platform.osCodename === "trixie") {
                result.success = false;
                result.message = 'Sysfs GPIO is not a supported path on Raspberry Pi OS Trixie. Use the libgpiod backend instead.';
                result.manualInstructions = [
                    '1. Install project dependencies including @bratbit/onoff',
                    '2. Verify /dev/gpiochip* exists and your user has permission',
                    '3. Restart relayEquipmentManager'
                ];
                return result;
            }
            // Check if we're on a Raspberry Pi
            if (!fs.existsSync('/proc/device-tree/model')) {
                result.message = 'Not on a Raspberry Pi system';
                return result;
            }
            const model = fs.readFileSync('/proc/device-tree/model', 'utf8').trim();
            if (!model.includes('Raspberry Pi')) {
                result.message = 'Not on a Raspberry Pi system';
                return result;
            }
            // Check if sysfs GPIO is already enabled
            try {
                if (fs.existsSync('/sys/class/gpio')) {
                    fs.accessSync('/sys/class/gpio/export', fs.constants.W_OK);
                    result.success = true;
                    result.message = 'Sysfs GPIO is already enabled';
                    return result;
                }
            } catch (err) {
                // Not writable, continue
            }
            // Try to enable sysfs GPIO using raspi-config
            try {
                logger.info('Attempting to enable sysfs GPIO using raspi-config...');
                execSync('raspi-config nonint do_gpio 0', { stdio: 'pipe' });
                result.success = true;
                result.message = 'Successfully enabled sysfs GPIO via raspi-config';
                logger.info('Successfully enabled sysfs GPIO via raspi-config');
                return result;
            } catch (err) {
                logger.warn(`raspi-config failed: ${err.message}`);
            }
            // Try to enable via device tree overlay
            try {
                logger.info('Attempting to enable sysfs GPIO via device tree...');
                execSync('echo "dtoverlay=gpio-no-irq" | sudo tee -a /boot/config.txt', { stdio: 'pipe' });
                result.success = true;
                result.requiresReboot = true;
                result.message = 'Added gpio-no-irq overlay to /boot/config.txt. A reboot is required for changes to take effect.';
                logger.info('Added gpio-no-irq overlay to /boot/config.txt (reboot required)');
                return result;
            } catch (err2) {
                logger.warn(`Device tree overlay failed: ${err2.message}`);
            }
            // Try to enable via sysfs directly
            try {
                logger.info('Attempting to enable sysfs GPIO directly...');
                execSync('echo 1 | sudo tee /sys/class/gpio/export', { stdio: 'pipe' });
                execSync('echo out | sudo tee /sys/class/gpio/gpio1/direction', { stdio: 'pipe' });
                execSync('echo 1 | sudo tee /sys/class/gpio/unexport', { stdio: 'pipe' });
                result.success = true;
                result.message = 'Successfully enabled sysfs GPIO directly';
                logger.info('Successfully enabled sysfs GPIO directly');
                return result;
            } catch (err3) {
                logger.warn(`Direct sysfs enable failed: ${err3.message}`);
            }
            result.success = false;
            result.message = 'All methods to enable sysfs GPIO failed';
            result.manualInstructions = [
                '1. Run: sudo raspi-config',
                '2. Navigate to: Interface Options > GPIO',
                '3. Select: Yes (to enable sysfs GPIO)',
                '4. Reboot the system'
            ];
            return result;
        } catch (err) {
            result.success = false;
            result.message = `Error enabling sysfs GPIO: ${err.message}`;
            return result;
        }
    }
}
export class gpioPinComms implements IDevice {
    constructor(headerId: number, pinId: number, gpioId: number) {
        this.headerId = headerId;
        this.pinId = pinId;
        this.gpioId = gpioId;
        this._latchTimer = new LatchTimer(`${this.headerId}-${this.pinId}`);
    }
    private _latchTimer: LatchTimer;
    public lastComm: number;
    public status: string;
    public label: string;
    public hasFault: boolean = false;
    public headerId: number;
    public pinId: number;
    public gpioId: number;
    public state: number;
    public initialized: boolean = false;
    public feeds: Feed[] = [];
    public gpio;
    public get deviceStatus(): DeviceStatus { return { name: `GPIO Pin #${this.headerId}-${this.pinId}`, category: 'GPIO Pin', hasFault: utils.makeBool(this.hasFault), status: this.status, lastComm: this.lastComm, protocol: 'gpio', busNumber: this.headerId, address: this.gpioId }; }
    public async closeAsync() {
        try {
            this.initialized = false;
            await this._latchTimer.unlatch(true);
        } catch (err) { logger.error(`Error closing GPIO ${this.headerId} - ${this.pinId}`); }
    }
    public async readPinAsync(): Promise<number> {
        try {
            let val = await this.gpio.read();
            this.lastComm = new Date().getTime();
            this.hasFault = false;
            this.status = undefined;
            this.state = val;
            return val;
        } catch (err) { this.hasFault = true; this.status = err.message; return Promise.reject(err); }
    }
    public async resetTriggers() {
        try {
            // Get all the connections we are dealing with.
            let conns: ServerConnection[] = [];
            let pin = cont.gpio.pins.getPinById(this.headerId, this.pinId);
            for (let i = 0; i < pin.triggers.length; i++) {
                let trigger = pin.triggers.getItemByIndex(i);
                if (typeof conns.find(elem => elem.connectionId === trigger.sourceId) === 'undefined') conns.push(connBroker.findServer(trigger.sourceId));
            }
            for (let i = 0; i < conns.length; i++) {
                let conn = conns[i];
                conn.resetDeviceTriggers(`gpio:${this.headerId || 0}:${this.pinId}`);
            }
        } catch (err) { return logger.error(`Error resetting trigger for device.`); }
    }
    public async initFeeds() {
        try {
            this.feeds.length = 0;
            let pin = cont.gpio.pins.getPinById(this.headerId, this.pinId);
            for (let i = 0; i < pin.feeds.length; i++) {
                let f = pin.feeds.getItemByIndex(i);
                if(f.id > 0) this.feeds.push(new Feed(f));
            }
        } catch (err) { return logger.error(`Error resetting feed for device: ${err.message}.`); }
    }
    public async resetFeeds() {
        try {
            this.initFeeds();
        } catch (err) { return logger.error(`Error resetting trigger for device.`); }
    }
    public async emitFeeds(pinDef: GpioPin) {
        for (let i = 0; i < this.feeds.length; i++) {
            let feed = this.feeds[i];
            try {
                await feed.send(pinDef);
            }
            catch (err) { logger.error(`Error sending feed ${feed.feed.property} from pin #${this.headerId}-${this.pinId}`); }
        }
    }
    public async writePinAsync(val: number, latch?: number): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            try {
                this._latchTimer.unlatch(false);
                logger.debug(`Writing Pin #${this.headerId}:${this.pinId} -> GPIO #${this.gpioId} to ${val}`);
                await this.gpio.write(val);
                if (latch > 0) {
                    // Do this again because the call may have called since we wrote the pin.  We only want
                    // one timer at a time.
                    this._latchTimer.latch(async () => {
                        try {
                            // await this.writePinAsync(val ? 0 : 1, -1);
                            await cont.gpio.setDeviceStateAsync(new DeviceBinding(`gpio:${this.headerId || 0}:${ this.pinId }`), val ? 0 : 1);
                            logger.warn(`GPIO latch expired ${this.label} ${this.headerId}:${this.pinId} - ${latch}ms`);
                        }
                        catch (err) { logger.error(`Error unlatching GPIO Pin #${this.headerId}-${this.pinId}: ${err.message}`); }
                    }, latch);
                }
                this.lastComm = new Date().getTime();
                this.hasFault = false;
                this.status = undefined;
                this.state = val;
                cont.gpio.emitFeeds(this.headerId, this.pinId);
                // logger.info(`writePinAsync with val: ${val}, latch: ${latch}`)
                webApp.emitToClients('gpioPin', { pinId: this.pinId, headerId: this.headerId, gpioId: this.gpioId, state: val, label: this.label });
                resolve();
            }
            catch (err) { this.hasFault = true; this.status = err.message; reject(err); }
        })
    }
}
class MockGpio {
    private _opts;
    private _pinId: number;
    private _direction: string;
    private _edge: string;
    private _value: number;
    private _watches: any[] = [];
    private _isExported = false;
    constructor(pinId: number, direction: string, edge?: string, options?) {
        this._pinId = pinId;
        switch (direction) {
            case 'high':
                this._value = 1;
                this._direction = 'out';
                break;
            case 'low':
                this._value = 0;
                this._direction = 'out';
                break;
            default:
                this._direction = direction;
                this._value = 0;
                break;
        }
        this._edge = edge;
        this._opts = extend(true, { activeLow: false, debounceTimeout: 0, reconfigureDirection: true }, options);
        this._value = 0;
        this._isExported = true;
        if (this._direction !== direction) logger.info(`Input direction translated to initial state ${direction} --> ${this._direction}`);
    }
    public read(callback?: (err, value) => void) {
        if (typeof callback !== 'undefined')
            callback(this.checkExported(), this._value);
        else
            return this._isExported ? Promise.resolve(this._value) : Promise.reject(this.notExportedError());
    }
    public readSync(): number {
        if (!this._isExported)
            throw this.notExportedError()
        return this._value;
    }
    public write(val: number, callback?: (err, value) => void) {
        if (this._direction === 'in') {
            let err = !this._isExported ? this.notExportedError() : new Error(`EPERM: GPIO #${this._pinId} Write operation is not permitted for inputs.`);
            if (typeof callback !== 'undefined') callback(err, this._value);
            else return Promise.reject(err);
        }
        else {
            let err = this.checkExported();
            this.setValueInternal(err, val);
            if (typeof callback !== 'undefined')
                callback(err, this._value);
            else
                return err ? Promise.reject(this.notExportedError()) : Promise.resolve(this._value);
        }
    }
    public writeSync(val): Promise<number> {
        let prom;
        if (this._direction === 'in') {
            let err = !this._isExported ? this.notExportedError : new Error(`EPERM: GPIO #${this._pinId} Write operation is not permitted.`);
            if (err) logger.error(err);
            prom = Promise.reject(err);
            this.setValueInternal(err, this._value);
        }
        else {
            prom = !this._isExported ? Promise.reject(this.notExportedError()) : Promise.resolve(val);
            this.setValueInternal(undefined, val);
        }
        return prom;
    }
    public watch(callback: (err, value) => void) {
        logger.info(`Watching GPIO #${this._pinId}`);
        this._watches.push(callback);
    }
    public unwatch(callback?: (err, value) => void) {
        if (typeof callback === 'undefined') this.unwatchAll();
        else {
            logger.info(`Unwatch GPIO #${this._pinId} callback`);

            for (let i = this._watches.length - 1; i >= 0; i--) {
                if (this._watches[i] === callback) {
                    this._watches.splice(i, 1);
                }
            }
        }
    }
    public unwatchAll() { this._watches.length = 0; logger.info(`Unwatch ${this._pinId} all callbacks`); }
    public edge(): string {
        logger.info(`Get GPIO #${this._pinId} Edge: ${this._edge}`);
        return this._edge
    }
    public setEdge(edge: string) {
        this._edge = edge;
        logger.info(`Set GPIO #${this._pinId} Edge to ${this.edge}`);
    }
    public activeLow(): boolean {
        logger.info(`Get GPIO #${this._pinId} ActiveLow: ${this._opts.activeLow}`);
        return utils.makeBool(this._opts.activeLow);
    }
    public direction() { return this._direction; }
    public setActiveLow(activeLow: boolean) { this._opts.activeLow = activeLow; }
    public unexport() {
        logger.info(`Unexported GPIO #${this._pinId}`);
        this._isExported = false;
    }
    private setValueInternal(err, val) {
        if (!err && this._isExported) {
            let oldVal = this._value;
            logger.debug(`Wrote GPIO #${this._pinId} from ${oldVal} to ${val}`);
            this._value = val;
            if ((typeof oldVal === 'undefined' || oldVal !== val) && ((this._edge === 'both') ||
                (this._edge === 'rising' && val === 1) ||
                (this._edge === 'falling' && val === 0))) {
                for (let i = 0; i < this._watches.length; i++) {
                    logger.info(`Fired GPIO #${this._pinId} watch #${i + 1} val:${val}`);
                    this._watches[i](err, val);
                }
            }
        }
        else {
            logger.error(`Cannot write GPIO #${this._pinId}`);
        }
        return this._value;
    }
    private checkExported() {
        if (!this._isExported) logger.error(this.notExportedError());
        return !this._isExported ? this.notExportedError() : undefined;
    }
    private notExportedError() { return new Error(`EPERM: GPIO #${this._pinId} has not been exported.`); }
    public static HIGH = 1;
    public static LOW = 0;
}
export let gpioCont = new GpioController({});
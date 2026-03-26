import * as fs from "fs";

import { GpioPin } from "../boards/Controller";

export interface BackendContext {
    controllerType: string;
    pinouts: any;
}

export interface BackendPinAddress {
    gpio: number;
    chipRegex?: string;
    source: string;
}

export interface GpioBackend {
    readonly id: string;
    readonly displayName: string;
    readonly usesSysfs: boolean;
    isAccessible(): boolean;
    resolveAddress(pinDef: GpioPin, pinout: any, context: BackendContext): BackendPinAddress;
    createGpio(address: BackendPinAddress, direction: string, edge: string, options: any): any;
}

export interface GpioPlatformInfo {
    platform: string;
    isLinux: boolean;
    isRaspberryPi: boolean;
    osInfo: string | null;
    osCodename: string | null;
    sysfsAvailable: boolean;
    sysfsWritable: boolean;
    hasGpioCharacterDevice: boolean;
    onoffAccessible: boolean;
    libgpiodAccessible: boolean;
}

export interface GpioBackendSelection {
    backend: GpioBackend | null;
    reason: string;
    platform: GpioPlatformInfo;
}

class SysfsOnOffBackend implements GpioBackend {
    public readonly id = "sysfs-onoff";
    public readonly displayName = "onoff (sysfs)";
    public readonly usesSysfs = true;
    constructor(private gp: any) { }
    public isAccessible(): boolean {
        return typeof this.gp !== "undefined" && this.gp !== null && this.gp.accessible === true;
    }
    public resolveAddress(pinDef: GpioPin, pinout: any, context: BackendContext): BackendPinAddress {
        return {
            gpio: Number(pinout.gpioId),
            source: "pinout.gpioId"
        };
    }
    public createGpio(address: BackendPinAddress, direction: string, edge: string, options: any): any {
        return new this.gp(address.gpio, direction, edge, options);
    }
}

class LibgpiodOnOffBackend implements GpioBackend {
    public readonly id = "libgpiod-onoff";
    public readonly displayName = "@bratbit/onoff (libgpiod)";
    public readonly usesSysfs = false;
    constructor(private gp: any) { }
    public isAccessible(): boolean {
        return typeof this.gp !== "undefined" && this.gp !== null && detectGpioCharacterDevice();
    }
    private getSysfsBase(context: BackendContext): number {
        const declaredBase = Number(context?.pinouts?.gpioBackends?.sysfs?.base);
        if (Number.isInteger(declaredBase) && declaredBase >= 0) return declaredBase;
        switch (context.controllerType) {
            case "raspi-bookworm":
                return 512;
            case "raspi-5":
                return 600;
            default:
                return 0;
        }
    }
    private configureChipRegex(pinDef: GpioPin, pinout: any, context: BackendContext): string | undefined {
        let regex = pinout?.chipRegex || context?.pinouts?.gpioBackends?.libgpiod?.chipRegex;
        if (typeof regex !== "string" || regex.length === 0) {
            if (context.controllerType === "raspi-5") regex = "pinctrl-rp1";
            else if (context.controllerType.startsWith("raspi")) regex = "pinctrl-bcm";
        }
        if (typeof regex === "string" && regex.length > 0 && typeof this.gp.setChipRegex === "function") {
            this.gp.setChipRegex(regex);
            return regex;
        }
    }
    private resolveLineOffset(pinDef: GpioPin, pinout: any, context: BackendContext): number {
        if (Number.isInteger(pinout?.lineOffset)) return Number(pinout.lineOffset);
        if (Number.isInteger(pinout?.bcmId)) return Number(pinout.bcmId);
        if (typeof pinout?.name === "string") {
            const match = pinout.name.match(/BCM\s+(\d+)/i);
            if (match) return parseInt(match[1], 10);
        }
        const gpioId = Number(pinout?.gpioId);
        if (!Number.isInteger(gpioId) || gpioId < 0) {
            throw new Error(`Invalid GPIO mapping for pin ${pinDef.headerId}-${pinDef.id}`);
        }
        const base = this.getSysfsBase(context);
        if (gpioId >= base) return gpioId - base;
        return gpioId;
    }
    public resolveAddress(pinDef: GpioPin, pinout: any, context: BackendContext): BackendPinAddress {
        const chipRegex = this.configureChipRegex(pinDef, pinout, context);
        const lineOffset = this.resolveLineOffset(pinDef, pinout, context);
        return {
            gpio: lineOffset,
            chipRegex: chipRegex,
            source: Number(pinout?.gpioId) === lineOffset ? "pinout.gpioId" : "pinout.lineOffset"
        };
    }
    public createGpio(address: BackendPinAddress, direction: string, edge: string, options: any): any {
        return new this.gp(address.gpio, direction, edge, options);
    }
}

function detectGpioCharacterDevice(): boolean {
    try {
        if (!fs.existsSync("/dev")) return false;
        const entries = fs.readdirSync("/dev");
        return entries.some(elem => elem.startsWith("gpiochip"));
    } catch (err) {
        return false;
    }
}

function readOsReleaseValue(key: string): string | null {
    try {
        if (!fs.existsSync("/etc/os-release")) return null;
        const data = fs.readFileSync("/etc/os-release", "utf8");
        const rgx = new RegExp(`^${key}=(.+)$`, "m");
        const match = data.match(rgx);
        if (!match || !match[1]) return null;
        return match[1].trim().replace(/^"/, "").replace(/"$/, "");
    } catch (err) {
        return null;
    }
}

function detectRaspberryPi(): boolean {
    try {
        if (!fs.existsSync("/proc/device-tree/model")) return false;
        const model = fs.readFileSync("/proc/device-tree/model", "utf8").trim();
        return model.includes("Raspberry Pi");
    } catch (err) {
        return false;
    }
}

function safeLoadOnOff(): any {
    try {
        return require("onoff").Gpio;
    } catch (err) {
        return null;
    }
}

function safeLoadBratbitOnOff(): any {
    try {
        return require("@bratbit/onoff").Gpio;
    } catch (err) {
        return null;
    }
}

function createSysfsBackend(): GpioBackend | null {
    const gp = safeLoadOnOff();
    if (!gp) return null;
    return new SysfsOnOffBackend(gp);
}

function createLibgpiodBackend(): GpioBackend | null {
    const gp = safeLoadBratbitOnOff();
    if (!gp) return null;
    return new LibgpiodOnOffBackend(gp);
}

export function getGpioPlatformInfo(): GpioPlatformInfo {
    const onoff = safeLoadOnOff();
    const libgpiod = safeLoadBratbitOnOff();
    let sysfsWritable = false;
    try {
        fs.accessSync("/sys/class/gpio/export", fs.constants.W_OK);
        sysfsWritable = true;
    } catch (err) {
        sysfsWritable = false;
    }
    return {
        platform: process.platform,
        isLinux: process.platform === "linux",
        isRaspberryPi: detectRaspberryPi(),
        osInfo: readOsReleaseValue("PRETTY_NAME"),
        osCodename: readOsReleaseValue("VERSION_CODENAME"),
        sysfsAvailable: fs.existsSync("/sys/class/gpio"),
        sysfsWritable: sysfsWritable,
        hasGpioCharacterDevice: detectGpioCharacterDevice(),
        onoffAccessible: !!(onoff && onoff.accessible),
        libgpiodAccessible: !!(libgpiod && detectGpioCharacterDevice())
    };
}

export function selectGpioBackend(info?: GpioPlatformInfo): GpioBackendSelection {
    const platform = info || getGpioPlatformInfo();
    const requested = (process.env.REM_GPIO_BACKEND || "").trim().toLowerCase();
    const sysfsBackend = createSysfsBackend();
    const libgpiodBackend = createLibgpiodBackend();
    if (requested === "sysfs-onoff") {
        if (sysfsBackend && platform.sysfsWritable && sysfsBackend.isAccessible()) {
            return { backend: sysfsBackend, reason: "Forced by REM_GPIO_BACKEND=sysfs-onoff", platform };
        }
        return { backend: null, reason: "REM_GPIO_BACKEND requested sysfs-onoff but sysfs is unavailable", platform };
    }
    if (requested === "libgpiod-onoff") {
        if (libgpiodBackend && libgpiodBackend.isAccessible()) {
            return { backend: libgpiodBackend, reason: "Forced by REM_GPIO_BACKEND=libgpiod-onoff", platform };
        }
        return { backend: null, reason: "REM_GPIO_BACKEND requested libgpiod-onoff but backend is unavailable", platform };
    }
    if (platform.osCodename === "trixie") {
        if (libgpiodBackend && libgpiodBackend.isAccessible()) {
            return { backend: libgpiodBackend, reason: "Trixie detected; selected libgpiod backend", platform };
        }
        return { backend: null, reason: "Trixie detected but no libgpiod backend is available. Install @bratbit/onoff.", platform };
    }
    if (sysfsBackend && platform.sysfsWritable && sysfsBackend.isAccessible()) {
        return { backend: sysfsBackend, reason: "Selected sysfs backend", platform };
    }
    if (libgpiodBackend && libgpiodBackend.isAccessible()) {
        return { backend: libgpiodBackend, reason: "Selected libgpiod backend because sysfs backend is unavailable", platform };
    }
    return { backend: null, reason: "No compatible GPIO backend detected", platform };
}

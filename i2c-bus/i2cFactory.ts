import { logger } from "../logger/Logger";
import { AtlasEZOorp, AtlasEZOpH, AtlasEZO } from "./AtlasEZO";
import { I2cController, cont, I2cBus, I2cDevice, I2cDeviceFeed } from "../boards/Controller";

interface II2cDevice {

}
export class i2cDeviceFactory {
    constructor() {

    }
    public static createDevice(sName: string, i2c, dev) {
        switch (sName) {
            case 'AtlasEZOpH':
                return new AtlasEZOpH(i2c, dev);
            case 'AtlasEZOorp':
                return new AtlasEZOorp(i2c, dev);
        }
    }
}

export class i2cDeviceBase {
    public static async factoryCreate(i2c, dev: I2cDevice): Promise<i2cDeviceBase> {
        try {
            let dt = dev.getDeviceType();
            if (typeof dt === 'undefined') return Promise.reject(new Error(`Cannot initialize I2c device id${dev.id} on Bus ${i2c.busNumber}: Device type not found ${dev.typeId}`));
            let d = i2cDeviceFactory.createDevice(dt.deviceClass, i2c, dev);
            if (typeof d !== 'undefined') {
                if (await d.initAsync(dt)) logger.info(`Device ${dt.name} initialized for i2c bus #${i2c.busNumber} address ${dev.address}`);
            }
            return Promise.resolve(d);
        }
        catch (err) { logger.error(err); }
    }
    constructor(i2c, dev: I2cDevice) {
        this.i2c = i2c;
        this.device = dev;
    }
    public readable: boolean = false;
    public writable: boolean = false;
    public i2c;
    public device: I2cDevice;
    public async closeAsync() { return Promise.resolve(); }
    public async initAsync(deviceType: any): Promise<boolean> { return Promise.resolve(true); }
}


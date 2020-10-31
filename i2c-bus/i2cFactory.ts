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



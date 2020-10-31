import { logger } from "../logger/Logger";
export class i2cDeviceFactory {
    constructor() {

    }
    public static async createDevice(sModule: string, sName: string, i2c, dev): Promise<any> {
        let mod = await import(sModule);
        return Promise.resolve(new mod[sName](i2c, dev));
    }
}



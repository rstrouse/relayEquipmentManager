import { logger } from "../logger/Logger";
export class OneWireDeviceFactory {
    constructor() {

    }
    public static async createDevice(sModule: string, sName: string, oneWire, dev): Promise<any> {
        let mod = await import(sModule);
        return Promise.resolve(new mod[sName](oneWire, dev));
    }
}



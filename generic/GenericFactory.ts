import { logger } from "../logger/Logger";
export class GenericDeviceFactory {
    constructor() {

    }
    public static async createDevice(sModule: string, sName: string, gdc, dev): Promise<any> {
        let mod = await import(sModule);
        return Promise.resolve(new mod[sName](gdc, dev));
    }
}



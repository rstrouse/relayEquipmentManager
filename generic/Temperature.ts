import { logger } from "../logger/Logger";
import { DeviceBinding } from "../boards/Controller";
import { setTimeout, clearTimeout } from "timers";
import { utils } from "../boards/Constants";

import * as fs from 'fs';
import { GenericDeviceBase } from "./genericDevices";
import { webApp } from "../web/Server";

export class Themistor10k extends GenericDeviceBase {
    protected logError(err, msg?: string) { logger.error(`${this.device.name} ${typeof msg !== 'undefined' ? msg + ' ' : ''}${typeof err !== 'undefined' ? err.message : ''}`); }
    public async setValues(vals): Promise<any> {
        try {
            return Promise.resolve(this.values);
        }
        catch (err) { this.logError(err); Promise.reject(err); }
        finally { }
    }
}



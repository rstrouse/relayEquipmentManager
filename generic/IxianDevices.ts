import { logger } from "../logger/Logger";
import { DeviceBinding } from "../boards/Controller";
import { setTimeout, clearTimeout } from "timers";
import { utils } from "../boards/Constants";

import * as fs from 'fs';
import { GenericDeviceBase } from "./genericDevices";
import { webApp } from "../web/Server";

export class IxianPhDevice extends GenericDeviceBase {
    protected logError(err, msg?: string) { logger.error(`${this.device.name} ${typeof msg !== 'undefined' ? msg + ' ' : ''}${typeof err !== 'undefined' ? err.message : ''}`); }
    public getValue(prop: string) {
        switch (prop.toLowerCase()) {
            case 'ph':
                return this.values.pH;
            case 'temperature':
                return this.values.temperature;
            case 'tempUnits':
                return this.values.tempUnits;
            default:
                return this.values;
        }
    }
    public calcMedian(prop: string, values: any[]) {
        let p = prop.toLowerCase();
        switch (p) {
            case 'all': {
                let ph = [];
                let temp = [];
                for (let i = 0; i < values.length; i++) {
                    ph.push(values[i].pH);
                    temp.push(values[i].temperature)
                  
                };
                return { pH: super.calcMedian(prop, ph), temperature: super.calcMedian(prop, temp), tempUnits: values[0].tempUnits };
            }
            case 'temperature':
            case 'ph':
            default:
                return super.calcMedian(prop, values);

        }
    }
    public setValue(prop: string, value) {
        switch (prop.toLowerCase()) {
            case 'adcvalue':
                super.setValue(prop, value);
                break;
            case 'tempf':
            case 'tempc':
            case 'tempk':
                let temp = Math.round(parseFloat(value) * 100) / 100;
                if (typeof temp === 'number') {
                    this.values.tempUnits = prop.toUpperCase().substring(4);
                    this.values.temperature = temp;
                }
                webApp.emitToClients('genericDataValues', { id: this.device.id, typeId: this.device.typeId, values: this.values });
                this.emitFeeds();
                break;
            default:
                super.setValue(prop, value);
                break;
        }
    }

}
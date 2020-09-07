import { vMaps } from "../boards/Constants";
import * as path from "path";
import * as fs from "fs";
import { logger } from "../logger/Logger";
import * as extend from 'extend';
import { cont } from "../boards/Controller";
export class AnalogDevices {
    constructor() { }
    public static maps = {};
    //public static convertThermistor() {
    //    try {
    //        let filePath = path.posix.join(process.cwd(), `/devices/thermistorTable.txt`);
    //        let lines = fs.readFileSync(filePath, 'utf8').split(/\n/g);
    //        let jsonReadings = [];
    //        for (let i = 0; i < lines.length; i++) {
    //            let arr = lines[i].split(' ');
    //            if (arr.length !== 3) continue;
    //            jsonReadings.push({ input: parseInt(arr[2], 10), value: parseFloat(arr[0]) });
    //        }
    //        fs.writeFileSync(path.posix.join(process.cwd(), `/devices/thermistorTable.json`), JSON.stringify(jsonReadings, undefined, 2), 'utf8');
    //    }
    //    catch (err) { logger.error(err); }
    //}
    public static loadDefintions() {
        let defs = [];
        try {
            let filePath = path.posix.join(process.cwd(), `/devices/`);
            let dirEnt: fs.Dirent[] = fs.readdirSync(filePath, { withFileTypes: true });
            for (let i = 0; i < dirEnt.length; i++) {
                let f = dirEnt[i];
                if (f.isFile) {
                    if (f.name.endsWith('.json')) {
                        let d = AnalogDevices.loadFile(path.posix.join(filePath, f.name));
                        defs.push(...d);
                    }
                }
            }
        }
        catch (err) { logger.error(err); }
        return defs;
    }
    private static loadFile(filePath) {
        let defs = [];
        try {
            if (fs.existsSync(filePath)) {
                let txt = fs.readFileSync(filePath, 'utf8');
                let objs = JSON.parse(txt.trim());
                if (typeof objs.devices !== 'undefined') {
                    for (let j = 0; j < objs.devices.length; j++) {
                        defs.push(extend(true, { category: objs.category, predefined: objs.predefined }, objs.devices[j]));
                    }
                }
                // Add in the maps.
                if (typeof objs.maps !== 'undefined') {
                    for (let k = 0; k < objs.maps.length; k++) {
                        AnalogDevices.maps[objs.maps[k].name] = new ConversionMap(objs.maps[k]);
                    }
                }
            }
            return defs;
        }
        catch (err) { logger.error(err); }
    }
    public static saveCustomDefinition(device) {
        let filePath = path.posix.join(process.cwd(), `/devices/`, 'custom-devices.json');
        let defs = AnalogDevices.loadFile(filePath);
        if (typeof defs !== 'undefined') {
            let id = typeof device.id === 'undefined' ? -1 : parseInt(device.id, 10)
            if (isNaN(id)) id = -1;
            if (id <= 0) {
                let maxId = 99;
                for (let i = 0; i < defs.length; i++) {
                    let def = defs[i];
                    if (typeof def.id !== undefined) maxId = Math.max(def.id, maxId);
                }
                id = maxId + 1;
            }
            let deviceOld = defs.find(elem => elem.id === id);
            if (typeof deviceOld !== 'undefined') {
                for (let prop in device) {
                    deviceOld[prop] = device[prop];
                }
            }
            else {
                device.id = id;
                defs.push(device);
            }
            let obj = { category: 'User Defined', predefined: false, devices: defs };
            fs.writeFileSync(filePath, JSON.stringify(obj, undefined, 2), 'utf8');
            cont.resetAnalogDevices();
            return device;
        }
    }
    public static deleteCustomDefintion(id:number) {
        let filePath = path.posix.join(process.cwd(), `/devices/`, 'custom-devices.json');
        let defs = AnalogDevices.loadFile(filePath);
        let device;
        for (let i = defs.length - 1; i >= 0; i--) {
            if (defs[i].id === id) {
                device = defs[i];
                defs.splice(i, 1);
            }
        }
        let obj = { category: 'User Defined', predefined: false, devices: defs };
        fs.writeFileSync(filePath, JSON.stringify(obj, undefined, 2), 'utf8');
        cont.resetAnalogDevices();
        return device;
    }
}
export class ConversionMap {
    constructor(map) {
        this.values = map.values;
        this.values.sort((a, b) => a.input - b.input);
        this.units = map.units;
        this.name = map.name;
    }
    public values: any[];
    public name: string;
    public units: string;
    public mapRange(input): { low: any, high: any } {
        // TODO: Make a binary search or optimized search to improve performance
        // for large maps.  Haven't seen any yet.
        let first = this.values.length > 0 ? this.values[0] : undefined;
        let next;
        for (let i = 0; i < this.values.length; i++) {
            if (this.values[i].input > input) break;
            if (i + 1 < this.values.length) next = this.values[i + 1];
            else break;
            first = this.values[i];
        }
        return { low: first, high: next || first };
    }
    public interpolate(input, units?: string): number {
        let range = this.mapRange(input);
        //logger.info(`Interpolating map ${this.name} ${JSON.stringify(range)}`);
        if (typeof range === 'undefined' || typeof range.low === 'undefined' || range.high === 'undefined') return typeof range.low !== 'undefined' ? range.low.output : undefined;
        let diff = (range.high.input - range.low.input) / input;
        let value = range.low.value + ((range.high.value - range.low.value) * diff);
        if (typeof units !== 'undefined' && units.toLocaleLowerCase() !== this.units.toLocaleLowerCase()) value = UnitsConverter.convertValue(value, this.units, units);
        return value;
    }
    public firstValue(input, units?:string): number {
        let range = this.mapRange(input);
        return typeof range.low !== 'undefined' ? range.low.output : undefined;
    }
    public nextValue(input): number {
        let range = this.mapRange(input);
        return typeof range.high !== 'undefined' ? range.high.output : typeof range.low !== 'undefined' ? range.low.output : undefined;
    }
}
export class UnitsConverter {
    private static converters = {
        f: {
            c: function (val) { return (val - 32) * 5 / 9; },
            k: function (val) { return ((val - 32) * 5 / 9) + 273.15; }
        },
        c: {
            f: function (val) { return val * 9 / 5 + 32 },
            k: function (val) { return val + 273.15; }
        }
    }
    public static convertValue(value, fromUnits, toUnits): number {
        return typeof this.converters[fromUnits.toLowerCase()] !== 'undefined' &&
            typeof this.converters[fromUnits.toLowerCase()][toUnits.toLowerCase] === 'function' ? this.converters[fromUnits.toLowerCase()][toUnits.toLowerCase()](value) : undefined;
    }
}
export class AnalogDevice {
    public category: string;
    public name: string;

}

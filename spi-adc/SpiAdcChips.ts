import { vMaps } from "../boards/Constants";
import * as path from "path";
import * as fs from "fs";
import { logger } from "../logger/Logger";
import * as extend from 'extend';
import { cont } from "../boards/Controller";
export class SpiAdcChips {
    constructor() { }
    public static loadDefintions() {
        let defs = [];
        try {
            let filePath = path.posix.join(process.cwd(), `/spi-adc/`);
            let dirEnt: fs.Dirent[] = fs.readdirSync(filePath, { withFileTypes: true });
            for (let i = 0; i < dirEnt.length; i++) {
                let f = dirEnt[i];
                if (f.isFile) {
                    if (f.name.endsWith('.json')) {
                        let d = SpiAdcChips.loadFile(path.posix.join(filePath, f.name));
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
                if (typeof objs.chips !== 'undefined') {
                    for (let j = 0; j < objs.chips.length; j++) {
                        defs.push(extend(true, { manufacturer: objs.manufacturer, predefined: objs.predefined }, objs.chips[j]));
                    }
                }
            }
            return defs;
        }
        catch (err) { logger.error(err); }
    }
    public static saveCustomDefinition(chip) {
        let filePath = path.posix.join(process.cwd(), `/spi-adc/`, 'custom-adc.json');
        let defs = SpiAdcChips.loadFile(filePath);
        if (typeof defs !== 'undefined') {
            let id = typeof chip.id === 'undefined' ? -1 : parseInt(chip.id, 10)
            if (isNaN(id)) id = -1;
            if (id <= 0) {
                let maxId = 99;
                for (let i = 0; i < defs.length; i++) {
                    let def = defs[i];
                    if (typeof def.id !== undefined) maxId = Math.max(def.id, maxId);
                }
                id = maxId + 1;
            }
            let chipOld = defs.find(elem => elem.id === id);
            if (typeof chipOld !== 'undefined') {
                for (let prop in chip) {
                    chipOld[prop] = chip[prop];
                }
            }
            else {
                chip.id = id;
                defs.push(chip);
            }
            let obj = { manufacturer: 'User Defined', predefined: false, chips: defs };
            fs.writeFileSync(filePath, JSON.stringify(obj, undefined, 2), 'utf8');
            cont.resetSpiAdcChips()
            return chip;
        }
    }
    public static deleteCustomDefintion(id:number) {
        let filePath = path.posix.join(process.cwd(), `/spi-adc/`, 'custom-adc.json');
        let defs = SpiAdcChips.loadFile(filePath);
        let chip;
        for (let i = defs.length - 1; i >= 0; i--) {
            if (defs[i].id === id) {
                chip = defs[i];
                defs.splice(i, 1);
            }
        }
        let obj = { manufacturer: 'User Defined', predefined: false, chips: defs };
        fs.writeFileSync(filePath, JSON.stringify(obj, undefined, 2), 'utf8');
        cont.resetSpiAdcChips();
        return chip;
    }
}

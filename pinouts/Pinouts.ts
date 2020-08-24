import { vMaps } from "../boards/Constants";
import * as path from "path";
import * as fs from "fs";

export class PinDefinitions {
    constructor(board: string) {
        // Load up the board definition from the json data.
    }
    public static loadDefintionByName(name: string) {
        let board = vMaps.controllerTypes.transformByName(name);
        let cfgFile = 'default.json'
        if (typeof board.pinouts === 'string') {
            cfgFile = board.pinouts;
        }
        let filePath = path.posix.join(process.cwd(), `/pinouts/${cfgFile}`);
        let pinouts = JSON.parse(fs.readFileSync(filePath, 'utf8').trim());
        return pinouts;

    }
}

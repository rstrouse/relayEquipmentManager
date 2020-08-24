"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Constants_1 = require("../boards/Constants");
const path = require("path");
const fs = require("fs");
class PinDefinitions {
    constructor(board) {
        // Load up the board definition from the json data.
    }
    static loadDefintionByName(name) {
        let board = Constants_1.vMaps.controllerTypes.transformByName(name);
        let cfgFile = 'default.json';
        if (typeof board.pinouts === 'string') {
            cfgFile = board.pinouts;
        }
        let filePath = path.posix.join(process.cwd(), `/pinouts/${cfgFile}`);
        let pinouts = JSON.parse(fs.readFileSync(filePath, 'utf8').trim());
        return pinouts;
    }
}
exports.PinDefinitions = PinDefinitions;
//# sourceMappingURL=Pinouts.js.map
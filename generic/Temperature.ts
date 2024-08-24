import { logger } from "../logger/Logger";
import { GenericDeviceBase } from "./genericDevices";
import { AnalogDevices } from "../devices/AnalogDevices";
import { utils } from "../boards/Constants";

import { webApp } from "../web/Server";

export class Thermistor10k extends GenericDeviceBase {
    public setValue(prop, value) {
        let replaceSymbols = /(?:\]\.|\[|\.)/g
        let _prop = prop.indexOf(',') > -1 ? prop.replace(replaceSymbols, ',').split(',') : prop;
        // Execute a function, load a module, or ...
        let dt = this.device.getDeviceType();
        let val = value;
        if (typeof dt.inputs !== 'undefined') {
            let inp = dt.inputs.find(x => x.name === prop);
            if (typeof inp !== 'undefined') {
                switch (inp.dataType) {
                    case 'number':
                        if (typeof value.value !== 'undefined') val = value.value;
                        else if (typeof value.adcValue !== 'undefined') val = value.adcValue;
                        break;

                }
            }
        }

        //let obj = this.device.values;
        // for (let i = 0; i < _prop.length; i++) {
        //     obj = obj[_prop[i]];
        // }
        // obj = value;
        this.device.values[_prop] = val;
        this.convertValue(val);
        webApp.emitToClients('genericDataValues', { id: this.device.id, typeId: this.device.typeId, values: this.values });
        this.emitFeeds();
    }
    public convertValue(value: number) {
        let device = this.device;
        let maps = AnalogDevices.maps;
        device.values.inputUnits = device.options.inputType === 'raw' ? '' : device.options.inputType === 'volt' ? 'volts' : device.options.inputResistanceUnits === 1000 ? 'kOhms' : 'ohms';
        device.values.units = device.options.units;
        device.values.maxVal = (device.options.inputType === 'raw') ? (1 << device.options.inputBitness) : device.options.inputType === 'volt' ? device.options.vccRef : 10000;
        switch (device.options.inputType) {
            case 'ohms':
                device.values.resistance = device.values.adcValue * device.options.inputResistanceUnits;
                break;
            case 'kohms':
                device.values.resistance = (10000 * device.values.adcValue) / (device.values.maxVal - device.values.adcValue);
                break;
            case 'raw':
            case 'volt':
                device.values.resistance = 10000 * (device.values.adcValue / (device.values.maxVal - device.values.adcValue));
                break;
        }
        switch (device.options.calcType) {
            case 'shart':
                device.values.tempK = utils.convert.temperature.shart3(device.values.resistance, 0.001125308852122, 0.000234711863267, 0.000000085663516, 'K');
                device.values.tempC = utils.convert.temperature.convertUnits(device.values.tempK, 'K', 'C');
                device.values.tempF = utils.convert.temperature.convertUnits(device.values.tempK, 'K', 'F');
                device.values.temperature = utils.convert.temperature.convertUnits(device.values.tempK, 'K', device.values.units || 'F') + (device.options.calibration || 0);
                break;
            default:
                device.values.tempK = (Math.round(maps['thermistor10k'].interpolate(device.values.resistance, 'K') * 100) / 100);
                device.values.tempC = utils.convert.temperature.convertUnits(device.values.tempK, 'K', 'C');
                device.values.tempF = utils.convert.temperature.convertUnits(device.values.tempK, 'K', 'F');
                device.values.temperature = utils.convert.temperature.convertUnits(device.values.tempK, 'K', device.values.units || 'F') + (device.options.calibration || 0);
                break;
        }
        return value;
    }
}



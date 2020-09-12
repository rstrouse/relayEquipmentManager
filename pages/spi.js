(function ($) {
    $.widget('pic.pnlCfgSpi', {
        options: {},
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._buildControls();
            el[0].bindChipTypes = function (chipTypes) { self.bindChipTypes(chipTypes); }
            el[0].setChannelValue = function (data) { self.setChannelValue(data); }
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('pnl-config-spi');
            el.attr('data-controllerid', o.controllerId);
            $.getLocalService('/config/options/spi/' + o.controllerId, null, function (data, status, xhr) {
                console.log(data);
                o.analogDevices = data.analogDevices;
                var outer = $('<div></div>').appendTo(el).addClass('control-panel');
                var head = $('<div></div>').appendTo(outer).addClass('pnl-settings-header').addClass('control-panel-title');
                $('<span></span>').appendTo(head).addClass('header-text').text('SPI Analog to Digital Settings');
                var settings = $('<div></div>').appendTo(outer).addClass('pnl-adc-controller-settings');
                var line = $('<div></div>').appendTo(settings);
                $('<div></div>').appendTo(line).pickList({
                    required: true,
                    bindColumn: 0, displayColumn: 1, labelText: 'ADC Chip', binding: 'adcChipType',
                    columns: [{ hidden: true, binding: 'id', text: 'Id', style: { whiteSpace: 'nowrap' } }, { hidden: false, binding: 'name', text: 'Chip', style: { whiteSpace: 'nowrap' } }, { binding: 'manufacturer', text: 'Manufacturer', style: { width: '297px', whiteSpace: 'nowrap' } }],
                    items: data.adcChipTypes, inputAttrs: { style: { width: '10rem' } }, labelAttrs: { style: { width: '5.7rem' } }
                }).
                    on('selchanged', function (evt) {
                        self.setAdcChip(evt.newItem);
                    });
                line = $('<div></div>').appendTo(settings);
                $('<div></div>').appendTo(line).valueSpinner({ canEdit: true, binding: 'spiClock', units: 'kHz', labelText: 'SPI Clock', step: 100, fmtMask: '#,##0.####', fmtEmpty: '', min: 7, max: 150000, labelAttrs: { style: { width: '5.7rem' } }, inputAttrs: { style: { width: '6.7rem' } } });
                line = $('<div></div>').appendTo(settings);
                $('<div></div>').appendTo(line).pickList({
                    required: true,
                    bindColumn: 0, displayColumn: 1, labelText: 'vREF', binding: 'referenceVoltage', units: 'volts',
                    columns: [{ hidden: true, binding: 'val', text: 'Id', style: { whiteSpace: 'nowrap' } }, { hidden: false, binding: 'name', text: 'Voltage', style: { whiteSpace: 'nowrap' } }],
                    items: [{ val: 3.3, name: '3.3' }, { val: 5.0, name: '5.0' }], inputAttrs: { style: { width: '3.7rem' } }, labelAttrs: { style: { width: '5.7rem' } }
                });

                var pnlChip = $('<div></div>').appendTo(outer).addClass('pnl-adc-parameters').hide();
                line = $('<div></div>').appendTo(pnlChip);
                $('<div></div>').appendTo(line).staticField({ binding: 'manufacturer', labelText: 'Supplier', labelAttrs: { style: { width: '5.7rem' } } });
                line = $('<div></div>').appendTo(pnlChip);
                $('<div></div>').appendTo(line).staticField({ binding: 'maxChannels', labelText: 'Channels', dataType:'int', labelAttrs: { style: { width: '5.7rem' } } });
                $('<div></div>').appendTo(line).staticField({ binding: 'bits', labelText: 'Bits', dataType:'int', labelAttrs: { style: { marginLeft: '1rem', marginRight: '.15rem' } } });
                $('<hr></hr>').appendTo(outer);
                var channels = $('<div></div>').appendTo(outer).addClass('pnl-adc-channels').hide();
                // Build out 32 channels worth for the adc.
                for (var i = 0; i < 32; i++) {
                    $('<div></div>').appendTo(channels).pnlSpiChannel({ controllerId: o.controllerId, channelId: i, analogDevices: o.analogDevices });
                }
                var btnPnl = $('<div class="btn-panel"></div>').appendTo(outer);
                $('<div></div>').appendTo(btnPnl).actionButton({ text: 'Define ADC Chip Types', icon: '<i class="fas fa-microchip"></i>' })
                    .on('click', function (evt) { self.defineChip(); });
                $('<div></div>').appendTo(btnPnl).actionButton({ text: 'Save Settings', icon: '<i class="fas fa-save"></i>' })
                    .on('click', function (evt) { self.saveSettings(); });
                o.adcChipTypes = data.adcChipTypes;
                self.dataBind(data.spi);
            });
        },
        dataBind: function (spi) {
            var self = this, o = self.options, el = self.element;
            var ct = o.adcChipTypes.find(elem => elem.id === spi.adcChipType);
            //self.setAdcChip(ct);
            var data = $.extend(true, {}, spi, { maxChannels: ct.maxChannels, bits: ct.bits });
            console.log(spi);
            dataBinder.bind(el, data);
           
        },
        createAdcChannel: function (channelId) {
            var self = this, o = self.options, el = self.element;
            var binding = 'channels[' + channelId + '].';
            var acc = $('<div></div>').accordian({
                columns: [{ text: 'Channel #' + channelId, glyph: 'fas fa-code-branch', style: { width: '10.5rem' } },
                    { binding: 'device', style: { width: '15rem', whiteSpace:'nowrap', textOverflow:'ellipsis' } }, { binding: 'value', style: { textAlign: 'right', width:'10rem' } }]
            });
            
            acc.attr('data-channelid', channelId);
            var contents = acc.find('div.picAccordian-contents');
            var line = $('<div></div>').appendTo(contents);
            $('<div></div>').appendTo(line).checkbox({ binding: binding + 'isActive', labelText: 'Is Active', style: {} }).on('changed', function (evt) {
                acc[0].columns()[0].elGlyph().attr('class', evt.newVal ? 'fas fa-share-alt' : 'fas fa-share-alt').css({ textShadow: evt.newVal ? '0px 0px 3px green' : '', color: evt.newVal ? 'darkGreen' : '' });
            });
            $('<div></div>').appendTo(line).pickList({
                binding: binding + 'deviceId', labelText: 'Device',
                bindColumn: 0, displayColumn: 1,
                columns: [{ hidden: true, binding: 'id', text: 'Id', style: { whiteSpace: 'nowrap' } }, { hidden: false, binding: 'name', text: 'Device Name', style: { whiteSpace: 'nowrap' } }, { hidden: false, binding: 'category', text: 'Category', style: { whiteSpace: 'nowrap' } }],
                items: o.analogDevices, inputAttrs: { style: { width: '14rem' } }, labelAttrs: { style: { marginLeft: '1rem' } }
            }).on('selchanged', function (evt) {
                console.log(evt.newItem);
                });

            return acc;

        },
        saveSettings: function () {
            var self = this, o = self.options, el = self.element;
            if (dataBinder.checkRequired(el, true)) {
                var settings = dataBinder.fromElement(el);
                settings.channels.length = settings.maxChannels || 0;
                console.log(settings);
                $.putLocalService('/config/spi/' + o.controllerId, settings, 'Saving SPI' + o.controllerId + ' Settings...', function (data, status, xhr) {
                    self.dataBind(data);
                });
            }
        },
        defineChip: function () {
            var self = this, o = self.options, el = self.element;
            var dlgCopy = $.pic.modalDialog.createDialog('dlgDefineAdcChips', {
                width: '377px',
                height: 'auto',
                title: 'Define SPI ADC Chip Types',
                position: { my: "center top", at: "center top", of: window },
                buttons: [
                    {
                        text: 'Cancel', icon: '<i class="far fa-window-close"></i>',
                        click: function () { $.pic.modalDialog.closeDialog(this); }
                    }
                ]
            });
            var pnl = $('<div></div>').appendTo(dlgCopy).pnlDefineChipTypes({ adcChipTypes: o.adcChipTypes });
        },
        bindChipTypes: function (chipTypes) {
            var self = this, o = self.options, el = self.element;
            o.adcChipTypes = chipTypes;
            var settings = el.find('div.pnl-adc-controller-settings');
            var spi = dataBinder.fromElement(settings);
            var ddChipTypes = el.find('div.picPickList[data-bind="adcChipType"]');
            if (spi.adcChipType !== 'undefined' && spi.adcChipType > 0) {
                var ct = o.adcChipTypes.find(elem => spi.adcChipType === elem.id);
                if (typeof ct === 'undefined') {
                    ddChipTypes.each(function () { this.val(0); });
                    self.setAdcChip();
                }
                else
                    self.setAdcChip(ct);
            }
            ddChipTypes.each(function () { this.items(chipTypes); });
        },
        editChipDefinition: function (chip) {
            var self = this, o = self.options, el = self.element;
            var dlgCopy = $('div#dlgDefineAdcChips');
            var dlg = $.pic.modalDialog.createDialog('dlgDefineAdc', {
                width: '747px',
                height: 'auto',
                title: 'Define Analog to Digital Converter Chip',
                position: { my: "center top", at: "center top", of: window },
                buttons: [
                    {
                        id: 'btnSaveAs',
                        hidden: typeof chip === 'undefined',
                        text: 'Save Copy...', icon: '<i class="fas fa-save"></i>',
                        click: function (evt) {
                            if (dataBinder.checkRequired(dlg, true)) {
                                var c = dataBinder.fromElement(dlg);
                                c.id = -1;
                                c.predefined = false;
                                $.putLocalService('/config/options/spi/chipType', c, 'Adding new Chip Definition...', function (data, status, xhr) {
                                    dataBinder.bind(dlg, data.chipType);
                                    dlg.find('div#btnSave').show();
                                    dlgCopy[0].bindChipTypes(data.adcChipTypes);
                                    self.bindChipTypes(data.adcChipTypes);
                                    //$.pic.modalDialog.closeDialog(this);
                                });
                            }
                        }
                    },
                    {
                        id: 'btnSave',
                        hidden: typeof chip !== 'undefined' && chip.predefined,
                        text: 'Save', icon: '<i class="fas fa-save"></i>',
                        click: function (evt) {
                            if (dataBinder.checkRequired(dlg, true)) {
                                var c = dataBinder.fromElement(dlg);
                                c.predefined = false;
                                $.putLocalService('/config/options/spi/chipType', c, 'Saving Chip Definition...', function (data, status, xhr) {
                                    dataBinder.bind(dlg, data.chipType);
                                    //$.pic.modalDialog.closeDialog(this);
                                    dlgCopy[0].bindChipTypes(data.adcChipTypes);
                                    self.bindChipTypes(data.adcChipTypes);
                                });
                            }
                        }
                    },
                    {
                        text: 'Cancel', icon: '<i class="far fa-window-close"></i>',
                        click: function () { $.pic.modalDialog.closeDialog(this); }
                    }
                ]
            });
            var line = $('<div></div>').appendTo(dlg);
            $('<input type="hidden"></input>').appendTo(line).attr('data-bind', 'id').attr('data-datatype', 'int');
            $('<div></div>').appendTo(line).inputField({ required: true, binding: 'name', labelText: 'Name', labelAttrs: { style: { width: '5rem' } }, inputAttrs: { maxlength: 16, style: { width: '16rem' } } });
            line = $('<div></div>').appendTo(dlg);
            $('<div></div>').appendTo(line).inputField({ required: true, binding: 'manufacturer', labelText: 'Supplier', labelAttrs: { style: { width: '5rem' } }, inputAttrs: { maxlength: 24, style: { width: '16rem' } } });
            line = $('<div></div>').appendTo(dlg);
            $('<div></div>').appendTo(line).valueSpinner({ required: true, binding: 'maxChannels', labelText: 'Channels', min: 1, max: 32, labelAttrs: { style: { width: '5rem' } } });
            $('<div></div>').appendTo(line).valueSpinner({ required: true, binding: 'bits', labelText: 'Bits', min: 1, max: 32, labelAttrs: { style: { marginLeft: '1rem', marginRight: '.15rem' } } });
            line = $('<div></div>').appendTo(dlg);
            $('<div></div>').appendTo(line).scriptEditor({ binding: 'getValue', prefix: 'getValue(buffer): number {', suffix: '}', codeStyle: { maxHeight: '300px', overflow: 'auto' } });
            line = $('<div></div>').appendTo(dlg);
            $('<div></div>').appendTo(line).scriptEditor({ binding: 'readChannel', prefix: 'readChannel(channel): Buffer {', suffix: '}', codeStyle: { maxHeight: '300px', overflow: 'auto' } });
            if (typeof chip !== 'undefined') { dataBinder.bind(dlg, chip); }
        },
        setAdcChip: function (chipType) {
            var self = this, o = self.options, el = self.element;
            var pnl = el.find('div.pnl-adc-parameters:first');
            if (typeof chipType === 'undefined') {
                el.find('div.pnl-adc-channels').hide();
                pnl.hide();
            }
            else {
                //console.log({ bits: chipType.bits, max: Math.pow(2, chipType.bits) - 1 });
                dataBinder.bind(pnl, chipType);
                if (pnl.attr('data-chiptype') !== chipType.id) {

                }
                el.find('div[data-bind="spiClock"]').each(function () { this.val(chipType.spiClock); })
                pnl.attr('data-chiptype', chipType.id);
                var channels = el.find('div.pnl-adc-channels > div.pnl-spi-channel');
                channels.each(function () {
                    var chan = $(this);
                    if (parseInt(chan.attr('data-channelid'), 10) > chipType.maxChannels - 1) chan.hide();
                    else chan.show();
                });
                el.find('div.pnl-adc-channels').show();
                pnl.show();
            }
        },
        setChannelValue: function (data) {
            var self = this, o = self.options, el = self.element;
            el.find('div.picAccordian[data-channelid="' + data.channel + '"]').each(function () {
                var cols = this.columns();
                cols[2].elText().text(data.raw + '/' + data.converted);
            });
        }
    });
    $.widget('pic.pnlSpiChannel', {
        options: {},
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._buildControls();
            el[0].dataBind = function (data) { return self.dataBind(data); };
            el[0].val = function (val) { return self.val(val); }
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('pnl-spi-channel');
            el.attr('data-channelid', o.channelId);
            var channelId = o.channelId;
            el.attr('data-bind', 'channels[' + channelId + ']');
            var binding = 'channels[' + channelId + '].';
            var acc = $('<div></div>').appendTo(el).accordian({
                columns: [{ text: 'Channel #' + channelId, glyph: 'fas fa-code-branch', style: { width: '10.5rem' } },
                { binding: 'device', style: { width: '14rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis' } }, { binding: 'value', style: { textAlign: 'right', width: '10rem' } }]
            });
            acc.attr('data-channelid', channelId);
            var contents = acc.find('div.picAccordian-contents');
            var line = $('<div></div>').appendTo(contents);
            $('<div></div>').appendTo(line).checkbox({ binding: binding + 'isActive', labelText: 'Is Active', style: {} }).on('changed', function (evt) {
                acc[0].columns()[0].elGlyph().attr('class', evt.newVal ? 'fas fa-share-alt' : 'fas fa-share-alt').css({ textShadow: evt.newVal ? '0px 0px 3px green' : '', color: evt.newVal ? 'darkGreen' : '' });
            });
            $('<div></div>').appendTo(line).pickList({
                binding: binding + 'deviceId', labelText: 'Device',
                bindColumn: 0, displayColumn: 1,
                columns: [{ hidden: true, binding: 'id', text: 'Id', style: { whiteSpace: 'nowrap' } }, { hidden: false, binding: 'name', text: 'Device Name', style: { whiteSpace: 'nowrap' } }, { hidden: false, binding: 'category', text: 'Category', style: { whiteSpace: 'nowrap' } }],
                items: o.analogDevices, inputAttrs: { style: { width: '14rem' } }, labelAttrs: { style: { marginLeft: '1rem' } }
            }).on('selchanged', function (evt) {
                console.log('Sel Changed called');
                self.createDeviceOptions(evt.newItem);
            });
            var fs = $('<fieldset></fieldset>').appendTo(line).addClass('pnl-analog-device-options').hide();
            $('<legend></legend>').appendTo(fs).text('Device Options');
            $('<div></div>').appendTo(fs).addClass('pnl-analog-device-options');
            $('<div></div>').appendTo(contents).pnlSpiFeeds({ binding: binding + 'feeds', channelId: channelId, controllerId: o.controllerId });

        },
        createDeviceOptions: function (devType, data) {
            var self = this, o = self.options, el = self.element;
            var fs = el.find('fieldset.pnl-analog-device-options');
            var pnl = el.find('div.pnl-analog-device-options');
            if (typeof devType !== 'undefined' && typeof devType.options !== 'undefined') {
                fs.show();
                var binding = 'channels[' + o.channelId + '].options.'
                if (pnl.attr('data-devicetypeid') !== devType.id.toString()) {
                    pnl.empty();
                    //console.log(`Resetting Options ${pnl.attr("data-devicetypeid")} - ${devType.id}`);
                    pnl.attr('data-devicetypeid', devType.id);
                    for (var prop in devType.options) {
                        var opt = devType.options[prop];
                        var val = typeof data !== 'undefined' ? data[prop] || opt.default : opt.default;
                        if (typeof opt.field !== 'undefined') {
                            var fld;
                            switch (opt.field.type) {
                                case 'hidden':
                                    $('<input type="hidden"></input>').appendTo(pnl).attr('data-bind', binding + prop).attr('data-datatype', opt.dataType).val(val);
                                    break;
                                case 'pickList':
                                    fld = $('<div></div>').appendTo(pnl).pickList(opt.field).attr('data-bind', binding + prop);
                                    break;
                                case 'valueSpinner':
                                    fld = $('<div></div>').appendTo(pnl).pickList(opt.field).attr('data-bind', binding + prop);
                                    break;
                                case 'timeSpinner':
                                    fld = $('<div></div>').appendTo(pnl).timeSpinner(opt.field).attr('data-bind', binding + prop);
                                    break;
                                case 'inputField':
                                    fld = $('<div></div>').appendTo(pnl).staticField(opt.field).attr('data-bind', binding + prop);
                                    break;
                                case 'dateField':
                                    fld = $('<div></div>').appendTo(pnl).dateField(opt.field).attr('data-bind', binding + prop);
                                    break;
                                case 'optionButton':
                                    fld = $('<div></div>').appendTo(pnl).optionButton(opt.field).attr('data-bind', binding + prop);
                                    break;
                                case 'staticField':
                                    fld = $('<div></div>').appendTo(pnl).staticField(opt.field).attr('data-bind', binding + prop);
                                    break;
                                case 'checkbox':
                                    fld = $('<div></div>').appendTo(pnl).checkbox(opt.field).attr('data-bind', binding + prop);
                                    break;
                                case 'actionButton':
                                    fld = $('<div></div>').appendTo(pnl).actionButton(opt.field).attr('data-bind', binding + prop);
                                    break;
                                case 'toggleButton':
                                    fld = $('<div></div>').appendTo(pnl).toggleButton(opt.field).attr('data-bind', binding + prop);
                                    break;
                                case 'colorPicker':
                                    fld = $('<div></div>').appendTo(pnl).colorPicker(opt.field).attr('data-bind', binding + prop);
                                    break;
                            }
                            if (typeof fld !== 'undefined' && typeof fld[0].val === 'function') fld[0].val(val);
                        }
                    }
                }
            }
            else {
                fs.hide(); pnl.empty();
            }
        },
        val: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val === 'undefined') {
                var baseBinding = el.attr('data-bind');
                if (typeof baseBinding !== 'undefined' && !baseBinding.endsWith('.')) baseBinding += '.';
                return dataBinder.fromElement(el.find('div.picAccordian-contents:first'), undefined, undefined, baseBinding);
            }
            else {
                self.dataBind(val);
            }
        },
        dataBind: function (data) {
            var self = this, o = self.options, el = self.element;
            el.find('div[data-bind$="deviceId"]').each(function () {
                var devType = o.analogDevices.find(elem => elem.id === data.deviceId);
                if (typeof devType !== 'undefined') {
                    self.createDeviceOptions(devType, data.options);
                }
                this.val(data.deviceId);
            });
        },
    });
    $.widget('pic.pnlDefineChipTypes', {
        options: {},
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._buildControls();
            el[0].bindChipTypes = function (chipTypes) { self.bindChipTypes(chipTypes); }
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('pnl-defineChipTypes');
            var crudChips = $('<div></div>').appendTo(el).crudList({
                id: 'crudSpiAdcChips',
                key: 'id',
                caption: 'SPI ADC Chip Definitions', itemName: 'Chip Definition',
                columns: [{ binding: 'name', text: 'Name', dataType: 'int', style: { width: '97px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, { binding: 'manufacturer', text: 'Supplier', style: { width: '197px' } }]
            }).on('additem', function (evt) {
                self.editChipDefinition();
            }).on('edititem', function (evt) {
                self.editChipDefinition(evt.dataRow.data('adcchiptype'));
            }).on('removeitem', function (evt) {
                var ctype = o.adcChipTypes.find(elem => elem.id === evt.dataKey);
                $.pic.modalDialog.createConfirm('dlgConfirmDeleteChipDefinition', {
                    message: `Are you sure you want to delete ADC Chip Definition <span style="font-weight:bold;">${ctype.name}</span> from <span style="font-weight:bold;">${ctype.manufacturer}</span>?`,
                    width: '350px',
                    height: 'auto',
                    title: 'Confirm Remove Chip Definition',
                    buttons: [{
                        text: 'Yes', icon: '<i class="fas fa-trash"></i>',
                        click: function () {
                            $.pic.modalDialog.closeDialog(this);
                            $.deleteLocalService('/config/options/spi/chipType/' + ctype.id, {}, 'Deleting ADC Chip Definition...', function (c, status, xhr) {
                                self.bindChipTypes(c.adcChipTypes);
                            });
                        }
                    },
                    {
                        text: 'No', icon: '<i class="far fa-window-close"></i>',
                        click: function () { $.pic.modalDialog.closeDialog(this); }
                    }]
                });
            });
            self.bindChipTypes(o.adcChipTypes);
        },
        bindChipTypes: function (chipTypes) {
            var self = this, o = self.options, el = self.element;
            var crudChips = el.find('div#crudSpiAdcChips');
            crudChips[0].clear();
            for (var i = 0; i < chipTypes.length; i++) {
                var chip = chipTypes[i];
                var row = crudChips[0].addRow(chip);
                row.data('adcchiptype', chip);
                if (chip.predefined) row.find('span.btn-remove').addClass('disabled');
            }
            o.adcChipTypes = chipTypes;
            var pnlSpi = $('div.pnl-config-spi');
            pnlSpi.each(function () { this.bindChipTypes(chipTypes) });
        },
        editChipDefinition: function (chip) {
            var self = this, o = self.options, el = self.element;
            var pnlSpi = $('div.pnl-config-spi');
            var dlg = $.pic.modalDialog.createDialog('dlgDefineAdc', {
                width: '747px',
                height: 'auto',
                title: 'Define Analog to Digital Converter Chip',
                position: { my: "center top", at: "center top", of: window },
                buttons: [
                    {
                        id: 'btnSaveAs',
                        hidden: typeof chip === 'undefined',
                        text: 'Save Copy...', icon: '<i class="fas fa-save"></i>',
                        click: function (evt) {
                            if (dataBinder.checkRequired(dlg, true)) {
                                var c = dataBinder.fromElement(dlg);
                                c.id = -1;
                                c.predefined = false;
                                $.putLocalService('/config/options/spi/chipType', c, 'Adding new Chip Definition...', function (data, status, xhr) {
                                    dataBinder.bind(dlg, data.chipType);
                                    dlg.find('div#btnSave').show();
                                    self.bindChipTypes(data.adcChipTypes);
                                });
                            }
                        }
                    },
                    {
                        id: 'btnSave',
                        hidden: typeof chip !== 'undefined' && chip.predefined,
                        text: 'Save', icon: '<i class="fas fa-save"></i>',
                        click: function (evt) {
                            if (dataBinder.checkRequired(dlg, true)) {
                                var c = dataBinder.fromElement(dlg);
                                c.predefined = false;
                                $.putLocalService('/config/options/spi/chipType', c, 'Saving Chip Definition...', function (data, status, xhr) {
                                    dataBinder.bind(dlg, data.chipType);
                                    self.bindChipTypes(data.adcChipTypes);
                                });
                            }
                        }
                    },
                    {
                        text: 'Cancel', icon: '<i class="far fa-window-close"></i>',
                        click: function () { $.pic.modalDialog.closeDialog(this); }
                    }
                ]
            });
            $('<div></div>').appendTo(dlg).pnlEditSpiChipType({ chipType: chip });
        }
    });
    $.widget('pic.pnlEditSpiChipType', {
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._buildControls();
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('pnl-edit-spi-chiptype');
            var line = $('<div></div>').appendTo(el);
            $('<input type="hidden"></input>').appendTo(line).attr('data-bind', 'id').attr('data-datatype', 'int');
            $('<div></div>').appendTo(line).inputField({ required: true, binding: 'name', labelText: 'Name', labelAttrs: { style: { width: '5rem' } }, inputAttrs: { maxlength: 16, style: { width: '16rem' } } });
            line = $('<div></div>').appendTo(el);
            $('<div></div>').appendTo(line).inputField({ required: true, binding: 'manufacturer', labelText: 'Supplier', labelAttrs: { style: { width: '5rem' } }, inputAttrs: { maxlength: 24, style: { width: '16rem' } } });
            line = $('<div></div>').appendTo(el);
            $('<div></div>').appendTo(line).valueSpinner({ required: true, binding: 'maxChannels', labelText: 'Channels', min: 1, max: 32, labelAttrs: { style: { width: '5rem' } } });
            $('<div></div>').appendTo(line).valueSpinner({ required: true, binding: 'bits', labelText: 'Bits', min: 1, max: 32, labelAttrs: { style: { marginLeft: '1rem', marginRight: '.15rem' } } });
            line = $('<div></div>').appendTo(el);
            $('<div></div>').appendTo(line).valueSpinner({ canEdit: true, binding: 'spiClock', units: 'kHz', labelText: 'SPI Clock', step: 100, fmtMask: '#,##0.####', fmtEmpty: '', min: 7, max: 150000, labelAttrs: { style: { width: '5rem' } }, inputAttrs: { style: { width: '6.7rem' } } });
            line = $('<div></div>').appendTo(el);
            $('<div></div>').appendTo(line).scriptEditor({ binding: 'getValue', prefix: 'getValue(buffer): number {', suffix: '}', codeStyle: { maxHeight: '300px', overflow: 'auto' } });
            line = $('<div></div>').appendTo(el);
            $('<div></div>').appendTo(line).scriptEditor({ binding: 'readChannel', prefix: 'readChannel(channel): Buffer {', suffix: '}', codeStyle: { maxHeight: '300px', overflow: 'auto' } });
            if (typeof o.chipType !== 'undefined') { dataBinder.bind(el, o.chipType); }
        }

    });
    $.widget('pic.pnlSpiFeeds', {
        options: {},
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._buildControls();
            el[0].dataBind = function (data) { return self.dataBind(data); };
            el[0].val = function (val) { return self.val(val); }
        },
        _createFeedDialog: function (id, title, f) {
            var self = this, o = self.options, el = self.element;
            var dlg = $.pic.modalDialog.createDialog(id, {
                width: '497px',
                height: 'auto',
                title: title,
                position: { my: "center top", at: "center top", of: window },
                buttons: [
                    {
                        text: 'Save', icon: '<i class="fas fa-save"></i>',
                        click: function (evt) {
                            var feed = dataBinder.fromElement(dlg);
                            if (dataBinder.checkRequired(dlg, true)) {
                                feed.connection = dlg.find('div[data-bind="connectionId"]')[0].selectedItem();
                                self.saveFeed(feed);
                                $.pic.modalDialog.closeDialog(this);
                            }
                        }
                    },
                    {
                        text: 'Cancel', icon: '<i class="far fa-window-close"></i>',
                        click: function () { $.pic.modalDialog.closeDialog(this); }
                    }
                ]
            });
            $('<div></div>').appendTo(dlg).text('A Data Feed is used to transport data to the specified data source.  You can add multiple data feeds for the specified channel.');
            $('<hr></hr>').appendTo(dlg);
            var line = $('<div></div>').appendTo(dlg);
            $('<input type="hidden"></input>').appendTo(dlg).attr('data-bind', 'id').attr('data-datatype', 'int').val(-1);
            $('<div></div>').appendTo(line).pickList({
                required: true,
                bindColumn: 0, displayColumn: 1, labelText: 'Connection', binding: 'connectionId',
                columns: [{ hidden: true, binding: 'id', text: 'Id', style: { whiteSpace: 'nowrap' } }, { binding: 'name', text: 'Name', style: { minWidth: '197px' } }, { binding: 'type.desc', text: 'Type', style: { minWidth: '147px' } }],
                items: f.connections, inputAttrs: { style: { width: '12rem' } }, labelAttrs: { style: { width: '7rem' } }
            })
                .on('selchanged', function (evt) {
                    dlg.find('div.pnl-spi-feed-params').each(function () { this.setConnection(evt.newItem); });
                });
            $('<div></div>').appendTo(line).checkbox({ labelText: 'Is Active', binding: 'isActive', value: true });
            line = $('<div></div>').appendTo(dlg);
            $('<div></div>').appendTo(dlg).pnlSpiFeedParams({});
            if (typeof f.feed.id !== 'undefined') {
                dlg.find('div.pnl-spi-feed-params').each(function () {
                    var pnl = this;
                    this.dataBind(f.feed);
                });
                dataBinder.bind(dlg, f.feed);
            }
            dlg.css({ overflow: 'visible' });
            return dlg;
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('pnl-spi-feeds').addClass('list-outer');
            el.attr('data-bind', o.binding)
            $('<div></div>').appendTo(el).crudList({
                id: 'crudFeeds' + o.channelId,
                key: 'id',
                caption: 'Channel Feeds', itemName: 'Channel Feeds',
                columns: [{ binding: 'connection.name', text: 'Connection', style: { width: '157px' } }, { binding: 'eventName', text: 'Topic/Event', style: { width: '127px' } }, { binding: 'property', text: 'Property', style: { width: '247px' }, cellStyle: { } }]
            }).on('additem', function (evt) {
                $.getLocalService('/config/options/spi/' + o.controllerId + '/' + o.channelId + '/feeds', null, function (feeds, status, xhr) {
                    feeds.feed = { isActive: true };
                    self._createFeedDialog('dlgAddSpiFeed', 'Add Feed to Channel #' + o.channelId, feeds);
                });
            }).on('edititem', function (evt) {
                $.getLocalService('/config/options/spi/' + o.controllerId + '/' + o.channelId + '/feeds', null, function (feeds, status, xhr) {
                    feeds.feed = o.feeds[evt.dataKey - 1];
                    self._createFeedDialog('dlgEditSpiFeed', 'Edit SPI Channel #' + o.channelId + ' Feed', feeds);
                });
            }).on('removeitem', function (evt) {
                $.pic.modalDialog.createConfirm('dlgConfirmDeleteSpiFeed', {
                    message: 'Are you sure you want to delete Channel Feed?',
                    width: '350px',
                    height: 'auto',
                    title: 'Confirm Delete Channel Feed',
                    buttons: [{
                        text: 'Yes', icon: '<i class="fas fa-trash"></i>',
                        click: function () {
                            $.pic.modalDialog.closeDialog(this);
                            o.feeds.splice(evt.dataKey - 1, 1);
                            self.loadFeeds(o.feeds);
                        }
                    },
                    {
                        text: 'No', icon: '<i class="far fa-window-close"></i>',
                        click: function () { $.pic.modalDialog.closeDialog(this); }
                    }]
                });
            });
            $('<div></div>').appendTo(el).addClass('pnl-spi-feeds-body');
            //$('<input type="hidden"></input>').attr('data-bind', 'pin.headerId').appendTo(el).attr('data-datatype', 'int');;
            //$('<input type="hidden"></input>').attr('data-bind', 'pin.id').appendTo(el).attr('data-datatype', 'int');
        },
        dataBind: function (data) {
            var self = this, o = self.options, el = self.element;
            dataBinder.bind(el, data);
        },
        loadFeeds: function (feeds) {
            var self = this, o = self.options, el = self.element;
            el.find('div[id^=crudFeeds]').each(function () {
                this.clear();
                for (var i = 0; i < feeds.length; i++) {
                    feeds[i].id = i + 1;
                    this.addRow(feeds[i]);
                }
                o.feeds = feeds;
            });
        },
        val: function (val) {
            var self = this, o = self.options, el = self.element;
            if (typeof val !== 'undefined') self.loadFeeds(val);
            else return o.feeds;
        },
        saveFeed: function (feed) {
            var self = this, o = self.options, el = self.element;
            console.log(feed);
            if (typeof feed.id === 'undefined' || feed.id <= 0 || feed.id - 1 >= o.feeds.length) {
                feed.id = o.feeds.length + 1;
                o.feeds.push(feed);
            }
            else {
                o.feeds[feed.id - 1] = feed;
            }
            self.loadFeeds(o.feeds);
        }
    });
    $.widget('pic.pnlSpiFeedParams', {
        options: {},
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._buildControls();
            el[0].setConnection = function (conn) { self.setConnection(conn); };
            el[0].dataBind = function (data) { self.dataBind(data); };
            el[0].setTopic = function (data) { self.setTopic(data); };
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('pnl-spi-feed-params');
        },
        setTopic: function () {
            var self = this, o = self.options, el = self.element;

        },
        dataBind: function (data) {
            var self = this, o = self.options, el = self.element;
            self.setConnection(data.connection, function () {
                if (typeof data.eventName !== 'undefined') {
                    var fldEventName = el.find('div[data-bind="eventName"]');
                    if (fldEventName[0].val() !== data.eventName) {
                        fldEventName[0].val(data.eventName);
                        dataBinder.bind(el, data);
                    }
                }
                else {
                    dataBinder.bind(el, data);
                }
            });
        },
        setConnection: function (conn, callback) {
            var self = this, o = self.options, el = self.element;
            let type = typeof conn !== 'undefined' && typeof conn.type !== 'undefined' && conn.id > 0 ? conn.type.name : '';
            if (el.attr('data-conntype') !== type || type === '') {
                el.attr('data-conntype', type);
                el.empty();
                o.bindings = undefined;
                if (type !== '') {
                    $.searchLocalService('/config/connection/bindings', { name: type }, 'Getting Connection Bindings...', function (bindings, status, xhr) {
                        o.bindings = bindings;
                        var line = $('<div></div>').appendTo(el);
                        var lbl = type === 'njspc' || type === 'webSocket' ? 'Socket Event' : 'Topic';
                        if (typeof o.bindings.feeds !== 'undefined' && o.bindings.feeds.length >= 1) {
                            $('<div></div>').appendTo(line).pickList({
                                required: true,
                                bindColumn: 0, displayColumn: 0, labelText: lbl, binding: 'eventName',
                                columns: [{ binding: 'name', text: 'Name', style: { whiteSpace: 'nowrap' } }],
                                items: bindings.feeds, inputAttrs: { style: { width: '7rem' } }, labelAttrs: { style: { width: '7rem' } }
                            })
                                .on('selchanged', function (evt) {
                                    var itm = o.bindings.feeds.find(elem => elem.name === evt.newItem.name);
                                    self._build_bindings(itm);
                                });
                        }
                        else {
                            $('<div></div>').appendTo(line).inputField({
                                required: true, binding: 'eventName', labelText: "Topic", inputAttrs: { style: { width: '7rem' } }, labelAttrs: { style: { width: '7rem' } }
                            });
                        }
                        $('<hr></hr>').appendTo(el);
                        if (typeof callback === 'function') { callback(); }
                    });
                }
                else if (typeof callback === 'function') { callback(); }
            }
            //else if (typeof callback === 'function') { console.log('callback2 called'); callback(); }
        },
        _build_bindings: function (feed) {
            var self = this, o = self.options, el = self.element;
            var line = $('<div></div>').appendTo(el);
            $('<div></div>').appendTo(line).pickList({
                canEdit: true,
                binding: 'property', labelText: 'Property',
                bindColumn: 0, displayColumn: 0,
                columns: [{ binding: 'binding', text: 'Variable', style: { whiteSpace: 'nowrap' } }],
                items: feed.bindings, inputAttrs: { style: { width: '12rem' } }, labelAttrs: { style: { width: '7rem' } }
            });

            $('<div></div>').appendTo(line).valueSpinner({
                required: true, canEdit:true, binding: 'frequency', labelText: 'Send Every', fmtMask: '#,###.##', dataType: 'number', step:.1,
                min: .1, max: 1000, units: 'seconds', inputAttrs: { style: { width: '4rem' } }, labelAttrs: { style: { width: '7rem' } }
            });
            $('<div></div>').appendTo(line).checkbox({ binding: 'changesOnly', labelText: 'Only When Changed', style: { marginLeft: '1rem' } });

        }
    });
})(jQuery);

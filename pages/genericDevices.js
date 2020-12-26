(function ($) {
    $.widget('pic.pnlCfgGenericDevices', {
        options: { cfg: {} },
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._buildControls();
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            var tabs = $('<div class="picTabPanel"></div>');
            el.addClass('config-general');
            $.getLocalService('/config/options/genericDevices', null, function (data, status, xhr) {
                var outer = $('<div></div>').appendTo(el).addClass('control-panel');
                var head = $('<div></div>').appendTo(outer).addClass('pnl-settings-header').addClass('control-panel-title');
                $('<span></span>').appendTo(head).addClass('header-text').text('Manage Generic Devices');
                $('<br></br>').appendTo(outer);
                var devices = $('<div></div>').appendTo(outer).pnlDevices();
                // o.deviceTypes = data.deviceTypes;
                devices[0].dataBind(data.genericDevices.devices);
            });
        }
    });

    $.widget('pic.pnlDevices', {
        options: { cfg: {} },
        // The devices need to be things like
        // 1. Pressure Guages
        // 2. Slack
        // 3. 10k Temp Sensors
        // 4. NTC Thermistors
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._buildControls();
            el[0].dataBind = function (genDev) { self.dataBind(genDev); }
        },
        _reloadGenericDevices() {
            var self = this, o = self.options, el = self.element;
            $.getLocalService('/config/options/genericDevices', null, function (genDev, status, xhr) {
                console.log(genDev);
                self.dataBind(genDev.genericDevices.devices);
            });
        },
        _createDeviceDialog: function (id, title, deviceTypes) {
            console.log(deviceTypes)
            var self = this, o = self.options, el = self.element;
            var dlg = $.pic.modalDialog.createDialog(id, {
                width: '570px',
                height: 'auto',
                title: title,
                buttons: [
                    {
                        text: 'Save', icon: '<i class="fas fa-save"></i>',
                        click: function () {
                            var device = dataBinder.fromElement(dlg);
                            if (dataBinder.checkRequired(dlg, true)) {
                                $.putLocalService('/config/genericDevices/device', device, 'Saving Generic Device...', function (genDev, status, xhr) {
                                    // $.pic.modalDialog.closeDialog(self);
                                    $.pic.modalDialog.closeDialog($.find('div#create-generic-device'));
                                    self._reloadGenericDevices();
                                });
                            }
                        }
                    },
                    {
                        text: 'Cancel', icon: '<i class="far fa-window-close"></i>',
                        click: function () { $.pic.modalDialog.closeDialog(this); }
                    }]
            });
            $('<input type="hidden"></input>').appendTo(dlg).attr('data-bind', "id").attr('data-datatype', 'int');
            $('<div></div>').appendTo(dlg)
                .text('Generic devices can accept feeds from other devices or triggers, take action, and emit results on a feed.');
            $('<hr></hr>').appendTo(dlg);
            var line = $('<div></div>').appendTo(dlg);
            $('<div></div>').appendTo(line).pickList({
                id: 'create-generic-device',
                required: true,
                bindColumn: 0, displayColumn: 1, labelText: 'Device', binding: 'typeId',
                columns: [{ hidden: false, binding: 'id', text: 'id', style: { whiteSpace: 'nowrap' } }, { binding: 'name', text: 'Name', style: { minWidth: '157px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, { binding: 'category', text: 'Category', style: { minWidth: '327px' } }],
                items: deviceTypes, inputAttrs: { style: { width: '12rem' } }, labelAttrs: { style: { width: '5.5rem' } }
            }).on('selchanged', function (e) {
                var c = dataBinder.fromElement(dlg);
                for (var prop in e.newItem){
                    c[prop] = e.newItem[prop];
                }
                // rsg - need to normalize arrays/objects
                if (!Array.isArray(c.options)) c.options = [c.options];
                // c.device = e.newItem;
                
                // need to close panel in addition to disable
                dlg.find('div.picPickList[data-bind="typeId"]')[0].disabled(true);
                dlg.find('div.picPickList[data-bind="typeId"]')[0].blur();
                dlg.find('div.pnl-generic-device-details').each(function () { this.dataBind(c); });
            });
            $('<div></div>').appendTo(line).checkbox({ labelText: 'Is Active', binding: 'isActive' });
            line = $('<div></div>').appendTo(dlg);
            $('<input type="hidden"></input>').appendTo(line).attr('data-bind', 'id').attr('data-datatype', 'int');
            // $('<div></div>').appendTo(line).inputField({ labelText: 'Name', binding: 'name', inputAttrs: { maxlength: 24 }, labelAttrs: { style: { width: '5.5rem' } } });
            $('<div></div>').appendTo(dlg).pnlDevice({ deviceTypes: deviceTypes.deviceTypes });
            dlg.css({ overflow: 'visible' });
            return dlg;
        },
        _editDeviceDialog: function (id, title, device) {
            console.log(device)
            var self = this, o = self.options, el = self.element;
            var dlg = $.pic.modalDialog.createDialog(id, {
                width: '570px',
                height: 'auto',
                title: title,
                buttons: [
                    {
                        text: 'Save', icon: '<i class="fas fa-save"></i>',
                        click: function () {
                            var device = dataBinder.fromElement(dlg);
                            if (dataBinder.checkRequired(dlg, true)) {
                                $.putLocalService('/config/genericDevices/device', device, 'Saving Generic Device...', function (genDev, status, xhr) {
                                    // $.pic.modalDialog.closeDialog(self);
                                    $.pic.modalDialog.closeDialog($.find('div#edit-generic-device'));
                                    self._reloadGenericDevices();
                                });
                            }
                        }
                    },
                    {
                        text: 'Cancel', icon: '<i class="far fa-window-close"></i>',
                        click: function () { $.pic.modalDialog.closeDialog(this); }
                    }]
            });
            dlg.attr('id', 'edit-generic-device');
            $('<input type="hidden"></input>').appendTo(dlg).attr('data-bind', "id").attr('data-datatype', 'int');
            var line = $('<div></div>').appendTo(dlg);
            line = $('<div></div>').appendTo(dlg);
            $('<input type="hidden"></input>').appendTo(line).attr('data-bind', 'id').attr('data-datatype', 'int');
            $('<div></div>').appendTo(line).checkbox({ labelText: 'Is Active', binding: 'isActive' });

            $('<div></div>').appendTo(dlg).pnlDevice();
            dlg.find('div.pnl-generic-device-details').each(function () { this.dataBind(device.deviceType); });
            dlg.css({ overflow: 'visible' });
            $('<div></div>').appendTo(dlg)
            .text('End');
            return dlg;
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('pnl-generic-devices').addClass('list-outer');
            el.attr('data-bind', o.binding)
            $('<div></div>').appendTo(el).crudList({
                key: 'id', actions: { canCreate: true, canEdit: true, canRemove: true },
                caption: 'Devices', itemName: 'GenericDevice',
                columns: [{ binding: 'options.name', text: 'Name', style: { width: '250px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, { binding: 'deviceType.category', text: 'Type', style: { width: '177px' } }]
            }).on('additem', function (evt) {
                $.getLocalService('/config/options/genericDevices', null, function (data, status, xhr) {
                    var dlg = self._createDeviceDialog('dlgAddGenericDevice', 'Add a new Generic Device', data.deviceTypes);
                    dataBinder.bind(dlg, { isActive: true });
                });
            }).on('edititem', function (evt) {
                $.getLocalService('/config/options/genericDevices', null, function (data, status, xhr) {
                    let device = data.genericDevices.devices.find(el => el.id === evt.dataKey);
                    var dlg = self._editDeviceDialog('dlgEditGenericDevice', 'Edit a Generic Device', device);
                    dataBinder.bind(dlg, device);
                    // dlg.find('div[data-bind="deviceTypes"]')[0].disabled(true);
                    dataBinder.bind(dlg, device);  // Bind it twice to make sure we have all the data.
                });
            }).on('removeitem', function (evt) {
                var device = dataBinder.fromElement(el);
                    $.pic.modalDialog.createConfirm('dlgConfirmConnection', {
                        message: '<div>Are you sure you want to delete generic device ' + device.options.name + '?</div><hr></hr><div><span style="color:red;font-weight:bold;">WARNING:</span> If you delete this device it will remove all <span style="font-weight:bold;">triggers and feeds</span> associated with this device.</div>',
                        width: '377px',
                        height: 'auto',
                        title: 'Confirm Delete Connection',
                        buttons: [{
                            text: 'Yes', icon: '<i class="fas fa-trash"></i>',
                            click: function () {
                                $.pic.modalDialog.closeDialog(this);
                                $.deleteLocalService('/config/genericDevices/device', {id: evt.dataKey}, 'Deleting Connection...', function (c, status, xhr) {
                                    evt.dataRow.remove();
                                });
                            }
                        },
                        {
                            text: 'No', icon: '<i class="far fa-window-close"></i>',
                            click: function () { $.pic.modalDialog.closeDialog(this); }
                        }]
                    });
            
            });
        },
        dataBind: function (data) {
            var self = this, o = self.options, el = self.element;
            var list = el.find('div.crud-list:first')[0];
            list.clear();
            for (var i = 0; i < data.length; i++) {
                //console.log(data[i]);
                list.addRow(data[i]);
            }
        }
    });



    $.widget('pic.pnlDevice', {
        options: {},
        _create: function () {
            var self = this, o = self.options, el = self.element;
            el[0].dataBind = function (dev) { self.dataBind(dev); }
            self._buildControls();
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('pnl-generic-device-details');
        },
        dataBind: function (device) {
            var self = this, o = self.options, el = self.element;
            var genDevOptions = el.attr('data-genericDeviceId');         
            console.log(device);
            templateBuilder.createObjectOptions(el, device);
            
            dataBinder.bind(el, device);
            el.attr('data-genericDeviceId', device.id);
        }
    });
})(jQuery);
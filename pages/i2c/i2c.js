(function ($) {
    $.widget('pic.pnlCfgI2c', {
        options: {},
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._buildControls();
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('pnl-config-i2c');
            el.attr('data-controllerid', o.controllerId);
            $.getLocalService('/config/options/i2c', null, function (data, status, xhr) {
                console.log(data);
            });
        },
        dataBind: function (i2c) {
            var self = this, o = self.options, el = self.element;
            var ct = o.adcChipTypes.find(elem => elem.id === spi.adcChipType);
            //self.setAdcChip(ct);
            var data = $.extend(true, {}, spi, { maxChannels: ct.maxChannels, bits: ct.bits });
            console.log(spi);
            dataBinder.bind(el, data);
        }
    });
    $.widget('pic.pnlI2cBus', {
        options: {},
        _create: function () {
            var self = this, o = self.options, el = self.element;
            self._buildControls();
            el[0].dataBind = function (data) { return self.dataBind(data); };
            el[0].val = function (val) { return self.val(val); }
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('pnl-i2c-bus');
            el.attr('data-busid', o.busId);
            $.getLocalService('/config/options/i2c/' + o.busId, null, function (i2cBus, status, xhr) {
                console.log(i2cBus);

            });

        },
        dataBind: function (data) {
            var self = this, o = self.options, el = self.element;
        },
    });
    $.widget('pic.dlgI2cBus', $.pic.modalDialog, {
        options: {},
        _create: function () {
            var self = this, o = self.options, el = self.element;
            console.log(`Creating Dialog`);
            o.title = 'Add I2C Bus';
            o.autoOpen = true;
            o.width = '447px';
            o.height = 'auto';
            o.position = { my: "center top", at: "center top", of: window };
            o.buttons = [
                {
                    text: 'Create Bus', icon: '<i class="fas fa-bus-alt"></i>',
                    click: function (evt) {
                        self.addBus();
                    }
                },
                {
                    text: 'Cancel', icon: '<i class="far fa-window-close"></i>',
                    click: function () { self.close(); }
                }
            ];
            self._buildControls();
            this._super('_create');
        },
        _buildControls: function () {
            var self = this, o = self.options, el = self.element;
            el.addClass('dlg-config-i2c');
            el.attr('data-busid', o.id);
            var line = $('<div></div>').appendTo(el);
            $('<div></div>').appendTo(line).addClass('script-advanced-instructions').html('Most ECs can have more than one i2c bus.  These are typically identified by a number.  Run i2cdetect -l to see the enabled i2c bus drivers on your system.');
            line = $('<div></div>').appendTo(el);
            $('<div></div>').appendTo(line).valueSpinner({ required: true, binding: 'busNumber', labelText: 'Bus #', min: 1, max: 100, labelAttrs: { style: { width: '4rem' } } });
            $('<div></div>').appendTo(line).checkbox({ labelText: 'Is Active', binding: 'isActive', value: true });

        },
        addBus: function () {
            var self = this, o = self.options, el = self.element;
            var bus = dataBinder.fromElement(el);
            console.log(bus);
            $.putLocalService('/config/i2c/bus', bus, function (data, status, xhr) {
                console.log(data);
                var evt = $.Event('busadded');
                evt.bus = data;
                el.trigger(evt);
                self.close();
            });

        }
    });
    
})(jQuery);

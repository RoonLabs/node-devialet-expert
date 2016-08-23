"use strict";

let SerialPort = require("serialport"),
    util       = require("util"),
    events     = require('events');

function DevialetExpert() {
    this.seq = 0;
}

util.inherits(DevialetExpert, events.EventEmitter);

let _processw = function() {
    if (!this._port) return;
    if (this._woutstanding) return;
    if (this._qw.length == 0) return;

    this._woutstanding = true;
    console.log("DEVIALET RS232: Writing", this._qw[0]);

    this._port.write(this._qw[0],
                    (err) => {
                        if (err) return;
                        this._qw.shift();
                        this._woutstanding = false;
                        setTimeout(() => { _processw.call(this); }, 50);
                    });
}
let _query = function(name, cb) {
    this._qw.push("[Devialet>" + name + "=?]\r\n");
    if (cb) this._qr.push({ cb: cb, name: name });
    _processw.call(this);
};

let _send = function(name, val, cb) {
    this._qw.push("[Devialet>" + name + "=" + val + "]\r\n");
    _processw.call(this);
    if (cb)
        this._qr.push({ cb: cb, name: name, ack: true });
};

DevialetExpert.prototype.set_volume          = function(val, cb) { _send.call(this, "VOLUME",          Number(val), cb); };
DevialetExpert.prototype.set_power           = function(val, cb) { _send.call(this, "POWER",           val == "1",  cb); };
DevialetExpert.prototype.set_source          = function(val, cb) { _send.call(this, "SOURCE",          val,         cb); };
DevialetExpert.prototype.set_mute            = function(val, cb) { _send.call(this, "MUTE",            val == "1",  cb); };
DevialetExpert.prototype.set_phase           = function(val, cb) { _send.call(this, "PHASE",           val == "1",  cb); };
DevialetExpert.prototype.set_preout          = function(val, cb) { _send.call(this, "PREOUT",          val == "1",  cb); };
DevialetExpert.prototype.set_subsonic_filter = function(val, cb) { _send.call(this, "SUBSONIC_FILTER", val == "1",  cb); };
DevialetExpert.prototype.set_subwoofer       = function(val, cb) { _send.call(this, "SUBWOOFER",       val == "1",  cb); };

DevialetExpert.prototype.init = function(port, baud, cb) {
    let self = this;

    this._qw = [];
    this._qr = [];
    this._woutstanding = false;

    this.properties = {};

    this._port = new SerialPort(port, {
        baudRate: baud,
        parser:   SerialPort.parsers.readline("\r\n")
    });

    this._port.on('data', data => {
        console.log("DEVIALET RS232: read", data);
        var re = /\[Devialet>([^:=]+)[:=]([^\]]+)\]/.exec(data);
        if (!re) {
            console.error("DEVIALET RS232: unexpected data from serial port %s: %s", port, data);
            return;
        }

        var d = {
            name: re[1],
            prop: re[1].toLowerCase(),
            val:  re[2]
        };

        if (d.val != "ACK") {
            if      (d.prop == "volume"         ) d.val = Number(d.val);
            else if (d.prop == "power"          ) d.val = d.val == "1" ;
            else if (d.prop == "start"          ) d.val = d.val == "1" ;
            else if (d.prop == "mute"           ) d.val = d.val == "1" ;
            else if (d.prop == "phase"          ) d.val = d.val == "1" ;
            else if (d.prop == "preout"         ) d.val = d.val == "1" ;
            else if (d.prop == "subsonic_filter") d.val = d.val == "1" ;
            else if (d.prop == "subwoofer"      ) d.val = d.val == "1" ;

            this.properties[d.prop] = d.val;
            this.emit("changed", d.prop, this.properties[d.prop]);
        }

        if (this._qr.length > 0) {
            var r = this._qr[0];
            if (r.name == d.name) {
                r.cb(false, d.val);
                this._qr.shift();
            }
        }
    });

    let opened = function() {
        if (!self._port) return;
        console.log(self.properties);
        if (self.properties.power && !self.properties.start) {
            _query.call(self, "VOLUME", (err, val) => {
                _query.call(self, "SOURCE", (err, val) => {
                    _query.call(self, "MUTE", valal => {
                        _query.call(self, "PHASE", vall => {
                            _query.call(self, "PREOUT", (err, val) => {
                                _query.call(self, "SUBSONIC_FILTER", (err, val) => {
                                    _query.call(self, "SUBWOOFER", (err, val) => {
                                        self.emit('status', "connected");
                                    });
                                });
                            });
                        });
                    });
                });
            });
        } else {
            _query.call(self, "START");
            _query.call(self, "POWER");
            setTimeout(opened, 500);
        }
    };

    this._port.on('open', err => {
        _processw.call(this);
        this.emit('status', "initializing");
        opened();
    });

    this._port.on('close',      ()  => { this._port.close(() => { this._port = undefined; if (cb) { var cb2 = cb; cb = undefined; cb2('close');      } }) });
    this._port.on('error',      err => { this._port.close(() => { this._port = undefined; if (cb) { var cb2 = cb; cb = undefined; cb2('error');      } }) });
    this._port.on('disconnect', ()  => { this._port.close(() => { this._port = undefined; if (cb) { var cb2 = cb; cb = undefined; cb2('disconnect'); } }) });
};

DevialetExpert.prototype.start = function(port, baud) {
    this.seq++;

    let closecb = (why) => {
        this.emit('status', 'disconnected');
        if (why != 'close') {
            var seq = ++this.seq;
            setTimeout(() => {
                if (seq != this.seq) return;
                this.start(port, baud);
            }, 1000);
        }
    };

    if (this._port) {
        this._port.close(() => {
            this.init(port, baud, closecb);
        });
    } else {
        this.init(port, baud, closecb);
    }
};

DevialetExpert.prototype.stop = function() {
    this.seq++;
    if (this._port)
        this._port.close(() => {});
};

exports = module.exports = DevialetExpert;


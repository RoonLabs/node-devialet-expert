"use strict";

let SerialPort = require("serialport"),
    util       = require("util"),
    events     = require('events');

function DevialetExpert() {
    this.seq = 0;
}

util.inherits(DevialetExpert, events.EventEmitter);

let _processw = function() {
    if (this._woutstanding) return;
    if (this._qw.length == 0) return;

    this._woutstanding = true;
    this._port.write(this._qw[0],
                    (err) => {
                        if (err) return;
                        this._qw.shift();
                        this._woutstanding = false;
                        _processw.call(this);
                    });
}
let _query = function(name, cb) {
    this._qw.push("[Devialet>" + name + "=?]\r\n");
    this._qr.push({ cb: cb, name: name });
    _processw.call(this);
};

let _send = function(name, val, cb) {
    this._qw.push(line);
    this._qw.push("[Devialet>" + name + "=" + val + "]\r\n");
    _processw.call(this);
    this._qr.push({ cb: cb, name: name, ack: true });
};

DevialetExpert.prototype.set_volume          = function(val, cb) { _send.call(this, "VOLUME",          val, cb); };
DevialetExpert.prototype.set_source          = function(val, cb) { _send.call(this, "SOURCE",          val, cb); };
DevialetExpert.prototype.set_mute            = function(val, cb) { _send.call(this, "MUTE",            val, cb); };
DevialetExpert.prototype.set_phase           = function(val, cb) { _send.call(this, "PHASE",           val, cb); };
DevialetExpert.prototype.set_preout          = function(val, cb) { _send.call(this, "PREOUT",          val, cb); };
DevialetExpert.prototype.set_riaa            = function(val, cb) { _send.call(this, "RIAA",            val, cb); };
DevialetExpert.prototype.set_subsonic_filter = function(val, cb) { _send.call(this, "SUBSONIC_FILTER", val, cb); };
DevialetExpert.prototype.set_subwoofer       = function(val, cb) { _send.call(this, "SUBWOOFER",       val, cb); };

DevialetExpert.prototype.get_volume          = function() { return this._volume;          };
DevialetExpert.prototype.get_source          = function() { return this._source;          };
DevialetExpert.prototype.get_mute            = function() { return this._mute;            };
DevialetExpert.prototype.get_phase           = function() { return this._phase;           };
DevialetExpert.prototype.get_preout          = function() { return this._preout;          };
DevialetExpert.prototype.get_riaa            = function() { return this._riaa;            };
DevialetExpert.prototype.get_subsonic_filter = function() { return this._subsonic_filter; };
DevialetExpert.prototype.get_subwoofer       = function() { return this._subwoofer;       };

DevialetExpert.prototype.init = function(port, baud, cb) {
    this._qw = [];
    this._qr = [];
    this._woutstanding = false;

    this._power           = undefined;
    this._volume          = undefined;
    this._source          = undefined;
    this._mute            = undefined;
    this._phase           = undefined;
    this._preout          = undefined;
    this._riaa            = undefined;
    this._subsonic_filter = undefined;
    this._subwoofer       = undefined;

    this._port = new SerialPort(port, {
        baudRate: baud,
        parser:   SerialPort.parsers.readline("\r\n")
    });

    this._port.on('data', data => {
        console.log(data);
        var re = /\[Devialet>([^:]+):([^\]]+)\]/.exec(data);
        if (!re) {
            console.error("unexpected data from serial port %s: %s", port, data);
            return;
        }

        var d = {
            name: re[1],
            val:  re[2]
        };

        this["_" + d.name.toLowerCase()] = d.val;
        this.emit("changed", d.name.toLowerCase(), d.val);
        if (this._qr.length > 0) {
            var r = this._qr[0];
            if (r.name == d.name) {
                if (r.ack && d.val == "ACK") {
                    r.cb(false);
                    this._qr.shift();
                } else if (!r.ack) {
                    r.cb(false, d.val);
                    this._qr.shift();
                }
            }
        }
    });
    this._port.on('open', err => {
        this.emit('status', "initializing");
        _query.call(this, "POWER", (err, val) => {
            this.onstatus && this.onstatus("connected", null);
            this.power = val;
            if (this.power == 1) {
                _query.call(this, "VOLUME", (err, val) => { this.volume = val;
                    _query.call(this, "SOURCE", (err, val) => { this.source = val;
                        _query.call(this, "MUTE", valal => { this.mute = val;
                            _query.call(this, "PHASE", vall => { this.phase = val;
                                _query.call(this, "PREOUT", (err, val) => { this.preout = val;
                                    _query.call(this, "RIAA", (err, val) => { this.riaa = val;
                                        _query.call(this, "SUBSONIC_FILTER", (err, val) => { this.subsonic_filter = val;
                                            _query.call(this, "SUBWOOFER", (err, val) => { this.subwoofer = val;
                                                this.emit('status', "connected");
                                            });
                                        });
                                    });
                                });
                            });
                        });
                    });
                });
            } else {
                this.onstatus && this.onstatus("connected", null);
            }
        });
    });

    this._port.on('close',      ()  => { this._port.close(() => { this._port = undefined; if (cb) { var cb2 = cb; cb = undefined; cb2('close');      } }) });
    this._port.on('error',      err => { this._port.close(() => { this._port = undefined; if (cb) { var cb2 = cb; cb = undefined; cb2('error');      } }) });
    this._port.on('disconnect', ()  => { this._port.close(() => { this._port = undefined; if (cb) { var cb2 = cb; cb = undefined; cb2('disconnect'); } }) });
}

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
}

exports = module.exports = DevialetExpert;


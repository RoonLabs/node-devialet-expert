var DevialetExpert = require(".");

var d = new DevialetExpert();

d.on('status', (s,e) => {
    console.log(s,e);
});

d.on('changed', (n,v) => {
    console.log(n,v);
});

d.start("/dev/cu.usbserial", 115200);

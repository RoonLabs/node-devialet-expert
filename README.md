# Devialet Expert Line Device Control via RS232

Configure your Expert:

* Link speed: 115200
* Identifier: Devialet
* Mode -> Command Acknowledge = TRUE
* Mode -> Auto Cchange notification = TRUE
* Mode -> Echo chaining = FALSE

Initialization:

```javascript
var DevialetExpert = require("node-devialet-expert");
var d = new DevialetExpert();
```

Listening to events:

```javascript
d.on('status', function(status, errormessage) { });
d.on('changed', function(property, value) { });
```

`status` can be one of the following:

* `'connecting'`
* `'initializing'`
* `'connected'`
* `'disconnected'`

`property` can be one of the following:

* `'power'`
* `'volume'`
* `'source'`
* `'mute'`
* `'phase'`
* `'preout'`
* `'riaa'`
* `'subsonic_filter'`
* `'subwoofer'`

Connecting to the Devialet Expert device:

```javascript
d.start(port, baud);
```

* `port` should be like `'/dev/cu.usbserial'` or something similar on MacOS or Linux, or `'COM3'` on Windows
* `baud` should be like `115200`, or whatever you configured your Devialet to be (see above)

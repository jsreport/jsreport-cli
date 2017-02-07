# silent-spawn

**Spawn detached process without opening command line on windows**

node.js always opens an extra command line for the child process if you run spawn with detached option. This is quite annoying if you just want to run a script on the background which is not killed when the parent process ends. This package eliminates this problem by passing spawn command through another .net based executable on windows. On linux you get the unchanged native spawn without proxy.

```JS
var spawn = require('silent-spawn')
spawn('node', ['script.js'], { detached: true })
```
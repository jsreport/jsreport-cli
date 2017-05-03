var path = require('path')
var assign = require('object-assign')
var Promise = require('bluebird')
var spawn = require('silent-spawn')
var startSocketServer = require('./startSocketServer')

var IS_WINDOWS = process.platform === 'win32'

module.exports = function keepAliveProcess (options) {
  var daemonExec = options.daemonExec || {}
  var mainSockPath = options.mainSockPath
  var workerSockPath = options.workerSockPath
  var cwd = options.cwd
  var verbose = options.verbose
  var daemonInstancePath = daemonExec.scriptPath || path.join(__dirname, './daemonInstance.js')

  return new Promise(function (resolve, reject) {
    var socketServer
    var initOptions
    var child
    var daemonProcess = {}

    // we are starting a temporary server for communication with the child
    // that it's gonna be spawned below, we can't use an IPC channel between
    // the processes because we are using "silent-spawn" package
    // that uses a little hack to be able to have a detached process without
    // creating a new console in windows, an because of that the built-in IPC
    // will not work.
    startSocketServer({
      socketPath: mainSockPath,
      socketPrefix: 'connection',
      protocol: daemonInstanceProtocol
    }, function (err, serverInfo) {
      var socketFile

      if (err) {
        return reject(err)
      }

      socketServer = serverInfo.server

      initOptions = {
        sockPath: workerSockPath,
        cwd: cwd,
        verbose: verbose
      }

      socketFile = serverInfo.normalizedSocketFile

      if (daemonExec.path) {
        daemonProcess.path = daemonExec.path
      } else {
        daemonProcess.path = process.execPath
      }

      daemonProcess.args = [
        daemonInstancePath,
        socketFile
      ]

      if (Array.isArray(daemonExec.args)) {
        daemonProcess.args = daemonProcess.args.concat(daemonExec.args)
      }

      // espacing arguments in windows
      if (IS_WINDOWS) {
        daemonProcess.args = daemonProcess.args.map(function (arg) {
          return '"' + arg + '"'
        })
      }

      daemonProcess.opts = {
        // change stdio to 'pipe' when you want to debug messages
        // in the child process
        stdio: 'ignore',
        detached: true,
        cwd: cwd
      }

      if (daemonExec.opts) {
        daemonProcess.opts = assign(daemonProcess.opts, daemonExec.opts)
        daemonProcess.opts.env = assign({}, process.env, { JSREPORT_CLI: true }, daemonProcess.opts.env)
      }

      // start a daemonized process
      child = spawn(
        daemonProcess.path,
        daemonProcess.args,
        daemonProcess.opts
      )

      // listening to stdout and stderr will only occur
      // when we are developing and trying to debug something
      // (in other words, when stdio: 'pipe')
      if (child.stdout) {
        child.stdout.on('data', function (msg) {
          console.log('stdout child:', msg.toString())
        })
      }

      if (child.stderr) {
        child.stderr.on('data', function (msg) {
          console.log('stderr child:', msg.toString())
        })
      }

      child.on('exit', function (code) {
        reject(new Error('Process died to soon with exit code ' + code))
      })
    })

    function daemonInstanceProtocol (socket) {
      socket.on('error', function () {
        socket.destroy()
        socketServer.close()
      })

      socket.dataOnce(['alive'], function () {
        socket.send(['init'], initOptions)
      })

      socket.dataOnce(['init'], function (result) {
        socket.end()
        socketServer.close()

        if (result.error) {
          reject(
            new Error(
              'An error occurred while trying to start daemonized process: ' +
              result.error
            )
          )
        } else {
          // remove error prop from result
          delete result.error
          resolve(resolve(assign({}, result, { proc: child })))
        }
      })
    }
  })
}

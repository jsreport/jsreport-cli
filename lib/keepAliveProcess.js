var path = require('path')
var Promise = require('bluebird')
var spawn = require('silent-spawn')
var startSocketServer = require('./startSocketServer')

module.exports = function keepAliveProcess (options) {
  var mainSockPath = options.mainSockPath
  var workerSockPath = options.workerSockPath
  var cwd = options.cwd
  var verbose = options.verbose
  var daemonInstancePath = path.join(__dirname, './daemonInstance.js')

  return new Promise(function (resolve, reject) {
    var socketServer
    var initOptions
    var child

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

      // start a daemonized process
      child = spawn(process.execPath, [
        daemonInstancePath,
        socketFile
      ], {
        // change stdio to 'pipe' when you want to debug messages
        // in the child process
        stdio: 'ignore',
        detached: true,
        cwd: cwd
      })

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
          resolve({
            proc: child,
            url: result.url,
            adminAuthentication: result.adminAuthentication
          })
        }
      })
    }
  })
}

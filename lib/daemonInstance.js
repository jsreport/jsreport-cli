var fs = require('fs')
var HttpsServer = require('https').Server
var assign = require('object-assign')
var Promise = require('bluebird')
var ipAddress = require('ip-address')
var nssocket = require('nssocket')
var startSocketServer = require('./startSocketServer.js')
var instanceHandler = require('./instanceHandler.js')

var PID = process.pid

function start (customInstance, socketFile) {
  var socketToMaster = new nssocket.NsSocket()
  var parentSocketFile
  var processInfo

  console.log('PID of daemon instance:', PID)

  if (socketFile) {
    parentSocketFile = socketFile
  } else {
    parentSocketFile = process.argv[2]
  }

  // connect to parent socket for parent-child communication
  socketToMaster.connect(parentSocketFile, function (err) {
    // in case of connection error exit the process immediately
    // to notify parent
    if (err) {
      return process.exit(1)
    }

    // parent process will pass options in the "init" event
    socketToMaster.dataOnce(['init'], function (options) {
      var sockPath = options.sockPath
      var cwd = options.cwd
      var verbose = options.verbose
      var getInstanceAsync

      if (customInstance) {
        getInstanceAsync = Promise.resolve({ instance: customInstance })
      } else {
        getInstanceAsync = instanceHandler.find(cwd)
      }

      // find and initialize a jsreport instance
      getInstanceAsync
      .then(function (instanceInfo) {
        return instanceHandler.initialize(instanceInfo.instance, verbose)
      })
      .then(function (instance) {
        var adminAuthentication
        var jsreportServer
        var address
        var hostname
        var protocol
        var appPath
        var urlToServer

        if (instance.options.authentication && instance.options.authentication.admin) {
          adminAuthentication = instance.options.authentication.admin
        }

        if (instance.express && instance.express.server) {
          jsreportServer = instance.express.server
          address = jsreportServer.address()
        }

        appPath = instance.options.appPath || ''

        if (appPath === '/') {
          appPath = ''
        }

        // normalizing ipv6 to ipv4
        if (address.family === 'IPv6') {
          hostname = new ipAddress.Address6(address.address).to4()

          if (typeof hostname !== 'string') {
            hostname = hostname.address
          }

          // normalizing host, on windows connecting to "0.0.0.0" doesn't work
          if (hostname === '0.0.0.0') {
            hostname = 'localhost'
          }
        } else {
          hostname = address.address
        }

        if (jsreportServer instanceof HttpsServer) {
          protocol = 'https'
        } else {
          protocol = 'http'
        }

        urlToServer = protocol + '://' + hostname + ':' + address.port + '/' + appPath

        // starting a server in a new socket to allow the monitoring
        // and query of this process from the CLI
        startSocketServer({
          socketPath: sockPath,
          socketPrefix: 'monitor',
          // Create 'symbolic' file on the system, so it can be later
          // found, since the `\\.pipe\\*` "files" can't
          // be enumerated because ... Windows.
          createSymbolicForSocket: process.platform === 'win32',
          protocol: monitorProtocol
        }, function (socketInitErr, serverInfo) {
          if (socketInitErr) {
            return socketToMaster.send(['init'], { error: socketInitErr.message })
          }

          // collecting all the information about this process
          // for later queries
          processInfo = {
            uid: serverInfo.uid,
            pid: PID,
            cwd: cwd,
            socketFile: serverInfo.socketFile,
            normalizedSocketFile: serverInfo.normalizedSocketFile,
            url: urlToServer,
            adminAuthentication: adminAuthentication
          }

          socketToMaster.send(['init'], assign({}, processInfo, { error: null }))
        })
      })
      .catch(function (err) {
        socketToMaster.send(['init'], { error: err.message })

        setImmediate(function () {
          process.exit(1)
        })
      })
    })

    socketToMaster.send(['alive'])
  })

  socketToMaster.on('error', function (err) {
    if (err.code === 'ECONNREFUSED') {
      try {
        fs.unlinkSync(parentSocketFile)
      } catch (e) {}
    }

    process.exit(1)
  })

  function monitorProtocol (socket) {
    socket.on('error', function () {
      socket.destroy()
    })

    socket.data(['info'], function () {
      socket.send(['info'], processInfo)
    })

    socket.data(['kill'], function () {
      if (process.platform === 'win32') {
        //
        // On Windows, delete the 'symbolic' sock file. This
        // file is used for exploration as a mapping to the
        // `\\.pipe\\*` "files" that can't
        // be enumerated because ... Windows.
        //
        try {
          fs.unlinkSync(processInfo.socketFile)
        } catch (e) {}
      }

      process.exit()
    })
  }
}

if (require.main === module) {
  start()
} else {
  module.exports = start
}

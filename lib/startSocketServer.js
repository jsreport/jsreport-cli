var path = require('path')
var fs = require('fs')
var nanoid = require('nanoid')
var nssocket = require('nssocket')
var normalizeSocketPath = require('./normalizeSocketPath')

/**
 * Starts a server using a socket file randomly generated
 * and resolves when it is ready to listen connections
 */
module.exports = function startSocketServer (options, cb) {
  var socketPath = options.socketPath
  var socketPrefix = options.socketPrefix || ''
  var createSymbolicForSocket = options.createSymbolicForSocket
  var protocol = options.protocol
  var uid = nanoid(7)
  var server = nssocket.createServer(protocol)
  var socketFile
  var normalizedSocketFile

  socketFile = path.join(socketPath, [
    socketPrefix,
    uid,
    'sock'
  ].join('.'))

  if (createSymbolicForSocket) {
    fs.openSync(socketFile, 'w')
  }

  normalizedSocketFile = normalizeSocketPath(socketFile)

  server.on('listening', function () {
    cb(null, {
      uid: uid,
      socketFile: socketFile,
      normalizedSocketFile: normalizedSocketFile,
      server: server
    })
  })

  server.on('error', function (err) {
    if (err.code === 'EADDRINUSE') {
      return startSocketServer(options, cb)
    } else {
      cb(err)
    }
  })

  server.listen(normalizedSocketFile)
}

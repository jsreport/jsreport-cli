'use strict'

var path = require('path')
var fs = require('fs')
var mapAsync = require('map-async')
var nssocket = require('nssocket')
var normalizeSocketPath = require('./normalizeSocketPath')

exports.findProcessByCWD = findProcessByCWD
exports.findProcessByUidOrPid = findProcessByUidOrPid
exports.getAllProcesses = getAllProcesses
exports.getSockets = getSockets
exports.kill = kill

function findProcessByCWD (sockPath, cwd, cb) {
  getAllProcesses(sockPath, function (err, processes) {
    var procs

    if (err) {
      return cb(err)
    }

    procs = processes.filter(function (p) {
      return p.cwd === cwd
    })

    if (procs.length === 0) {
      return cb(null, null)
    }

    return cb(null, procs[0])
  })
}

function findProcessByUidOrPid (sockPath, id, cb) {
  getAllProcesses(sockPath, function (err, processes) {
    var procs

    if (err) {
      return cb(err)
    }

    function search (filters) {
      var result = []

      filters.forEach(function (filter) {
        if (result.length > 0) {
          return
        }

        result = processes.filter(filter)
      })

      return result
    }

    procs = search([function (p) {
      return p.uid === id
    }, function (p) {
      return String(p.pid) === String(id)
    }])

    if (procs.length === 0) {
      return cb(null, null)
    }

    return cb(null, procs[0])
  })
}

function kill (proc, cb) {
  var socketFile = proc.normalizedSocketFile

  function sendAction (action, next) {
    var socket = new nssocket.NsSocket()

    socket.connect(socketFile, function (err) {
      if (err) {
        return next(err)
      }

      socket.send([action], function () {
        next()
        socket.end()
      })
    })

    socket.on('error', function (err) {
      next(err)
    })
  }

  sendAction('kill', cb)
}

function getAllProcesses (sockPath, cb) {
  function getProcess (name, next) {
    var fullPath = path.join(sockPath, name)
    var socket = new nssocket.NsSocket()

    fullPath = normalizeSocketPath(fullPath)

    socket.connect(fullPath, function (connectErr) {
      if (connectErr) {
        return next(connectErr)
      }

      socket.dataOnce(['info'], function (info) {
        next(null, info)
        socket.end()
      })

      socket.send(['info'])
    })

    socket.on('error', function (err) {
      if (err.code === 'ECONNREFUSED') {
        try {
          fs.unlinkSync(fullPath)
        } catch (e) {}

        next()
      } else {
        next()
      }
    })
  }

  getSockets(sockPath, function (err, sockets) {
    if (err) {
      return cb(err)
    }

    mapAsync(sockets, getProcess, function (err, processes) {
      cb(err, processes.filter(Boolean))
    })
  })
}

function getSockets (sockPath, cb) {
  var sockets = []

  try {
    sockets = fs.readdirSync(sockPath)
  } catch (ex) {
    return cb(ex)
  }

  cb(null, sockets)
}

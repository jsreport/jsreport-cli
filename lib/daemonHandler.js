'use strict'

const path = require('path')
const fs = require('fs')
const mapAsync = require('map-async')
const nssocket = require('nssocket')
const normalizeSocketPath = require('./normalizeSocketPath')

exports.findProcessByCWD = findProcessByCWD
exports.findProcessByUidOrPid = findProcessByUidOrPid
exports.getAllProcesses = getAllProcesses
exports.getSockets = getSockets
exports.kill = kill

function findProcessByCWD (sockPath, cwd, cb) {
  getAllProcesses(sockPath, (err, processes) => {
    if (err) {
      return cb(err)
    }

    const procs = processes.filter((p) => {
      return p.cwd === cwd
    })

    if (procs.length === 0) {
      return cb(null, null)
    }

    return cb(null, procs[0])
  })
}

function findProcessByUidOrPid (sockPath, id, cb) {
  getAllProcesses(sockPath, (err, processes) => {
    if (err) {
      return cb(err)
    }

    function search (filters) {
      let result = []

      filters.forEach((filter) => {
        if (result.length > 0) {
          return
        }

        result = processes.filter(filter)
      })

      return result
    }

    const procs = search([(p) => {
      return p.uid === id
    }, (p) => {
      return String(p.pid) === String(id)
    }])

    if (procs.length === 0) {
      return cb(null, null)
    }

    return cb(null, procs[0])
  })
}

function kill (proc, cb) {
  const socketFile = proc.normalizedSocketFile

  function sendAction (action, next) {
    const socket = new nssocket.NsSocket()

    socket.connect(socketFile, (err) => {
      if (err) {
        return next(err)
      }

      socket.send([action], () => {
        next()
        socket.end()
      })
    })

    socket.on('error', (err) => {
      next(err)
    })
  }

  sendAction('kill', cb)
}

function getAllProcesses (sockPath, cb) {
  function getProcess (name, next) {
    let fullPath = path.join(sockPath, name)
    const socket = new nssocket.NsSocket()

    fullPath = normalizeSocketPath(fullPath)

    socket.connect(fullPath, (connectErr) => {
      if (connectErr) {
        return next(connectErr)
      }

      socket.dataOnce(['info'], (info) => {
        next(null, info)
        socket.end()
      })

      socket.send(['info'])
    })

    socket.on('error', (err) => {
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

  getSockets(sockPath, (err, sockets) => {
    if (err) {
      return cb(err)
    }

    mapAsync(sockets, getProcess, (err, processes) => {
      cb(err, processes.filter(Boolean))
    })
  })
}

function getSockets (sockPath, cb) {
  let sockets = []

  try {
    sockets = fs.readdirSync(sockPath)
  } catch (ex) {
    return cb(ex)
  }

  cb(null, sockets)
}

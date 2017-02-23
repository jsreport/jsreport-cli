'use strict'

var Promise = require('bluebird')
var daemonHandler = require('../daemonHandler')

var description = 'Kill a daemon jsreport process'
var command = 'kill'

exports.command = command
exports.description = description

exports.builder = function (yargs) {
  return (
    yargs
    .usage(
      [
        description + '\n',
        'Usage: jsreport ' + command + ' [uid|pid]\n',
        'If uid or pid is not specified we will try to kill a daemon process that was started from CWD'
      ].join('\n')
    )
  )
}

exports.handler = function (argv) {
  var verbose = argv.verbose
  var context = argv.context
  var cwd = context.cwd
  var workerSockPath = context.workerSockPath
  var identifier
  var resolveProcAsync

  resolveProcAsync = new Promise(function (resolve, reject) {
    if (argv._ && argv._[1]) {
      identifier = argv._[1]
    }

    function onProcessSearch (processLookupErr, processInfo) {
      if (processLookupErr) {
        return reject(processLookupErr)
      }

      if (!processInfo) {
        if (!identifier) {
          return reject(new Error('there is no active daemon process in: ' + cwd))
        }

        return reject(new Error('there is no active daemon with id: ' + identifier))
      }

      if (verbose) {
        if (!identifier) {
          console.log('daemon process found in:', workerSockPath, 'cwd:', cwd, 'pid:', processInfo.pid)
        } else {
          console.log('daemon process found in:', workerSockPath, 'id:', identifier, 'pid:', processInfo.pid)
        }
      }

      resolve(processInfo)
    }

    if (!identifier) {
      console.log('searching for daemon process in:', cwd)

      if (verbose) {
        console.log('looking for previously daemonized process in:', workerSockPath, 'cwd:', cwd)
      }

      return daemonHandler.findProcessByCWD(workerSockPath, cwd, onProcessSearch)
    }

    console.log('searching for daemon process with id:', identifier)

    daemonHandler.findProcessByUidOrPid(workerSockPath, identifier, onProcessSearch)
  })

  return (
    resolveProcAsync
    .then(function (proc) {
      if (verbose) {
        console.log('killing daemon process.. uid:', proc.uid, 'pid:', proc.pid)
      }

      return new Promise(function (resolve, reject) {
        daemonHandler.kill(proc, function (err) {
          if (err) {
            return reject(new Error('error while trying to kill daemon process: ', err.message))
          }

          console.log('daemon process (pid: ' + proc.pid + ') killed successfully')

          resolve(proc)
        })
      })
    })
  )
}

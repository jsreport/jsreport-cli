'use strict'

const daemonHandler = require('../daemonHandler')

const description = 'Kill a daemon jsreport process'
const command = 'kill'

exports.command = command
exports.description = description

exports.builder = (yargs) => {
  return (
    yargs
      .usage(
        [
          `${description}\n`,
          `Usage: jsreport ${command} [uid|pid]\n`,
          'If uid or pid is not specified we will try to kill a daemon process that was started from CWD'
        ].join('\n')
      )
  )
}

exports.handler = (argv) => {
  const verbose = argv.verbose
  const context = argv.context
  const cwd = context.cwd
  const workerSockPath = context.workerSockPath

  const resolveProcAsync = new Promise((resolve, reject) => {
    let identifier

    if (argv._ && argv._[1]) {
      identifier = argv._[1]
    }

    function onProcessSearch (processLookupErr, processInfo) {
      if (processLookupErr) {
        return reject(processLookupErr)
      }

      if (!processInfo) {
        let customError

        if (!identifier) {
          customError = new Error(`there is no active daemon process in: ${cwd}`)
        } else {
          customError = new Error(`there is no active daemon with id: ${identifier}`)
        }

        // makes the cli to print clean error (without stack trace)
        customError.cleanState = true

        return reject(customError)
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
      .then((proc) => {
        if (verbose) {
          console.log('killing daemon process.. uid:', proc.uid, 'pid:', proc.pid)
        }

        return new Promise((resolve, reject) => {
          daemonHandler.kill(proc, (err) => {
            if (err) {
              err.message = `error while trying to kill daemon process: ${err.message}`
              return reject(err)
            }

            console.log('daemon process (pid: ' + proc.pid + ') killed successfully')

            resolve(proc)
          })
        })
      })
  )
}

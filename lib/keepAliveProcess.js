'use strict'

const path = require('path')
const fs = require('fs')
const spawn = require('silent-spawn')
const omit = require('lodash.omit')
const startSocketServer = require('./startSocketServer')

const IS_WINDOWS = process.platform === 'win32'

module.exports = async function keepAliveProcess (options) {
  const daemonExec = options.daemonExec || {}
  const mainSockPath = options.mainSockPath
  const workerSockPath = options.workerSockPath
  const cwd = options.cwd
  const verbose = options.verbose
  const daemonInstancePath = daemonExec.scriptPath || path.join(__dirname, './daemonInstance.js')
  // activate env var JSREPORT_CLI_DAEMON_STD_FILES when you want to debug messages
  // in the child process
  const processStdToFiles = process.env.JSREPORT_CLI_DAEMON_STD_FILES === 'enabled'
  let targetStdio = 'ignore'

  if (processStdToFiles) {
    const stdStreams = await createStdFiles()
    targetStdio = ['ignore', stdStreams[0], stdStreams[1]]
  }

  return new Promise((resolve, reject) => {
    let socketServer
    let initOptions
    let child
    const daemonProcess = {}

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
    }, (err, serverInfo) => {
      if (err) {
        err.message = `Error while trying to start socket server: ${err.message}`
        return reject(err)
      }

      socketServer = serverInfo.server

      initOptions = {
        sockPath: workerSockPath,
        cwd: cwd,
        verbose: verbose
      }

      const socketFile = serverInfo.normalizedSocketFile

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
      } else if (typeof daemonExec.args === 'function') {
        const customArgs = daemonExec.args(daemonProcess.args)

        if (Array.isArray(customArgs)) {
          daemonProcess.args = customArgs
        }
      }

      // espacing arguments in windows
      if (IS_WINDOWS) {
        daemonProcess.args = daemonProcess.args.map((arg) => {
          return '"' + arg + '"'
        })
      }

      daemonProcess.opts = {
        stdio: targetStdio,
        detached: true,
        cwd: cwd
      }

      daemonProcess.opts.env = Object.assign({}, process.env, { JSREPORT_CLI: true, JSREPORT_CLI_DAEMON_PROCESS: true })

      if (daemonExec.opts) {
        daemonProcess.opts = Object.assign(daemonProcess.opts, daemonExec.opts)
        daemonProcess.opts.env = Object.assign(daemonProcess.opts.env, daemonProcess.opts.env)
      }

      // start a daemonized process
      child = spawn(
        daemonProcess.path,
        daemonProcess.args,
        daemonProcess.opts
      )

      child.on('exit', (code) => {
        reject(new Error('Child process died to soon with exit code ' + code))
      })
    })

    function daemonInstanceProtocol (socket) {
      socket.on('error', () => {
        socket.destroy()
        socketServer.close()
      })

      socket.dataOnce(['alive'], () => {
        socket.send(['init'], initOptions)
      })

      socket.dataOnce(['init'], (result) => {
        socket.end()
        socketServer.close()

        if (result.error) {
          const error = new Error(
            'An error occurred while trying to start daemonized process: ' +
            result.error
          )

          if (result.meta != null) {
            Object.assign(error, omit(result.meta, ['message', 'stack']))
          }

          reject(error)
        } else {
          // remove error prop from result
          delete result.error

          resolve(resolve(Object.assign({}, result, {
            // result.pid and child.pid can be different on windows, because the detached mode
            pid: result.pid,
            proc: child
          })))
        }
      })
    }
  })
}

async function createStdFiles () {
  return new Promise((resolve) => {
    let fileStream

    function ready () {
      resolve([fileStream, fileStream])
    }

    fileStream = fs.createWriteStream('jsreport-daemon-log.txt')

    fileStream.on('open', ready)
  })
}

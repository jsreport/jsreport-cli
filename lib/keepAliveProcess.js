'use strict'

const path = require('path')
const spawn = require('silent-spawn')
const omit = require('lodash.omit')
const startSocketServer = require('./startSocketServer')

const IS_WINDOWS = process.platform === 'win32'

module.exports = function keepAliveProcess (options) {
  const daemonExec = options.daemonExec || {}
  const mainSockPath = options.mainSockPath
  const workerSockPath = options.workerSockPath
  const cwd = options.cwd
  const verbose = options.verbose
  const daemonInstancePath = daemonExec.scriptPath || path.join(__dirname, './daemonInstance.js')

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
      }

      // espacing arguments in windows
      if (IS_WINDOWS) {
        daemonProcess.args = daemonProcess.args.map((arg) => {
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

      daemonProcess.opts.env = Object.assign({}, process.env, { JSREPORT_CLI: true })

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

      // listening to stdout and stderr will only occur
      // when we are developing and trying to debug something
      // (in other words, when stdio: 'pipe')
      if (child.stdout) {
        child.stdout.on('data', (msg) => {
          console.log('stdout child:', msg.toString())
        })
      }

      if (child.stderr) {
        child.stderr.on('data', (msg) => {
          console.log('stderr child:', msg.toString())
        })
      }

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
          resolve(resolve(Object.assign({}, result, { pid: child.pid, proc: child })))
        }
      })
    }
  })
}

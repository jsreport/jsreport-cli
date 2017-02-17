'use strict'

var path = require('path')
var fs = require('fs')
var Promise = require('bluebird')
var childProcess = require('child_process')
var platform = require('os').platform()

var description = 'WINDOWS ONLY - Stop and uninstall service'
var command = 'uninstall'

exports.command = command
exports.description = description

exports.builder = function (yargs) {
  return (
    yargs
    .usage(description + '\nUsage: $0 ' + command)
    .check(function (argv, hash) {
      if (argv.serverUrl) {
        throw new Error('serverUrl option is not supported in this command')
      }

      return true
    })
  )
}

exports.handler = function (argv) {
  return new Promise(function (resolve, reject) {
    var cwd = argv.context.cwd
    var existsPackageJson = fs.existsSync(path.join(cwd, './package.json'))
    var userPkg
    var serviceName
    var pathToWinser

    console.log('Platform is ' + platform)

    if (platform !== 'win32') {
      console.log('Unstalling windows service for app only works on windows platforms..')

      return resolve({
        uninstalled: false,
        serviceName: null
      })
    }

    if (!existsPackageJson) {
      return reject(new Error('To uninstall windows service for app you need a package.json file..'))
    }

    userPkg = require(path.join(cwd, './package.json'))

    if (!userPkg.name) {
      return reject(new Error('To uninstall windows service for app you need a "name" field in package.json file..'))
    }

    serviceName = userPkg.name

    console.log('Uninstalling windows service "' + serviceName + '".')

    try {
      pathToWinser = path.join(cwd, 'node_modules/winser/bin/winser')

      pathToWinser = require.resolve(pathToWinser)

      pathToWinser = '"' + process.execPath + '" "' + pathToWinser + '"'
    } catch (e) {
      if (e.code === 'MODULE_NOT_FOUND') {
        return reject(new Error('couldn\'t find "winser" package'))
      }

      return reject(new Error('Unexpected error happened: ' + e.message))
    }

    childProcess.exec(pathToWinser + ' -r -x', {
      cwd: cwd
    }, function (error, stdout, stderr) {
      if (error) {
        return reject(error)
      }

      console.log('Windows service "' + serviceName + '" uninstalled')

      resolve({
        uninstalled: true,
        serviceName: serviceName
      })
    })
  })
}

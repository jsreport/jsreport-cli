'use strict'

var path = require('path')
var fs = require('fs')
var Promise = require('bluebird')
var platform = require('os').platform()
var Winser = require('winser').Winser

var description = 'WINDOWS ONLY - Stop and uninstall service'
var command = 'win-uninstall'

exports.command = command
exports.description = description

exports.handler = function (argv) {
  return new Promise(function (resolve, reject) {
    var verbose = argv.verbose
    var context = argv.context
    var cwd = context.cwd
    var staticPaths = context.staticPaths || {}
    var existsPackageJson = fs.existsSync(path.join(cwd, './package.json'))
    var userPkg
    var serviceName
    var winser

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

    winser = Winser({ silent: !verbose, nssmPath: staticPaths.nssm })

    winser.remove({
      path: cwd,
      stop: true
    }, function (error) {
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

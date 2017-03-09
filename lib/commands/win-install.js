'use strict'

var path = require('path')
var fs = require('fs')
var Promise = require('bluebird')
var platform = require('os').platform()
var Winser = require('winser-with-api').Winser

var description = 'WINDOWS ONLY - install app as windows service, For other platforms see http://jsreport.net/on-prem/downloads'
var command = 'win-install'

exports.command = command
exports.description = description

exports.handler = function (argv) {
  return new Promise(function (resolve, reject) {
    var verbose = argv.verbose
    var context = argv.context
    var cwd = context.cwd
    var staticPaths = context.staticPaths || {}
    var appInfo = context.appInfo
    var existsPackageJson = fs.existsSync(path.join(cwd, './package.json'))
    var hasEntry = false
    var pathToApp
    var userPkg
    var serviceName
    var winser

    console.log('Platform is ' + platform)

    if (platform !== 'win32') {
      console.log('Installing app as windows service only works on windows platforms..')
      console.log('Installing jsreport as startup service for your platform should be described at http://jsreport.net/downloads')

      return resolve({
        installed: false,
        serviceName: null
      })
    }

    if (!existsPackageJson && !appInfo) {
      return reject(new Error('To install app as windows service you need a package.json file..'))
    }

    if (appInfo) {
      if (!appInfo.path) {
        return reject(new Error('To install app as windows service you need to pass "path" in appInfo..'))
      }

      pathToApp = appInfo.path

      if (!appInfo.name) {
        return reject(new Error('To install app as windows service you need to pass "name" in appInfo..'))
      }

      serviceName = appInfo.name

      if (appInfo.startcmd) {
        hasEntry = true
      }

      if (!hasEntry) {
        return reject(new Error('To install app as windows service you need to pass "startcmd" in appInfo..'))
      }
    } else {
      pathToApp = cwd
      userPkg = require(path.join(pathToApp, './package.json'))

      if (!userPkg.name) {
        return reject(new Error('To install app as windows service you need a "name" field in package.json file..'))
      }

      serviceName = userPkg.name

      if (userPkg.scripts && userPkg.scripts.start) {
        hasEntry = true
      } else if (userPkg.main) {
        hasEntry = true
      }

      if (!hasEntry) {
        return reject(new Error('To install app as windows service you need to have a "start" script or a "main" field in package.json file..'))
      }
    }

    console.log('Installing windows service "' + serviceName + '" for app..')

    if (appInfo) {
      winser = Winser({ silent: !verbose, nssmPath: staticPaths.nssm, app: appInfo })
    } else {
      winser = Winser({ silent: !verbose, nssmPath: staticPaths.nssm })
    }

    winser.install({
      path: pathToApp,
      env: ['NODE_ENV=' + (process.env.NODE_ENV != null ? process.env.NODE_ENV : 'development')],
      autostart: true
    }, function (error) {
      if (error) {
        return reject(error)
      }

      console.log('Service "' + serviceName + '" is running.')

      resolve({
        installed: true,
        serviceName: serviceName
      })
    })
  })
}

'use strict'

var path = require('path')
var fs = require('fs')
var Promise = require('bluebird')
var childProcess = require('child_process')
var platform = require('os').platform()

var description = 'WINDOWS ONLY - install app as windows service, For other platforms see http://jsreport.net/on-prem/downloads'
var command = 'install'

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
    var hasEntry = false
    var userPkg
    var serviceName
    var pathToWinser
    var env

    console.log('Platform is ' + platform)

    if (platform !== 'win32') {
      console.log('Installing app as windows service only works on windows platforms..')
      console.log('Installing jsreport as startup service for your platform should be described at http://jsreport.net/downloads')

      return resolve({
        installed: false,
        serviceName: null
      })
    }

    if (!existsPackageJson) {
      return reject(new Error('To install app as windows service you need a package.json file..'))
    }

    userPkg = require(path.join(cwd, './package.json'))

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

    console.log('Installing windows service "' + serviceName + '" for app..')

    try {
      pathToWinser = path.join(cwd, 'node_modules/winser/bin/winser')

      pathToWinser = require.resolve(pathToWinser)

      pathToWinser = '"' + process.execPath + '" "' + pathToWinser + '"'

      env = ' --env NODE_ENV=' + (process.env.NODE_ENV != null ? process.env.NODE_ENV : 'development')
    } catch (e) {
      if (e.code === 'MODULE_NOT_FOUND') {
        return reject(new Error('couldn\'t find "winser" package'))
      }

      return reject(new Error('Unexpected error happened: ' + e.message))
    }

    childProcess.exec(pathToWinser + ' -i ' + env, {
      cwd: cwd
    }, function (error, stdout, stderr) {
      if (error) {
        return reject(error)
      }

      console.log('Starting windows service "' + serviceName + '".')

      childProcess.exec('net start ' + serviceName, function (error, stdout, stder) {
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
  })
}

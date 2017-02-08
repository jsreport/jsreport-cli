'use strict'

var path = require('path')
var fs = require('fs')
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
    }).fail(function (msg, err) {
      console.error(command + ' command error:')
      console.error(msg)
      process.exit(1)
    })
  )
}

exports.handler = function (argv) {
  var existsPackageJson = fs.existsSync('package.json')
  var hasEntry = false
  var userPkg
  var serviceName
  var pathToWinser
  var env

  console.log('Platform is ' + platform)

  if (platform !== 'win32') {
    console.log('Installing app as windows service only works on windows platforms..')
    console.log('Installing jsreport as startup service for your platform should be described at http://jsreport.net/downloads')
    return
  }

  if (!existsPackageJson) {
    return console.log('To install app as windows service you need a package.json file..')
  }

  userPkg = require(path.join(process.cwd(), './package.json'))

  if (!userPkg.name) {
    return console.log('To install app as windows service you need a "name" field in package.json file..')
  }

  serviceName = userPkg.name

  if (userPkg.scripts && userPkg.scripts.start) {
    hasEntry = true
  } else if (userPkg.main) {
    hasEntry = true
  }

  if (!hasEntry) {
    return console.log('To install app as windows service you need to have a "start" script or a "main" field in package.json file..')
  }

  console.log('Installing windows service "' + serviceName + '" for app..')

  try {
    pathToWinser = path.dirname(require.resolve('winser'))
    pathToWinser = path.resolve(pathToWinser, '../.bin/winser.cmd')
    pathToWinser = '"' + pathToWinser + '"'

    env = ' --env NODE_ENV=' + process.env.NODE_ENV || 'development'
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      return console.log('couldn\'t find "winser" package')
    }

    return console.log('Unexpected error happened,', e)
  }

  childProcess.exec(pathToWinser + ' -i ' + env, {
    cwd: process.cwd()
  }, function (error, stdout, stderr) {
    if (error) {
      console.log(error)
      process.exit(1)
      return
    }

    console.log('Starting windows service "' + serviceName + '".')

    childProcess.exec('net start ' + serviceName, function (error, stdout, stder) {
      if (error) {
        console.log(error)
        process.exit(1)
        return
      }

      console.log('Service "' + serviceName + '" is running.')
      process.exit(0)
    })
  })
}

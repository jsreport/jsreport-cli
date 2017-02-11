'use strict'

var path = require('path')
var fs = require('fs')
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
    }).fail(function (msg, err) {
      console.error(command + ' command error:')
      console.error(msg)
      process.exit(1)
    })
  )
}

exports.handler = function (argv) {
  var cwd = argv.context.cwd
  var existsPackageJson = fs.existsSync(path.join(cwd, './package.json'))
  var userPkg
  var serviceName
  var pathToWinser

  console.log('Platform is ' + platform)

  if (platform !== 'win32') {
    console.log('Unstalling windows service for app only works on windows platforms..')
    return
  }

  if (!existsPackageJson) {
    return console.log('To uninstall windows service for app you need a package.json file..')
  }

  userPkg = require(path.join(cwd, './package.json'))

  if (!userPkg.name) {
    return console.log('To uninstall windows service for app you need a "name" field in package.json file..')
  }

  serviceName = userPkg.name

  console.log('Uninstalling windows service "' + serviceName + '".')

  try {
    pathToWinser = path.dirname(require.resolve('winser'))
    pathToWinser = path.resolve(pathToWinser, '../.bin/winser.cmd')
    pathToWinser = '"' + pathToWinser + '"'
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      return console.log('couldn\'t find "winser" package')
    }

    return console.log('Unexpected error happened,', e)
  }

  childProcess.exec(pathToWinser + ' -r -x', {
    cwd: cwd
  }, function (error, stdout, stderr) {
    if (error) {
      console.log(error)
      process.exit(1)
      return
    }

    console.log('Windows service "' + serviceName + '" uninstalled')
    process.exit(0)
  })
}

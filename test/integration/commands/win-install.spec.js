'use strict'

var path = require('path')
var fs = require('fs')
var childProcess = require('child_process')
var should = require('should')
var utils = require('../../utils')
var winInstall = require('../../../lib/commands/win-install').handler

var IS_WINDOWS = process.platform === 'win32'

var TEMP_DIRS = [
  'win-install-empty',
  'win-install-packagejson-only',
  'win-install-packagejson-without-entry',
  'win-install-packagejson-ok'
]

describe('win-install command', function () {
  // disabling timeout because removing files could take a
  // couple of seconds
  this.timeout(0)

  before(function () {
    utils.cleanTempDir(TEMP_DIRS)

    utils.createTempDir(TEMP_DIRS, function (dir, absoluteDir) {
      switch (dir) {
        case 'win-install-packagejson-only':
          fs.writeFileSync(
            path.join(absoluteDir, './package.json'),
            JSON.stringify({
              description: 'example project'
            }, null, 2)
          )
          return

        case 'win-install-packagejson-without-entry':
          fs.writeFileSync(
            path.join(absoluteDir, './package.json'),
            JSON.stringify({
              name: 'example project'
            }, null, 2)
          )

          return

        case 'win-install-packagejson-ok':
          fs.writeFileSync(
            path.join(absoluteDir, './package.json'),
            JSON.stringify({
              name: 'jsreport-server-for-cli-testing',
              main: 'server.js',
              dependencies: {
                jsreport: '*'
              }
            }, null, 2)
          )

          fs.writeFileSync(
            path.join(absoluteDir, './server.js'),
            'require("jsreport")().init().catch(function(err) { console.error("Error starting jsreport:", err); process.exit(1); })'
          )
      }
    })
  })

  it('should not work on empty directory', function () {
    var dir = utils.getTempDir('win-install-empty')
    var installAsync = winInstall({ context: { cwd: dir } })

    if (!IS_WINDOWS) {
      should(installAsync).be.fulfilledWith({ installed: false, serviceName: null })
    } else {
      should(installAsync).be.rejected()
    }
  })

  it('should not work on directory with package.json without name field', function () {
    var dir = utils.getTempDir('win-install-packagejson-only')
    var installAsync = winInstall({ context: { cwd: dir } })

    if (!IS_WINDOWS) {
      should(installAsync).be.fulfilledWith({ installed: false, serviceName: null })
    } else {
      should(installAsync).be.rejected()
    }
  })

  it('should not work on directory with package.json without main or scripts field', function () {
    var dir = utils.getTempDir('win-install-packagejson-without-entry')
    var installAsync = winInstall({ context: { cwd: dir } })

    if (!IS_WINDOWS) {
      should(installAsync).be.fulfilledWith({ installed: false, serviceName: null })
    } else {
      should(installAsync).be.rejected()
    }
  })

  it('should install windows service', function (done) {
    // disabling timeout because npm install could take a
    // couple of minutes
    this.timeout(0)

    var dir = utils.getTempDir('win-install-packagejson-ok')
    var installAsync

    utils.npmInstall(dir, function (error) {
      if (error) {
        return done(error)
      }

      installAsync = winInstall({ context: { cwd: dir } })

      installAsync
        .then(function (serviceInfo) {
          if (!IS_WINDOWS) {
            should(serviceInfo.installed).be.eql(false)
            return done()
          }

          childProcess.exec('sc query "' + serviceInfo.serviceName + '"', {
            cwd: dir
          }, function (error, stdout) {
            if (error) {
              return done(error)
            }

            if (stdout) {
              should(stdout.indexOf('RUNNING') !== -1).be.eql(true)
            } else {
              return done(new Error('Can\' detect is service is running or not'))
            }

            should(serviceInfo.installed).be.eql(true)
            should(serviceInfo.serviceName).be.eql('jsreport-server-for-cli-testing')

            console.log('uninstalling service "' + serviceInfo.serviceName + '" after test case has finished..')

            childProcess.exec('sc stop "' + serviceInfo.serviceName + '"', {
              cwd: dir
            }, function () {
              childProcess.exec('sc delete "' + serviceInfo.serviceName + '"', {
                cwd: dir
              }, function () {
                done()
              })
            })
          })
        })
        .catch(done)
    })
  })

  after(function () {
    utils.cleanTempDir(TEMP_DIRS)
  })
})

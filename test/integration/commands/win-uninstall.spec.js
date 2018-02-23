'use strict'

var path = require('path')
var fs = require('fs')
var childProcess = require('child_process')
var should = require('should')
var utils = require('../../utils')
var winUninstall = require('../../../lib/commands/win-uninstall').handler

var IS_WINDOWS = process.platform === 'win32'

var TEMP_DIRS = [
  'win-uninstall-empty',
  'win-uninstall-packagejson-only',
  'win-uninstall-packagejson-ok'
]

describe('win-uninstall command', function () {
  // disabling timeout because removing files could take a
  // couple of seconds
  this.timeout(0)

  before(function () {
    utils.cleanTempDir(TEMP_DIRS)

    utils.createTempDir(TEMP_DIRS, function (dir, absoluteDir) {
      switch (dir) {
        case 'win-uninstall-packagejson-only':
          fs.writeFileSync(
            path.join(absoluteDir, './package.json'),
            JSON.stringify({
              description: 'example project'
            }, null, 2)
          )
          return

        case 'win-uninstall-packagejson-ok':
          fs.writeFileSync(
            path.join(absoluteDir, './package.json'),
            JSON.stringify({
              name: 'jsreport-server-for-uninstall',
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
    var dir = utils.getTempDir('win-uninstall-empty')
    var uninstallAsync = winUninstall({ context: { cwd: dir } })

    if (!IS_WINDOWS) {
      should(uninstallAsync).be.fulfilledWith({ uninstalled: false, serviceName: null })
    } else {
      should(uninstallAsync).be.rejected()
    }
  })

  it('should not work on directory with package.json without name field', function () {
    var dir = utils.getTempDir('win-uninstall-packagejson-only')
    var uninstallAsync = winUninstall({ context: { cwd: dir } })

    if (!IS_WINDOWS) {
      should(uninstallAsync).be.fulfilledWith({ uninstalled: false, serviceName: null })
    } else {
      should(uninstallAsync).be.rejected()
    }
  })

  it('should uninstall windows service', function (done) {
    // disabling timeout because npm install could take a
    // couple of minutes
    this.timeout(0)

    var dir = utils.getTempDir('win-uninstall-packagejson-ok')
    var uninstallAsync

    if (!IS_WINDOWS) {
      return done()
    }

    utils.npmInstall(dir, function (error) {
      var pathToWinser = path.join(__dirname, '../../node_modules/.bin/winser.cmd')

      if (error) {
        return done(error)
      }

      console.log('installing app in', dir, 'as windows service for the test case..')

      childProcess.exec('"' + pathToWinser + '" -i -p "' + dir + '"', {
        cwd: dir
      }, function (error) {
        if (error) {
          return done(error)
        }

        uninstallAsync = winUninstall({ context: { cwd: dir } })

        uninstallAsync
          .then(function (serviceInfo) {
            if (!IS_WINDOWS) {
              should(serviceInfo.uninstalled).be.eql(false)
              return done()
            }

            childProcess.exec('sc query "' + serviceInfo.serviceName + '"', {
              cwd: dir
            }, function (error, stdout) {
              if (error) {
                should(serviceInfo.serviceName).be.eql('jsreport-server-for-uninstall')
                return done()
              }

              return done(new Error('service ' + serviceInfo.serviceName + ' should have been uninstalled'))
            })
          })
          .catch(done)
      })
    })
  })

  after(function () {
    utils.cleanTempDir(TEMP_DIRS)
  })
})

'use strict'

var path = require('path')
var fs = require('fs')
var childProcess = require('child_process')
var should = require('should')
var utils = require('../utils')
var install = require('../../lib/commands/install').handler

var IS_WINDOWS = process.platform === 'win32'

var TEMP_DIRS = [
  'install-empty',
  'install-packagejson-only',
  'install-packagejson-ok'
]

describe('install command', function () {
  before(function () {
    utils.cleanTempDir(TEMP_DIRS)

    utils.createTempDir(TEMP_DIRS, function (dir, absoluteDir) {
      switch (dir) {
        case 'install-packagejson-only':
          fs.writeFileSync(
            path.join(absoluteDir, './package.json'),
            JSON.stringify({
              description: 'example project'
            }, null, 2)
          )
          return

        case 'install-packagejson-without-entry':
          fs.writeFileSync(
            path.join(absoluteDir, './package.json'),
            JSON.stringify({
              name: 'example project'
            }, null, 2)
          )

          return

        case 'install-packagejson-ok':
          fs.writeFileSync(
            path.join(absoluteDir, './package.json'),
            JSON.stringify({
              name: 'jsreport-server',
              main: 'server.js',
              dependencies: {
                jsreport: '*'
              }
            }, null, 2)
          )

          fs.writeFileSync(
            path.join(absoluteDir, './server.js'),
            'require("jsreport")().init().catch(function(err) { console.error("Error starting jsreport:", err) })'
          )
          return
      }
    })
  })

  it('should not work on empty directory', function () {
    var dir = utils.getTempDir('install-empty')
    var installAsync = install({ context: { cwd: dir } })

    if (!IS_WINDOWS) {
      should(installAsync).be.fulfilledWith(false)
    } else {
      should(installAsync).be.rejected()
    }
  })

  it('should not work on directory with package.json without name field', function () {
    var dir = utils.getTempDir('install-packagejson-only')
    var installAsync = install({ context: { cwd: dir } })

    if (!IS_WINDOWS) {
      should(installAsync).be.fulfilledWith(false)
    } else {
      should(installAsync).be.rejected()
    }
  })

  it('should not work on directory with package.json without main or scripts field', function () {
    var dir = utils.getTempDir('install-packagejson-without-entry')
    var installAsync = install({ context: { cwd: dir } })

    if (!IS_WINDOWS) {
      should(installAsync).be.fulfilledWith(false)
    } else {
      should(installAsync).be.rejected()
    }
  })

  it('should install windows service', function (done) {
    // disabling timeout because npm install could take a
    // couple of minutes
    this.timeout(0)

    var dir = utils.getTempDir('install-packagejson-ok')
    var installAsync

    console.log('installing jsreport for the test case...')

    childProcess.exec('npm install', {
      cwd: dir
    }, function (error, stdout, stderr) {
      if (error) {
        return done(error)
      }

      installAsync = install({ context: { cwd: dir } })

      installAsync.then(function (serviceInstalled) {
        if (!IS_WINDOWS) {
          return should(serviceInstalled).be.eql(false)
        }

        childProcess.exec('sc query "jsreport-server" | find "RUNNING"', {
          cwd: dir
        }, function (error) {
          if (error) {
            return done(error)
          }

          should(serviceInstalled).be.eql(true)
          done()
        })
      }).catch(done)
    })
  })

  after(function () {
    utils.cleanTempDir(TEMP_DIRS)
  })
})

const path = require('path')
const fs = require('fs')
const childProcess = require('child_process')
const should = require('should')
const jsreportVersionToTest = require('../../jsreportVersionToTest')
const utils = require('../../utils')
const winInstall = require('../../../lib/commands/win-install').handler

const IS_WINDOWS = process.platform === 'win32'

const TEMP_DIRS = [
  'win-install-empty',
  'win-install-packagejson-only',
  'win-install-packagejson-without-entry',
  'win-install-packagejson-ok'
]

describe('win-install command', function () {
  // disabling timeout because removing files could take a
  // couple of seconds
  this.timeout(0)

  before(() => {
    utils.cleanTempDir(TEMP_DIRS)

    utils.createTempDir(TEMP_DIRS, (dir, absoluteDir) => {
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
                jsreport: jsreportVersionToTest
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

  it('should not work on empty directory', () => {
    const dir = utils.getTempDir('win-install-empty')
    const installAsync = winInstall({ context: { cwd: dir } })

    if (!IS_WINDOWS) {
      should(installAsync).be.fulfilledWith({ installed: false, serviceName: null })
    } else {
      should(installAsync).be.rejected()
    }
  })

  it('should not work on directory with package.json without name field', () => {
    const dir = utils.getTempDir('win-install-packagejson-only')
    const installAsync = winInstall({ context: { cwd: dir } })

    if (!IS_WINDOWS) {
      should(installAsync).be.fulfilledWith({ installed: false, serviceName: null })
    } else {
      should(installAsync).be.rejected()
    }
  })

  it('should not work on directory with package.json without main or scripts field', () => {
    const dir = utils.getTempDir('win-install-packagejson-without-entry')
    const installAsync = winInstall({ context: { cwd: dir } })

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

    const dir = utils.getTempDir('win-install-packagejson-ok')
    let installAsync

    utils.npmInstall(dir, (error) => {
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

  after(() => utils.cleanTempDir(TEMP_DIRS))
})

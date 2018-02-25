const path = require('path')
const fs = require('fs')
const childProcess = require('child_process')
const should = require('should')
const utils = require('../../utils')
const winUninstall = require('../../../lib/commands/win-uninstall').handler

const IS_WINDOWS = process.platform === 'win32'

const TEMP_DIRS = [
  'win-uninstall-empty',
  'win-uninstall-packagejson-only',
  'win-uninstall-packagejson-ok'
]

describe('win-uninstall command', function () {
  // disabling timeout because removing files could take a
  // couple of seconds
  this.timeout(0)

  before(() => {
    utils.cleanTempDir(TEMP_DIRS)

    utils.createTempDir(TEMP_DIRS, (dir, absoluteDir) => {
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

  it('should not work on empty directory', () => {
    const dir = utils.getTempDir('win-uninstall-empty')
    const uninstallAsync = winUninstall({ context: { cwd: dir } })

    if (!IS_WINDOWS) {
      should(uninstallAsync).be.fulfilledWith({ uninstalled: false, serviceName: null })
    } else {
      should(uninstallAsync).be.rejected()
    }
  })

  it('should not work on directory with package.json without name field', () => {
    const dir = utils.getTempDir('win-uninstall-packagejson-only')
    const uninstallAsync = winUninstall({ context: { cwd: dir } })

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

    const dir = utils.getTempDir('win-uninstall-packagejson-ok')

    if (!IS_WINDOWS) {
      return done()
    }

    utils.npmInstall(dir, function (error) {
      const pathToWinser = path.join(__dirname, '../../node_modules/.bin/winser.cmd')

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

        const uninstallAsync = winUninstall({ context: { cwd: dir } })

        uninstallAsync
          .then((serviceInfo) => {
            if (!IS_WINDOWS) {
              should(serviceInfo.uninstalled).be.eql(false)
              return done()
            }

            childProcess.exec('sc query "' + serviceInfo.serviceName + '"', {
              cwd: dir
            }, (error, stdout) => {
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

  after(() => utils.cleanTempDir(TEMP_DIRS))
})

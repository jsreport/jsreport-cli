'use strict'

var path = require('path')
var fs = require('fs')
var childProcess = require('child_process')
var should = require('should')
var utils = require('../utils')
var instanceHandler = require('../../lib/instanceHandler')
var start = require('../../lib/commands/start').handler

describe('start command', function () {
  var pathToTempProject
  var currentInstance
  var port = 9879

  function getInstance (cwd) {
    return (
      instanceHandler
      .find(cwd)
      .then(function (instanceInfo) {
        return instanceInfo.instance
      })
    )
  }

  function initInstance (instance) {
    currentInstance = instance

    return (
      instanceHandler.initialize(instance, false)
    )
  }

  before(function (done) {
    // disabling timeout because npm install could take a
    // couple of seconds
    this.timeout(0)

    utils.cleanTempDir(['start-project'])

    utils.createTempDir(['start-project'], function (dir, absoluteDir) {
      pathToTempProject = absoluteDir

      fs.writeFileSync(
        path.join(absoluteDir, './package.json'),
        JSON.stringify({
          name: 'start-project',
          dependencies: {
            jsreport: '*'
          },
          jsreport: {
            entryPoint: 'server.js'
          }
        }, null, 2)
      )

      fs.writeFileSync(
        path.join(absoluteDir, 'dev.config.json'),
        JSON.stringify({
          httpPort: port
        }, null, 2)
      )

      fs.writeFileSync(
        path.join(absoluteDir, './server.js'),
        [
          'var jsreport = require("jsreport")()',
          'if (require.main !== module) {',
          'module.exports = jsreport',
          '} else {',
          'jsreport.init().catch(function (e) {',
          'console.error("error on jsreport init")',
          'console.error(e.stack)',
          'process.exit(1)',
          '})',
          '}'
        ].join('\n')
      )

      console.log('installing dependencies for test suite...')

      childProcess.exec('npm install', {
        cwd: pathToTempProject
      }, function (error, stdout, stderr) {
        if (error) {
          console.log('error while installing dependencies for test suite...')
          return done(error)
        }

        console.log('installation of dependencies for test suite completed...')
        done()
      })
    })
  })

  it('should handle errors', function () {
    return (
      start({
        context: {
          cwd: '/invalid/path',
          getInstance: getInstance,
          initInstance: initInstance
        }
      })
      .then(function () {
        throw new Error('start should have failed')
      }, function (err) {
        should(err).be.Error()
      })
    )
  })

  it('should start a jsreport instance', function () {
    return (
      start({
        context: {
          cwd: pathToTempProject,
          getInstance: getInstance,
          initInstance: initInstance
        }
      })
      .then(function (instance) {
        should(instanceHandler.isJsreportInstance(instance)).be.eql(true)
        should(instance._initialized).be.eql(true)
      })
    )
  })

  afterEach(function () {
    if (currentInstance && currentInstance.express && currentInstance.express.server) {
      currentInstance.express.server.close()
    }
  })

  after(function () {
    // disabling timeout because removing files could take a
    // couple of seconds
    this.timeout(0)

    utils.cleanTempDir(['start-project'])
  })
})

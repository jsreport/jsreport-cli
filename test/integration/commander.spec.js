'use strict'

var path = require('path')
var fs = require('fs')
var childProcess = require('child_process')
var should = require('should')
var assign = require('object-assign')
var stdMocks = require('std-mocks')
var utils = require('../utils')
var commander = require('../../lib/commander')
var exitMock = utils.mockProcessExit

describe('commander', function () {
  describe('when using jsreport instances', function () {
    var pathToTempProject

    var originalPkgJson = {
      name: 'commander-project',
      dependencies: {
        jsreport: '*'
      }
    }

    before(function (done) {
      // disabling timeout because npm install could take a
      // couple of seconds
      this.timeout(0)

      utils.cleanTempDir(['commander-project'])

      utils.createTempDir(['commander-project'], function (dir, absoluteDir) {
        pathToTempProject = absoluteDir

        fs.writeFileSync(
          path.join(absoluteDir, './package.json'),
          JSON.stringify(originalPkgJson, null, 2)
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
      })

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

    beforeEach(function () {
      // deleting cache of package.json to allow run the tests on the same project
      delete require.cache[require.resolve(path.join(pathToTempProject, './package.json'))]

      fs.writeFileSync(
        path.join(pathToTempProject, './package.json'),
        JSON.stringify(originalPkgJson, null, 2)
      )
    })

    it('should emit event on instance searching', function (done) {
      var cli = commander(pathToTempProject)
      var instanceLookupCalled = false
      var instanceFoundCalled = false
      var instanceInEvent
      var instanceInHandler

      var testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: function (argv) {
          instanceInHandler = argv.context.jsreport
          return instanceInHandler
        }
      }

      cli.registerCommand(testCommand)

      cli.on('instance.lookup', function () {
        instanceLookupCalled = true
      })

      cli.on('instance.found', function (instance) {
        instanceFoundCalled = true
        instanceInEvent = instance
      })

      cli.on('command.success', function (cmdName, result) {
        setTimeout(function () {
          var exitCode

          stdMocks.restore()
          stdMocks.flush()
          exitMock.restore()

          exitCode = exitMock.callInfo().exitCode

          should(cmdName).be.eql('test')
          should(exitCode).be.eql(0)
          should(instanceLookupCalled).be.eql(true)
          should(instanceFoundCalled).be.eql(true)
          should(instanceInHandler).be.exactly(instanceInEvent)
          should(result).be.exactly(instanceInHandler)

          instanceInHandler.express.server.close()

          done()
        }, 200)
      })

      stdMocks.use()
      exitMock.enable()

      // set entry point in package.json of test project
      fs.writeFileSync(
        path.join(pathToTempProject, './package.json'),
        JSON.stringify(
          assign({
            jsreport: {
              entryPoint: 'server.js'
            }
          }, originalPkgJson),
          null, 2
        )
      )

      cli.start(['test'])
    })

    it('should emit event when using a default instance', function (done) {
      var cli = commander(pathToTempProject)
      var instanceLookupCalled = false
      var instanceDefaultCalled = false
      var instanceInEvent
      var instanceInHandler

      var testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: function (argv) {
          instanceInHandler = argv.context.jsreport
          return instanceInHandler
        }
      }

      cli.registerCommand(testCommand)

      cli.on('instance.lookup', function () {
        instanceLookupCalled = true
      })

      cli.on('instance.default', function (instance) {
        instanceDefaultCalled = true
        instanceInEvent = instance
      })

      cli.on('command.success', function (cmdName, result) {
        setTimeout(function () {
          var exitCode

          stdMocks.restore()
          stdMocks.flush()
          exitMock.restore()

          exitCode = exitMock.callInfo().exitCode

          should(cmdName).be.eql('test')
          should(exitCode).be.eql(0)
          should(instanceLookupCalled).be.eql(true)
          should(instanceDefaultCalled).be.eql(true)
          should(instanceInHandler).be.exactly(instanceInEvent)
          should(result).be.exactly(instanceInHandler)

          instanceInHandler.express.server.close()

          done()
        }, 200)
      })

      stdMocks.use()
      exitMock.enable()

      cli.start(['test'])
    })

    it('should emit event on instance initialization', function (done) {
      var cli = commander(pathToTempProject)
      var instanceInitializingCalled = false
      var instanceInHandler

      var testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: function (argv) {
          instanceInHandler = argv.context.jsreport
          return instanceInHandler
        }
      }

      cli.registerCommand(testCommand)

      cli.on('instance.initializing', function () {
        instanceInitializingCalled = true
      })

      cli.on('instance.initialized', function (result) {
        setTimeout(function () {
          var exitCode

          stdMocks.restore()
          stdMocks.flush()
          exitMock.restore()

          exitCode = exitMock.callInfo().exitCode

          should(exitCode).be.eql(0)
          should(instanceInitializingCalled).be.eql(true)
          should(result).be.exactly(instanceInHandler)

          instanceInHandler.express.server.close()

          done()
        }, 200)
      })

      stdMocks.use()
      exitMock.enable()

      cli.start(['test'])
    })

    after(function () {
      // disabling timeout because removing files could take a
      // couple of seconds
      this.timeout(0)

      utils.cleanTempDir(['commander-project'])
    })
  })
})

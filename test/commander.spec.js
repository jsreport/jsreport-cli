'use strict'

var path = require('path')
var fs = require('fs')
var childProcess = require('child_process')
var should = require('should')
var assign = require('object-assign')
var Promise = require('bluebird')
var stdMocks = require('std-mocks')
var utils = require('./utils')
var commander = require('../lib/commander')
var pkg = require('../package.json')
var exitMock = utils.mockProcessExit

describe('commander', function () {
  describe('when initializing', function () {
    it('should initialize with default options', function () {
      var defaultCommands = ['init', 'configure', 'start', 'win-install', 'render', 'repair', 'win-uninstall', 'kill']
      var cli = commander()

      should(cli.cwd).be.eql(process.cwd())
      should(cli.context).be.not.undefined()
      should(cli._showHelpWhenNoCommand).be.eql(true)
      should(cli._commandNames).containDeep(defaultCommands)
      should(cli._commandNames.length).be.eql(defaultCommands.length)
      should(cli._cli).not.be.undefined()
    })

    it('should emit event', function (done) {
      var cli = commander()

      cli.on('initialized', done)
    })

    it('should have a method to get registered commands', function () {
      var cli = commander()

      should(cli.getCommands()).be.Array()
      should(cli.getCommands().length).be.above(0)
    })

    it('should have an option to register built-in commands', function () {
      var commands
      var cli

      commands = [{
        command: 'push',
        description: 'push command',
        handler: function () {}
      }, {
        command: 'pull',
        description: 'pull command',
        handler: function () {}
      }]

      cli = commander(undefined, { builtInCommands: commands })

      should(cli.getCommands()).be.eql(['push', 'pull'])
    })

    it('should have an option to disable commands', function () {
      var commands
      var cli

      commands = [{
        command: 'push',
        description: 'push command',
        handler: function () {}
      }, {
        command: 'pull',
        description: 'pull command',
        handler: function () {}
      }]

      cli = commander(undefined, { builtInCommands: commands, disabledCommands: ['push'] })

      should(cli.getCommands()).be.eql(['pull'])
    })
  })

  describe('when registering command', function () {
    it('should throw error on invalid command module', function () {
      var cli = commander()

      should(function registerInvalidCommands () {
        cli.registerCommand(2)
        cli.registerCommand(true)
        cli.registerCommand(null)
        cli.registerCommand(undefined)
        cli.registerCommand([])
        cli.registerCommand({})
        cli.registerCommand({ command: '' })
        cli.registerCommand({ command: 'command', description: '' })
        cli.registerCommand({ command: 'command', description: 'some description', handler: null })
      }).throw()
    })

    it('should register command', function () {
      var cli = commander()

      var testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: function () {}
      }

      cli.registerCommand(testCommand)

      // test reference equality
      should(cli._commands.test).be.exactly(testCommand)
    })

    it('should return instance', function () {
      var cli = commander()

      var testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: function () {}
      }

      var returnValue = cli.registerCommand(testCommand)

      should(cli).be.exactly(returnValue)
    })

    it('should emit event', function (done) {
      var cli = commander()

      var testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: function () {}
      }

      cli.on('command.register', function (cmdName, cmdModule) {
        should(cmdName).be.eql('test')
        should(cmdModule).be.exactly(testCommand)
        done()
      })

      cli.registerCommand(testCommand)
    })
  })

  describe('when executing command', function () {
    it('should fail on invalid command', function () {
      var cli = commander()

      return should(cli.executeCommand('unknowCmd')).be.rejected()
    })

    it('should pass arguments to command handler', function () {
      var cli = commander()
      var cmdArgs

      var testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: function (args) {
          return args
        }
      }

      cli.registerCommand(testCommand)

      cli.on('command.init', function (cmdName, args) {
        if (cmdName === 'test') {
          cmdArgs = args
        }
      })

      return (
        cli.executeCommand('test', { args: true })
        .then(function (result) {
          should(result).be.exactly(cmdArgs)
        })
      )
    })

    it('should fail when command sync handler fails', function () {
      var cli = commander()

      var testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: function () {
          throw new Error('error in handler')
        }
      }

      cli.registerCommand(testCommand)

      return should(cli.executeCommand('test')).be.rejectedWith({ message: 'error in handler' })
    })

    it('should emit event when command sync handler fails', function () {
      var cli = commander()
      var onInitCalled = false
      var onErrorCalled = false
      var onFinishCalled = false
      var errorInEvent

      var testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: function () {
          throw new Error('error in handler')
        }
      }

      cli.registerCommand(testCommand)

      cli.on('command.init', function (cmdName) {
        if (cmdName === 'test') {
          onInitCalled = true
        }
      })

      cli.on('command.error', function (cmdName, error) {
        if (cmdName === 'test') {
          onErrorCalled = true
          errorInEvent = error
        }
      })

      cli.on('command.finish', function (cmdName) {
        if (cmdName === 'test') {
          onFinishCalled = true
        }
      })

      return cli.executeCommand('test')
      .then(function () {
        throw new Error('command should have failed')
      }, function (err) {
        should(err).be.Error()
        should(err).be.exactly(errorInEvent)
        should(err.message).be.eql('error in handler')
        should(onInitCalled).be.eql(true)
        should(onErrorCalled).be.eql(true)
        should(onFinishCalled).be.eql(true)
      })
    })

    it('should fail when command async handler fails', function () {
      var cli = commander()

      var testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: function () {
          return new Promise(function (resolve, reject) {
            reject(new Error('error in handler'))
          })
        }
      }

      cli.registerCommand(testCommand)

      return should(cli.executeCommand('test')).be.rejectedWith({ message: 'error in handler' })
    })

    it('should emit event when command async handler fails', function () {
      var cli = commander()
      var onInitCalled = false
      var onErrorCalled = false
      var onFinishCalled = false
      var errorInEvent

      var testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: function () {
          return new Promise(function (resolve, reject) {
            reject(new Error('error in handler'))
          })
        }
      }

      cli.registerCommand(testCommand)

      cli.on('command.init', function (cmdName) {
        if (cmdName === 'test') {
          onInitCalled = true
        }
      })

      cli.on('command.error', function (cmdName, error) {
        if (cmdName === 'test') {
          onErrorCalled = true
          errorInEvent = error
        }
      })

      cli.on('command.finish', function (cmdName) {
        if (cmdName === 'test') {
          onFinishCalled = true
        }
      })

      return (
        cli.executeCommand('test')
        .then(function () {
          throw new Error('command should have failed')
        }, function (err) {
          should(err).be.Error()
          should(err).be.exactly(errorInEvent)
          should(err.message).be.eql('error in handler')
          should(onInitCalled).be.eql(true)
          should(onErrorCalled).be.eql(true)
          should(onFinishCalled).be.eql(true)
        })
      )
    })

    it('should success when command sync handler ends successfully', function () {
      var cli = commander()

      var testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: function () {
          return true
        }
      }

      cli.registerCommand(testCommand)

      return should(cli.executeCommand('test')).be.fulfilledWith(true)
    })

    it('should emit event when command sync handler ends successfully', function () {
      var cli = commander()
      var onInitCalled = false
      var onSuccessCalled = false
      var onFinishCalled = false
      var successValueInEvent

      var testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: function () {
          return true
        }
      }

      cli.registerCommand(testCommand)

      cli.on('command.init', function (cmdName) {
        if (cmdName === 'test') {
          onInitCalled = true
        }
      })

      cli.on('command.success', function (cmdName, value) {
        if (cmdName === 'test') {
          onSuccessCalled = true
          successValueInEvent = value
        }
      })

      cli.on('command.finish', function (cmdName) {
        if (cmdName === 'test') {
          onFinishCalled = true
        }
      })

      return (
        cli.executeCommand('test')
        .then(function (result) {
          should(result).be.exactly(successValueInEvent)
          should(onInitCalled).be.eql(true)
          should(onSuccessCalled).be.eql(true)
          should(onFinishCalled).be.eql(true)
        })
      )
    })

    it('should success when command async handler ends successfully', function () {
      var cli = commander()

      var testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: function () {
          return new Promise(function (resolve, reject) {
            resolve(true)
          })
        }
      }

      cli.registerCommand(testCommand)

      return should(cli.executeCommand('test')).be.fulfilledWith(true)
    })

    it('should emit event when command async handler ends successfully', function () {
      var cli = commander()
      var onInitCalled = false
      var onSuccessCalled = false
      var onFinishCalled = false
      var successValueInEvent

      var testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: function () {
          return new Promise(function (resolve) {
            resolve(true)
          })
        }
      }

      cli.registerCommand(testCommand)

      cli.on('command.init', function (cmdName) {
        if (cmdName === 'test') {
          onInitCalled = true
        }
      })

      cli.on('command.success', function (cmdName, value) {
        if (cmdName === 'test') {
          onSuccessCalled = true
          successValueInEvent = value
        }
      })

      cli.on('command.finish', function (cmdName) {
        if (cmdName === 'test') {
          onFinishCalled = true
        }
      })

      return (
        cli.executeCommand('test')
        .then(function (result) {
          should(result).be.exactly(successValueInEvent)
          should(onInitCalled).be.eql(true)
          should(onSuccessCalled).be.eql(true)
          should(onFinishCalled).be.eql(true)
        })
      )
    })
  })

  describe('when starting', function () {
    it('should fail on invalid arguments', function () {
      var cli = commander()

      should(function startCommander () {
        cli.start()
      }).throw()

      should(function startCommander () {
        cli.start(null)
      }).throw()
    })

    it('should print help by default when command is not present', function (done) {
      var cli = commander()
      var helpPrinted = false

      stdMocks.use()

      cli.on('parsed', function () {
        process.nextTick(function () {
          stdMocks.restore()
          helpPrinted = stdMocks.flush().stderr.join('\n').indexOf('Commands:') !== -1
          should(helpPrinted).be.eql(true)
          done()
        })
      })

      cli.start([])
    })

    it('should not print help when using `showHelpWhenNoCommand` option and command is not present', function (done) {
      var cli = commander(process.cwd(), {
        showHelpWhenNoCommand: false
      })

      var output

      stdMocks.use()

      cli.on('parsed', function () {
        process.nextTick(function () {
          stdMocks.restore()
          output = stdMocks.flush()

          should(output.stdout.length).be.eql(0)
          should(output.stderr.length).be.eql(0)
          done()
        })
      })

      cli.start([])
    })

    it('should handle --help option by default', function (done) {
      var cli = commander()
      var helpPrinted = false

      stdMocks.use()
      exitMock.enable()

      cli.on('parsed', function () {
        process.nextTick(function () {
          stdMocks.restore()
          exitMock.restore()

          helpPrinted = stdMocks.flush().stdout.join('\n').indexOf('Commands:') !== -1

          should(helpPrinted).be.eql(true)
          done()
        })
      })

      cli.start(['--help'])
    })

    it('should handle --version option by default', function (done) {
      var cli = commander()
      var versionPrinted

      stdMocks.use()
      exitMock.enable()

      cli.on('parsed', function () {
        process.nextTick(function () {
          stdMocks.restore()
          exitMock.restore()

          versionPrinted = stdMocks.flush().stdout[0]

          should(versionPrinted.indexOf(pkg.version) !== -1).be.eql(true)
          done()
        })
      })

      cli.start(['--version'])
    })

    it('should emit start events', function (done) {
      var cli = commander()
      var startingCalled = false
      var startedCalled = false

      cli.on('starting', function () {
        startingCalled = true
      })

      cli.on('started', function () {
        startedCalled = true
      })

      cli.on('parsed', function () {
        process.nextTick(function () {
          stdMocks.restore()
          stdMocks.flush()

          should(startingCalled).be.eql(true)
          should(startedCalled).be.eql(true)
          done()
        })
      })

      stdMocks.use()

      cli.start([])
    })

    it('should emit parse events', function (done) {
      var cli = commander()
      var cliArgs = ['--some', '--value']
      var argsInEvent
      var contextInEvent

      cli.on('parsing', function (args, context) {
        argsInEvent = args
        contextInEvent = context
      })

      cli.on('parsed', function () {
        process.nextTick(function () {
          stdMocks.restore()
          stdMocks.flush()
          exitMock.restore()
          should(argsInEvent).be.eql(cliArgs)
          should(contextInEvent).be.not.undefined()
          done()
        })
      })

      stdMocks.use()
      exitMock.enable()

      cli.start(cliArgs)
    })

    it('should exit on invalid command', function (done) {
      var cli = commander()
      var cliArgs = ['unknown']

      cli.on('parsed', function (err) {
        process.nextTick(function () {
          var exitCode

          stdMocks.restore()
          stdMocks.flush()
          exitMock.restore()

          exitCode = exitMock.callInfo().exitCode

          should(err).be.Error()
          should(exitCode).be.eql(1)
          done()
        })
      })

      stdMocks.use()
      exitMock.enable()

      cli.start(cliArgs)
    })

    it('should exit on invalid option', function (done) {
      var cli = commander()
      var cliArgs = ['--unknown']

      cli.on('parsed', function (err) {
        process.nextTick(function () {
          var exitCode

          stdMocks.restore()
          stdMocks.flush()
          exitMock.restore()

          exitCode = exitMock.callInfo().exitCode

          should(err).be.Error()
          should(exitCode).be.eql(1)
          done()
        })
      })

      stdMocks.use()
      exitMock.enable()

      cli.start(cliArgs)
    })

    it('should handle a failing sync command', function (done) {
      var cli = commander()

      var testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: function () {
          throw new Error('error testing')
        }
      }

      cli.registerCommand(testCommand)

      cli.on('command.error', function (cmdName, err) {
        setTimeout(function () {
          var exitCode

          stdMocks.restore()
          stdMocks.flush()
          exitMock.restore()

          exitCode = exitMock.callInfo().exitCode

          should(cmdName).be.eql('test')
          should(err).be.Error()
          should(exitCode).be.eql(1)
          done()
        }, 200)
      })

      stdMocks.use()
      exitMock.enable()

      cli.start(['test'])
    })

    it('should handle a failing async command', function (done) {
      var cli = commander()

      var testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: function () {
          return new Promise(function (resolve, reject) {
            reject(new Error('error testing'))
          })
        }
      }

      cli.registerCommand(testCommand)

      cli.on('command.error', function (cmdName, err) {
        setTimeout(function () {
          var exitCode

          stdMocks.restore()
          stdMocks.flush()
          exitMock.restore()

          exitCode = exitMock.callInfo().exitCode

          should(cmdName).be.eql('test')
          should(err).be.Error()
          should(exitCode).be.eql(1)
          done()
        }, 200)
      })

      stdMocks.use()
      exitMock.enable()

      cli.start(['test'])
    })

    it('should handle a successfully sync command ', function (done) {
      var cli = commander()

      var testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: function () {
          console.log('test output')
          return true
        }
      }

      cli.registerCommand(testCommand)

      cli.on('command.success', function (cmdName, result) {
        setTimeout(function () {
          var output
          var exitCode

          stdMocks.restore()
          exitMock.restore()

          output = stdMocks.flush()
          exitCode = exitMock.callInfo().exitCode

          should(cmdName).be.eql('test')
          should(output.stdout[0].replace(/(?:\r\n|\r|\n)/, '')).be.eql('test output')
          should(result).be.eql(true)
          should(exitCode).be.eql(0)
          done()
        }, 200)
      })

      stdMocks.use()
      exitMock.enable()

      cli.start(['test'])
    })

    it('should handle a successfully async command', function (done) {
      var cli = commander()

      var testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: function () {
          return new Promise(function (resolve, reject) {
            console.log('test async output')
            resolve(true)
          })
        }
      }

      cli.registerCommand(testCommand)

      cli.on('command.success', function (cmdName, result) {
        setTimeout(function () {
          var output
          var exitCode

          stdMocks.restore()
          exitMock.restore()

          output = stdMocks.flush()
          exitCode = exitMock.callInfo().exitCode

          should(cmdName).be.eql('test')
          should(output.stdout[0].replace(/(?:\r\n|\r|\n)/, '')).be.eql('test async output')
          should(result).be.eql(true)
          should(exitCode).be.eql(0)
          done()
        }, 200)
      })

      stdMocks.use()
      exitMock.enable()

      cli.start(['test'])
    })

    it('should pass context to command', function (done) {
      var cli = commander()

      var testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: function (argv) {
          return argv.context
        }
      }

      cli.registerCommand(testCommand)

      cli.on('command.success', function (cmdName, result) {
        setTimeout(function () {
          stdMocks.restore()
          stdMocks.flush()
          exitMock.restore()

          should(cmdName).be.eql('test')
          should(result).be.not.undefined()

          should(result).have.properties([
            'cwd',
            'sockPath',
            'workerSockPath'
          ])

          done()
        }, 200)
      })

      stdMocks.use()
      exitMock.enable()

      cli.start(['test'])
    })
  })

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

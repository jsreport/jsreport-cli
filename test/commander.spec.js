const should = require('should')
const stdMocks = require('std-mocks')
const utils = require('./utils')
const commander = require('../lib/commander')
const pkg = require('../package.json')
const exitMock = utils.mockProcessExit

describe('commander', () => {
  describe('when initializing', () => {
    it('should initialize with default options', () => {
      const defaultCommands = ['help', 'init', 'configure', 'start', 'win-install', 'render', 'repair', 'win-uninstall', 'kill']
      const cli = commander()

      should(cli.cwd).be.eql(process.cwd())
      should(cli.context).be.not.undefined()
      should(cli._showHelpWhenNoCommand).be.eql(true)
      should(cli._commandNames).containDeep(defaultCommands)
      should(cli._commandNames.length).be.eql(defaultCommands.length)
      should(cli._cli).not.be.undefined()
    })

    it('should emit event', (done) => {
      const cli = commander()

      cli.on('initialized', done)
    })

    it('should have a method to get registered commands', () => {
      const cli = commander()

      should(cli.getCommands()).be.Array()
      should(cli.getCommands().length).be.above(0)
    })

    it('should have an option to register built-in commands', () => {
      const commands = [{
        command: 'push',
        description: 'push command',
        handler: () => {}
      }, {
        command: 'pull',
        description: 'pull command',
        handler: () => {}
      }]

      const cli = commander(undefined, { builtInCommands: commands })

      should(cli.getCommands()).be.eql(['push', 'pull'])
    })

    it('should have an option to disable commands', () => {
      const commands = [{
        command: 'push',
        description: 'push command',
        handler: () => {}
      }, {
        command: 'pull',
        description: 'pull command',
        handler: () => {}
      }]

      const cli = commander(undefined, { builtInCommands: commands, disabledCommands: ['push'] })

      should(cli.getCommands()).be.eql(['pull'])
    })
  })

  describe('when registering command', () => {
    it('should throw error on invalid command module', () => {
      const cli = commander()

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

    it('should register command', () => {
      const cli = commander()

      const testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: () => {}
      }

      cli.registerCommand(testCommand)

      // test reference equality
      should(cli._commands.test).be.exactly(testCommand)
    })

    it('should return instance', () => {
      const cli = commander()

      const testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: () => {}
      }

      const returnValue = cli.registerCommand(testCommand)

      should(cli).be.exactly(returnValue)
    })

    it('should emit event', function (done) {
      const cli = commander()

      const testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: () => {}
      }

      cli.on('command.register', (cmdName, cmdModule) => {
        should(cmdName).be.eql('test')
        should(cmdModule).be.exactly(testCommand)
        done()
      })

      cli.registerCommand(testCommand)
    })
  })

  describe('when executing command', () => {
    it('should fail on invalid command', () => {
      const cli = commander()

      return should(cli.executeCommand('unknowCmd')).be.rejected()
    })

    it('should pass arguments to command handler', async () => {
      const cli = commander()
      let cmdArgs

      const testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: (args) => {
          return args
        }
      }

      cli.registerCommand(testCommand)

      cli.on('command.init', (cmdName, args) => {
        if (cmdName === 'test') {
          cmdArgs = args
        }
      })

      const result = await cli.executeCommand('test', { args: true })

      should(result).be.exactly(cmdArgs)
    })

    it('should fail when command sync handler fails', () => {
      const cli = commander()

      const testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: () => {
          throw new Error('error in handler')
        }
      }

      cli.registerCommand(testCommand)

      return should(cli.executeCommand('test')).be.rejectedWith({ message: 'error in handler' })
    })

    it('should emit event when command sync handler fails', () => {
      const cli = commander()
      let onInitCalled = false
      let onErrorCalled = false
      let onFinishCalled = false
      let errorInEvent

      const testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: () => {
          throw new Error('error in handler')
        }
      }

      cli.registerCommand(testCommand)

      cli.on('command.init', (cmdName) => {
        if (cmdName === 'test') {
          onInitCalled = true
        }
      })

      cli.on('command.error', (cmdName, error) => {
        if (cmdName === 'test') {
          onErrorCalled = true
          errorInEvent = error
        }
      })

      cli.on('command.finish', (cmdName) => {
        if (cmdName === 'test') {
          onFinishCalled = true
        }
      })

      return cli.executeCommand('test')
        .then(() => {
          throw new Error('command should have failed')
        }, (err) => {
          should(err).be.Error()
          should(err).be.exactly(errorInEvent)
          should(err.message).be.eql('error in handler')
          should(onInitCalled).be.eql(true)
          should(onErrorCalled).be.eql(true)
          should(onFinishCalled).be.eql(true)
        })
    })

    it('should fail when command async handler fails', () => {
      const cli = commander()

      const testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: () => {
          return new Promise((resolve, reject) => {
            reject(new Error('error in handler'))
          })
        }
      }

      cli.registerCommand(testCommand)

      return should(cli.executeCommand('test')).be.rejectedWith({ message: 'error in handler' })
    })

    it('should emit event when command async handler fails', () => {
      const cli = commander()
      let onInitCalled = false
      let onErrorCalled = false
      let onFinishCalled = false
      let errorInEvent

      const testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: () => {
          return new Promise((resolve, reject) => {
            reject(new Error('error in handler'))
          })
        }
      }

      cli.registerCommand(testCommand)

      cli.on('command.init', (cmdName) => {
        if (cmdName === 'test') {
          onInitCalled = true
        }
      })

      cli.on('command.error', (cmdName, error) => {
        if (cmdName === 'test') {
          onErrorCalled = true
          errorInEvent = error
        }
      })

      cli.on('command.finish', (cmdName) => {
        if (cmdName === 'test') {
          onFinishCalled = true
        }
      })

      return (
        cli.executeCommand('test')
          .then(() => {
            throw new Error('command should have failed')
          }, (err) => {
            should(err).be.Error()
            should(err).be.exactly(errorInEvent)
            should(err.message).be.eql('error in handler')
            should(onInitCalled).be.eql(true)
            should(onErrorCalled).be.eql(true)
            should(onFinishCalled).be.eql(true)
          })
      )
    })

    it('should success when command sync handler ends successfully', () => {
      const cli = commander()

      const testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: () => {
          return true
        }
      }

      cli.registerCommand(testCommand)

      return should(cli.executeCommand('test')).be.fulfilledWith(true)
    })

    it('should emit event when command sync handler ends successfully', () => {
      const cli = commander()
      let onInitCalled = false
      let onSuccessCalled = false
      let onFinishCalled = false
      let successValueInEvent

      const testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: () => {
          return true
        }
      }

      cli.registerCommand(testCommand)

      cli.on('command.init', (cmdName) => {
        if (cmdName === 'test') {
          onInitCalled = true
        }
      })

      cli.on('command.success', (cmdName, value) => {
        if (cmdName === 'test') {
          onSuccessCalled = true
          successValueInEvent = value
        }
      })

      cli.on('command.finish', (cmdName) => {
        if (cmdName === 'test') {
          onFinishCalled = true
        }
      })

      return (
        cli.executeCommand('test')
          .then((result) => {
            should(result).be.exactly(successValueInEvent)
            should(onInitCalled).be.eql(true)
            should(onSuccessCalled).be.eql(true)
            should(onFinishCalled).be.eql(true)
          })
      )
    })

    it('should success when command async handler ends successfully', () => {
      const cli = commander()

      const testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: () => {
          return new Promise((resolve, reject) => {
            resolve(true)
          })
        }
      }

      cli.registerCommand(testCommand)

      return should(cli.executeCommand('test')).be.fulfilledWith(true)
    })

    it('should emit event when command async handler ends successfully', () => {
      const cli = commander()
      let onInitCalled = false
      let onSuccessCalled = false
      let onFinishCalled = false
      let successValueInEvent

      const testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: () => {
          return new Promise((resolve) => {
            resolve(true)
          })
        }
      }

      cli.registerCommand(testCommand)

      cli.on('command.init', (cmdName) => {
        if (cmdName === 'test') {
          onInitCalled = true
        }
      })

      cli.on('command.success', (cmdName, value) => {
        if (cmdName === 'test') {
          onSuccessCalled = true
          successValueInEvent = value
        }
      })

      cli.on('command.finish', (cmdName) => {
        if (cmdName === 'test') {
          onFinishCalled = true
        }
      })

      return (
        cli.executeCommand('test')
          .then((result) => {
            should(result).be.exactly(successValueInEvent)
            should(onInitCalled).be.eql(true)
            should(onSuccessCalled).be.eql(true)
            should(onFinishCalled).be.eql(true)
          })
      )
    })
  })

  describe('when starting', () => {
    it('should fail on invalid arguments', () => {
      const cli = commander()

      should(function startCommander () {
        cli.start()
      }).throw()

      should(function startCommander () {
        cli.start(null)
      }).throw()
    })

    it('should print help by default when command is not present', (done) => {
      const cli = commander()
      let helpPrinted = false

      stdMocks.use()

      cli.on('parsed', () => {
        process.nextTick(() => {
          stdMocks.restore()
          helpPrinted = stdMocks.flush().stderr.join('\n').indexOf('Commands:') !== -1
          should(helpPrinted).be.eql(true)
          done()
        })
      })

      cli.start([])
    })

    it('should not print help when using `showHelpWhenNoCommand` option and command is not present', (done) => {
      const cli = commander(process.cwd(), {
        showHelpWhenNoCommand: false
      })

      let output

      stdMocks.use()

      cli.on('parsed', () => {
        process.nextTick(() => {
          stdMocks.restore()
          output = stdMocks.flush()

          should(output.stdout.length).be.eql(0)
          should(output.stderr.length).be.eql(0)
          done()
        })
      })

      cli.start([])
    })

    it('should handle --help option by default', (done) => {
      const cli = commander()
      let helpPrinted = false

      stdMocks.use()
      exitMock.enable()

      cli.on('parsed', () => {
        process.nextTick(() => {
          stdMocks.restore()
          exitMock.restore()

          helpPrinted = stdMocks.flush().stdout.join('\n').indexOf('Commands:') !== -1

          should(helpPrinted).be.eql(true)
          done()
        })
      })

      cli.start(['--help'])
    })

    it('should handle --version option by default', (done) => {
      const cli = commander()
      let versionPrinted

      stdMocks.use()
      exitMock.enable()

      cli.on('parsed', () => {
        process.nextTick(() => {
          stdMocks.restore()
          exitMock.restore()

          versionPrinted = stdMocks.flush().stdout[0]

          should(versionPrinted.indexOf(pkg.version) !== -1).be.eql(true)
          done()
        })
      })

      cli.start(['--version'])
    })

    it('should emit start events', (done) => {
      const cli = commander()
      let startingCalled = false
      let startedCalled = false

      cli.on('starting', () => (startingCalled = true))
      cli.on('started', () => (startedCalled = true))

      cli.on('parsed', () => {
        process.nextTick(() => {
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

    it('should emit parse events', (done) => {
      const cli = commander()
      const cliArgs = ['--some', '--value']
      let argsInEvent
      let contextInEvent

      cli.on('parsing', (args, context) => {
        argsInEvent = args
        contextInEvent = context
      })

      cli.on('parsed', () => {
        process.nextTick(() => {
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

    it('should exit on invalid command', (done) => {
      const cli = commander()
      const cliArgs = ['unknown']

      cli.on('started', (err) => {
        process.nextTick(() => {
          stdMocks.restore()
          stdMocks.flush()
          exitMock.restore()

          const exitCode = exitMock.callInfo().exitCode

          should(err).be.Error()
          should(exitCode).be.eql(1)
          done()
        })
      })

      stdMocks.use()
      exitMock.enable()

      cli.start(cliArgs)
    })

    it('should exit on invalid option', (done) => {
      const cli = commander()
      const cliArgs = ['--unknown']

      cli.on('parsed', (err) => {
        process.nextTick(() => {
          stdMocks.restore()
          stdMocks.flush()
          exitMock.restore()

          const exitCode = exitMock.callInfo().exitCode

          should(err).be.Error()
          should(exitCode).be.eql(1)
          done()
        })
      })

      stdMocks.use()
      exitMock.enable()

      cli.start(cliArgs)
    })

    it('should handle a failing sync command', (done) => {
      const cli = commander()

      const testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: () => {
          throw new Error('error testing')
        }
      }

      cli.registerCommand(testCommand)

      cli.on('started', (err) => {
        if (err) {
          stdMocks.restore()
          stdMocks.flush()
          exitMock.restore()
          return done(err)
        }
      })

      cli.on('command.error', (cmdName, err) => {
        setTimeout(() => {
          stdMocks.restore()
          stdMocks.flush()
          exitMock.restore()

          const exitCode = exitMock.callInfo().exitCode

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

    it('should handle a failing async command', (done) => {
      const cli = commander()

      const testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: () => {
          return new Promise((resolve, reject) => reject(new Error('error testing')))
        }
      }

      cli.registerCommand(testCommand)

      cli.on('command.error', (cmdName, err) => {
        setTimeout(() => {
          stdMocks.restore()
          stdMocks.flush()
          exitMock.restore()

          const exitCode = exitMock.callInfo().exitCode

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

    it('should handle a successfully sync command ', (done) => {
      const cli = commander()

      const testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: () => {
          console.log('test output')
          return true
        }
      }

      cli.registerCommand(testCommand)

      cli.on('command.success', (cmdName, result) => {
        setTimeout(() => {
          stdMocks.restore()
          exitMock.restore()

          const output = stdMocks.flush()
          const exitCode = exitMock.callInfo().exitCode

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

    it('should handle a successfully async command', (done) => {
      const cli = commander()

      const testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: () => {
          return new Promise((resolve, reject) => {
            console.log('test async output')
            resolve(true)
          })
        }
      }

      cli.registerCommand(testCommand)

      cli.on('command.success', (cmdName, result) => {
        setTimeout(() => {
          stdMocks.restore()
          exitMock.restore()

          const output = stdMocks.flush()
          const exitCode = exitMock.callInfo().exitCode

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

    it('should pass context to command', (done) => {
      const cli = commander()

      const testCommand = {
        command: 'test',
        description: 'test command desc',
        handler: (argv) => {
          return argv.context
        }
      }

      cli.registerCommand(testCommand)

      cli.on('command.success', (cmdName, result) => {
        setTimeout(() => {
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
})

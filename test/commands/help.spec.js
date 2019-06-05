const path = require('path')
const fs = require('fs')
const should = require('should')
const jsreportVersionToTest = require('../jsreportVersionToTest')
const utils = require('../utils')
const stdMocks = require('std-mocks')
const exitMock = utils.mockProcessExit
const instanceHandler = require('../../lib/instanceHandler')
const commander = require('../../lib/commander')
const help = require('../../lib/commands/help').handler

describe('help command', () => {
  let pathToTempProject

  before(function (done) {
    // disabling timeout because npm install could take a
    // couple of seconds
    this.timeout(0)

    utils.cleanTempDir(['help-project'])

    utils.createTempDir(['help-project'], (dir, absoluteDir) => {
      pathToTempProject = absoluteDir

      fs.writeFileSync(
        path.join(absoluteDir, './package.json'),
        JSON.stringify({
          name: 'help-project',
          dependencies: {
            jsreport: jsreportVersionToTest
          },
          jsreport: {
            entryPoint: 'server.js'
          }
        }, null, 2)
      )

      fs.writeFileSync(
        path.join(absoluteDir, './server.js'),
        [
          'const jsreport = require("jsreport")()',
          'if (process.env.JSREPORT_CLI) {',
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

    utils.npmInstall(pathToTempProject, done)
  })

  beforeEach(() => {
    // deleting cache of package.json to allow run the tests on the same project
    delete require.cache[require.resolve(path.join(pathToTempProject, './package.json'))]
  })

  after(function () {
    // disabling timeout because removing files could take a
    // couple of seconds
    this.timeout(0)

    utils.cleanTempDir(['help-project'])
  })

  it('should print information of registered command', (done) => {
    const cli = commander()

    stdMocks.use()
    exitMock.enable()

    cli.on('parsed', (err) => {
      let commandInfo

      if (err) {
        return done(err)
      }

      process.nextTick(() => {
        stdMocks.restore()
        exitMock.restore()

        commandInfo = stdMocks.flush().stdout.join('\n')

        help({
          _: ['help', 'render'],
          context: {
            cwd: pathToTempProject,
            getCommandHelp: async () => ({ output: commandInfo })
          }
        }).then((helpOutput) => {
          should(commandInfo).be.eql(helpOutput.output)
          done()
        }).catch((e) => {
          stdMocks.restore()
          exitMock.restore()
          done(e)
        })
      })
    })

    cli.start(['render', '-h'])
  })

  it('should print information of jsreport configuration format', async () => {
    let currentInstance

    function getInstance () {
      return (
        instanceHandler
          .find(pathToTempProject)
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

    const result = await help({
      _: ['help', 'config'],
      context: {
        cwd: pathToTempProject,
        getInstance: getInstance,
        initInstance: initInstance
      }
    })

    result.raw.should.match(/"extensions": <object> {/)
    result.raw.should.match(/"allowLocalFilesAccess": <boolean>/)
    result.raw.should.match(/"tempDirectory": <string>/)

    await currentInstance.express.server.close()
  })
})

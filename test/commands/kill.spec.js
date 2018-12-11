const path = require('path')
const fs = require('fs')
const nanoid = require('nanoid')
const should = require('should')
const jsreportVersionToTest = require('../jsreportVersionToTest')
const utils = require('../utils')
const keepAliveProcess = require('../../lib/keepAliveProcess')
const kill = require('../../lib/commands/kill').handler

describe('kill command', () => {
  let pathToTempProject
  let port = 9398

  before(function (done) {
    // disabling timeout because npm install could take a
    // couple of seconds
    this.timeout(0)

    utils.cleanTempDir(['kill-project'])

    utils.createTempDir(['kill-project'], (dir, absoluteDir) => {
      pathToTempProject = absoluteDir

      fs.writeFileSync(
        path.join(absoluteDir, './package.json'),
        JSON.stringify({
          name: 'kill-project',
          dependencies: {
            jsreport: jsreportVersionToTest
          },
          jsreport: {
            entryPoint: 'server.js'
          }
        }, null, 2)
      )

      fs.writeFileSync(
        path.join(absoluteDir, 'jsreport.config.json'),
        JSON.stringify({
          httpPort: port
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

      utils.npmInstall(pathToTempProject, done)
    })
  })

  describe('when there is no daemon instance running', () => {
    let localPathToWorkerSocketDir

    beforeEach(() => {
      const localPathToSocketDir = path.join(pathToTempProject, `sock-dir-${nanoid(7)}`)
      localPathToWorkerSocketDir = path.join(pathToTempProject, `workerSock-dir-${nanoid(7)}`)

      utils.tryCreate(localPathToSocketDir)
      utils.tryCreate(localPathToWorkerSocketDir)
    })

    it('should fail searching daemon by current working directory', () => {
      return kill({
        context: {
          cwd: pathToTempProject,
          workerSockPath: localPathToWorkerSocketDir
        }
      }).should.be.rejected()
    })

    it('should fail searching daemon by identifier', () => {
      return kill({
        context: {
          cwd: pathToTempProject,
          workerSockPath: localPathToWorkerSocketDir
        },
        _: [null, 'zzzzzzzzzz']
      }).should.be.rejected()
    })
  })

  describe('when there is daemon instance running', () => {
    let localPathToWorkerSocketDir
    let childInfo
    let child

    beforeEach(async function () {
      this.timeout(0)

      console.log('spawning a daemon jsreport instance for the test suite..')

      const localPathToSocketDir = path.join(pathToTempProject, `sock-dir-${nanoid(7)}`)
      localPathToWorkerSocketDir = path.join(pathToTempProject, `workerSock-dir-${nanoid(7)}`)

      utils.tryCreate(localPathToSocketDir)
      utils.tryCreate(localPathToWorkerSocketDir)

      const info = await keepAliveProcess({
        mainSockPath: localPathToSocketDir,
        workerSockPath: localPathToWorkerSocketDir,
        cwd: pathToTempProject
      })
      console.log('daemonized jsreport instance is ready..')

      childInfo = info
      child = info.proc
    })

    it('should kill by current working directory', async () => {
      const result = await kill({
        context: {
          cwd: pathToTempProject,
          workerSockPath: localPathToWorkerSocketDir
        }
      })
      should(result).not.be.undefined()
      should(result.pid).be.eql(childInfo.pid)
    })

    it('should kill by process id', async () => {
      const result = await kill({
        context: {
          cwd: pathToTempProject,
          workerSockPath: localPathToWorkerSocketDir
        },
        _: [null, childInfo.pid]
      })

      should(result).not.be.undefined()
      should(result.pid).be.eql(childInfo.pid)
    })

    it('should kill by uid', async () => {
      const result = await kill({
        context: {
          cwd: pathToTempProject,
          workerSockPath: localPathToWorkerSocketDir
        },
        _: [null, childInfo.uid]
      })
      should(result).not.be.undefined()
      should(result.uid).be.eql(childInfo.uid)
    })

    afterEach(() => {
      if (child) {
        child.kill()
      }
    })
  })

  after(function () {
    // disabling timeout because removing files could take a
    // couple of seconds
    this.timeout(0)

    utils.cleanTempDir(['kill-project'])
  })
})

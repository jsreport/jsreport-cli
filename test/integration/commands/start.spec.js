const path = require('path')
const fs = require('fs')
const should = require('should')
const utils = require('../../utils')
const instanceHandler = require('../../../lib/instanceHandler')
const start = require('../../../lib/commands/start').handler

describe('start command', () => {
  let pathToTempProject
  let currentInstance
  const port = 9879

  async function getInstance (cwd) {
    const instanceInfo = await instanceHandler.find(cwd)
    return instanceInfo.instance
  }

  function initInstance (instance) {
    currentInstance = instance

    return instanceHandler.initialize(instance, false)
  }

  before(function (done) {
    // disabling timeout because npm install could take a
    // couple of seconds
    this.timeout(0)

    utils.cleanTempDir(['start-project'])

    utils.createTempDir(['start-project'], (dir, absoluteDir) => {
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
          'const jsreport = require("jsreport")()',
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

      utils.npmInstall(pathToTempProject, done)
    })
  })

  it('should handle errors', async () => {
    return start({
      context: {
        cwd: '/invalid/path',
        getInstance: getInstance,
        initInstance: initInstance
      }
    }).should.be.rejected()
  })

  it('should start a jsreport instance', async () => {
    const instance = await
      start({
        context: {
          cwd: pathToTempProject,
          getInstance: getInstance,
          initInstance: initInstance
        }
      })

    should(instanceHandler.isJsreportInstance(instance)).be.eql(true)
    should(instance._initialized).be.eql(true)
  })

  afterEach(() => {
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

'use strict'

var path = require('path')
var fs = require('fs')
var childProcess = require('child_process')
var should = require('should')
var shortid = require('shortid')
var utils = require('../utils')
var instanceHandler = require('../../lib/instanceHandler')
var render = require('../../lib/commands/render').handler

function tryCreate (dir) {
  try {
    fs.mkdirSync(dir, '0755')
  } catch (ex) { }
}

describe('render command', function () {
  var pathToTempProject
  var pathToSocketDir
  var pathToWorkerSocketDir
  var currentInstance

  var originalDevConfig = {
    authentication: {
      cookieSession: {
        secret: '<your strong secret>'
      },
      admin: {
        username: 'admin',
        password: 'password'
      },
      enabled: false
    }
  }

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

  before(function (done) {
    // disabling timeout because npm install could take a
    // couple of seconds
    this.timeout(0)

    // utils.cleanTempDir(['render-project'])

    utils.createTempDir(['render-project'], function (dir, absoluteDir) {
      pathToTempProject = absoluteDir

      fs.writeFileSync(
        path.join(absoluteDir, './package.json'),
        JSON.stringify({
          name: 'render-project',
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
        JSON.stringify(originalDevConfig, null, 2)
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

      pathToSocketDir = path.join(absoluteDir, 'sock-dir')
      pathToWorkerSocketDir = path.join(absoluteDir, 'workerSock-dir')

      tryCreate(pathToSocketDir)
      tryCreate(pathToWorkerSocketDir)
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
    delete require.cache[require.resolve(path.join(pathToTempProject, './dev.config.json'))]
  })

  describe('when using local instance', function () {
    common('local')

    describe('and when authentication is enabled', function () {
      beforeEach(function () {
        // enabling authentication
        fs.writeFileSync(
          path.join(pathToTempProject, 'dev.config.json'),
          JSON.stringify({
            authentication: {
              cookieSession: {
                secret: '<your strong secret>'
              },
              admin: {
                username: 'admin',
                password: 'password'
              },
              enabled: true
            }
          }, null, 2)
        )
      })

      common('local')
    })
  })

  describe('when using remote instance', function () {
    var child
    var childWithAuth

    before(function (done) {
      this.timeout(0)

      console.log('spawning a remote jsreport instance for the test suite..')

      child = childProcess.spawn(process.execPath, ['server.js'], {
        cwd: pathToTempProject,
        stdio: 'pipe',
        env: {
          PORT: 7869
        }
      })

      child.on('error', function (err) {
        done(err)
      })

      child.stdout.setEncoding('utf8')

      child.stdout.on('data', function (msg) {
        if (msg.indexOf('reporter initialized') !== -1) {
          console.log('remote jsreport instance is ready..')
          done()
        }
      })
    })

    common('remote', {
      hostname: 'localhost',
      port: 7869
    })

    describe('and when authentication is enabled', function () {
      before(function (done) {
        this.timeout(0)

        // enabling authentication
        fs.writeFileSync(
          path.join(pathToTempProject, 'dev.config.json'),
          JSON.stringify({
            authentication: {
              cookieSession: {
                secret: '<your strong secret>'
              },
              admin: {
                username: 'admin',
                password: 'password'
              },
              enabled: true
            }
          }, null, 2)
        )

        console.log('spawning a remote jsreport instance with authentication for the test suite..')

        childWithAuth = childProcess.spawn(process.execPath, ['server.js'], {
          cwd: pathToTempProject,
          stdio: 'pipe',
          env: {
            PORT: 7870
          }
        })

        childWithAuth.on('error', function (err) {
          done(err)
        })

        childWithAuth.stdout.setEncoding('utf8')

        childWithAuth.stdout.on('data', function (msg) {
          if (msg.indexOf('reporter initialized') !== -1) {
            console.log('remote jsreport instance with authentication is ready..')
            done()
          }
        })
      })

      common('remote', {
        hostname: 'localhost',
        port: 7870,
        auth: {
          username: 'admin',
          password: 'password'
        }
      })
    })

    after(function () {
      if (child) {
        child.kill()
      }

      if (childWithAuth) {
        childWithAuth.kill()
      }
    })
  })

  describe('when using local instance with keepAlive option', function () {
    var daemonProcess

    before(function () {
      // starting in specific port
      fs.writeFileSync(
        path.join(pathToTempProject, 'dev.config.json'),
        JSON.stringify({
          httpPort: 7468
        }, null, 2)
      )
    })

    it('should render normally and next calls to render should use the same daemon process', function () {
      this.timeout(0)

      var randomFile = path.join(pathToTempProject, shortid.generate() + '.pdf')

      return (
        render({
          keepAlive: true,
          template: {
            content: '<h1>Rendering in daemon process (first time)</h1>',
            engine: 'handlebars',
            recipe: 'phantom-pdf'
          },
          out: randomFile,
          context: {
            cwd: pathToTempProject,
            sockPath: pathToSocketDir,
            workerSockPath: pathToWorkerSocketDir,
            getInstance: getInstance,
            initInstance: initInstance
          }
        })
        .then(function (info) {
          daemonProcess = info.daemonProcess.proc

          should(info.fromDaemon).be.eql(true)
          should(fs.existsSync(info.output)).be.eql(true)

          randomFile = path.join(pathToTempProject, shortid.generate() + '.pdf')

          return render({
            template: {
              content: '<h1>Rendering in daemon process (second time)</h1>',
              engine: 'handlebars',
              recipe: 'phantom-pdf'
            },
            out: randomFile,
            context: {
              cwd: pathToTempProject,
              sockPath: pathToSocketDir,
              workerSockPath: pathToWorkerSocketDir,
              getInstance: getInstance,
              initInstance: initInstance
            }
          }).then(function (info) {
            should(info.fromDaemon).be.eql(true)
            should(fs.existsSync(info.output)).be.eql(true)
          })
        })
      )
    })

    after(function () {
      if (daemonProcess) {
        process.kill(daemonProcess.pid)
      }
    })
  })

  afterEach(function () {
    if (currentInstance && currentInstance.express && currentInstance.express.server) {
      currentInstance.express.server.close()
    }

    // reset dev.config.json to original value
    fs.writeFileSync(
      path.join(pathToTempProject, 'dev.config.json'),
      JSON.stringify(originalDevConfig, null, 2)
    )
  })

  after(function () {
    // disabling timeout because removing files could take a
    // couple of seconds
    this.timeout(0)

    // utils.cleanTempDir(['render-project'])
  })

  function common (instanceType, remote) {
    var remoteInfo = remote || {}
    var serverUrl
    var user
    var password

    if (instanceType === 'remote') {
      serverUrl = 'http://' + remoteInfo.hostname + ':' + remoteInfo.port
    }

    if (remoteInfo.auth) {
      user = remoteInfo.auth.username
      password = remoteInfo.auth.password
    }

    it('should handle a failed render', function () {
      var randomFile = path.join(pathToTempProject, shortid.generate() + '.pdf')

      return (
        render({
          template: {
            shortid: 'unknown'
          },
          out: randomFile,
          context: {
            cwd: pathToTempProject,
            sockPath: pathToSocketDir,
            workerSockPath: pathToWorkerSocketDir,
            getInstance: getInstance,
            initInstance: initInstance
          },
          serverUrl: serverUrl,
          user: user,
          password: password
        })
        .then(function () {
          throw new Error('render should have failed')
        }, function (err) {
          should(err).be.Error()
        })
      )
    })

    it('should render normally with request option', function () {
      var randomFile = path.join(pathToTempProject, shortid.generate() + '.pdf')

      return (
        render({
          request: {
            template: {
              content: '<h1>Test ' + instanceType + ' instance, request option</h1>',
              engine: 'none',
              recipe: 'phantom-pdf'
            }
          },
          out: randomFile,
          context: {
            cwd: pathToTempProject,
            sockPath: pathToSocketDir,
            workerSockPath: pathToWorkerSocketDir,
            getInstance: getInstance,
            initInstance: initInstance
          },
          serverUrl: serverUrl,
          user: user,
          password: password
        })
        .then(function (info) {
          should(fs.existsSync(info.output)).be.eql(true)
        })
      )
    })

    it('should render normally with template option', function () {
      var randomFile = path.join(pathToTempProject, shortid.generate() + '.pdf')

      return (
        render({
          template: {
            content: '<h1>Test ' + instanceType + ' instance, template option</h1>',
            engine: 'none',
            recipe: 'phantom-pdf'
          },
          out: randomFile,
          context: {
            cwd: pathToTempProject,
            sockPath: pathToSocketDir,
            workerSockPath: pathToWorkerSocketDir,
            getInstance: getInstance,
            initInstance: initInstance
          },
          serverUrl: serverUrl,
          user: user,
          password: password
        })
        .then(function (info) {
          should(fs.existsSync(info.output)).be.eql(true)
        })
      )
    })

    it('should render normally with template and data option', function () {
      var randomFile = path.join(pathToTempProject, shortid.generate() + '.pdf')

      return (
        render({
          template: {
            content: '<h1>Hello i\'m {{name}} and i\'m rendering from {{instanceType}} instance, template and data option</h1>',
            engine: 'handlebars',
            recipe: 'phantom-pdf'
          },
          data: {
            name: 'jsreport',
            instanceType: instanceType
          },
          out: randomFile,
          context: {
            cwd: pathToTempProject,
            sockPath: pathToSocketDir,
            workerSockPath: pathToWorkerSocketDir,
            getInstance: getInstance,
            initInstance: initInstance
          },
          serverUrl: serverUrl,
          user: user,
          password: password
        })
        .then(function (info) {
          should(fs.existsSync(info.output)).be.eql(true)
        })
      )
    })
  }
})

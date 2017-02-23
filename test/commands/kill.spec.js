'use strict'

var path = require('path')
var fs = require('fs')
var childProcess = require('child_process')
var should = require('should')
var utils = require('../utils')
var keepAliveProcess = require('../../lib/keepAliveProcess')
var kill = require('../../lib/commands/kill').handler

function tryCreate (dir) {
  try {
    fs.mkdirSync(dir, '0755')
  } catch (ex) { }
}

describe('kill command', function () {
  var pathToTempProject
  var pathToSocketDir
  var pathToWorkerSocketDir
  var port = 9398

  before(function (done) {
    // disabling timeout because npm install could take a
    // couple of seconds
    this.timeout(0)

    utils.cleanTempDir(['kill-project'])

    utils.createTempDir(['kill-project'], function (dir, absoluteDir) {
      pathToTempProject = absoluteDir

      fs.writeFileSync(
        path.join(absoluteDir, './package.json'),
        JSON.stringify({
          name: 'kill-project',
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

      pathToSocketDir = path.join(absoluteDir, 'sock-dir')
      pathToWorkerSocketDir = path.join(absoluteDir, 'workerSock-dir')

      tryCreate(pathToSocketDir)
      tryCreate(pathToWorkerSocketDir)

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

  describe('when there is no daemon instance running', function () {
    it('should fail searching daemon by current working directory', function () {
      return (
        kill({
          context: {
            cwd: pathToTempProject,
            workerSockPath: pathToWorkerSocketDir
          }
        })
        .then(function () {
          throw new Error('kill should have failed')
        }, function (err) {
          should(err).be.Error()
        })
      )
    })

    it('should fail searching daemon by identifier', function () {
      return (
        kill({
          context: {
            cwd: pathToTempProject,
            workerSockPath: pathToWorkerSocketDir
          },
          _: [null, 'xXsfrt']
        })
        .then(function () {
          throw new Error('kill should have failed')
        }, function (err) {
          should(err).be.Error()
        })
      )
    })
  })

  describe('when there is daemon instance running', function () {
    var childInfo
    var child

    beforeEach(function () {
      this.timeout(0)

      console.log('spawning a daemon jsreport instance for the test suite..')

      return keepAliveProcess({
        mainSockPath: pathToSocketDir,
        workerSockPath: pathToWorkerSocketDir,
        cwd: pathToTempProject
      }).then(function (info) {
        console.log('daemonized jsreport instance is ready..')

        childInfo = info
        child = info.proc
      })
    })

    it('should kill by current working directory', function () {
      return (
        kill({
          context: {
            cwd: pathToTempProject,
            workerSockPath: pathToWorkerSocketDir
          }
        })
        .then(function (result) {
          should(result).not.be.undefined()
          should(result.pid).be.eql(child.pid)
        })
      )
    })

    it('should kill by process id', function () {
      return (
        kill({
          context: {
            cwd: pathToTempProject,
            workerSockPath: pathToWorkerSocketDir
          },
          _: [null, child.pid]
        })
        .then(function (result) {
          should(result).not.be.undefined()
          should(result.pid).be.eql(child.pid)
        })
      )
    })

    it('should kill by uid', function () {
      return (
        kill({
          context: {
            cwd: pathToTempProject,
            workerSockPath: pathToWorkerSocketDir
          },
          _: [null, childInfo.uid]
        })
        .then(function (result) {
          should(result).not.be.undefined()
          should(result.uid).be.eql(childInfo.uid)
        })
      )
    })

    afterEach(function () {
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

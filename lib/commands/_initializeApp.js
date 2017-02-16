'use strict'

var path = require('path')
var fs = require('fs')
var Promise = require('bluebird')
var install = require('npm-install-package')

function initializeApp (cwd, force) {
  return new Promise(function (resolve, reject) {
    var existsPackageJson = fs.existsSync(path.join(cwd, './package.json'))
    var jsreportModule
    var jsreportVersion
    var isMainJsreport = false

    checkOrInstallJsreport(cwd, existsPackageJson, function (err, detectedJsreport) {
      var errorToReject

      if (err) {
        errorToReject = new Error('Unexpected error happened')
        errorToReject.originalError = err
        return reject(errorToReject)
      }

      isMainJsreport = (detectedJsreport === 'jsreport')

      try {
        jsreportModule = require(path.join(cwd, 'node_modules/' + detectedJsreport + '/package.json'))
        jsreportVersion = jsreportModule.version
      } catch (err) {
        errorToReject = new Error('Unexpected error happened')
        errorToReject.originalError = err
        return reject(errorToReject)
      }

      if (!fs.existsSync(path.join(cwd, './server.js')) || force) {
        console.log('Creating server.js')
        fs.writeFileSync(
          path.join(cwd, './server.js'),
          fs.readFileSync(
            path.join(__dirname, '../../example.server.js')
          ).toString().replace('$moduleName$', detectedJsreport)
        )
      }

      if (!existsPackageJson || force) {
        console.log('Creating package.json')

        var serverPackageJson = {
          'name': 'jsreport-server',
          'main': 'server.js',
          'scripts': {
            'start': 'node server'
          },
          'jsreport': {
            'entryPoint': 'server.js'
          },
          'dependencies': {
          }
        }

        serverPackageJson.dependencies[detectedJsreport] = jsreportVersion

        if (isMainJsreport) {
          serverPackageJson.scripts.jsreport = 'jsreport'
        }

        fs.writeFileSync(path.join(cwd, './package.json'), JSON.stringify(serverPackageJson, null, 2))
      }

      if ((!fs.existsSync(path.join(cwd, './prod.config.json')) || force) && isMainJsreport) {
        console.log('Creating prod.config.json (applied on npm start --production)')
        fs.writeFileSync(path.join(cwd, './prod.config.json'), fs.readFileSync(path.join(__dirname, '../../example.config.json')))
        console.log('Creating dev.config.json (applied on npm start)')
        fs.writeFileSync(path.join(cwd, './dev.config.json'), fs.readFileSync(path.join(__dirname, '../../example.config.json')))
      }

      console.log('Initialized')
      resolve()
    })
  })
}

function checkOrInstallJsreport (cwd, existsPackageJson, cb) {
  var detectedJsreport
  var userPkg
  var userDependencies

  if (existsPackageJson) {
    userPkg = require(path.join(cwd, './package.json'))
    userDependencies = userPkg.dependencies || {}

    if (userDependencies['jsreport']) {
      detectedJsreport = 'jsreport'
    } else if (userDependencies['jsreport-core']) {
      detectedJsreport = 'jsreport-core'
    }
  }

  if (!detectedJsreport) {
    if (fs.existsSync(path.join(cwd, 'node_modules/jsreport'))) {
      detectedJsreport = 'jsreport'
    } else if (fs.existsSync(path.join(cwd, 'node_modules/jsreport-core'))) {
      detectedJsreport = 'jsreport-core'
    }
  }

  if (!detectedJsreport) {
    console.log('jsreport installation not found, intalling it now, wait a moment...')

    detectedJsreport = 'jsreport'

    install(detectedJsreport, function (installErr) {
      if (installErr) {
        return cb(installErr)
      }

      console.log('jsreport installation finished..')
      cb(null, detectedJsreport)
    })
  } else {
    cb(null, detectedJsreport)
  }
}

module.exports = initializeApp

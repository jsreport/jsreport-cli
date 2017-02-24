'use strict'

var path = require('path')
var fs = require('fs')
var Promise = require('bluebird')
var install = require('npm-install-package')

function initializeApp (cwd, force, selectedVersion) {
  return new Promise(function (resolve, reject) {
    var existsPackageJson = fs.existsSync(path.join(cwd, './package.json'))
    var isMainJsreport = false

    checkOrInstallJsreport(cwd, existsPackageJson, selectedVersion, function (err, jsreportPkgInfo) {
      var errorToReject

      if (err) {
        console.error(err)
        console.error(err.originalError)
        errorToReject = new Error('Unexpected error happened')
        errorToReject.originalError = err
        return reject(errorToReject)
      }

      isMainJsreport = (jsreportPkgInfo.name === 'jsreport')

      if (!fs.existsSync(path.join(cwd, './server.js')) || force) {
        console.log('Creating server.js')
        fs.writeFileSync(
          path.join(cwd, './server.js'),
          fs.readFileSync(
            path.join(__dirname, '../../example.server.js')
          ).toString().replace('$moduleName$', jsreportPkgInfo.name)
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

        serverPackageJson.dependencies[jsreportPkgInfo.name] = jsreportPkgInfo.version

        if (isMainJsreport) {
          serverPackageJson.scripts.jsreport = 'jsreport'
        }

        fs.writeFileSync(path.join(cwd, './package.json'), JSON.stringify(serverPackageJson, null, 2))
      }

      if ((!fs.existsSync(path.join(cwd, './prod.config.json')) || force) && isMainJsreport) {
        console.log('Creating prod.config.json (applied on npm start --production)')
        fs.writeFileSync(path.join(cwd, './prod.config.json'), fs.readFileSync(path.join(__dirname, '../../example.config.json')))
      }

      if ((!fs.existsSync(path.join(cwd, './dev.config.json')) || force) && isMainJsreport) {
        console.log('Creating dev.config.json (applied on npm start)')
        fs.writeFileSync(path.join(cwd, './dev.config.json'), fs.readFileSync(path.join(__dirname, '../../example.config.json')))
      }

      console.log('Initialized')

      resolve({
        name: jsreportPkgInfo.name,
        version: jsreportPkgInfo.version
      })
    })
  })
}

function checkOrInstallJsreport (cwd, existsPackageJson, version, cb) {
  var detectedJsreport
  var detectedVersion
  var versionToInstall
  var userPkg
  var userDependencies
  var originalCWD = process.cwd()

  if (existsPackageJson) {
    userPkg = require(path.join(cwd, './package.json'))
    userDependencies = userPkg.dependencies || {}

    if (userDependencies['jsreport']) {
      detectedJsreport = 'jsreport'
      detectedVersion = userDependencies['jsreport']
    } else if (userDependencies['jsreport-core']) {
      detectedJsreport = 'jsreport-core'
      detectedVersion = userDependencies['jsreport-core']
    }
  }

  if (!detectedJsreport) {
    if (fs.existsSync(path.join(cwd, 'node_modules/jsreport'))) {
      detectedJsreport = 'jsreport'
    } else if (fs.existsSync(path.join(cwd, 'node_modules/jsreport-core'))) {
      detectedJsreport = 'jsreport-core'
    }

    if (detectedJsreport) {
      try {
        detectedVersion = requireJsreportPkg(cwd, detectedJsreport).version
      } catch (e) {
        return cb(e)
      }
    }
  }

  if (!detectedJsreport) {
    detectedJsreport = 'jsreport'

    if (version) {
      versionToInstall = 'jsreport@' + version
      console.log('jsreport installation not found, installing ' + detectedJsreport + '@' + version + ' version now, wait a moment...')
    } else {
      versionToInstall = 'jsreport'
      console.log('jsreport installation not found, installing ' + detectedJsreport + ' latest version now, wait a moment...')
    }

    process.chdir(cwd)

    // creating basic package.json in order to make npm install
    // work normally in current directory, later the real package.json
    // will be created
    if (!existsPackageJson) {
      fs.writeFileSync(
        path.join(cwd, './package.json'),
        JSON.stringify({
          name: 'jsreport-server'
        }, null, 2))
    }

    install(versionToInstall, { save: true }, function (installErr) {
      process.chdir(originalCWD)

      if (installErr) {
        return cb(installErr)
      }

      console.log('jsreport installation finished..')

      try {
        detectedVersion = requireJsreportPkg(cwd, detectedJsreport).version
      } catch (e) {
        return cb(e)
      }

      cb(null, {
        name: detectedJsreport,
        version: detectedVersion
      })
    })
  } else {
    cb(null, {
      name: detectedJsreport,
      version: detectedVersion
    })
  }
}

function requireJsreportPkg (cwd, jsreportPkgName) {
  var errorToReject
  var jsreportModule
  var jsreportVersion

  try {
    jsreportModule = require(path.join(cwd, 'node_modules/' + jsreportPkgName + '/package.json'))
    jsreportVersion = jsreportModule.version

    return {
      name: jsreportPkgName,
      version: jsreportVersion
    }
  } catch (err) {
    errorToReject = new Error('Unexpected error happened')
    errorToReject.originalError = err
    throw errorToReject
  }
}

module.exports = initializeApp

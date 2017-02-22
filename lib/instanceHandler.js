var path = require('path')
var fs = require('fs')
var isPromise = require('is-promise')
var once = require('once')
var Promise = require('bluebird')

exports.initialize = function (instance, verbose) {
  if (!instance._initialized) {
    // explicitly silent jsreport logging if verboseMode is not activated
    if (!verbose) {
      if (instance.options.logger) {
        instance.options.logger.silent = true
      } else {
        instance.options.logger = {
          silent: true
        }
      }
    }

    // initializing jsreport instance
    return instance.init().then(function () {
      return instance
    }).catch(function (err) {
      var msg = 'An error has occurred when trying to initialize jsreport..'
      var errorToReject

      if (err.code === 'EADDRINUSE') {
        msg += ' seems like there is already a server running in port: ' + err.port
      }

      errorToReject = new Error(msg)
      errorToReject.originalError = err

      throw errorToReject
    })
  }

  return Promise.resolve(instance)
}

exports.find = function find (cwd) {
  return new Promise(function (resolve, reject) {
    // finding entry point before activating CLI
    var isAlreadyResolved = false
    var existsPackageJson
    var jsreportModuleInfo
    var userPkg
    var jsreportEntryPoint
    var pathToJsreportEntryPoint
    var jsreportEntryPointExport
    var entryPointExportResult
    var resolveInstanceOnce

    existsPackageJson = fs.existsSync(path.join(cwd, './package.json'))
    jsreportModuleInfo = getJsreportModuleInstalled(cwd, existsPackageJson)

    if (!jsreportModuleInfo) {
      return reject(new Error('Couldn\'t find a jsreport intallation necessary to process the command, try to install jsreport first'))
    }

    if (!existsPackageJson) {
      // creating a default instance
      return resolve({
        from: jsreportModuleInfo.name,
        isDefault: true,
        instance: createDefaultInstance(
          jsreportModuleInfo.module
        )
      })
    }

    userPkg = require(path.join(cwd, './package.json'))
    jsreportEntryPoint = (userPkg.jsreport || {}).entryPoint

    if (!jsreportEntryPoint) {
      return resolve({
        from: jsreportModuleInfo.name,
        isDefault: true,
        instance: createDefaultInstance(
          jsreportModuleInfo.module
        )
      })
    }

    pathToJsreportEntryPoint = path.resolve(cwd, jsreportEntryPoint)

    try {
      jsreportEntryPointExport = require(pathToJsreportEntryPoint)

      if (typeof jsreportEntryPointExport === 'function') {
        // prevents resolving an instance more than once
        resolveInstanceOnce = once(resolveInstance)
        entryPointExportResult = jsreportEntryPointExport(resolveInstanceOnce)

        if (isAlreadyResolved) {
          return
        }

        // check if function returns a promise,
        // otherwise just wait until user calls `resolveInstanceOnce`
        if (isPromise(entryPointExportResult)) {
          if (resolveInstanceOnce.called) {
            isAlreadyResolved = true
            return reject(createDuplicateResolutionError(pathToJsreportEntryPoint))
          }

          handlePromiseExport(entryPointExportResult, {
            entryPoint: pathToJsreportEntryPoint,
            resolveCheck: resolveInstanceOnce,
            jsreportModule: jsreportModuleInfo.module
          }, function (err, instance) {
            if (isAlreadyResolved) {
              return
            }

            isAlreadyResolved = true

            if (err) {
              return reject(err)
            }

            return resolve({
              from: jsreportModuleInfo.name,
              isDefault: false,
              instance: instance,
              entryPoint: pathToJsreportEntryPoint
            })
          })
        }
      } else if (isJsreportInstance(jsreportEntryPointExport, jsreportModuleInfo.module)) {
        return resolve({
          from: jsreportModuleInfo.name,
          isDefault: false,
          instance: jsreportEntryPointExport,
          entryPoint: pathToJsreportEntryPoint
        })
      } else {
        return reject(new Error(
          'Entry point must return a valid jsreport instance or a function resolving to a jsreport instance, check file in ' +
          pathToJsreportEntryPoint
        ))
      }
    } catch (e) {
      var errorToReject

      if (e.code === 'MODULE_NOT_FOUND') {
        errorToReject = new Error('Couldn\'t find a jsreport entry point in: ' + pathToJsreportEntryPoint)
      } else {
        errorToReject = new Error('An error has occurred when trying to find a jsreport instance..')
        errorToReject.originalError = e
      }

      return reject(errorToReject)
    }

    function resolveInstance (err, instance) {
      var errorToReject

      if (isAlreadyResolved) {
        return
      }

      isAlreadyResolved = true

      if (err) {
        errorToReject = new Error('An error has occurred when trying to find a jsreport instance..')
        errorToReject.originalError = err
        return reject(errorToReject)
      }

      if (!isJsreportInstance(instance, jsreportModuleInfo.module)) {
        return reject(new Error(
          'Callback in entry point must return a valid jsreport instance, check file in ' +
          pathToJsreportEntryPoint
        ))
      }

      resolve({
        from: jsreportModuleInfo.name,
        isDefault: false,
        instance: instance,
        entryPoint: pathToJsreportEntryPoint
      })
    }
  })
}

exports.isJsreportInstance = isJsreportInstance

function createDuplicateResolutionError (pathToJsreportEntryPoint) {
  return new Error(
    'jsreport instance is already resolved, are you using promise and callback at the same time? ' +
    'you should only use one way to resolve the instance from entry point, check file in ' +
    pathToJsreportEntryPoint
  )
}

function isJsreportInstance (instance, jsreportModule) {
  if (!instance) {
    return false
  }

  // only check if jsreportModule is not null or undefined
  if (jsreportModule != null) {
    return instance instanceof jsreportModule.Reporter
  }

  // if no jsreportModule is passed try to check if "instance" looks
  // like a jsreport instance
  return (
    typeof instance.init === 'function' &&
    typeof instance.render === 'function' &&
    typeof instance.afterConfigLoaded === 'function' &&
    instance.extensionsManager != null &&
    instance.beforeRenderListeners != null &&
    instance.afterRenderListeners != null
  )
}

function createDefaultInstance (jsreportModule) {
  return jsreportModule()
}

function handlePromiseExport (promiseToInstance, options, cb) {
  var entryPoint = options.entryPoint
  var jsreportModule = options.jsreportModule
  var resolveCheck = options.resolveCheck

  promiseToInstance.then(function (jsreportInstance) {
    if (resolveCheck.called) {
      return cb(createDuplicateResolutionError(entryPoint))
    }

    if (!isJsreportInstance(jsreportInstance, jsreportModule)) {
      return cb(
        new Error(
          'Promise in entry point must resolve to a jsreport instance, check file in ' +
          entryPoint
        )
      )
    }

    cb(null, jsreportInstance)
  }).catch(function (getJsreportInstanceError) {
    if (resolveCheck.called) {
      return cb(createDuplicateResolutionError(entryPoint))
    }

    cb(getJsreportInstanceError)
  })
}

function getJsreportModuleInstalled (cwd, existsPackageJson) {
  var detectedJsreport
  var detectedModule
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
    return null
  }

  try {
    // always require top-level package from cwd
    detectedModule = require(require.resolve(path.join(cwd, 'node_modules', detectedJsreport)))

    detectedModule = {
      name: detectedJsreport,
      module: detectedModule
    }
  } catch (err) {
    detectedModule = null
  }

  return detectedModule
}

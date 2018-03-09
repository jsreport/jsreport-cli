'use strict'

const path = require('path')
const fs = require('fs')
const platform = require('os').platform()
const Winser = require('winser-with-api').Winser

const description = 'WINDOWS ONLY - Stop and uninstall service'
const command = 'win-uninstall'

exports.command = command
exports.description = description

exports.handler = (argv) => {
  return new Promise((resolve, reject) => {
    const verbose = argv.verbose
    const context = argv.context
    const cwd = context.cwd
    const staticPaths = context.staticPaths || {}
    const appInfo = context.appInfo
    const existsPackageJson = fs.existsSync(path.join(cwd, './package.json'))
    let pathToApp
    let serviceName

    console.log('Platform is ' + platform)

    if (platform !== 'win32') {
      console.log('Unstalling windows service for app only works on windows platforms..')

      return resolve({
        uninstalled: false,
        serviceName: null
      })
    }

    if (!existsPackageJson && !appInfo) {
      return reject(new Error('To uninstall windows service for app you need a package.json file..'))
    }

    if (appInfo) {
      if (!appInfo.path) {
        return reject(new Error('To uninstall windows service for app you need to pass "path" in appInfo..'))
      }

      pathToApp = appInfo.path

      if (!appInfo.name) {
        return reject(new Error('To uninstall windows service for app you need to pass "name" in appInfo..'))
      }

      serviceName = appInfo.name
    } else {
      pathToApp = cwd

      const userPkg = require(path.join(pathToApp, './package.json'))

      if (!userPkg.name) {
        return reject(new Error('To uninstall windows service for app you need a "name" field in package.json file..'))
      }

      serviceName = userPkg.name
    }

    console.log('Uninstalling windows service "' + serviceName + '".')

    let winser

    if (appInfo) {
      winser = Winser({ silent: !verbose, nssmPath: staticPaths.nssm, app: appInfo })
    } else {
      winser = Winser({ silent: !verbose, nssmPath: staticPaths.nssm })
    }

    winser.remove({
      path: pathToApp,
      stop: true
    }, (error) => {
      if (error) {
        return reject(error)
      }

      console.log('Windows service "' + serviceName + '" uninstalled')

      resolve({
        uninstalled: true,
        serviceName: serviceName
      })
    })
  })
}

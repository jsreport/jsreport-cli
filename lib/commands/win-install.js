'use strict'

const path = require('path')
const fs = require('fs')
const platform = require('os').platform()
const Winser = require('winser-with-api').Winser

const description = 'WINDOWS ONLY - install app as windows service, For other platforms see http://jsreport.net/on-prem/downloads'
const command = 'win-install'

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
    let hasEntry = false
    let pathToApp
    let serviceName

    console.log('Platform is ' + platform)

    if (platform !== 'win32') {
      console.log('Installing app as windows service only works on windows platforms..')
      console.log('Installing jsreport as startup service for your platform should be described at http://jsreport.net/downloads')

      return resolve({
        installed: false,
        serviceName: null
      })
    }

    if (!existsPackageJson && !appInfo) {
      return reject(new Error('To install app as windows service you need a package.json file..'))
    }

    if (appInfo) {
      if (!appInfo.path) {
        return reject(new Error('To install app as windows service you need to pass "path" in appInfo..'))
      }

      pathToApp = appInfo.path

      if (!appInfo.name) {
        return reject(new Error('To install app as windows service you need to pass "name" in appInfo..'))
      }

      serviceName = appInfo.name

      if (appInfo.startcmd) {
        hasEntry = true
      }

      if (!hasEntry) {
        return reject(new Error('To install app as windows service you need to pass "startcmd" in appInfo..'))
      }
    } else {
      pathToApp = cwd

      const userPkg = require(path.join(pathToApp, './package.json'))

      if (!userPkg.name) {
        return reject(new Error('To install app as windows service you need a "name" field in package.json file..'))
      }

      serviceName = userPkg.name

      if (userPkg.scripts && userPkg.scripts.start) {
        hasEntry = true
      } else if (userPkg.main) {
        hasEntry = true
      }

      if (!hasEntry) {
        return reject(new Error('To install app as windows service you need to have a "start" script or a "main" field in package.json file..'))
      }
    }

    console.log('Installing windows service "' + serviceName + '" for app..')

    let winser

    if (appInfo) {
      winser = Winser({ silent: !verbose, nssmPath: staticPaths.nssm, app: appInfo })
    } else {
      winser = Winser({ silent: !verbose, nssmPath: staticPaths.nssm })
    }

    winser.install({
      path: pathToApp,
      env: ['NODE_ENV=' + (process.env.NODE_ENV != null ? process.env.NODE_ENV : 'development')],
      autostart: true
    }, (error) => {
      if (error) {
        return reject(error)
      }

      console.log('Service "' + serviceName + '" is running.')

      resolve({
        installed: true,
        serviceName: serviceName
      })
    })
  })
}

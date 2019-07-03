'use strict'

const path = require('path')
const searchExtensionsCommands = require('./registerExtensionsCommands')

module.exports = (reporter, definition) => {
  if (reporter.compilation2) {
    reporter.compilation2.resourceInTemp('nssm.exe', path.join(path.dirname(require.resolve('winser-with-api')), './bin/nssm.exe'))
    reporter.compilation2.resourceInTemp('nssm64.exe', path.join(path.dirname(require.resolve('winser-with-api')), './bin/nssm64.exe'))
    reporter.compilation2.resourceInTemp('WinRun.exe', path.join(path.dirname(require.resolve('silent-spawn')), './WinRun.exe'))
  }

  reporter.cli = {
    findCommandsInExtensions: async () => {
      const extensionsCommands = await searchExtensionsCommands(
        reporter.extensionsManager.extensions,
        { registerCommand: () => {} }
      )

      return extensionsCommands
    }
  }
}

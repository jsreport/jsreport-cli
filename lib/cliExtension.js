'use strict'

const path = require('path')
const searchExtensionsCommands = require('./registerExtensionsCommands')

module.exports = (reporter, definition) => {
  if (reporter.compilation2) {
    reporter.compilation2.resource('nssm.exe', path.join(path.dirname(require.resolve('winser-with-api')), './bin/nssm.exe'))
    reporter.compilation2.resource('nssm64.exe', path.join(path.dirname(require.resolve('winser-with-api')), './bin/nssm64.exe'))
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

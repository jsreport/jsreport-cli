const commander = require('./lib/commander')
const main = require('./lib/cliExtension')
const config = require('./jsreport.config')

module.exports = function (options) {
  const newConfig = Object.assign({}, config)

  newConfig.options = options
  newConfig.main = main
  newConfig.directory = __dirname

  return newConfig
}

module.exports.commander = commander

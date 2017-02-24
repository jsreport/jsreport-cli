var assign = require('object-assign')
var commander = require('./lib/commander')
var main = require('./lib/cliExtension')
var config = require('./jsreport.config')

module.exports = function (options) {
  var newConfig = assign({}, config)

  newConfig.options = options
  newConfig.main = main
  newConfig.directory = __dirname

  return newConfig
}

module.exports.commander = commander

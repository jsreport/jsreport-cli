'use strict'

var _originalProcessExit
var _hasBeenCalled = false
var _exitCode
var callInfo = {}

exports.enable = function () {
  _originalProcessExit = process.exit

  _exitCode = undefined
  _hasBeenCalled = false

  process.exit = function (exitCode) {
    _exitCode = exitCode
    _hasBeenCalled = true
  }
}

exports.callInfo = function () {
  return callInfo
}

exports.restore = function () {
  process.exit = _originalProcessExit

  callInfo = {
    called: _hasBeenCalled,
    exitCode: _exitCode
  }
}

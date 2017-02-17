'use strict'

var path = require('path')
var mkdirp = require('mkdirp')
var rimraf = require('rimraf')

function getTempDir (dir) {
  return path.join(__dirname, '../temp', dir)
}

function createTempDir (dirs, visitor) {
  dirs.forEach(function (dir) {
    var absoluteDir = getTempDir(dir)

    mkdirp.sync(absoluteDir)

    visitor(dir, absoluteDir)
  })
}

function cleanTempDir (dirs) {
  try {
    dirs.forEach(function (dir) {
      rimraf.sync(getTempDir(dir))
    })
  } catch (e) {}
}

exports.getTempDir = getTempDir
exports.cleanTempDir = cleanTempDir
exports.createTempDir = createTempDir

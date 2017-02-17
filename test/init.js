var path = require('path')
var fs = require('fs')
var should = require('should')
var mkdirp = require('mkdirp')
var rimraf = require('rimraf')
var init = require('../lib/commands/init').handler

var TEMP_DIRS = [
  'init-empty',
  'init-packagejson-only',
  'init-packagejson-with-server',
  'init-packagejson-with-devconfig',
  'init-packagejson-with-prodconfig'
]

function getTempDir (dir) {
  return path.join(__dirname, 'temp', dir)
}

function createTempDir () {
  TEMP_DIRS.forEach(function (dir) {
    var absoluteDir = getTempDir(dir)

    mkdirp.sync(absoluteDir)

    switch (dir) {
      case 'init-packagejson-only':
        fs.writeFileSync(
          path.join(absoluteDir, './package.json'),
          JSON.stringify({
            name: 'packagejson-only',
            dependencies: {
              jsreport: '*'
            }
          }, null, 2)
        )
        return

      case 'init-packagejson-with-server':
        fs.writeFileSync(
          path.join(absoluteDir, './package.json'),
          JSON.stringify({
            name: 'packagejson-with-server',
            dependencies: {
              jsreport: '*'
            }
          }, null, 2)
        )

        fs.writeFileSync(
          path.join(absoluteDir, './server.js'),
          'require("jsreport")().init()'
        )
        return

      case 'init-packagejson-with-devconfig':
        fs.writeFileSync(
          path.join(absoluteDir, './package.json'),
          JSON.stringify({
            name: 'devconfig',
            dependencies: {
              jsreport: '*'
            }
          }, null, 2)
        )

        fs.writeFileSync(
          path.join(absoluteDir, './dev.config.json'),
          '{"connectionString": { "name": "fs" }}'
        )
        return

      case 'init-packagejson-with-prodconfig':
        fs.writeFileSync(
          path.join(absoluteDir, './package.json'),
          JSON.stringify({
            name: 'prodconfig',
            dependencies: {
              jsreport: '*'
            }
          }, null, 2)
        )

        fs.writeFileSync(
          path.join(absoluteDir, './prod.config.json'),
          '{"connectionString": { "name": "fs" }}'
        )
        return
    }
  })
}

function cleanTempDir () {
  try {
    TEMP_DIRS.forEach(function (dir) {
      rimraf.sync(getTempDir(dir))
    })
  } catch (e) {}
}

describe('init command', function () {
  // disabling timeout because removing files could take a
  // couple of seconds
  this.timeout(0)

  before(function () {
    cleanTempDir()

    createTempDir()
  })

  it('should initialize an empty directory', function () {
    // disabling timeout because npm install could take a
    // couple of minutes
    this.timeout(0)

    var dir = getTempDir('init-empty')

    return (
      init({ context: { cwd: dir } })
      .then(function (jsreportPackage) {
        // should install jsreport package
        should(fs.existsSync(path.join(dir, 'node_modules/' + jsreportPackage.name))).be.eql(true)
        // and generate default files
        should(fs.existsSync(path.join(dir, 'server.js'))).be.eql(true)
        should(fs.existsSync(path.join(dir, 'dev.config.json'))).be.eql(true)
        should(fs.existsSync(path.join(dir, 'prod.config.json'))).be.eql(true)
        should(fs.existsSync(path.join(dir, 'package.json'))).be.eql(true)
      })
    )
  })

  it('should initialize a directory that contains only package.json', function () {
    // disabling timeout because npm install could take a
    // couple of minutes
    this.timeout(0)

    var dir = getTempDir('init-packagejson-only')

    return (
      init({ context: { cwd: dir } })
      .then(function (jsreportPackage) {
        // should generate default files
        should(fs.existsSync(path.join(dir, 'server.js'))).be.eql(true)
        should(fs.existsSync(path.join(dir, 'dev.config.json'))).be.eql(true)
        should(fs.existsSync(path.join(dir, 'prod.config.json'))).be.eql(true)
        // but not replace package.json in dir
        should(
          JSON.parse(
            fs.readFileSync(path.join(dir, 'package.json')).toString()
          ).name
        ).be.eql('packagejson-only')
      })
    )
  })

  it('should not override server.js file', function () {
    // disabling timeout because npm install could take a
    // couple of minutes
    this.timeout(0)

    var dir = getTempDir('init-packagejson-with-server')

    return (
      init({ context: { cwd: dir } })
      .then(function (jsreportPackage) {
        // should generate default files
        should(fs.existsSync(path.join(dir, 'dev.config.json'))).be.eql(true)
        should(fs.existsSync(path.join(dir, 'prod.config.json'))).be.eql(true)
        // but not replace package.json in dir
        should(
          JSON.parse(
            fs.readFileSync(path.join(dir, 'package.json')).toString()
          ).name
        ).be.eql('packagejson-with-server')
        // and not replace server.js
        should(
          fs.readFileSync(path.join(dir, 'server.js')).toString().trim()
        ).be.eql('require("jsreport")().init()')
      })
    )
  })

  it('should not override dev.config.json file', function () {
    // disabling timeout because npm install could take a
    // couple of minutes
    this.timeout(0)

    var dir = getTempDir('init-packagejson-with-devconfig')

    return (
      init({ context: { cwd: dir } })
      .then(function (jsreportPackage) {
        // should generate default files
        should(fs.existsSync(path.join(dir, 'prod.config.json'))).be.eql(true)
        should(fs.existsSync(path.join(dir, 'server.js'))).be.eql(true)
        // but not replace package.json in dir
        should(
          JSON.parse(
            fs.readFileSync(path.join(dir, 'package.json')).toString()
          ).name
        ).be.eql('devconfig')
        // and not replace dev.config.json
        should(
          fs.readFileSync(path.join(dir, 'dev.config.json')).toString().trim()
        ).be.eql('{"connectionString": { "name": "fs" }}')
      })
    )
  })

  it('should not override prod.config.json file', function () {
    // disabling timeout because npm install could take a
    // couple of minutes
    this.timeout(0)

    var dir = getTempDir('init-packagejson-with-prodconfig')

    return (
      init({ context: { cwd: dir } })
      .then(function (jsreportPackage) {
        // should generate default files
        should(fs.existsSync(path.join(dir, 'dev.config.json'))).be.eql(true)
        should(fs.existsSync(path.join(dir, 'server.js'))).be.eql(true)
        // but not replace package.json in dir
        should(
          JSON.parse(
            fs.readFileSync(path.join(dir, 'package.json')).toString()
          ).name
        ).be.eql('prodconfig')
        // and not replace prod.config.json
        should(
          fs.readFileSync(path.join(dir, 'prod.config.json')).toString().trim()
        ).be.eql('{"connectionString": { "name": "fs" }}')
      })
    )
  })

  after(function () {
    cleanTempDir()
  })
})

const path = require('path')
const fs = require('fs')
const should = require('should')
const utils = require('../utils')
const repair = require('../../lib/commands/repair').handler

const TEMP_DIRS = [
  'repair-empty',
  'repair-with-specific-version',
  'repair-packagejson-only',
  'repair-packagejson-with-server',
  'repair-packagejson-with-config'
]

describe('repair command', function () {
  // disabling timeout because removing files could take a
  // couple of seconds
  this.timeout(0)

  before(function () {
    utils.cleanTempDir(TEMP_DIRS)

    utils.createTempDir(TEMP_DIRS, function (dir, absoluteDir) {
      switch (dir) {
        case 'repair-packagejson-only':
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

        case 'repair-packagejson-with-server':
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

        case 'repair-packagejson-with-config':
          fs.writeFileSync(
            path.join(absoluteDir, './package.json'),
            JSON.stringify({
              name: 'config',
              dependencies: {
                jsreport: '*'
              }
            }, null, 2)
          )

          fs.writeFileSync(
            path.join(absoluteDir, './jsreport.config.json'),
            '{"connectionString": { "name": "fs" }}'
          )
      }
    })
  })

  it('should work on empty directory', function () {
    // disabling timeout because npm install could take a
    // couple of minutes
    this.timeout(0)

    const dir = utils.getTempDir('repair-empty')

    return (
      repair({ context: { cwd: dir } })
        .then(function (jsreportPackage) {
        // should install jsreport package
          should(fs.existsSync(path.join(dir, 'node_modules/' + jsreportPackage.name))).be.eql(true)
          // and generate default files
          should(fs.existsSync(path.join(dir, 'server.js'))).be.eql(true)
          should(fs.existsSync(path.join(dir, 'jsreport.config.json'))).be.eql(true)
          should(fs.existsSync(path.join(dir, 'package.json'))).be.eql(true)
        })
    )
  })

  it('should work with specific jsreport version', function () {
    // disabling timeout because npm install could take a
    // couple of minutes
    this.timeout(0)

    const dir = utils.getTempDir('repair-with-specific-version')
    const versionToInstall = '1.3.0'

    return (
      repair({ context: { cwd: dir }, _: [null, versionToInstall] })
        .then(function (jsreportPackage) {
        // should install jsreport package
          should(fs.existsSync(path.join(dir, 'node_modules/' + jsreportPackage.name))).be.eql(true)
          // and generate default files
          should(fs.existsSync(path.join(dir, 'server.js'))).be.eql(true)
          should(fs.existsSync(path.join(dir, 'jsreport.config.json'))).be.eql(true)
          should(fs.existsSync(path.join(dir, 'package.json'))).be.eql(true)

          should(JSON.parse(
            fs.readFileSync(path.join(dir, 'package.json')).toString()
          ).dependencies.jsreport).endWith(versionToInstall)
        })
    )
  })

  it('should work on a directory that contains only package.json', function () {
    // disabling timeout because npm install could take a
    // couple of minutes
    this.timeout(0)

    const dir = utils.getTempDir('repair-packagejson-only')

    return (
      repair({ context: { cwd: dir } })
        .then(function (jsreportPackage) {
        // should generate default files
          should(fs.existsSync(path.join(dir, 'server.js'))).be.eql(true)
          should(fs.existsSync(path.join(dir, 'jsreport.config.json'))).be.eql(true)
          // and replace package.json in dir
          should(
            JSON.parse(
              fs.readFileSync(path.join(dir, 'package.json')).toString()
            ).name
          ).be.eql('jsreport-server')
        })
    )
  })

  it('should override server.js file', function () {
    // disabling timeout because npm install could take a
    // couple of minutes
    this.timeout(0)

    const dir = utils.getTempDir('repair-packagejson-with-server')

    return (
      repair({ context: { cwd: dir } })
        .then(function (jsreportPackage) {
        // should generate default files
          should(fs.existsSync(path.join(dir, 'jsreport.config.json'))).be.eql(true)
          // replace package.json in dir
          should(
            JSON.parse(
              fs.readFileSync(path.join(dir, 'package.json')).toString()
            ).name
          ).be.eql('jsreport-server')
          // and replace server.js
          should(
            fs.readFileSync(path.join(dir, 'server.js')).toString().trim()
          ).be.not.eql('require("jsreport")().init()')
        })
    )
  })

  it('should override jsreport.config.json file', function () {
    // disabling timeout because npm install could take a
    // couple of minutes
    this.timeout(0)

    const dir = utils.getTempDir('repair-packagejson-with-config')

    return (
      repair({ context: { cwd: dir } })
        .then(function (jsreportPackage) {
        // should generate default files
          should(fs.existsSync(path.join(dir, 'jsreport.config.json'))).be.eql(true)
          should(fs.existsSync(path.join(dir, 'server.js'))).be.eql(true)
          // replace package.json in dir
          should(
            JSON.parse(
              fs.readFileSync(path.join(dir, 'package.json')).toString()
            ).name
          ).be.eql('jsreport-server')
          // and replace jsreport.config.json
          should(
            fs.readFileSync(path.join(dir, 'jsreport.config.json')).toString().trim()
          ).be.not.eql('{"connectionString": { "name": "fs" }}')
        })
    )
  })

  after(() => utils.cleanTempDir(TEMP_DIRS))
})

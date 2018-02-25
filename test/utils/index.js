const path = require('path')
const mkdirp = require('mkdirp')
const rimraf = require('rimraf')
const fs = require('fs')
const childProcess = require('child_process')
const mockProcessExit = require('./mockProcessExit')

function getTempDir (dir) {
  return path.join(__dirname, '../temp', dir)
}

function createTempDir (dirs, visitor) {
  dirs.forEach(function (dir) {
    const absoluteDir = getTempDir(dir)

    mkdirp.sync(absoluteDir)

    visitor(dir, absoluteDir)
  })
}

function cleanTempDir (dirs) {
  try {
    dirs.forEach(function (dir) {
      const fullDir = getTempDir(dir)
      fs.readdirSync(fullDir).forEach(function (d) {
        // omit node_modules from cleaning to speed up the tests
        if (d !== 'node_modules') {
          rimraf.sync(path.join(fullDir, d))
        }
      })
    })
  } catch (e) {
  }
}

function npmInstall (cwd, cb) {
  console.log('installing dependencies for test suite in ' + cwd)

  if (fs.existsSync(path.join(cwd, 'node_modules', 'jsreport'))) {
    console.log('skipping npm install...')
    return cb()
  }

  childProcess.exec('npm install', {
    cwd: cwd
  }, function (error, stdout, stderr) {
    if (error) {
      console.log('error while installing dependencies for test suite...')
      return cb(error)
    }

    console.log('installation of dependencies for test suite completed...')
    cb()
  })
}

exports.getTempDir = getTempDir
exports.cleanTempDir = cleanTempDir
exports.createTempDir = createTempDir
exports.mockProcessExit = mockProcessExit
exports.npmInstall = npmInstall

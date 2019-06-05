const path = require('path')
const fs = require('fs')
const should = require('should')
const { init, clean, cwd, exec } = require('./utils')

describe('cli', () => {
  before(init)
  beforeEach(clean)

  it('should fail when passing unknown option', () => {
    should(() => {
      exec('--unknown value')
    }).throw(/Unknown argument/)
  })

  it('should fail when passing unknown dashed option', () => {
    should(() => {
      exec('--unknown-arg value')
    }).throw(/Unknown argument/)
  })

  it('--version should return version', () => {
    exec('--version').should.match(/cli version/)
  })

  it('--help should return message', () => {
    exec('--help').should.match(/Usage:\n\njsreport/)
  })

  it('should fail when command receives unknown option', () => {
    should(() => {
      exec(' --unknown value')
    }).throw(/Unknown argument/)
  })

  it('should fail when command receives unknown dashed option', () => {
    should(() => {
      exec(' --unknown-args value')
    }).throw(/Unknown argument/)
  })

  it('"help config" should return message', () => {
    const result = exec('help config')

    result.should.match(/Configuration format description/)
    result.should.match(/"extensions": <object> {/)
  })

  it('render should write to output file', () => {
    fs.writeFileSync(path.join(cwd, 'test.html'), 'foo')
    exec('render --template.content=test.html --template.engine=none --template.recipe=html --out=out.html')
    fs.readFileSync(path.join(cwd, 'out.html')).toString().should.be.eql('foo')
  })

  it('render failing instance should provide init error', () => {
    fs.writeFileSync(path.join(cwd, 'jsreport.config.json'), 'intention')
    fs.writeFileSync(path.join(cwd, 'test.html'), 'foo')
    should(() => {
      exec('render --template.content=test.html --template.engine=none --template.recipe=html --out=out.html')
    }).throw(/Error parsing your configuration file/)
  })

  it('render with keepAlive and failing instance should provide init error', () => {
    fs.writeFileSync(path.join(cwd, 'jsreport.config.json'), 'intention')
    fs.writeFileSync(path.join(cwd, 'test.html'), 'foo')
    should(() => {
      exec('render --keepAlive --template.content=test.html --template.engine=none --template.recipe=html --out=out.html')
    }).throw(/Error parsing your configuration file/)
  })
})

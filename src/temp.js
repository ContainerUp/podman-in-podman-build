const io = require('@actions/io')
const path = require('path')
const exec = require('@actions/exec')

const tmp = path.join(process.env.RUNNER_TEMP, 'podman-in-podman-build')
let temDirCreated = false

async function tempDir() {
  if (!temDirCreated) {
    await io.mkdirP(tmp)
    await exec.exec(await io.which('chmod', true), ['777', tmp])
    temDirCreated = true
  }

  return tmp
}

async function fixOwner() {
  await exec.exec(await io.which('sudo', true), [
    'chown',
    '-R',
    process.env.USER,
    tmp
  ])
}

module.exports = { tempDir, fixOwner }

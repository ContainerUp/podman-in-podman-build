const io = require('@actions/io')
const path = require('path')
const exec = require('@actions/exec')

let temDirCreated = false

async function tempDir() {
  const tmp = path.join(process.env.RUNNER_TEMP, 'podman-in-podman-build')

  if (!temDirCreated) {
    await io.mkdirP(tmp)
    await exec.exec(await io.which('chmod', true), ['777', tmp])
    temDirCreated = true
  }

  return tmp
}

module.exports = { tempDir }

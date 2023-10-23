const core = require('@actions/core')
const io = require('@actions/io')
const path = require('path')
const exec = require('@actions/exec')

const tmp = path.join(
  process.env.RUNNER_TEMP || '/tmp',
  'podman-in-podman-build'
)
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
  core.startGroup('🔨 Fixing ownerships of temporary files...')
  await exec.exec(await io.which('sudo', true), [
    'chown',
    '-R',
    process.env.USER,
    tmp
  ])
  core.endGroup()
}

module.exports = { tempDir, fixOwner }

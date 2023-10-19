const core = require('@actions/core')
const exec = require('@actions/exec')
const path = require('path')
const { tempDir } = require('./temp')

const mountPoint = '/podman_in_podman'
const sleepCmd = ['sh', '-c', 'trap : TERM INT; sleep infinity & wait']

class Podman {
  constructor(executable) {
    this.podman = executable
  }

  async loadImage(archive) {
    core.startGroup('💿 [Podman] Loading image from file...')

    const exitCode = await exec.exec(this.podman, ['load', '-i', archive])
    if (exitCode !== 0) {
      throw new Error(`Podman exited with code ${exitCode}`)
    }

    core.endGroup()
  }

  async saveImage(image, archive) {
    core.startGroup(`💿 [Podman] Saving image ${image} to file...`)

    const exitCode = await exec.exec(this.podman, [
      'save',
      '--format',
      'oci-archive',
      '-o',
      archive,
      image
    ])
    if (exitCode !== 0) {
      throw new Error(`Podman exited with code ${exitCode}`)
    }

    core.endGroup()
  }

  async manifestCreate(name) {
    core.startGroup(`🏷️ [Podman] Create manifest ${name}...`)
    const exitCode = await exec.exec(this.podman, ['manifest', 'create', name])
    if (exitCode !== 0) {
      throw new Error(`Podman exited with code ${exitCode}`)
    }
    core.endGroup()
  }

  async manifestAddArchive(manifest, archive) {
    core.startGroup(`🏷️ [Podman] Add an archive manifest ${manifest}...`)
    const exitCode = await exec.exec(this.podman, [
      'manifest',
      'add',
      manifest,
      `oci-archive:${archive}`
    ])
    if (exitCode !== 0) {
      throw new Error(`Podman exited with code ${exitCode}`)
    }
    core.endGroup()
  }

  async tagImage(image, tags) {
    core.startGroup(`🏷️ [Podman] Add tags to ${image}...`)
    const exitCode = await exec.exec(this.podman, ['tag', image, ...tags])
    if (exitCode !== 0) {
      throw new Error(`Podman exited with code ${exitCode}`)
    }
    core.endGroup()
  }

  async runDetachedContainer(
    name,
    devices,
    volumes,
    user,
    workdir,
    image,
    cmds
  ) {
    const args = ['run', '-d', '--name', name]

    for (const dev of devices) {
      args.push('--device', dev)
    }
    for (const v of volumes) {
      args.push('-v', v)
    }
    if (user) {
      args.push('--user', user)
    }
    if (workdir) {
      args.push('--workdir', workdir)
    }

    args.push(image, ...cmds)

    const exitCode = await exec.exec(this.podman, args)
    if (exitCode !== 0) {
      throw new Error(`Podman exited with code ${exitCode}`)
    }

    return this.getContainer(name)
  }

  getContainer(name) {
    return new Container(this.podman, name)
  }
}

class Container {
  constructor(podmanExec, name) {
    this.podmanExec = podmanExec
    this.name = name
  }

  async exec(cmds, opts = []) {
    const args = ['exec', ...opts, this.name, ...cmds]
    return await exec.exec(this.podmanExec, args)
  }

  async remove(force = false) {
    const args = ['rm']
    if (force) {
      args.push('-f')
    }
    args.push(this.name)

    core.startGroup(`🚫 [Podman] Removing container ${this.name}...`)
    const exitCode = await exec.exec(this.podman, ['rm', ...args])
    if (exitCode !== 0) {
      throw new Error(`Podman exited with code ${exitCode}`)
    }
    core.endGroup()
  }
}

function repoTagWithPlatform(repoTag, platform) {
  platform = platform.replace('/', '_')
  return `${repoTag}_${platform}`
}

class PodmanInPodman {
  constructor(podman, container) {
    this.podman = podman
    this.container = container
  }

  async build(
    containerfile,
    workdir,
    platforms,
    repository,
    tags,
    buildArgs,
    labels
  ) {
    const repoTag = `${repository}:${tags[0]}`

    if (platforms.length < 2) {
      let platform = ''
      if (platforms.length === 1) {
        platform = platforms[0]
      }

      await this.buildSinglePlatform(
        containerfile,
        workdir,
        platform,
        repoTag,
        buildArgs,
        labels
      )
      await this.exportAndImportToHost(repoTag)

      if (tags.length > 1) {
        await this.podman.tagImage(repoTag, tags.slice(1))
      }
      return
    }

    await this.createManifest(repoTag)
    for (const platform of platforms) {
      await this.buildSinglePlatform(
        containerfile,
        workdir,
        platform,
        repoTagWithPlatform(repoTag, platform),
        buildArgs,
        labels
      )

      await this.exportAndImportToHost(
        repoTagWithPlatform(repoTag, platform),
        true
      )

      if (tags.length > 1) {
        await this.podman.tagImage(repoTag, tags.slice(1))
      }
    }
  }

  async exportAndImportToHost(repoTag, isManifest = false) {
    const normalizedRepoTag = repoTag.replace('/', '_')
    const archiveExport = path.join(mountPoint, `${normalizedRepoTag}.tar`)
    const archiveImport = path.join(await tempDir(), `${normalizedRepoTag}.tar`)

    core.startGroup(`➡️ [PodmanInPodman] Copying image ${repoTag}...`)
    await this.export(repoTag, archiveExport)
    if (!isManifest) {
      await this.importToHostImage(archiveImport)
    } else {
      await this.importToHostManifest(repoTag, archiveImport)
    }
    core.endGroup()
  }

  async export(repoTag, archive) {
    const args = ['podman', 'save', '-o', archive, repoTag]

    core.startGroup(`📦 [PodmanInPodman] Exporting image ${repoTag}...`)
    const exitCode = await this.container.exec(args)
    if (exitCode !== 0) {
      throw new Error(`PodmanInPodman exited with code ${exitCode}`)
    }
    core.endGroup()
  }

  async importToHostImage(archive) {
    core.startGroup(`📦 [PodmanInPodman] Importing image to host...`)
    await this.podman.loadImage(archive)
    core.endGroup()
  }

  async createManifest(manifest) {
    core.startGroup(`📦 [PodmanInPodman] Create manifest ${manifest}...`)
    await this.podman.manifestCreate(manifest)
    core.endGroup()
  }

  async importToHostManifest(manifest, archive) {
    core.startGroup(
      `📦 [PodmanInPodman] Importing image to host manifest ${manifest}...`
    )
    await this.podman.manifestAddArchive(manifest, archive)
    core.endGroup()
  }

  async buildSinglePlatform(
    containerfile,
    workdir,
    platform,
    repoTag,
    buildArgs,
    labels
  ) {
    const args = ['podman', 'build']

    if (containerfile) {
      args.push('-f', containerfile)
    }
    if (platform) {
      args.push('--platform', platform)
    }
    for (const arg of buildArgs) {
      args.push('--build-arg', arg)
    }
    for (const label of labels) {
      args.push('--label', label)
    }
    args.push('--tag', repoTag)

    if (workdir) {
      args.push(workdir)
    } else {
      args.push('.')
    }

    core.startGroup(`🛠️ [PodmanInPodman] Building image ${repoTag}...`)
    const exitCode = await this.container.exec(args)
    if (exitCode !== 0) {
      throw new Error(`PodmanInPodman exited with code ${exitCode}`)
    }
    core.endGroup()
  }
}

async function createPodmanInPodman(podman, githubWorkdir, workdir, image) {
  const tmpDir = await tempDir()

  core.startGroup(`✨ [PodmanInPodman] Creating podman-in-podman container...`)
  const podmanContainer = await podman.runDetachedContainer(
    'podmaninpodman',
    ['/dev/fuse:rw'],
    [`${githubWorkdir}:${githubWorkdir}`, `${tmpDir}:${mountPoint}`],
    'podman',
    githubWorkdir,
    image,
    sleepCmd
  )
  core.endGroup()

  return new PodmanInPodman(podman, podmanContainer)
}

module.exports = { Podman, createPodmanInPodman }

const cache = require('@actions/cache')
const core = require('@actions/core')
const path = require('path')
const { tempDir } = require('./temp')

const cacheKeyContainerImage = 'container-image'
const cachePodmanArchive = 'podman.tar'
const cacheHitPodman = 'cachehit.podman'

async function loadPodmanImageCache(podman, podmanImage) {
  if (!core.getBooleanInput('cache-podman-image')) {
    return
  }

  const archive = path.join(await tempDir(), cachePodmanArchive)
  const key = `${cacheKeyContainerImage}-${podmanImage}`

  core.startGroup('⬇️ Downloading Podman image from cache...')
  const hit = await cache.restoreCache([archive], key)
  if (hit) {
    core.info('✅ Cache hit')
  } else {
    core.info('⚠️ Cache miss')
  }
  core.endGroup()

  if (hit) {
    core.saveState(cacheHitPodman, 'true')
    await podman.loadImage(archive)
  }
}

async function savePodmanImageCache(podman, podmanImage) {
  if (!core.getBooleanInput('cache-podman-image')) {
    return
  }
  if (core.getState(cacheHitPodman) === 'true') {
    // Cache hit, no need to save cache
    console.log('🎯 Cache hit, no need to upload Podman image to cache')
    return
  }

  const archive = path.join(await tempDir(), cachePodmanArchive)
  const key = `${cacheKeyContainerImage}-${podmanImage}`

  await podman.saveImage(podmanImage, archive)

  core.startGroup('⬆️ Uploading Podman image to cache...')
  await cache.saveCache([archive], key)
  core.endGroup()
}

module.exports = {
  loadPodmanImageCache,
  savePodmanImageCache
}

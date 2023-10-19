# Podman-in-Podman Build

[![GitHub Super-Linter](https://github.com/ContainerUp/podman-in-podman-build/actions/workflows/linter.yml/badge.svg)](https://github.com/super-linter/super-linter)
![CI](https://github.com/ContainerUp/podman-in-podman-build/actions/workflows/ci.yml/badge.svg)

A simple replacement of [redhat-actions/buildah-build](https://github.com/redhat-actions/buildah-build),
but with only `podman build`, and runs the command in a container with Podman image.

The newly built images are imported to Podman on the host,
so this action is still **compatible** with actions like [redhat-actions/push-to-registry](https://github.com/redhat-actions/push-to-registry).

## Why?

The only Linux distro provided by [GitHub-hosted runners](https://github.com/actions/runner-images) is Ubuntu,
and the latest provided version is [22.04](https://github.com/actions/runner-images/blob/main/images/linux/Ubuntu2204-Readme.md), as of October 2023.

The installed version of Podman version is `3.4.4`, and the installed version of Buildah is `1.23.1`.

This could be fine for most cases, but not for ContainerUp.
We tried to do a multiplatform build with a single Containerfile,
but with an old buggy version of Podman and Buildah, [a problem is encountered](https://github.com/redhat-actions/buildah-build/issues/100).

It's very tricky to alter the environment on the runner for a new version of Podman and Buildah.
So we decided to do the build in a Podman-in-Podman container.

## What does this action do?

### 1. Create a container with Podman image

The user is set to `podman`.

A temporary directory `${RUNNER_TEMP}/podman-in-podman-build` is created, and the mode is set to 777.

The `current working directory`, `${RUNNER_TEMP}/podman-in-podman-build` are mounted in the container.

The container is named `podmaninpodman`.

### 2. Run build commands in the container

`podman exec podmaninpodman podman build ...`

### 3. Export the newly built images

`podman exec podmaninpodman save -o xxxx.tar IMAGE`

### 4. Import the images to Podman on the host

`podman load -i xxxx.tar`

### 5. Clean up

Remove the `podmaninpodman` container.

Fix the ownership of files in `${RUNNER_TEMP}/podman-in-podman-build`,
otherwise it cannot be removed automatically [as stated here](https://docs.github.com/en/actions/learn-github-actions/variables#default-environment-variables).

## Usage

```yaml
- name: Podman-in-Podman Build
  uses: ContainerUp/podman-in-podman-build@v1
  with:
    # Relative path under $GITHUB_WORKSPACE to build the image
    # Defaults: $GITHUB_WORKSPACE
    workdir: ''

    # Path of Containerfile
    # Default: 'Containerfile'
    containerfile: ''

    # Build container images with the specified OS/ARCH
    # Separate values into multiple lines
    # Defaults to the value of the runner, e.g. linux/amd64
    platforms: ''

    # The repository:tag of Podman to be run in the container
    # Default: 'quay.io/containers/podman:latest'
    podman-image: ''

    # Required
    # The built image will be tagged as <repository>:<tags[0]>, <repository>:<tags[1]>, ...
    repository: ''

    # Refer to `repository`
    # Separate values into multiple lines
    # Default: 'latest'
    tags: ''

    # List of argument=value to supply to the builder
    # Separate values into multiple lines
    build-args: ''

    # Set metadata for an image
    # Separate values into multiple lines
    labels: ''

    # Cache the Podman image, and load the image from cache
    # Default: 'true'
    cache-podman-image: ''
```

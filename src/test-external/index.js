'use strict'

const path = require('path')
const os = require('os')
const {
  exec
} = require('../utils')
const fs = require('fs-extra')
const glob = require('it-glob')

const findHttpClientPkg = (targetDir) => {
  const location = require.resolve('ipfs-http-client', {
    paths: [
      targetDir
    ]
  })

  return require(location.replace('src/index.js', 'package.json'))
}

const isDep = (name, pkg) => {
  return Object.keys(pkg.dependencies || {}).filter(dep => dep === name).pop()
}

const isDevDep = (name, pkg) => {
  return Object.keys(pkg.devDependencies || {}).filter(dep => dep === name).pop()
}

const isOptionalDep = (name, pkg) => {
  return Object.keys(pkg.optionalDendencies || {}).filter(dep => dep === name).pop()
}

const dependsOn = (name, pkg) => {
  return isDep(name, pkg) || isDevDep(name, pkg) || isOptionalDep(name, pkg)
}

const isMonoRepo = (targetDir) => {
  return fs.existsSync(path.join(targetDir, 'lerna.json'))
}

const installDependencies = async (targetDir) => {
  if (fs.existsSync(path.join(targetDir, 'package-lock.json')) || fs.existsSync(path.join(targetDir, 'npm-shrinkwrap.json'))) {
    console.info('Installing dependencies using `npm ci`') // eslint-disable-line no-console
    await exec('npm', ['ci'])
  } else {
    console.info('Installing dependencies using `npm install`') // eslint-disable-line no-console
    await exec('npm', ['install'])
  }
}

const linkIPFSInDir = async (targetDir, ipfsDir, ipfsPkg, httpClientPkg) => {
  process.chdir(targetDir)

  const modulePkgPath = path.join(targetDir, 'package.json')
  const modulePkg = require(modulePkgPath)

  // if the project also depends on the http client, upgrade it to the same version we are using
  if (dependsOn('ipfs-http-client', modulePkg)) {
    console.info('Upgrading ipfs-http-client dependency to', httpClientPkg.version) // eslint-disable-line no-console
    await exec('npm', ['install', `ipfs-http-client@${httpClientPkg.version}`])
  }

  console.info(`Linking ipfs@${ipfsPkg.version} in dir ${targetDir}`) // eslint-disable-line no-console
  await exec('npx', ['connect-deps', 'link', path.relative(await fs.realpath(targetDir), await fs.realpath(ipfsDir))])
  await exec('npx', ['connect-deps', 'connect'])
}

const testModule = async (targetDir, ipfsDir, ipfsPkg, httpClientPkg) => {
  const pkgPath = path.join(targetDir, 'package.json')

  if (!fs.existsSync(pkgPath)) {
    console.info(`No package.json found at ${pkgPath}`) // eslint-disable-line no-console

    return
  }

  const modulePkg = require(pkgPath)

  if (!dependsOn('ipfs', modulePkg) && !dependsOn('ipfs-http-client', modulePkg)) {
    console.info(`Module ${modulePkg.name} does not depend on IPFS or the IPFS HTTP Client`) // eslint-disable-line no-console

    return
  }

  if (!modulePkg.scripts || !modulePkg.scripts.test) {
    console.info(`Module ${modulePkg.name} has no tests`) // eslint-disable-line no-console

    return
  }

  process.chdir(targetDir)

  try {
    // run the tests without our upgrade - if they are failing, no point in continuing
    await exec('npm', ['test'])
  } catch (err) {
    console.info(err) // eslint-disable-line no-console
    console.info(`Failed to run the tests of ${modulePkg.name}, aborting`) // eslint-disable-line no-console

    return
  }

  // upgrade IPFS to the rc
  await linkIPFSInDir(targetDir, ipfsDir, ipfsPkg, httpClientPkg)

  // run the tests with the new IPFS/IPFSHTTPClient
  await exec('npm', ['test'])
}

const testRepo = async (targetDir, ipfsDir, ipfsPkg, httpClientPkg) => {
  process.chdir(targetDir)

  await installDependencies(targetDir)
  await testModule(targetDir, ipfsDir, ipfsPkg, httpClientPkg)
}

const testMonoRepo = async (targetDir, ipfsDir, ipfsPkg, httpClientPkg) => {
  process.chdir(targetDir)

  await installDependencies(targetDir)

  let lerna = path.join('node_modules', '.bin', 'lerna')

  if (!fs.existsSync(lerna)) {
    // no lerna in project depenencies :(
    await exec('npm', ['install', '-g', 'lerna'])
    lerna = 'lerna'
  }

  await exec(lerna, ['bootstrap'])

  // read package targetDir config
  const config = require(path.join(targetDir, 'lerna.json'))

  // find where the packages are stored
  let packages = config.packages || 'packages'

  if (!Array.isArray(packages)) {
    packages = [packages]
  }

  // test each package that depends on ipfs/http client
  for (const pattern of packages) {
    for await (const match of glob(targetDir, pattern)) {
      testModule(path.join(targetDir, match), ipfsDir, ipfsPkg, httpClientPkg)
    }
  }
}

async function testExternal (opts) {
  // work out our versions
  const ipfsDir = process.cwd()
  const ipfsPkg = require(path.join(ipfsDir, 'package.json'))
  const httpClientPkg = findHttpClientPkg(ipfsDir)
  const targetDir = path.join(os.tmpdir(), `${opts.name}-${Date.now()}`)

  console.info(`Cloning ${opts.repo} into ${targetDir}`) // eslint-disable-line no-console
  await exec('git', ['clone', opts.repo, targetDir])

  if (isMonoRepo(targetDir)) {
    await testMonoRepo(targetDir, ipfsDir, ipfsPkg, httpClientPkg)
  } else {
    await testRepo(targetDir, ipfsDir, ipfsPkg, httpClientPkg)
  }

  console.info(`Removing ${targetDir}`) // eslint-disable-line no-console
  await fs.remove(targetDir)
}

module.exports = testExternal

'use strict'

const merge = require('webpack-merge')
const webpack = require('webpack')
const path = require('path')

const utils = require('../../utils')
const base = require('./base')
const user = require('../user')()

function webpackConfig (env) {
  env = env || 'production'

  return utils.getPkg().then((pkg) => {
    const libraryName = utils.getLibraryName(pkg.name)
    const userConfig = user.webpack
    const entry = user.entry
    const environment = utils.getEnv(env).stringified
    environment.TEST_DIR = JSON.stringify(path.join(process.cwd(), 'test'))

    return merge(base, {
      entry: [
        entry
      ],
      devtool: 'source-map',
      output: {
        filename: path.basename(entry),
        library: libraryName,
        path: utils.getPathToDist()
      },
      plugins: [
        new webpack.DefinePlugin(environment)
      ]
    }, userConfig)
  })
}

module.exports = webpackConfig

'use strict'

const EPILOG = `
Typescript config file is required to generated docs. Try \`aegir ts --preset config > tsconfig.json\`
`

module.exports = {
  command: 'docs',
  desc: 'Generate documentation from JSDoc comments.',
  builder: yargs => {
    yargs
      .epilog(EPILOG)
      .example('aegir docs', 'Build markdown documentation.')
      .example('aegir docs -p', 'Build markdown documentation and publish to Github Pages.')
      .options(
        {
          publish: {
            alias: 'p',
            type: 'boolean',
            describe: 'Publish to GitHub Pages',
            default: false
          }
        }
      )
  },
  handler (argv) {
    const docs = require('../src/docs')
    return docs.run(argv)
  }
}

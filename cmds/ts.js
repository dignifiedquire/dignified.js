'use strict'

const EPILOG = `
Presets:
\`check\`       Runs the type checker with your local config and doesn't not emit output. 
\`types\`       Emits type declarations for \`['src/**/*', 'package.json']\` to \`dist\` folder.
\`docs\`        Generates documentation based on type declarations to the \`docs\` folder.
\`config\`      Prints base config to stdout.

Note: 
To enable types declarations to be used add this to your package.json:

\`\`\`json
"types": "./dist/src/index.d.ts",
"typesVersions": {
  "*": { "src/*": ["dist/src/*"] }
},
\`\`\`

Supports options forwarding with '--' for more info check https://www.typescriptlang.org/docs/handbook/compiler-options.html
`
module.exports = {
  command: 'ts',
  desc: 'Typescript command with presets for specific tasks.',
  builder: (yargs) => {
    yargs
      .epilog(EPILOG)
      .example('aegir ts --preset config > tsconfig.json', 'Add a base tsconfig.json to the current repo.')
      .options({
        preset: {
          type: 'string',
          choices: ['config', 'check', 'types', 'docs'],
          describe: 'Preset to run',
          alias: 'p'
        }
      })
  },
  handler (argv) {
    const ts = require('../src/ts')
    return ts(argv)
  }
}

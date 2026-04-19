/** @type {import('@cucumber/cucumber').IRunConfiguration} */
export default {
  default: {
    features: 'features/**/*.feature',
    require: ['steps/**/*.ts'],
    requireModule: ['ts-node/register'],
    format: ['progress-bar', 'html:cucumber-report.html'],
    formatOptions: { snippetInterface: 'async-await' },
  },
}

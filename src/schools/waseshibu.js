// Deployment-owned configuration. Shared modules must not import a school directly.
export const SCHOOL_PROFILE = Object.freeze({
  schoolId: 'waseshibu',
  schoolLabel: '早稲田渋谷シンガポール',
  adminTitle: 'WaseShibu Progress Admin',
  platformLabel: 'WaseShibu Progress Platform',
  workerName: 'waseshibu-progress-api',
  objectName: 'family-main',
  bindingName: 'PROGRESS',
  className: 'HouseholdProgress',
  deviceCodePrefix: 'WS-',
  legacyAppId: 'kokugo',
  allowedOrigin: 'https://fyam8.github.io',
  years: Object.freeze([2026,2025,2024,2023,2022,2021,2020,2019]),
  targets: Object.freeze({
    'target-60': '目標 60点',
    'target-70': '目標 70点',
    'target-75': '目標 75点',
  }),
  apps: Object.freeze({
    kokugo:Object.freeze({label:'国語',supportsExamScore:true,supportsYears:true}),
    math:Object.freeze({label:'数学',supportsExamScore:true,supportsYears:true}),
    english:Object.freeze({label:'英語',supportsExamScore:true,supportsYears:true}),
    listening:Object.freeze({label:'リスニング',supportsExamScore:false,supportsYears:false}),
    vocab:Object.freeze({label:'英単語',supportsExamScore:false,supportsYears:false}),
  }),
  access: Object.freeze({
    teamDomain:'https://fyam8.cloudflareaccess.com',
    audience:'a3aedeb57c70a1a92916bc9d6e642daa520319bcf77c876ace8e837df8cd0244',
  }),
});

export const APP_CONFIG = Object.freeze({
  kokugo:{label:'国語',supportsExamScore:true,supportsYears:true},
  math:{label:'数学',supportsExamScore:true,supportsYears:true},
  english:{label:'英語',supportsExamScore:true,supportsYears:true},
  listening:{label:'リスニング',supportsExamScore:false,supportsYears:false},
  vocab:{label:'英単語',supportsExamScore:false,supportsYears:false},
});

export const APP_IDS = Object.freeze(Object.keys(APP_CONFIG));
export const APP_ID_SET = new Set(APP_IDS);

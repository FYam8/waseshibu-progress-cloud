// Explicit answer-only fields. Whole learner state and arbitrary metadata remain forbidden.
export const ANSWER_LIMITS=Object.freeze({questionLabel:240,questionText:1000,answerText:1400,expectedText:1400,mistakeReason:700,gradingMethod:80,sourceQuestionId:200});
export const ANSWER_FIELDS=Object.freeze(['answerVersion','outcome',...Object.keys(ANSWER_LIMITS)]);
export function validateAnswer(payload,eventType){
  if(!ANSWER_FIELDS.some(k=>Object.hasOwn(payload,k)))return eventType==='answer_record'?{ok:false,code:'invalid_answer_record'}:{ok:true};
  if(eventType!=='answer_record')return {ok:false,code:'payload_field_not_allowed'};
  if(payload.answerVersion!==1||!['correct','wrong','partial','unanswered','ungraded'].includes(payload.outcome)||typeof payload.questionId!=='string'||!payload.questionId||payload.questionId.length>200)return {ok:false,code:'invalid_answer_record'};
  for(const [key,max]of Object.entries(ANSWER_LIMITS))if(payload[key]!==undefined&&(typeof payload[key]!=='string'||payload[key].length>max))return {ok:false,code:'invalid_answer_record'};
  return {ok:true};
}

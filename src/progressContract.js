// Additive, summary-only v2 fields. Existing v1 payloads keep their original contract.
export const PROGRESS_COUNT_FIELDS=Object.freeze([
  'weaknessCount','masteredCount','practiceCount','retentionPending',
  'learningCount','relearningCount','reviewDue','learnedWordCount',
  'foundationMastered','foundationTotal','coreMastered','coreTotal',
  'challengeMastered','challengeTotal',
]);
export const PROGRESS_V2_FIELDS=Object.freeze([
  'progressVersion','examId','session','examStatus','referenceAccuracy',...PROGRESS_COUNT_FIELDS,
]);
export function examDefinitions(profile,appId){
  const app=profile.apps?.[appId];
  if(!app)return [];
  const exams=Array.isArray(profile.exams)?profile.exams:[];
  return Array.isArray(app.examIds)?exams.filter(x=>app.examIds.includes(x.id)):app.supportsYears?exams:[];
}
export function validateProgressFields(payload,profile,appId){
  if(!PROGRESS_V2_FIELDS.some(key=>Object.hasOwn(payload,key)))return {ok:true};
  const invalid={ok:false,code:'invalid_progress_summary'};
  if(payload.progressVersion!==2)return invalid;
  for(const key of PROGRESS_COUNT_FIELDS){
    if(payload[key]!==undefined&&(!Number.isSafeInteger(payload[key])||payload[key]<0||payload[key]>1e7))return invalid;
  }
  for(const tier of ['foundation','core','challenge']){
    const n=payload[tier+'Mastered'],total=payload[tier+'Total'];
    if(n!==undefined&&(total===undefined||n>total))return invalid;
  }
  if(payload.examId!==undefined){
    if(typeof payload.examId!=='string')return invalid;
    const exam=examDefinitions(profile,appId).find(x=>x.id===payload.examId);
    if(!exam)return {ok:false,code:'exam_not_allowed'};
    if(payload.year!==undefined&&String(payload.year)!==String(exam.year))return invalid;
    if(payload.session!==undefined&&payload.session!==exam.session)return invalid;
  }else if(payload.session!==undefined||payload.examStatus!==undefined||payload.referenceAccuracy!==undefined)return invalid;
  if(payload.examStatus!==undefined&&!['notstarted','started','done','holdout'].includes(payload.examStatus))return invalid;
  if(payload.referenceAccuracy!==undefined){
    const {correct,total,referenceAccuracy:accuracy}=payload;
    if(!Number.isSafeInteger(correct)||!Number.isSafeInteger(total)||total<=0||correct<0||correct>total||total>1e7||typeof accuracy!=='number'||!Number.isFinite(accuracy)||accuracy<0||accuracy>100||Math.abs(accuracy-correct/total*100)>0.51)return invalid;
    // Never mix an unofficial item-based accuracy with a points authority.
    if(payload.score!==undefined||payload.maxScore!==undefined)return invalid;
  }
  return {ok:true};
}
export function applyProgressSummary(app,rows,profile){
  const metrics=rows.find(x=>x.source_record_id==='state:summary'&&x.payload?.progressVersion===2);
  if(metrics){
    app.progressMetrics={};
    for(const key of PROGRESS_COUNT_FIELDS)if(metrics.payload[key]!==undefined)app.progressMetrics[key]=metrics.payload[key];
  }
  if(!metrics){
    const legacy=profile.apps?.[app.appId]?.legacyMetrics||{};
    for(const [key,mapping] of Object.entries(legacy)){
      if(!PROGRESS_COUNT_FIELDS.includes(key))continue;
      const p=rows.find(row=>row.source_record_id===mapping.source)?.payload;
      const value=p?.[mapping.field],subtract=mapping.subtract?p?.[mapping.subtract]:0;
      if(Number.isSafeInteger(value)&&Number.isSafeInteger(subtract)&&value>=subtract&&subtract>=0){app.progressMetrics??={};app.progressMetrics[key]=value-subtract;}
    }
  }
  const allowed=new Set(examDefinitions(profile,app.appId).map(x=>x.id));
  const states=rows.filter(x=>x.payload?.progressVersion===2&&allowed.has(x.payload.examId)&&x.source_record_id==='state:exam:'+x.payload.examId);
  if(states.length){
    app.exams={};
    for(const row of states){
      const p=row.payload;
      app.exams[p.examId]={status:p.examStatus||'started'};
      if(p.referenceAccuracy!==undefined)Object.assign(app.exams[p.examId],{correct:p.correct,total:p.total,referenceAccuracy:p.correct/p.total*100});
    }
  }
  const latest=rows.find(x=>x.source_record_id==='state:latest-exam'&&x.payload?.progressVersion===2);
  if(latest&&latest.payload.referenceAccuracy!==undefined&&latest.payload.completed!==false){
    const p=latest.payload;
    app.latestExam={examId:p.examId,year:p.year??null,session:p.session??null,occurredAt:latest.occurred_at,correct:p.correct,total:p.total,referenceAccuracy:p.correct/p.total*100,kind:'reference'};
  }
}
export function mergeProgressSummary(target,part){
  if(part.progressMetrics){
    target.progressMetrics??={};
    for(const key of PROGRESS_COUNT_FIELDS)if(part.progressMetrics[key]!==undefined)target.progressMetrics[key]=(target.progressMetrics[key]||0)+part.progressMetrics[key];
  }
  if(part.exams){
    target.exams??={};
    const rank={notstarted:0,holdout:1,started:2,done:3};
    for(const [id,value] of Object.entries(part.exams))if(!target.exams[id]||rank[value.status]>rank[target.exams[id].status])target.exams[id]=value;
  }
}

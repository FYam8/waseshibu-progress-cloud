// Pure formatting shared by the browser dashboard and executable tests.
export function createProgressFormatter(examDefinitions){
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function referenceExam(exam){
    if(!exam||!Number.isInteger(exam.correct)||!Number.isInteger(exam.total)||exam.total<=0||exam.correct<0||exam.correct>exam.total)return '—';
    const label=examDefinitions.find(x=>x.id===exam.examId)?.label||exam.examId||'';
    return label+' '+exam.correct+' / '+exam.total+'問・参考正答率 '+Math.round(exam.correct/exam.total*100)+'%';
  }
  function today(lastLearningAt,now=new Date(),evidence={}){
    if(!lastLearningAt||Date.parse(lastLearningAt)<=0){
      if(evidence.hasLearningRecords||Number(evidence.recordCount)>0)return '学習日時不明';
      return evidence.hasSyncedProgress?'今日の記録なし':'未同期';
    }
    const at=new Date(lastLearningAt);
    if(!Number.isFinite(at.getTime())||at>now)return '学習日時を確認';
    return at.getFullYear()===now.getFullYear()&&at.getMonth()===now.getMonth()&&at.getDate()===now.getDate()?'✅ 今日':'今日の記録なし';
  }
  function extra(app){
    const parts=[];
    if(app.exams){
      const labels={notstarted:'－ 未着手',started:'▶ 途中',done:'✅ 完了',holdout:'HOLDOUT'};
      parts.push('<div class="years">'+examDefinitions.filter(x=>Object.hasOwn(app.exams,x.id)).map(x=>{
        const state=app.exams[x.id],status=Object.hasOwn(labels,state.status)?state.status:'notstarted';
        return '<div class="year '+status+'"><b>'+esc(x.label)+'</b><br>'+labels[status]+'</div>';
      }).join('')+'</div>');
    }
    const metrics=app.progressMetrics;
    if(metrics){
      const labels={weaknessCount:'残っている弱点',masteredCount:'克服済み',practiceCount:'補強の学習記録',retentionPending:'翌日確認の残り',learnedWordCount:'学習語数',learningCount:'学習中',relearningCount:'再学習中',reviewDue:'復習期限到来'};
      const rows=Object.entries(labels).filter(([key])=>Number.isFinite(metrics[key])).map(([key,label])=>'<div class="metric">'+label+'<b>'+metrics[key]+'</b></div>');
      for(const [tier,label] of [['foundation','Foundation'],['core','Core'],['challenge','Challenge']]){
        if(Number.isFinite(metrics[tier+'Mastered'])&&Number.isFinite(metrics[tier+'Total']))rows.push('<div class="metric">'+label+'<b>'+metrics[tier+'Mastered']+' / '+metrics[tier+'Total']+'</b></div>');
      }
      if(rows.length)parts.push('<div class="summary">'+rows.join('')+'</div>');
    }
    return parts.join('');
  }
  return {referenceExam,today,extra};
}

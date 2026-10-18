import test from 'node:test';
import assert from 'node:assert/strict';
import {validateAnswer} from '../src/answerContract.js';
test('answer records require explicit identity, outcome and bounded text',()=>{
 const p={answerVersion:1,questionId:'Q1',outcome:'wrong',answerText:'x',expectedText:'y'};
 assert.equal(validateAnswer(p,'answer_record').ok,true);
 for(const bad of [{...p,answerText:{secret:'not allowed'}},{...p,questionId:''},{...p,outcome:'guessed'},{...p,answerText:'x'.repeat(1401)},{...p,answerVersion:2}])assert.equal(validateAnswer(bad,'answer_record').ok,false);
 assert.equal(validateAnswer(p,'progress_state').ok,false);
 assert.equal(validateAnswer({},'answer_record').ok,false);
 assert.equal(validateAnswer({total:1},'progress_state').ok,true);
});

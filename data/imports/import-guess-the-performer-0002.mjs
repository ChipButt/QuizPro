import {readFileSync,writeFileSync,existsSync,mkdirSync,copyFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const slug='guess-the-performer-0002', title='Guess the Performer – 0002';
const root='assets/picture-rounds/'+slug+'/';
const libraryPath='data/quiz-library.json';
const expected=['Eddie Redmayne','Jennifer Lawrence','Zendaya','Judi Dench','Zac Efron','Jake Gyllenhaal','Scarlett Johansson','Emilia Clarke','Matt Damon','Mckenna Grace'];
if(!existsSync(root+'manifest.json')){console.log('Awaiting approved media manifest');process.exit(0);}
const m=JSON.parse(readFileSync(root+'manifest.json','utf8'));
if(m.slug!==slug||m.title!==title||m.category!=='Picture'||m.questions?.length!==10||m.questions.some((q,i)=>q.number!==i+1||q.performer!==expected[i]||q.width!==([5,6,7,8].includes(i)?600:1254)||q.height!==q.width))throw Error('Manifest does not match approved round');
for(const q of m.questions)for(const k of ['question','answer']){
 const a=q[k], filename=q.performer.toLowerCase().replaceAll(' ','-')+'-'+k+'.webp';
 if(a.filename!==filename||!(/^[a-f0-9]{64}$/).test(a.sha256))throw Error('Invalid asset descriptor '+filename);
 if(!existsSync(root+filename)){console.log('Awaiting '+filename);process.exit(0);}
 const b=readFileSync(root+filename);
 if(b.length!==a.bytes||createHash('sha256').update(b).digest('hex')!==a.sha256||b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WEBP')throw Error('Asset validation failed: '+filename);
}
const library=JSON.parse(readFileSync(libraryPath,'utf8'));
if(!Array.isArray(library.roundLibrary)||!Array.isArray(library.quizzes)||!Array.isArray(library.media))throw Error('Unexpected library format');
const id='saved-round-'+slug, base='https://chipbutt.github.io/QuizPro/'+root;
const questions=m.questions.map(q=>({id:'question-'+slug+'-'+String(q.number).padStart(2,'0'),number:q.number,text:'Which actor or performer is represented by this image?',answer:q.performer,alternatives:[],points:1,type:'Picture',options:[],category:'',difficulty:'Medium',image:base+q.question.filename,imageName:q.question.filename,audio:'',audioName:'',answerImage:base+q.answer.filename,answerImageName:q.answer.filename,answerAudio:'',answerAudioName:'',notes:'',timeLimit:60,autoMark:true}));
const existing=library.roundLibrary.find(r=>r.id===id||r.title===title);
if(existing){if(existing.id!==id||existing.title!==title||existing.questions?.length!==10||existing.questions.some((q,i)=>['answer','image','answerImage'].some(k=>q[k]!==questions[i][k])))throw Error('Conflicting existing round; no overwrite');}
mkdirSync('public/'+root,{recursive:true});
for(const q of m.questions)for(const k of ['question','answer'])copyFileSync(root+q[k].filename,'public/'+root+q[k].filename);
if(!existing){const stamp=new Date().toISOString();library.roundLibrary.push({id,title,type:'Picture round',answerMode:'text',choiceCount:4,instructions:'Identify the actor or performer linked by the hidden film and television references in each image.',scoringRules:'1 point per correct performer; 10 points maximum.',category:'Picture',questions,createdAt:stamp,updatedAt:stamp});library.updatedAt=stamp;writeFileSync(libraryPath,JSON.stringify(library,null,2)+'\n');}
console.log('Validated '+title+': 10 questions and 20 approved images');

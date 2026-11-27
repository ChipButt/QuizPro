import { readFileSync, writeFileSync, existsSync } from "node:fs";
const libraryPath="data/quiz-library.json";
const sourcePath="data/imports/world-flags-0001.json";
const source=JSON.parse(readFileSync(sourcePath,"utf8"));
const library=JSON.parse(readFileSync(libraryPath,"utf8"));
const expected=["Jamaica","Ghana","Laos","North Macedonia","South Africa","Argentina","Ukraine","Iceland","Thailand","Greece"];
const id="saved-round-world-flags-0001", title="World Flags – 0001";
const root="assets/picture-rounds/world-flags-0001/";
if(source.slug!=="world-flags-0001"||source.title!==title||!Array.isArray(source.flags)||source.flags.length!==10||
  source.flags.some((f,i)=>f.number!==i+1||f.country!==expected[i]))throw Error("Approved flags source or order does not match locked decisions.");
if(!Array.isArray(library.quizzes)||!Array.isArray(library.roundLibrary)||!Array.isArray(library.media))throw Error("Unexpected QuizPro library format.");
const current=library.roundLibrary.find(r=>r.id===id);
if(current){if(current.title!==title||current.questions?.length!==10||current.questions.some((q,i)=>q.answer!==expected[i]||q.imageName!==source.flags[i].filename))throw Error("Existing saved round differs from approved flags. Refusing overwrite.");console.log("Already correctly imported: "+title);process.exit(0);}
if(library.roundLibrary.some(r=>r.title===title))throw Error("A different round already uses the approved title.");
for(const flag of source.flags){
 for(const p of ["public/"+root+flag.filename,root+flag.filename]){
  if(!existsSync(p)||!readFileSync(p,"utf8").includes("<svg"))throw Error("Missing or invalid flag image "+p);
 }
}
const stamp=new Date().toISOString();
const questions=source.flags.map((flag,i)=>({
 id:"question-world-flags-0001-"+String(i+1).padStart(2,"0"),
 number:i+1,
 text:"Which country is represented by flag "+(i+1)+"?",
 answer:flag.country,
 alternatives:[],
 points:1,
 type:"Picture",
 options:[],
 category:"",
 difficulty:"Medium",
 image:"https://chipbutt.github.io/QuizPro/"+root+flag.filename,
 imageName:flag.filename,
 audio:"",audioName:"",
 answerImage:"",answerImageName:"",
 answerAudio:"",answerAudioName:"",
 notes:"",
 timeLimit:60,
 autoMark:true
}));
library.roundLibrary.push({
 id,title,type:"Picture round",answerMode:"text",choiceCount:4,
 instructions:"Identify the country represented by each national flag.",
 scoringRules:"1 point for each correct country; 10 points maximum.",
 category:"Picture",
 questions,createdAt:stamp,updatedAt:stamp
});
library.updatedAt=stamp;
writeFileSync(libraryPath,JSON.stringify(library,null,2)+"\n","utf8");
console.log(JSON.stringify({status:"imported",round:title,questionCount:questions.length,libraryRoundCount:library.roundLibrary.length,quizCount:library.quizzes.length}));

import fs from "node:fs";
import path from "node:path";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../..");
const directory=path.join(root,"data/media-processing");
const server=path.join(root,"server");
const python=path.join(root,".venv-media",process.platform==="win32"?"Scripts/python.exe":"bin/python");
const read=file=>JSON.parse(fs.readFileSync(path.join(directory,file),"utf8"));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const status=(stage,extra={})=>{
  const value={stage,pid:process.pid,updatedAt:new Date().toISOString(),...extra};
  const temporary=path.join(directory,"finish-status.part");
  fs.writeFileSync(temporary,JSON.stringify(value,null,2));
  fs.renameSync(temporary,path.join(directory,"finish-status.json"));
  console.log(JSON.stringify(value));
};
const alive=pid=>{try{process.kill(pid,0);return true;}catch(error){return error.code==="EPERM";}};
const run=(executable,args,cwd=server)=>new Promise((resolve,reject)=>{
  const child=spawn(executable,args,{cwd,stdio:"inherit",windowsHide:true});
  child.on("error",reject);
  child.on("exit",code=>code===0?resolve():reject(new Error(`${path.basename(executable)} ${args[0]} exited with ${code}`)));
});

// This coordinator never kills an existing worker. After workers finish, it
// resumes any incomplete scan, retries failures, uploads and verifies every
// output hash before the image-only database transaction.
const workerPids=(process.argv.find(arg=>arg.startsWith("--worker-pids="))?.split("=")[1]||"").split(",").map(Number).filter(pid=>Number.isSafeInteger(pid)&&pid>0);
try{
  status("waiting-for-image-workers",{workerPids});
  while(workerPids.some(alive))await sleep(5000);
  let complete;
  try{complete=read("processing-complete.json");}catch{}
  if(!complete){
    status("resuming-image-scan");
    await run(python,["tools/media/process_catalog.py","--gallery-only","--cpu","--workers","3"],root);
    complete=read("processing-complete.json");
  }
  for(let attempt=0;complete.failed&&attempt<3;attempt++){
    status("retrying-source-failures",{attempt:attempt+1,failed:complete.failed});
    await run(python,["tools/media/process_catalog.py","--gallery-only","--retry-errors","--cpu","--workers","2"],root);
    complete=read("processing-complete.json");
  }
  if(complete.total!==read("plan.json").assets.length||complete.failed)throw new Error("Image scan is incomplete; original live images remain in place");
  status("checking-repeated-watermarks");
  await run(python,["tools/media/complete_watermarks.py","--workers","2"],root);
  status("uploading-final-images");
  await run(process.execPath,["scripts/uploadProductMedia.js"]);
  if(read("upload-failures.json").length)throw new Error("Some edited images have not uploaded; database application withheld");
  if(!fs.existsSync(path.join(directory,"applied.json"))){
    status("applying-image-urls");
    await run(process.execPath,["scripts/applyProductMedia.js","--apply","--database=vouges"]);
  }
  status("verifying-catalog");
  await run(process.execPath,["scripts/verifyProductMedia.js"]);
  status("complete",{report:read("applied.json"),verification:read("verification.json")});
}catch(error){
  status("failed",{error:error.message});
  process.exitCode=1;
}

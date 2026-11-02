// Read-only preview by default. Explicit apply is resumable and preserves Admin edits.
import "dotenv/config";
import mongoose from "mongoose";
import {createHash,randomUUID} from "node:crypto";
import {mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import User from "../models/User.js";
import Order from "../models/Order.js";
import {loyaltyModels,LoyaltyConfig,LoyaltyReward,LoyaltyLedger,LoyaltyAccount,LoyaltyOrder} from "../models/Loyalty.js";
import {defaultPolicy,eligibleAmount} from "../services/loyalty/policy.js";
import {transaction,audit,reconcileUser} from "../services/loyalty/engine.js";

const apply=process.argv.includes("--apply"),database=process.argv.find(value=>value.startsWith("--database="))?.split("=")[1];
if(database!=="vouges")throw Error("Explicit --database=vouges is required, including previews");
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"../.."),stamp=new Date().toISOString().replace(/[:.]/g,"-");
const digest=rows=>createHash("sha256").update(JSON.stringify(rows)).digest("hex");
const report={at:new Date().toISOString(),database,mode:apply?"apply":"preview",historicalMode:"all",thresholdsVnd:[0,15000000,40000000,100000000],rates:[10,12,15,20]};
try{
  await mongoose.connect(process.env.MONGO_URI,{dbName:database,autoIndex:false,autoCreate:false,serverSelectionTimeoutMS:15000});
  if(mongoose.connection.db.databaseName!==database)throw Error("Unexpected database");
  const ordersBefore=await Order.collection.find({}).sort({_id:1}).toArray();
  const eligible=ordersBefore.filter(order=>eligibleAmount(order)>0),users=await User.find({role:{$ne:"owner"}}).select("_id").sort({_id:1}).lean();
  report.customers=users.length;report.eligibleHistoricalOrders=eligible.length;report.eligibleHistoricalGrossVnd=eligible.reduce((sum,row)=>sum+eligibleAmount(row),0);
  const prior=await LoyaltyConfig.findById("program").lean();report.policyAlreadyExists=Boolean(prior);
  if(apply){
    const backup=path.join(root,".backups","loyalty-"+stamp);await mkdir(backup,{recursive:true});
    const existing=new Set((await mongoose.connection.db.listCollections().toArray()).map(row=>row.name));
    for(const Model of loyaltyModels){
      const rows=existing.has(Model.collection.collectionName)?await Model.collection.find({}).toArray():[];
      await writeFile(path.join(backup,Model.collection.collectionName+".json"),JSON.stringify(rows,null,2),"utf8");
      if(!existing.has(Model.collection.collectionName))await Model.createCollection();
      await Model.createIndexes();
    }
    await Order.createIndexes();
    await transaction(async session=>{
      if(!await LoyaltyConfig.exists({_id:"program"}).session(session)){
        const policy={...defaultPolicy(),enabled:true,version:1,activatedAt:new Date()};
        await LoyaltyConfig.create([policy],{session});
        await audit(session,"system:loyalty-bootstrap","policy-initialize","program","User confirmed 15/40/100 million VND thresholds and eligible historical sales plus points backfill.",null,policy);
      }
      const samples=[
        ["6a0000000000000000000101","Mẫu quà khám phá",100],
        ["6a0000000000000000000102","Mẫu bộ quà trải nghiệm",250],
        ["6a0000000000000000000103","Mẫu quà tri ân",500],
      ];
      for(const [id,name,points] of samples){
        if(await LoyaltyReward.exists({_id:id}).session(session))continue;
        const row={_id:id,name,description:"Dữ liệu mẫu. Admin cần thay bằng quà thực tế, xác nhận hình ảnh, điều kiện, giá vốn và tồn kho trước khi mở đổi.",image:"",points,costVnd:0,stock:0,perCustomerLimit:1,tierIds:defaultPolicy().tiers.map(tier=>tier.id),active:false,version:0};
        await LoyaltyReward.create([row],{session});await audit(session,"system:loyalty-bootstrap","reward-sample",id,"Inactive sample; no real inventory or service promised.",null,row);
      }
    });
    let processed=0;for(const user of users){await reconcileUser(user._id);processed++;}
    report.enrolled=processed;report.orderCredits=await LoyaltyOrder.countDocuments();report.pointGrants=await LoyaltyLedger.countDocuments({kind:"grant"});
    report.totalEarnedPoints=(await LoyaltyAccount.aggregate([{$group:{_id:null,total:{$sum:"$earned"}}}]))[0]?.total||0;
    report.policy=await LoyaltyConfig.findById("program").select("enabled version tiers.id tiers.thresholdVnd tiers.rate").lean();
    report.ordersUnchanged=digest(ordersBefore)===digest(await Order.collection.find({}).sort({_id:1}).toArray());
    report.completed=true;report.runId=randomUUID();report.backup=path.relative(root,backup).replaceAll("\\","/");
    const output=path.join(root,"data","loyalty-2026-11-02");await mkdir(output,{recursive:true});
    await writeFile(path.join(output,"initialization.json"),JSON.stringify(report,null,2)+"\n","utf8");
  }
  console.log(JSON.stringify(report,null,2));
}finally{await mongoose.disconnect();}

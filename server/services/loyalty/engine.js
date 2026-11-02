import mongoose from "mongoose";
import {createHash,randomUUID} from "node:crypto";
import User from "../../models/User.js";
import Order from "../../models/Order.js";
import {LoyaltyAccount,LoyaltyConfig,LoyaltyLot,LoyaltyLedger,LoyaltyTierHistory,LoyaltyAudit,LoyaltyOrder,LoyaltyNotification,LoyaltyClaim,LoyaltyRedemption,LoyaltyReward} from "../../models/Loyalty.js";
import {addMonths,defaultPolicy,eligibleAmount,integer,LoyaltyError,pointsFor,text,tierFor,validatePolicy} from "./policy.js";
import {expireLots,grantPoints,reverseOrderPoints,spendPoints,walletSummary} from "./wallet.js";

export const keyFor=(...parts)=>createHash("sha256").update(JSON.stringify(parts)).digest("hex");
export const requestKey=value=>{if(typeof value!=="string"||!/^[a-zA-Z0-9_-]{12,100}$/.test(value))throw new LoyaltyError("Thiếu mã yêu cầu hợp lệ. Vui lòng tải lại và thử lại.");return value;};
export const getPolicy=async(session)=>{
  const query=LoyaltyConfig.findById("program").lean();return await(session?query.session(session):query)||defaultPolicy();
};
export const audit=async(session,actorId,action,subject,reason,before,after)=>{
  await LoyaltyAudit.create([{_id:randomUUID(),actorId,action,subject,reason,before,after,at:new Date()}],{session});
};
export const transaction=async callback=>{
  for(let attempt=0;attempt<4;attempt++){
    const session=await mongoose.startSession();
    try{let result;await session.withTransaction(async()=>{result=await callback(session);});return result;}
    catch(error){if(error.code!==11000||attempt===3)throw error;}
    finally{await session.endSession();}
  }
};
export const savePolicy=async(value,actorId)=>{
  const normalized=validatePolicy(value),version=integer(value.version,"Phiên bản chính sách");
  return transaction(async session=>{
    const before=await getPolicy(session);
    if(before.version!==version)throw new LoyaltyError("Chính sách đã thay đổi. Vui lòng tải lại.",409);
    const after=await LoyaltyConfig.findOneAndUpdate({_id:"program",version},{$set:{...normalized,activatedAt:before.activatedAt||(normalized.enabled?new Date():null)},$inc:{version:1}},{session,upsert:version===0,returnDocument:'after',runValidators:true});
    if(!after)throw new LoyaltyError("Chính sách đã thay đổi.",409);
    await audit(session,actorId,"policy","program",text(value.reason,"Lý do thay đổi",500),before,after.toObject());return after;
  });
};
export const notify=async(context,id,title,message)=>{
  await LoyaltyNotification.updateOne({_id:keyFor(context.userId,id)},{$setOnInsert:{userId:context.userId,title,message,createdAt:context.now}},{session:context.session,upsert:true});
};
export const append=async(context,event,id=randomUUID())=>{
  await LoyaltyLedger.create([{_id:id,userId:context.userId,at:context.now,actorId:context.actorId,...event}],{session:context.session});
};
const setTier=async(context,tier,at,kind,reason,actorId="system",expiry=addMonths(at))=>{
  const {account,session,userId}=context,from=account.tierId;
  if(kind!=="extend")account.achievedAt=new Date(at);
  account.tierId=tier.id;account.expiresAt=new Date(expiry);
  const id=randomUUID();
  await LoyaltyTierHistory.create([{_id:id,userId,kind,from,to:tier.id,achievedAt:account.achievedAt,expiresAt:account.expiresAt,salesVnd:context.salesVnd||0,at,actorId,reason}],{session});
  await notify(context,id,kind==="upgrade"?`Chúc mừng bạn đạt hạng ${tier.name}`:kind==="renew"?`Đã gia hạn hạng ${tier.name}`:"Cập nhật hạng thành viên",`Hạng ${tier.name} có hiệu lực đến ${account.expiresAt.toLocaleDateString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"})}. Xem quyền lợi và điều kiện tại trang thành viên.`);
};
export const salesAt=async(context,at)=>{
  const start=addMonths(at,-12);
  const total=context.credits.filter(row=>new Date(row.recognizedAt)>start&&new Date(row.recognizedAt)<=at).reduce((sum,row)=>{
    const refunded=(row.initialRefundedVnd||0)+context.refunds.filter(event=>event.data.orderId===String(row._id)&&new Date(event.at)<=at).reduce((amount,event)=>amount+event.data.refundVnd,0);
    return sum+Math.max(0,row.grossVnd-refunded);
  },0);
  return integer(total,"Doanh số tích lũy");
};
const review=async(context,at)=>{
  const {account,policy}=context;let cycles=0;
  while(new Date(account.expiresAt)<=at){
    if(++cycles>100)throw new LoyaltyError("Lịch sử ngày tháng cần được quản trị viên kiểm tra.",409);
    const boundary=new Date(account.expiresAt);context.salesVnd=await salesAt(context,boundary);
    account.tierReviewedAt=null;
    const target=tierFor(policy.tiers,context.salesVnd),current=policy.tiers.findIndex(tier=>tier.id===account.tierId),next=policy.tiers.findIndex(tier=>tier.id===target.id);
    await setTier(context,target,boundary,next<current?"downgrade":next>current?"upgrade":"renew","Tái xét doanh số hợp lệ tại ngày hết hạn hạng.");
  }
  context.salesVnd=await salesAt(context,at);
  const target=tierFor(policy.tiers,context.salesVnd);
  // A manual review must survive reads and cron replays of the same sales.
  // A new eligible completion or the next expiry resumes automatic evaluation.
  if(account.tierReviewedAt){
    if(!context.credits.some(row=>new Date(row.recognizedAt)>new Date(account.tierReviewedAt)&&new Date(row.recognizedAt)<=at))return;
    account.tierReviewedAt=null;
  }
  if(policy.tiers.findIndex(tier=>tier.id===target.id)>policy.tiers.findIndex(tier=>tier.id===account.tierId))await setTier(context,target,at,"upgrade","Đạt ngưỡng doanh số của hạng mới.");
};
export const flush=async context=>{
  for(const lot of context.lots){if(context.initialLots.get(lot._id)===JSON.stringify(lot))continue;const { _id,...fields}=lot;await LoyaltyLot.updateOne({_id,userId:context.userId},{$set:{...fields,userId:context.userId}},{session:context.session,upsert:true,runValidators:true});}
  const {_id,...fields}=context.account;await LoyaltyAccount.updateOne({_id},{$set:fields},{session:context.session,runValidators:true});
};
const recognize=async(context,order)=>{
  const id=String(order._id);
  if(context.credits.some(row=>String(row._id)===id))return;
  const amount=eligibleAmount(order);if(!amount)return;
  const recognizedAt=new Date(order.completedAt||order.updatedAt),dateSource=order.completedAt?"completedAt":"legacy-updatedAt";
  if(!Number.isFinite(recognizedAt.getTime())||recognizedAt>context.now)throw new LoyaltyError("Ngày hoàn tất đơn cũ cần được kiểm tra.",409);
  // Review BEFORE the order, then use that tier's rate for the award.
  await review(context,recognizedAt);
  const tier=context.policy.tiers.find(tier=>tier.id===context.account.tierId),refunded=integer(order.loyaltyRefundedVnd||0,"Doanh số đã hoàn trả",0,amount);
  const accrual=tier.benefits.find(benefit=>benefit.code==="points"),rate=accrual?.enabled&&accrual.availability==="available"?tier.rate:0;
  const points=pointsFor(amount-refunded,rate),lotId=`order:${id}`;
  const refundMatch=refunded?{loyaltyRefundedVnd:refunded}:{$or:[{loyaltyRefundedVnd:0},{loyaltyRefundedVnd:{$exists:false}}]};
  const write=await Order.updateOne({_id:order._id,status:"Delivery",isPaid:true,...refundMatch},{$set:{loyaltyPending:false,loyaltyRefundedVnd:refunded}},{session:context.session});
  if(write.matchedCount!==1)throw new LoyaltyError("Đơn hàng đã thay đổi khi đối soát.",409);
  const credit={_id:id,userId:context.userId,recognizedAt,dateSource,grossVnd:amount,initialRefundedVnd:refunded,refundedVnd:refunded,awarded:points,reversed:0,rate,tierId:tier.id,policyVersion:context.policy.version,lotId};
  await LoyaltyOrder.create([credit],{session:context.session});context.credits.push(credit);
  const event=grantPoints(context.account,context.lots,{id:lotId,points,source:`order:${id}`,at:recognizedAt,asOf:context.now});
  await append(context,{...event,at:recognizedAt,data:{...event.data,orderId:id,tierId:tier.id,rate,eligibleVnd:amount-refunded,dateSource}},keyFor("order",id));
  await review(context,recognizedAt);
};
export const withMember=async(userId,actorId,operation,{references=[],now=new Date(),deferReview=false}={})=>transaction(async session=>{
  const user=await User.findById(userId).session(session).lean();if(!user)throw new LoyaltyError("Không tìm thấy khách hàng.",404);
  const policy=await getPolicy(session);
  const orders=policy.enabled?await Order.find({userId,status:"Delivery",isPaid:true}).session(session).lean():[];
  orders.sort((a,b)=>new Date(a.completedAt||a.updatedAt)-new Date(b.completedAt||b.updatedAt)||String(a._id).localeCompare(String(b._id)));
  const startsAt=orders.length?new Date(Math.min(now.getTime(),new Date(orders[0].completedAt||orders[0].updatedAt).getTime())):new Date(Math.min(now.getTime(),Math.max(new Date(user.createdAt||now).getTime(),new Date(policy.activatedAt||now).getTime())));
  const account=await LoyaltyAccount.findOneAndUpdate({_id:userId},{$setOnInsert:{tierId:policy.tiers[0].id,achievedAt:startsAt,expiresAt:addMonths(startsAt)},$inc:{version:1}},{session,upsert:true,returnDocument:'after',setDefaultsOnInsert:true}).lean();
  const claims=await LoyaltyClaim.find({userId,orderId:{$ne:null},status:"Granted"}).select("_id").session(session).lean();
  const refs=[...references,...orders.map(order=>`order:${order._id}`),...claims.map(claim=>`campaign:${claim._id}`)];
  const lots=await LoyaltyLot.find({userId,$or:[{remaining:{$gt:0}},{_id:{$in:refs}}]}).session(session).lean();
  const credits=await LoyaltyOrder.find({userId}).session(session).lean(),refunds=await LoyaltyLedger.find({userId,kind:"refund"}).select("at data.orderId data.refundVnd").session(session).lean();
  const context={user,userId,actorId,policy,account,lots,session,now,orders,salesVnd:0,credits,refunds,initialLots:new Map(lots.map(lot=>[lot._id,JSON.stringify(lot)]))};
  if(policy.enabled){for(const order of orders)await recognize(context,order);if(!deferReview)await review(context,now);}
  for(const event of expireLots(account,lots,now))await append(context,event);
  account.backfillComplete=policy.enabled;
  const result=await operation(context);
  await flush(context);
  return result;
});
export const memberSummary=async context=>{
  const {account,policy,now}=context,salesVnd=await salesAt(context,now),index=policy.tiers.findIndex(tier=>tier.id===account.tierId),next=policy.tiers[index+1]||null;
  const catalog=policy.tiers[index].benefits.find(benefit=>benefit.code==="rewards");
  return {userId:context.userId,programEnabled:policy.enabled,canRedeem:policy.enabled&&Boolean(catalog?.enabled)&&catalog.availability==="available",tier:policy.tiers[index],tiers:policy.tiers,achievedAt:account.achievedAt,expiresAt:account.expiresAt,salesVnd,nextTier:next?{id:next.id,name:next.name,thresholdVnd:next.thresholdVnd,remainingVnd:Math.max(0,next.thresholdVnd-salesVnd)}:null,points:walletSummary(account,context.lots,now),policyVersion:policy.version};
};
export const reconcileUser=(userId)=>withMember(userId,"system",memberSummary);
export const loyaltyHooks={reconcile:reconcileUser};
export const adjustPoints=async(userId,actorId,value)=>{
  const points=value.points;if(!Number.isSafeInteger(points))throw new LoyaltyError("Số điểm phải là số nguyên.");integer(Math.abs(points),"Số điểm",1,1000000);const reason=text(value.reason,"Lý do điều chỉnh",500),key=requestKey(value.requestId),id=keyFor("adjust",userId,key);
  return withMember(userId,actorId,async context=>{
    const existing=await LoyaltyLedger.findById(id).session(context.session).lean();
    if(existing){if(existing.delta!==points||existing.reason!==reason)throw new LoyaltyError("Mã yêu cầu đã được dùng cho nội dung khác.",409);return memberSummary(context);}
    const before=walletSummary(context.account,context.lots,context.now);
    let event;
    if(points>0)event=grantPoints(context.account,context.lots,{id:`admin:${id}`,points,source:"admin",at:context.now});
    else event={kind:"admin-debit",delta:points,data:spendPoints(context.account,context.lots,-points,context.now,{allowDebt:true})};
    await append(context,{...event,reason,source:"admin"},id);await audit(context.session,actorId,"points",userId,reason,before,walletSummary(context.account,context.lots,context.now));return memberSummary(context);
  });
};
export const adjustTier=async(userId,actorId,value)=>withMember(userId,actorId,async context=>{
  const reason=text(value.reason,"Lý do điều chỉnh hạng",500),before={...context.account};
  const id=keyFor("manual-tier",userId,requestKey(value.requestId)),fingerprint=keyFor(value.action,value.tierId,value.months,reason);
  const existing=await LoyaltyLedger.findById(id).session(context.session).lean();if(existing){if(existing.data.fingerprint!==fingerprint)throw new LoyaltyError("Mã yêu cầu đã sử dụng.",409);return memberSummary(context);}
  const tier=context.policy.tiers.find(tier=>tier.id===(value.action==="extend"?context.account.tierId:value.tierId));if(!tier)throw new LoyaltyError("Hạng không hợp lệ.");
  const expiry=value.action==="extend"?addMonths(new Date(Math.max(context.now.getTime(),new Date(context.account.expiresAt).getTime())),integer(value.months,"Số tháng gia hạn",1,36)):addMonths(context.now);
  if(!["extend","adjust"].includes(value.action))throw new LoyaltyError("Thao tác hạng không hợp lệ.");
  await setTier(context,tier,context.now,value.action,reason,actorId,expiry);if(value.action==="adjust")context.account.tierReviewedAt=context.now;await append(context,{kind:"tier-admin",delta:0,reason,data:{fingerprint}},id);await audit(context.session,actorId,"tier",userId,reason,before,context.account);return memberSummary(context);
});
export const recordRefund=async(orderId,actorId,value)=>{
  if(!mongoose.isObjectIdOrHexString(orderId))throw new LoyaltyError("Đơn hàng không hợp lệ.");
  const order=await Order.findById(orderId).lean();if(!order)throw new LoyaltyError("Không tìm thấy đơn hàng.",404);
  const amount=integer(value.amountVnd,"Tiền hàng hoàn trả",1),reason=text(value.reason,"Lý do hoàn trả",500),id=keyFor("refund",orderId,requestKey(value.requestId));
  return withMember(order.userId,actorId,async context=>{
    const existing=await LoyaltyLedger.findById(id).session(context.session).lean();if(existing){if(existing.data.refundVnd!==amount||existing.reason!==reason)throw new LoyaltyError("Mã yêu cầu hoàn trả đã được sử dụng.",409);return memberSummary(context);}
    const credit=await LoyaltyOrder.findById(orderId).session(context.session);
    if(!credit)throw new LoyaltyError("Đơn chưa đủ điều kiện ghi nhận doanh số.",409);
    const total=credit.refundedVnd+amount;if(total>credit.grossVnd)throw new LoyaltyError("Số tiền hoàn trả vượt quá tiền hàng còn lại.");
    const lot=context.lots.find(lot=>lot._id===credit.lotId);if(!lot)throw Error("Missing original order lot");
    const points=Math.max(0,credit.awarded-credit.reversed-pointsFor(credit.grossVnd-total,credit.rate));
    const event=reverseOrderPoints(context.account,lot,points,{lots:context.lots,now:context.now});credit.refundedVnd=total;credit.reversed+=points;await credit.save({session:context.session});
    const write=await Order.updateOne({_id:orderId,loyaltyRefundedVnd:total-amount},{$set:{loyaltyRefundedVnd:total}},{session:context.session});if(write.matchedCount!==1)throw new LoyaltyError("Thông tin hoàn trả đã thay đổi.",409);
    await append(context,{...event,reason,data:{...event.data,orderId,refundVnd:amount,totalRefundedVnd:total}},id);
    context.refunds.push({at:context.now,data:{orderId,refundVnd:amount}});
    const claims=await LoyaltyClaim.find({userId:context.userId,orderId,status:"Granted"}).session(context.session);
    for(const claim of claims){
      if(credit.grossVnd-total>=(claim.benefit.qualifyingMinVnd||0))continue;
      let adjustment={kind:"campaign-revoke",delta:0,data:{orderId,claimId:claim._id}};
      if(claim.benefit.type==="points"){
        const bonus=context.lots.find(lot=>lot._id===`campaign:${claim._id}`);if(!bonus)throw Error("Missing campaign points lot");
        const reversal=reverseOrderPoints(context.account,bonus,bonus.issued,{lots:context.lots,now:context.now});
        adjustment={...reversal,kind:"campaign-revoke",data:{...reversal.data,orderId,claimId:claim._id}};
      }
      claim.status="Revoked";
      if(claim.benefit.type==="gift"){
        const request=await LoyaltyRedemption.findById(claim.benefit.redemptionId).session(context.session);
        if(request&&["Pending","Confirmed"].includes(request.status)){request.status="Cancelled";request.reason="Đơn điều kiện đã hoàn trả, không còn đạt mức tối thiểu.";request.actorId=actorId;request.updatedAt=context.now;await request.save({session:context.session});await LoyaltyReward.updateOne({_id:request.rewardId},{$inc:{stock:1,version:1}},{session:context.session});}
        else if(request?.status==="Fulfilled")claim.status="ReviewRequired";
      }
      await claim.save({session:context.session});await append(context,{...adjustment,source:claim._id,reason:"Đơn không còn đáp ứng điều kiện chiến dịch sau hoàn trả."},keyFor("revoke-claim",claim._id));
      await audit(context.session,actorId,"campaign-refund-review",claim._id,reason,{status:"Granted"},{status:claim.status,orderId});
      await notify(context,`revoke:${claim._id}`,"Đối soát quyền lợi sau hoàn trả","Đơn điều kiện không còn đủ doanh số. Quyền lợi liên quan đã được điều chỉnh hoặc chuyển cửa hàng xem xét.");
    }
    await audit(context.session,actorId,"refund",orderId,reason,{refundedVnd:total-amount},{refundedVnd:total,pointsReversed:points});
    // Refunds adjust points/sales immediately. A downgrade still requires expiry or owner review.
    if(context.policy.enabled)await review(context,context.now);context.salesVnd=await salesAt(context,context.now);return memberSummary(context);
  },{references:[`order:${orderId}`],deferReview:true});
};

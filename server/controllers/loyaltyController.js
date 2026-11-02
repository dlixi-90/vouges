import crypto from "node:crypto";
import User from "../models/User.js";
import Order from "../models/Order.js";
import {LoyaltyAccount,LoyaltyReward,LoyaltyRedemption,LoyaltyCampaign,LoyaltyClaim,LoyaltyLedger,LoyaltyTierHistory,LoyaltyNotification,LoyaltyAudit,LoyaltyJob} from "../models/Loyalty.js";
import {getPolicy,savePolicy,withMember,memberSummary,adjustPoints,adjustTier,recordRefund,notify,reconcileUser} from "../services/loyalty/engine.js";
import {saveReward,saveCampaign,redeem,updateRedemption,claimCampaign,campaignEligibility,publicReward,publicRedemption,campaignOrderOptions} from "../services/loyalty/rewards.js";
import {birthdayWindow} from "../utils/membership.js";
import {integer,LoyaltyError,eligibleAmount,text} from "../services/loyalty/policy.js";
import {transaction,audit} from "../services/loyalty/engine.js";

const handler=operation=>async(req,res,next)=>{
  res.set("Cache-Control","private, no-store");
  try{res.json({success:true,...await operation(req)});}catch(error){if(error.statusCode)return res.status(error.statusCode).json({success:false,message:error.message});if(error.code===11000)return res.status(409).json({success:false,message:"Yêu cầu vừa được xử lý. Vui lòng tải lại."});next(error);}
};
const pageOf=req=>integer(Number(req.query.page||1),"Trang",1,100000);
export const myLoyalty=handler(req=>withMember(req.user._id,req.user._id,async context=>{
  const summary=await memberSummary(context),now=context.now;
  const rewards=await LoyaltyReward.find({active:true,tierIds:context.account.tierId,$and:[{$or:[{startsAt:null},{startsAt:{$lte:now}}]},{$or:[{endsAt:null},{endsAt:{$gt:now}}]}]}).sort({points:1,_id:1}).limit(200).session(context.session).lean();
  const campaigns=await LoyaltyCampaign.find({active:true,tierIds:context.account.tierId,startsAt:{$lte:now},endsAt:{$gt:now},$or:[{userIds:{$size:0}},{userIds:context.userId}]}).sort({endsAt:1}).limit(100).session(context.session).lean();
  const memberClaims=await LoyaltyClaim.find({userId:context.userId}).sort({createdAt:-1}).session(context.session).lean(),offers=[];
  for(const campaign of campaigns){const eligibility=await campaignEligibility(context,campaign);if(eligibility){const claimed=await LoyaltyClaim.exists({_id:eligibility.key}).session(context.session);let available=campaign.benefit.type!=="event"||campaign.benefit.available===true;
    if(campaign.benefit.type==="gift"){const gift=await LoyaltyReward.findById(campaign.benefit.rewardId).session(context.session).lean();available=Boolean(gift?.active&&gift.stock>0&&gift.tierIds.includes(context.account.tierId)&&(!gift.startsAt||gift.startsAt<=now)&&(!gift.endsAt||gift.endsAt>now));}
    const eligibleOrders=campaignOrderOptions(context.orders,memberClaims,campaign,now);
    if(campaign.minOrderVnd>0&&campaign.benefit.type!=="offer"&&!eligibleOrders.length)available=false;
    if(claimed||campaign.usedCount<campaign.maxUses)offers.push({_id:campaign._id,name:campaign.name,description:campaign.description,type:campaign.type,benefit:campaign.benefit,endsAt:campaign.endsAt,minOrderVnd:campaign.minOrderVnd,stackable:campaign.stackable,claimed:Boolean(claimed),available,eligibleOrders});}}
  const redemptions=await LoyaltyRedemption.find({userId:context.userId}).sort({createdAt:-1}).limit(30).session(context.session).lean();
  const notifications=await LoyaltyNotification.find({userId:context.userId}).sort({createdAt:-1}).limit(30).session(context.session).lean();
  const history=await LoyaltyTierHistory.find({userId:context.userId}).sort({at:-1}).limit(30).session(context.session).lean();
  const claims=memberClaims.slice(0,30);
  return {membership:summary,rewards:rewards.map(publicReward),campaigns:offers,redemptions:redemptions.map(publicRedemption),notifications,tierHistory:history,claims};
}));
export const myLedger=handler(async req=>{const page=pageOf(req),filter={userId:req.user._id};return {page,entries:await LoyaltyLedger.find(filter).sort({at:-1,_id:-1}).skip((page-1)*30).limit(30).lean(),total:await LoyaltyLedger.countDocuments(filter)};});
export const redeemReward=handler(async req=>({redemption:await redeem(req.user._id,req.body)}));
export const claimPrivilege=handler(async req=>({claim:await claimCampaign(req.user._id,req.body)}));
export const readNotification=handler(async req=>{await LoyaltyNotification.updateOne({_id:req.params.id,userId:req.user._id,readAt:null},{$set:{readAt:new Date()}});return {};});
export const adminOverview=handler(async()=>({policy:await getPolicy(),rewards:await LoyaltyReward.find().sort({createdAt:-1}).limit(200).lean(),campaigns:await LoyaltyCampaign.find().sort({createdAt:-1}).limit(200).lean(),reviews:await LoyaltyClaim.find({status:"ReviewRequired"}).sort({createdAt:1}).limit(100).lean()}));
export const adminPolicy=handler(async req=>({policy:await savePolicy(req.body,req.user._id)}));
export const adminReward=handler(async req=>({reward:await saveReward(req.params.id,req.body,req.user._id)}));
export const adminCampaign=handler(async req=>({campaign:await saveCampaign(req.params.id,req.body,req.user._id)}));
export const adminMembers=handler(async req=>{
  const page=pageOf(req),q=typeof req.query.q==="string"?req.query.q.trim():"";if(q.length>120)throw new LoyaltyError("Từ khóa quá dài.");const filter={role:{$ne:"owner"}};
  if(q){const regex={$regex:q.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),$options:"i"};filter.$or=["_id","username","customerProfile.fullName","phone","email"].map(field=>({[field]:regex}));}
  const users=await User.find(filter).select("username customerProfile.fullName phone email birthday").sort({_id:1}).skip((page-1)*20).limit(20).lean(),members=[];
  for(const user of users){const membership=await reconcileUser(user._id);members.push({_id:user._id,name:user.customerProfile?.fullName||user.username,phone:user.phone,email:user.email,membership});}
  return {members,page,total:await User.countDocuments(filter)};
});
export const adminMember=handler(async req=>({membership:await reconcileUser(req.params.id),ledger:await LoyaltyLedger.find({userId:req.params.id}).sort({at:-1}).limit(100).lean(),history:await LoyaltyTierHistory.find({userId:req.params.id}).sort({at:-1}).limit(100).lean()}));
export const adminPoints=handler(async req=>({membership:await adjustPoints(req.params.id,req.user._id,req.body)}));
export const adminTier=handler(async req=>({membership:await adjustTier(req.params.id,req.user._id,req.body)}));
export const adminRefund=handler(async req=>({membership:await recordRefund(req.params.id,req.user._id,req.body)}));
export const adminOrder=handler(async req=>{if(!/^[a-f\d]{24}$/i.test(req.params.id))throw new LoyaltyError("Mã đơn không hợp lệ.");const row=await Order.findById(req.params.id).select("userId status isPaid subtotal discount shipping amount completedAt updatedAt loyaltyRefundedVnd").lean();if(!row)throw new LoyaltyError("Không tìm thấy đơn hàng.",404);const eligibleVnd=eligibleAmount(row);return {order:{...row,eligibleVnd,remainingVnd:Math.max(0,eligibleVnd-(row.loyaltyRefundedVnd||0))}};});
export const adminResolveClaim=handler(req=>transaction(async session=>{const reason=text(req.body.reason,"Lý do xử lý",500),before=await LoyaltyClaim.findOne({_id:req.params.id,status:"ReviewRequired"}).session(session).lean();if(!before)throw new LoyaltyError("Yêu cầu đã được xử lý hoặc không tồn tại.",409);await LoyaltyClaim.updateOne({_id:req.params.id,status:"ReviewRequired"},{$set:{status:"Resolved"}},{session});await audit(session,req.user._id,"claim-review",req.params.id,reason,before,{...before,status:"Resolved"});return {}; }));
export const adminRequests=handler(async req=>{const page=pageOf(req),status=req.query.status,filter={};if(status){if(!["Pending","Confirmed","Fulfilled","Cancelled"].includes(status))throw new LoyaltyError("Trạng thái không hợp lệ.");filter.status=status;}return {requests:await LoyaltyRedemption.find(filter).sort({createdAt:-1}).skip((page-1)*30).limit(30).lean(),total:await LoyaltyRedemption.countDocuments(filter),page};});
export const adminRequestStatus=handler(async req=>({redemption:await updateRedemption(req.params.id,req.user._id,req.body)}));
export const adminAudit=handler(async req=>{const page=pageOf(req);return {entries:await LoyaltyAudit.find().sort({at:-1,_id:-1}).skip((page-1)*50).limit(50).lean(),page,total:await LoyaltyAudit.countDocuments()};});

export const maintainLoyalty=async({budgetMs=40000}={})=>{
  const policy=await getPolicy();if(!policy.enabled)return {processed:0,disabled:true};
  const started=Date.now(),job=await LoyaltyJob.findById("members").lean();let cursor=job?.cursor||"",processed=0,failed=0;
  while(Date.now()-started<budgetMs){
    const user=await User.findOne({_id:{$gt:cursor},role:{$ne:"owner"}}).sort({_id:1}).select("_id").lean();
    if(!user){await LoyaltyJob.updateOne({_id:"members"},{$set:{cursor:"",updatedAt:new Date()}},{upsert:true});break;}
    try{await withMember(user._id,"system",async context=>{
      const window=birthdayWindow(context.user.birthday,context.now);
      if(window){const campaign=await LoyaltyCampaign.findOne({type:"birthday",active:true,tierIds:context.account.tierId,startsAt:{$lte:context.now},endsAt:{$gt:context.now},$or:[{userIds:{$size:0}},{userIds:context.userId}]}).session(context.session).lean();if(campaign)await notify(context,`birthday-invite:${window.year}`,"Chúc mừng sinh nhật bạn","Quyền lợi sinh nhật đang chờ tại trang thành viên, tối đa một lần trong năm và tùy điều kiện chiến dịch.");}
    });processed++;}catch(error){console.error("Loyalty maintenance member failed",user._id,error.message);failed++;}
    cursor=user._id;await LoyaltyJob.updateOne({_id:"members"},{$set:{cursor,updatedAt:new Date()}},{upsert:true});
  }
  // Outbox recovery also covers a completed order whose immediate award was interrupted.
  const due=await Order.find({status:"Delivery",isPaid:true,loyaltyPending:true}).select("userId").limit(20).lean();
  for(const row of due){if(Date.now()-started>=budgetMs)break;try{await reconcileUser(row.userId);}catch{failed++;}}
  return {processed,failed,cursor};
};
export const adminMaintain=handler(async()=>await maintainLoyalty());
export const loyaltyCron=async(req,res,next)=>{
  const secret=process.env.CRON_SECRET||"",expected=Buffer.from(`Bearer ${secret}`),received=Buffer.from(req.get("authorization")||"");
  if(!secret||expected.length!==received.length||!crypto.timingSafeEqual(expected,received))return res.status(401).json({success:false,message:"Bạn chưa được xác thực"});
  try{res.json({success:true,...await maintainLoyalty()});}catch(error){next(error);}
};

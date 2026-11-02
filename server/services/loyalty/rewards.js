import mongoose from "mongoose";
import Voucher from "../../models/Voucher.js";
import Order from "../../models/Order.js";
import {LoyaltyReward,LoyaltyRedemption,LoyaltyCampaign,LoyaltyClaim,LoyaltyLedger,LoyaltyTierHistory} from "../../models/Loyalty.js";
import {birthdayWindow} from "../../utils/membership.js";
import {integer,text,LoyaltyError,TIER_IDS,eligibleAmount} from "./policy.js";
import {spendPoints,restorePoints,grantPoints} from "./wallet.js";
import {withMember,keyFor,requestKey,append,notify,audit,transaction} from "./engine.js";

const objectId=value=>{if(!mongoose.isObjectIdOrHexString(value))throw new LoyaltyError("Mã dữ liệu không hợp lệ.");return String(value);};
const tierIds=value=>{if(!Array.isArray(value)||!value.length||value.some(id=>!TIER_IDS.includes(id)))throw new LoyaltyError("Danh sách hạng không hợp lệ.");return [...new Set(value)];};
const date=(value,label,optional=false)=>{if(optional&&!value)return null;const parsed=new Date(value);if(!value||!Number.isFinite(parsed.getTime()))throw new LoyaltyError(`${label} không hợp lệ.`);return parsed;};
export const publicReward=reward=>Object.fromEntries(["_id","name","description","image","points","stock","perCustomerLimit","tierIds","active","startsAt","endsAt"].map(key=>[key,reward[key]]));
export const publicRedemption=row=>({...row,reward:publicReward(row.reward)});
export const campaignOrderOptions=(orders,claims,campaign,now)=>{
  if(!campaign.minOrderVnd||campaign.benefit.type==="offer")return [];
  return orders.filter(order=>order.completedAt&&new Date(order.completedAt)>=new Date(campaign.startsAt)&&new Date(order.completedAt)<=new Date(campaign.endsAt)&&new Date(order.completedAt)<=now&&eligibleAmount(order)-(order.loyaltyRefundedVnd||0)>=campaign.minOrderVnd&&(campaign.stackable||!order.voucherId)&&!claims.some(claim=>claim.orderId===String(order._id)&&(!campaign.stackable||!claim.benefit.stackable)))
    .map(order=>({_id:String(order._id),completedAt:order.completedAt,eligibleVnd:eligibleAmount(order)-(order.loyaltyRefundedVnd||0)})).sort((a,b)=>new Date(b.completedAt)-new Date(a.completedAt));
};
export const validateReward=value=>{
  const image=text(value.image||"","Ảnh quà",1000,false);
  if(image&&!/^\/images\/[a-zA-Z0-9_./%-]+$/.test(image)){let url;try{url=new URL(image);}catch{throw new LoyaltyError("Ảnh quà phải là URL HTTPS.");}if(url.protocol!=="https:"||url.username||url.password)throw new LoyaltyError("Ảnh quà không hợp lệ.");}
  const startsAt=date(value.startsAt,"Ngày bắt đầu",true),endsAt=date(value.endsAt,"Ngày kết thúc",true);if(startsAt&&endsAt&&endsAt<=startsAt)throw new LoyaltyError("Ngày kết thúc phải sau ngày bắt đầu.");
  if(typeof value.active!=="boolean")throw new LoyaltyError("Trạng thái quà không hợp lệ.");
  return {name:text(value.name,"Tên quà",160),description:text(value.description||"","Mô tả",3000,false),image,points:integer(value.points,"Điểm đổi",1,1000000),costVnd:integer(value.costVnd,"Giá vốn"),stock:integer(value.stock,"Tồn kho",0,1000000),perCustomerLimit:value.perCustomerLimit==null?null:integer(value.perCustomerLimit,"Giới hạn mỗi khách",1,10000),tierIds:tierIds(value.tierIds),active:value.active,startsAt,endsAt};
};
export const saveReward=async(id,value,actorId)=>transaction(async session=>{
  const fields=validateReward(value),reason=text(value.reason,"Lý do",500),before=id?await LoyaltyReward.findById(objectId(id)).session(session).lean():null;
  let reward;
  if(id){reward=await LoyaltyReward.findOneAndUpdate({_id:id,version:integer(value.version,"Phiên bản")},{$set:fields,$inc:{version:1}},{session,returnDocument:'after',runValidators:true});if(!reward)throw new LoyaltyError("Quà đã thay đổi. Vui lòng tải lại.",409);}
  else [reward]=await LoyaltyReward.create([fields],{session});
  await audit(session,actorId,"reward",String(reward._id),reason,before,reward.toObject());return reward;
});
const availableReward=async(context,id,{campaign=false}={})=>{
  const reward=await LoyaltyReward.findById(objectId(id)).session(context.session).lean();
  if(!reward||!reward.active||reward.stock<1||!reward.tierIds.includes(context.account.tierId)||(reward.startsAt&&reward.startsAt>context.now)||(reward.endsAt&&reward.endsAt<=context.now))throw new LoyaltyError("Quà chưa khả dụng cho hạng hiện tại hoặc đã hết hàng.",409);
  if(reward.perCustomerLimit){const count=await LoyaltyRedemption.countDocuments({userId:context.userId,rewardId:reward._id,status:{$ne:"Cancelled"}}).session(context.session);if(count>=reward.perCustomerLimit)throw new LoyaltyError("Bạn đã đạt giới hạn đổi quà này.",409);}
  if(!campaign&&!context.policy.enabled)throw new LoyaltyError("Chương trình thành viên đang tạm dừng.",409);
  const catalog=context.policy.tiers.find(tier=>tier.id===context.account.tierId).benefits.find(benefit=>benefit.code==="rewards");
  if(!campaign&&(!catalog?.enabled||catalog.availability!=="available"))throw new LoyaltyError("Hạng hiện tại chưa được mở quyền đổi quà.",409);
  return reward;
};
const reserveGift=async(context,reward,id,points,allocations)=>{
  const write=await LoyaltyReward.updateOne({_id:reward._id,active:true,stock:{$gte:1},version:reward.version},{$inc:{stock:-1,version:1}},{session:context.session});if(write.modifiedCount!==1)throw new LoyaltyError("Quà vừa thay đổi hoặc đã hết hàng. Vui lòng thử lại.",409);
  const [redemption]=await LoyaltyRedemption.create([{_id:id,userId:context.userId,rewardId:reward._id,reward,points,allocations,status:"Pending",createdAt:context.now,updatedAt:context.now}],{session:context.session});
  await notify(context,id,"Đã tiếp nhận yêu cầu đổi quà",`Yêu cầu nhận ${reward.name} đang chờ cửa hàng xác nhận.`);return publicRedemption(redemption.toObject());
};
export const redeem=async(userId,value)=>{
  const rewardId=objectId(value.rewardId),id=keyFor("redeem",userId,requestKey(value.requestId));
  return withMember(userId,userId,async context=>{
    const existing=await LoyaltyRedemption.findById(id).session(context.session).lean();if(existing){if(String(existing.rewardId)!==rewardId)throw new LoyaltyError("Mã yêu cầu đã dùng cho quà khác.",409);return publicRedemption(existing);}
    const reward=await availableReward(context,rewardId),{allocations}=spendPoints(context.account,context.lots,reward.points,context.now);context.account.used+=reward.points;
    const redemption=await reserveGift(context,reward,id,reward.points,allocations);await append(context,{kind:"redeem",delta:-reward.points,source:id,data:{rewardId,allocations}},keyFor("redemption-ledger",id));return redemption;
  });
};
export const updateRedemption=async(id,actorId,value)=>{
  const existing=await LoyaltyRedemption.findById(text(id,"Yêu cầu đổi quà",100)).lean();if(!existing)throw new LoyaltyError("Không tìm thấy yêu cầu đổi quà.",404);
  const status=text(value.status,"Trạng thái",30),reason=text(value.reason,"Lý do xử lý",500);
  return withMember(existing.userId,actorId,async context=>{
    const row=await LoyaltyRedemption.findById(id).session(context.session);if(row.status===status)return publicRedemption(row.toObject());
    const allowed={Pending:["Confirmed","Cancelled"],Confirmed:["Fulfilled","Cancelled"],Fulfilled:[],Cancelled:[]};if(!allowed[row.status].includes(status))throw new LoyaltyError("Không thể chuyển sang trạng thái này.",409);
    const before=row.toObject();
    if(status==="Cancelled"){
      const event=restorePoints(context.account,context.lots,row.allocations,context.now);await append(context,{...event,source:id,reason},keyFor("cancel-redemption",id));
      await LoyaltyReward.updateOne({_id:row.rewardId},{$inc:{stock:1,version:1}},{session:context.session});
    }
    row.status=status;row.reason=reason;row.actorId=actorId;row.updatedAt=context.now;await row.save({session:context.session});
    await audit(context.session,actorId,"redemption",id,reason,before,row.toObject());await notify(context,`${id}:${status}`,"Cập nhật yêu cầu đổi quà",`${row.reward.name}: ${status==="Confirmed"?"đã xác nhận":status==="Fulfilled"?"đã hoàn tất":"đã hủy; điểm được xử lý theo hạn của các lô điểm gốc"}.`);
    return publicRedemption(row.toObject());
  },{references:existing.allocations.map(allocation=>allocation.lotId)});
};
export const validateCampaign=value=>{
  const type=text(value.type,"Loại chiến dịch",30),benefitType=value.benefit?.type;
  if(!["birthday","upgrade","vip","launch","personal"].includes(type)||!["points","gift","offer","event"].includes(benefitType)||typeof value.active!=="boolean"||typeof value.stackable!=="boolean")throw new LoyaltyError("Chiến dịch không hợp lệ.");
  const startsAt=date(value.startsAt,"Ngày bắt đầu"),endsAt=date(value.endsAt,"Ngày kết thúc");if(endsAt<=startsAt)throw new LoyaltyError("Ngày kết thúc phải sau ngày bắt đầu.");
  const userIds=Array.isArray(value.userIds)?value.userIds:[];if(userIds.length>500||userIds.some(id=>typeof id!=="string"||!/^[a-zA-Z0-9_-]{1,150}$/.test(id)))throw new LoyaltyError("Danh sách khách hàng không hợp lệ.");if(type==="personal"&&!userIds.length)throw new LoyaltyError("Ưu đãi cá nhân phải chỉ định khách hàng.");
  const benefit={type:benefitType,condition:text(value.benefit.condition||"","Điều kiện quyền lợi",1000,false)};
  if(benefitType==="points")benefit.points=integer(value.benefit.points,"Điểm ưu đãi",1,1000000);
  if(benefitType==="gift")benefit.rewardId=objectId(value.benefit.rewardId);
  if(benefitType==="event"){benefit.instructions=text(value.benefit.instructions,"Hướng dẫn tham gia",2000);if(value.active&&value.benefit.available!==true)throw new LoyaltyError("Phải xác nhận khả năng tổ chức trước khi mở sự kiện.");benefit.available=value.benefit.available===true;}
  if(benefitType==="offer"){
    const offer=value.benefit.offer;if(!offer||!["percent","fixed"].includes(offer.type))throw new LoyaltyError("Loại ưu đãi không hợp lệ.");
    benefit.offer={type:offer.type,value:integer(offer.value,"Giá trị ưu đãi",1,offer.type==="percent"?100:Number.MAX_SAFE_INTEGER),maxDiscount:offer.maxDiscount==null?null:integer(offer.maxDiscount,"Giảm tối đa",1)};
  }
  return {name:text(value.name,"Tên chiến dịch",160),description:text(value.description||"","Mô tả",3000,false),type,tierIds:tierIds(value.tierIds),userIds:[...new Set(userIds)],benefit,startsAt,endsAt,maxUses:integer(value.maxUses,"Số lượt",1,1000000),minOrderVnd:integer(value.minOrderVnd||0,"Đơn tối thiểu"),stackable:value.stackable,active:value.active};
};
export const saveCampaign=async(id,value,actorId)=>transaction(async session=>{
  const fields=validateCampaign(value),reason=text(value.reason,"Lý do",500),before=id?await LoyaltyCampaign.findById(objectId(id)).session(session).lean():null;
  if(before&&fields.maxUses<before.usedCount)throw new LoyaltyError("Số lượt tối đa nhỏ hơn số lượt đã cấp.");
  let row;
  if(id){row=await LoyaltyCampaign.findOneAndUpdate({_id:id,version:integer(value.version,"Phiên bản")},{$set:fields,$inc:{version:1}},{session,returnDocument:'after',runValidators:true});if(!row)throw new LoyaltyError("Chiến dịch đã thay đổi. Vui lòng tải lại.",409);}
  else [row]=await LoyaltyCampaign.create([fields],{session});
  await audit(session,actorId,"campaign",String(row._id),reason,before,row.toObject());return row;
});
export const campaignEligibility=async(context,campaign)=>{
  if(!context.policy.enabled||!campaign.active||campaign.startsAt>context.now||campaign.endsAt<=context.now||!campaign.tierIds.includes(context.account.tierId)||(campaign.userIds.length&&!campaign.userIds.includes(context.userId)))return null;
  if(campaign.type==="birthday"){
    const window=birthdayWindow(context.user.birthday,context.now);if(!window)return null;
    // A birthday voucher granted by the previous program also consumes this year's benefit.
    if(await Voucher.exists({userId:context.userId,kind:"birthday",birthdayYear:window.year}).session(context.session))return null;
    return {key:keyFor("birthday",context.userId,window.year),year:window.year};
  }
  if(campaign.type==="upgrade"){
    const upgrade=await LoyaltyTierHistory.findOne({userId:context.userId,kind:"upgrade",to:context.account.tierId,at:{$gte:campaign.startsAt,$lte:campaign.endsAt}}).sort({at:-1}).session(context.session).lean();
    return upgrade?{key:keyFor("upgrade-campaign",context.userId,String(campaign._id),upgrade._id)}:null;
  }
  return {key:keyFor("campaign",context.userId,String(campaign._id))};
};
export const claimCampaign=async(userId,value)=>{
  const campaignId=objectId(value.campaignId);requestKey(value.requestId);
  return withMember(userId,userId,async context=>{
    const campaign=await LoyaltyCampaign.findById(campaignId).session(context.session).lean();if(!campaign)throw new LoyaltyError("Không tìm thấy chiến dịch.",404);
    const eligibility=await campaignEligibility(context,campaign);if(!eligibility)throw new LoyaltyError("Chiến dịch chưa khả dụng cho tài khoản này.",409);
    const existing=await LoyaltyClaim.findById(eligibility.key).session(context.session).lean();if(existing){if(String(existing.campaignId)!==campaignId)throw new LoyaltyError("Bạn đã nhận quyền lợi sinh nhật trong năm này.",409);return existing;}
    const benefit={...campaign.benefit,stackable:campaign.stackable,qualifyingMinVnd:campaign.minOrderVnd,campaignName:campaign.name};let order=null;
    if(campaign.minOrderVnd>0&&benefit.type!=="offer"){
      order=await Order.findOne({_id:objectId(value.orderId),userId,status:"Delivery",isPaid:true,completedAt:{$gte:campaign.startsAt,$lte:campaign.endsAt}}).session(context.session).lean();
      if(!order||Math.max(0,(order.subtotal||0)-(order.discount||0)-(order.loyaltyRefundedVnd||0))<campaign.minOrderVnd)throw new LoyaltyError("Đơn hàng chưa đáp ứng điều kiện chiến dịch.",409);
      const uses=await LoyaltyClaim.find({userId,orderId:String(order._id)}).session(context.session).lean();if((order.voucherId&&!campaign.stackable)||uses.some(claim=>!campaign.stackable||!claim.benefit.stackable))throw new LoyaltyError("Quyền lợi này không kết hợp với ưu đãi khác trên đơn.",409);
    }
    const reserve=await LoyaltyCampaign.updateOne({_id:campaign._id,active:true,version:campaign.version,usedCount:{$lt:campaign.maxUses}},{$inc:{usedCount:1,version:1}},{session:context.session});if(reserve.modifiedCount!==1)throw new LoyaltyError("Chiến dịch vừa thay đổi hoặc đã hết lượt.",409);
    if(benefit.type==="points")await append(context,grantPoints(context.account,context.lots,{id:`campaign:${eligibility.key}`,points:benefit.points,source:`campaign:${campaignId}`,at:context.now}),keyFor("campaign-points",eligibility.key));
    if(benefit.type==="gift"){const reward=await availableReward(context,benefit.rewardId,{campaign:true});benefit.redemptionId=eligibility.key;await reserveGift(context,reward,eligibility.key,0,[]);}
    if(benefit.type==="offer"){
      const [voucher]=await Voucher.create([{code:`LOYAL-${eligibility.key.slice(0,20).toUpperCase()}`,kind:"loyalty",userId,...benefit.offer,minSubtotal:campaign.minOrderVnd,startsAt:context.now,expiresAt:campaign.endsAt,maxUses:1}],{session:context.session});benefit.code=voucher.code;
    }
    const [claim]=await LoyaltyClaim.create([{_id:eligibility.key,userId,campaignId:campaign._id,type:campaign.type,year:eligibility.year,benefit,orderId:order?String(order._id):null,createdAt:context.now}],{session:context.session});
    await notify(context,eligibility.key,"Đã cấp quyền lợi thành viên",`${campaign.name}: xem chi tiết tại trang Thành viên & mã giảm giá.`);return claim.toObject();
  });
};

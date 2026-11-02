// Browser-only data. This module never opens MongoDB or calls production APIs.
import {defaultPolicy,addMonths} from "../../services/loyalty/policy.js";
export function createLoyaltyFixtures(){
  const now=new Date(),policy={...defaultPolicy(),enabled:true,version:1,activatedAt:now};
  const reward={_id:"6a0000000000000000000111",name:"Bộ quà trải nghiệm",description:"Quà kiểm thử trong bộ nhớ.",image:"",points:100,costVnd:555555,stock:3,perCustomerLimit:2,tierIds:policy.tiers.map(tier=>tier.id),active:true,version:0};
  const campaign={_id:"6a0000000000000000000222",name:"Tri ân thành viên",description:"Chiến dịch kiểm thử.",type:"vip",tierIds:reward.tierIds,userIds:[],benefit:{type:"points",points:50,condition:"Theo điều kiện chiến dịch."},startsAt:now,endsAt:addMonths(now),maxUses:100,usedCount:0,minOrderVnd:0,stackable:false,active:true,version:0};
  const membership={tier:policy.tiers[1],tiers:policy.tiers,achievedAt:now,expiresAt:addMonths(now),salesVnd:20000000,nextTier:{...policy.tiers[2],remainingVnd:20000000},points:{available:500,debt:0,earned:500,used:0,expired:0,expiringSoon:50},programEnabled:true,canRedeem:true};
  const requests=[],redemptions=[],claims=[],ledger=[{_id:"grant",kind:"grant",delta:500,at:now,source:"order:fixture",data:{}}],notifications=[{_id:"notice",title:"Chúc mừng đạt hạng Prestige",message:"Quyền lợi mới đã có hiệu lực.",createdAt:now,readAt:null}];
  const overview=()=>({policy,rewards:[reward],campaigns:[campaign],reviews:[]});
  const success=body=>({statusCode:200,body:{success:true,...structuredClone(body)}});
  return {requests,policy,membership,respond(request){
    const url=new URL(request.url),p=url.pathname,body=request.postData?JSON.parse(request.postData):{};
    if(p==="/api/vouchers/mine")return success({profile:{username:"Khách kiểm thử",email:"qa@example.invalid",phone:"0900000000",birthday:"2000-01-01"},vouchers:[]});
    if(!p.startsWith("/api/loyalty"))return null;
    if(request.method!=="GET")requests.push({path:p,method:request.method,body});
    if(p==="/api/loyalty/me")return success({membership,rewards:[Object.fromEntries(Object.entries(reward).filter(([key])=>key!=="costVnd"))],campaigns:[{...campaign,minOrderVnd:1000000,eligibleOrders:[{_id:"6a0000000000000000000333",eligibleVnd:2000000,completedAt:now}],available:true,claimed:claims.length>0}],claims,redemptions,notifications,tierHistory:[{_id:"tier",kind:"upgrade",from:"signature",to:"prestige",at:now,expiresAt:addMonths(now),reason:"Đạt ngưỡng doanh số."}]});
    if(p==="/api/loyalty/redeem"){
      const old=redemptions.find(row=>row._id===body.requestId);if(old)return success({redemption:old});
      membership.points.available-=100;membership.points.used+=100;reward.stock--;
      const row={_id:body.requestId,reward:{name:reward.name},points:100,status:"Pending",createdAt:now};redemptions.push(row);ledger.unshift({_id:row._id,kind:"redeem",delta:-100,at:now,data:{}});return success({redemption:row});
    }
    if(p==="/api/loyalty/claim"){const row={_id:"claim",benefit:campaign.benefit,createdAt:now,status:"Granted"};claims.push(row);membership.points.available+=50;return success({claim:row});}
    if(p.startsWith("/api/loyalty/ledger"))return success({page:1,total:ledger.length,entries:ledger});
    if(p.startsWith("/api/loyalty/notifications/")){notifications[0].readAt=now;return success({});}
    if(p==="/api/loyalty/admin")return success(overview());
    if(p==="/api/loyalty/admin/policy"){Object.assign(policy,body,{version:policy.version+1});return success({policy});}
    if(p==="/api/loyalty/admin/members")return success({page:1,total:1,members:[{_id:"qa-owner",name:"Khách kiểm thử",phone:"0900000000",membership}]});
    if(p==="/api/loyalty/admin/members/qa-owner")return success({membership,ledger,history:[]});
    if(p==="/api/loyalty/admin/redemptions")return success({requests:redemptions,total:redemptions.length,page:1});
    if(p==="/api/loyalty/admin/audit")return success({entries:[{_id:"audit",action:"policy",subject:"program",actorId:"qa-owner",at:now,reason:"Kiểm thử giao diện",before:{version:0},after:{version:1}}],total:1,page:1});
    if(p.startsWith("/api/loyalty/admin/orders/"))return success({order:{eligibleVnd:10000000,loyaltyRefundedVnd:0,remainingVnd:10000000}});
    return success({});
  }};
}

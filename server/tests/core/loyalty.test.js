import test from "node:test";
import assert from "node:assert/strict";
import {addMonths,pointsFor,eligibleAmount,defaultPolicy,validatePolicy,tierFor} from "../../services/loyalty/policy.js";
import {expireLots,grantPoints,spendPoints,reverseOrderPoints,restorePoints,walletSummary} from "../../services/loyalty/wallet.js";
import {LoyaltyLedger,LoyaltyTierHistory,LoyaltyAudit} from "../../models/Loyalty.js";
import {publicReward,publicRedemption,validateReward,validateCampaign,campaignOrderOptions} from "../../services/loyalty/rewards.js";
import loyaltyRouter from "../../routes/loyaltyRoute.js";
import {requireOwner} from "../../middleware/authMiddleware.js";
const now=new Date("2026-11-02T10:00:00+07:00");
const account=()=>({debt:0,earned:0,used:0,expired:0});
const grant=(a,lots,id,points,expiresAt=addMonths(now))=>grantPoints(a,lots,{id,points,source:id,at:now,expiresAt});
test("all four purchase examples use exact integer floors and reject fractional or injected currency",()=>{
  assert.deepEqual([10,12,15,20].map(rate=>pointsFor(10000000,rate)),[100,120,150,200]);
  assert.equal(pointsFor(999999,10),9);assert.equal(pointsFor(Number.MAX_SAFE_INTEGER,20),180143985094);
  for(const value of [-1,1.1,"10000000",NaN,Infinity,{$gt:0}])assert.throws(()=>pointsFor(value,10));
});
test("twelve months are calendar months in Vietnam, including leap day and month end",()=>{
  assert.equal(addMonths(new Date("2024-02-29T01:30:00+07:00")).toISOString(),"2025-02-27T18:30:00.000Z");
  assert.equal(addMonths(new Date("2026-01-31T23:30:00+07:00"),1).toISOString(),"2026-02-28T16:30:00.000Z");
});
test("qualifying sales exclude unpaid/cancelled orders, shipping and discounts",()=>{
  const order={status:"Delivery",isPaid:true,subtotal:10000000,discount:1000000,shipping:30000,amount:9030000};
  assert.equal(eligibleAmount(order),9000000);assert.equal(eligibleAmount({...order,isPaid:false}),0);assert.equal(eligibleAmount({...order,status:"Payment Cancelled"}),0);
  assert.equal(eligibleAmount({...order,subtotal:undefined}),9000000);assert.throws(()=>eligibleAmount({...order,subtotal:undefined,shipping:undefined}));
});
test("tier decisions read editable configuration and can jump directly to the highest tier",()=>{
  const config=defaultPolicy();assert.deepEqual(config.tiers.map(tier=>tier.thresholdVnd),[0,15000000,40000000,100000000]);assert.equal(tierFor(config.tiers,100000000).id,"private-circle");
  config.tiers[1].thresholdVnd=1000;assert.equal(tierFor(config.tiers,1000).id,"prestige");assert.doesNotThrow(()=>validatePolicy(config));
  config.tiers[2].thresholdVnd=999;assert.throws(()=>validatePolicy(config));
});
test("spend takes the earliest expiring lots and insufficient points cannot partially spend",()=>{
  const a=account(),lots=[];grant(a,lots,"late",100,addMonths(now,12));grant(a,lots,"early",60,addMonths(now,1));
  const result=spendPoints(a,lots,80,now);assert.deepEqual(result.allocations.map(row=>[row.lotId,row.points]),[["early",60],["late",20]]);
  const before=structuredClone(lots);assert.throws(()=>spendPoints(a,lots,81,now));assert.deepEqual(lots,before);
});
test("refund after spending creates debt and future grants first repay that debt",()=>{
  const a=account(),lots=[];grant(a,lots,"order",100);spendPoints(a,lots,80,now);a.used=80;
  const reversal=reverseOrderPoints(a,lots[0],100);assert.equal(reversal.delta,-100);assert.equal(a.debt,80);assert.throws(()=>spendPoints(a,lots,1,now));
  const award=grant(a,lots,"next",120);assert.equal(award.data.debtRepaid,80);assert.equal(a.debt,0);assert.equal(walletSummary(a,lots,now).available,40);
});
test("expired unspent points are not charged a second time on refund",()=>{
  const a=account(),lots=[];grant(a,lots,"order",100);spendPoints(a,lots,80,now);const later=addMonths(now,13);
  assert.equal(expireLots(a,lots,later)[0].delta,-20);assert.equal(expireLots(a,lots,later).length,0);
  const reversal=reverseOrderPoints(a,lots[0],100);assert.equal(reversal.data.alreadyExpired,20);assert.equal(a.debt,80);assert.equal(reversal.delta,-80);
});
test("cancellation restores original lots without extending expiry; refund debt is repaid first",()=>{
  const a=account(),lots=[];grant(a,lots,"order",100);const {allocations}=spendPoints(a,lots,80,now);a.used=80;
  reverseOrderPoints(a,lots[0],100);const result=restorePoints(a,lots,allocations,now);assert.equal(a.debt,0);assert.equal(result.data.debtRepaid,80);assert.equal(walletSummary(a,lots,now).available,0);assert.equal(a.used,0);
});
test("cancellation after original expiry records expiry rather than fresh usable points",()=>{
  const a=account(),lots=[];grant(a,lots,"order",100);const {allocations}=spendPoints(a,lots,100,now);a.used=100;
  const result=restorePoints(a,lots,allocations,addMonths(now,13));assert.equal(result.delta,0);assert.equal(result.data.expiredOnReturn,100);assert.equal(a.expired,100);assert.equal(a.used,0);assert.equal(lots[0].remaining,0);
});
test("already expired backfill awards cannot erase a present point debt",()=>{
  const a=account();a.debt=100;const lots=[];grantPoints(a,lots,{id:"old",points:100,source:"order",at:addMonths(now,-13),asOf:now});expireLots(a,lots,now);assert.equal(a.debt,100);assert.equal(a.expired,100);
});
test("expired cancellation can settle its own refund debt but never a different order's debt",()=>{
  const a=account(),lots=[];grant(a,lots,"first",100);const {allocations}=spendPoints(a,lots,100,now);a.used=100;grant(a,lots,"other",100);spendPoints(a,lots,100,now);a.used+=100;
  reverseOrderPoints(a,lots[1],100);const result=restorePoints(a,lots,allocations,addMonths(now,13));assert.equal(a.debt,100);assert.equal(result.data.expiredOnReturn,100);assert.equal(result.delta,0);
});
test("public rewards and redemption snapshots never reveal internal costs",()=>{
  const reward={_id:"gift",name:"Sample",costVnd:250000,points:100,stock:1};assert.equal(publicReward(reward).costVnd,undefined);assert.equal(publicRedemption({reward,points:100}).reward.costVnd,undefined);
});
test("campaign order choices exclude unpaid, refunded, outside-period and non-stackable orders",()=>{
  const base={_id:"paid",status:"Delivery",isPaid:true,subtotal:5000000,discount:0,completedAt:now},campaign={minOrderVnd:3000000,startsAt:addMonths(now,-1),endsAt:addMonths(now,1),benefit:{type:"points"},stackable:false};
  const orders=[base,{...base,_id:"unpaid",isPaid:false},{...base,_id:"returned",loyaltyRefundedVnd:3000000},{...base,_id:"old",completedAt:addMonths(now,-2)},{...base,_id:"coupon",voucherId:"voucher"},{...base,_id:"claimed"}];
  const claims=[{orderId:"claimed",benefit:{stackable:false}}];
  assert.deepEqual(campaignOrderOptions(orders,claims,campaign,now).map(row=>row._id),["paid"]);
  assert.deepEqual(campaignOrderOptions(orders,claims,{...campaign,stackable:true},now).map(row=>row._id),["paid","coupon"]);
  assert.deepEqual(campaignOrderOptions(orders,claims,{...campaign,benefit:{type:"offer"}},now),[]);
});
test("refunds use other unspent valid lots before leaving debt, preserving any positive usable balance",()=>{
  const a=account(),lots=[];grant(a,lots,"original",100);spendPoints(a,lots,100,now);grant(a,lots,"later",200);
  const result=reverseOrderPoints(a,lots[0],100,{lots,now});
  assert.equal(a.debt,0);assert.equal(walletSummary(a,lots,now).available,100);assert.equal(result.data.debtRepaid,100);
  assert.deepEqual(result.data.debtAllocations.map(row=>[row.lotId,row.points]),[["later",100]]);
  assert.doesNotThrow(()=>spendPoints(a,lots,50,now));
});
test("immutable ledgers, tier histories and audits reject edits, deletions and bulk mutations",async()=>{
  for(const Model of[LoyaltyLedger,LoyaltyTierHistory,LoyaltyAudit]){
    await assert.rejects(Model.updateOne({_id:"x"},{$set:{delta:100}}),/append-only/);await assert.rejects(Model.deleteMany({}),/append-only/);await assert.rejects(Model.bulkWrite([{updateOne:{filter:{_id:"x"},update:{$set:{delta:10}}}}]),/append-only/);
  }
});
test("rewards require valid inventory, points, ranks and safe photos; event promises require availability",()=>{
  const reward={name:"Gift",description:"",image:"",points:100,costVnd:0,stock:0,perCustomerLimit:null,tierIds:["signature"],active:false};assert.doesNotThrow(()=>validateReward(reward));
  assert.throws(()=>validateReward({...reward,stock:-1}));assert.throws(()=>validateReward({...reward,image:"javascript:alert(1)"}));
  const campaign={name:"Event",description:"",type:"vip",tierIds:["elite"],userIds:[],benefit:{type:"event",instructions:"Invitation required",available:false},startsAt:now,endsAt:addMonths(now,1),maxUses:10,minOrderVnd:0,stackable:false,active:true};assert.throws(()=>validateCampaign(campaign));assert.doesNotThrow(()=>validateCampaign({...campaign,benefit:{...campaign.benefit,available:true}}));
});
test("all admin routes are behind owner authorization and customers have no point transfer/cash endpoints",()=>{
  const guard=loyaltyRouter.stack.findIndex(layer=>layer.handle===requireOwner);assert.ok(guard>=0);for(const layer of loyaltyRouter.stack.filter(layer=>layer.route?.path.startsWith('/admin')))assert.ok(loyaltyRouter.stack.indexOf(layer)>guard);
  assert.equal(loyaltyRouter.stack.some(layer=>/transfer|cash/i.test(layer.route?.path||"")),false);
});

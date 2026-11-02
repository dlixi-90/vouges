import { LoyaltyError, addMonths, integer } from "./policy.js";

const debts=account=>{
  account.debtSources ||= [];
  const represented=account.debtSources.reduce((sum,row)=>sum+row.points,0);
  if(represented<account.debt)account.debtSources.push({source:"legacy",points:account.debt-represented});
  return account.debtSources;
};
const payDebt=(account,points,source)=>{
  let left=points;
  for(const row of debts(account)){if(source&&row.source!==source)continue;const paid=Math.min(left,row.points);row.points-=paid;left-=paid;account.debt-=paid;if(!left)break;}
  account.debtSources=account.debtSources.filter(row=>row.points>0);return points-left;
};
const addDebt=(account,points,source)=>{const rows=debts(account),row=rows.find(row=>row.source===source);if(row)row.points+=points;else if(points)rows.push({source,points});account.debt+=points;};

// Mutable lots are a projection. Every change is committed with an immutable ledger event.
export const expireLots = (account,lots,now) => {
  const events=[];
  for(const lot of lots){if(lot.remaining>0&&new Date(lot.expiresAt)<=now){const points=lot.remaining;lot.remaining=0;lot.expired+=points;account.expired+=points;events.push({kind:"expire",delta:-points,source:lot._id,data:{lotId:lot._id,points}});}}
  return events;
};
export const grantPoints = (account,lots,{id,points,source,at,expiresAt=addMonths(at),asOf=at}) => {
  integer(points,"Điểm");const debtRepaid=new Date(expiresAt)>asOf?payDebt(account,points):0;account.earned+=points;
  const lot={_id:id,issued:points,remaining:points-debtRepaid,expired:0,expiredReversed:0,source,createdAt:new Date(at),expiresAt:new Date(expiresAt)};lots.push(lot);
  return {kind:"grant",delta:points,source,data:{lotId:id,issued:points,debtRepaid,expiresAt:lot.expiresAt}};
};
export const spendPoints = (account,lots,points,now,{allowDebt=false}={}) => {
  integer(points,"Điểm",1);const available=lots.filter(lot=>lot.remaining>0&&new Date(lot.expiresAt)>now).sort((a,b)=>new Date(a.expiresAt)-new Date(b.expiresAt)||String(a._id).localeCompare(String(b._id)));
  if(!allowDebt&&(account.debt>0||available.reduce((sum,lot)=>sum+lot.remaining,0)<points))throw new LoyaltyError("Điểm khả dụng chưa đủ để đổi quà.",409);
  let left=points;const allocations=[];
  for(const lot of available){const used=Math.min(left,lot.remaining);if(used){lot.remaining-=used;left-=used;allocations.push({lotId:lot._id,points:used,expiresAt:lot.expiresAt});}if(!left)break;}
  if(left)addDebt(account,left,"admin");
  return {allocations,debtAdded:left};
};
export const reverseOrderPoints = (account,lot,points,{lots=[],now=new Date()}={}) => {
  integer(points,"Điểm hoàn trả");const removed=Math.min(lot.remaining,points);lot.remaining-=removed;
  const alreadyExpired=Math.min(points-removed,Math.max(0,lot.expired-lot.expiredReversed));lot.expiredReversed+=alreadyExpired;
  const debtAdded=points-removed-alreadyExpired;addDebt(account,debtAdded,lot._id);
  // Existing unspent points also cover a refund adjustment. A funded wallet must
  // not be blocked merely because the refunded order's own lot was already spent.
  const debtAllocations=[];let debtRepaid=0;
  for(const available of lots.filter(row=>row.remaining>0&&new Date(row.expiresAt)>now).sort((a,b)=>new Date(a.expiresAt)-new Date(b.expiresAt)||String(a._id).localeCompare(String(b._id)))){
    const paid=payDebt(account,available.remaining);if(paid){available.remaining-=paid;debtRepaid+=paid;debtAllocations.push({lotId:available._id,points:paid,expiresAt:available.expiresAt});}if(!account.debt)break;
  }
  return {kind:"refund",delta:-(removed+debtAdded),source:lot._id,data:{pointsReversed:points,removed,alreadyExpired,debtAdded,debtRepaid,debtAllocations}};
};
export const restorePoints = (account,lots,allocations,now) => {
  let total=0,expired=0,debtRepaid=0;
  for(const allocation of allocations){
    const lot=lots.find(lot=>lot._id===allocation.lotId);if(!lot)throw Error("Missing original points lot");
    total+=allocation.points;const paid=payDebt(account,allocation.points,new Date(lot.expiresAt)<=now?lot._id:undefined);debtRepaid+=paid;const remaining=allocation.points-paid;
    if(new Date(lot.expiresAt)<=now){lot.expired+=remaining;expired+=remaining;account.expired+=remaining;}else lot.remaining+=remaining;
  }
  account.used=Math.max(0,account.used-total);
  return {kind:"restore",delta:total-expired,data:{allocations,total,expiredOnReturn:expired,debtRepaid}};
};
export const walletSummary=(account,lots,now)=>({available:account.debt?0:lots.filter(lot=>new Date(lot.expiresAt)>now).reduce((sum,lot)=>sum+lot.remaining,0),debt:account.debt,earned:account.earned,used:account.used,expired:account.expired,expiringSoon:lots.filter(lot=>new Date(lot.expiresAt)>now&&new Date(lot.expiresAt)<=new Date(now.getTime()+30*86400000)).reduce((sum,lot)=>sum+lot.remaining,0)});

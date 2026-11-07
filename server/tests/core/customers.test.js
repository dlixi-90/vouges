import test from "node:test";
import assert from "node:assert/strict";
import { customerIdentity } from "../../services/customerIdentity.js";
import { Webhook } from "svix";
import User from "../../models/User.js";
import Order from "../../models/Order.js";
import userRouter from "../../routes/userRoute.js";
import orderRouter from "../../routes/orderRoute.js";
import authUser, {requireOwner,requireCustomerProfile} from "../../middleware/authMiddleware.js";
import clerkWebhooks from "../../controllers/ClerkWebhooks.js";
import {completeCustomerProfile,listCustomers,updateCustomer,updateContactPhone} from "../../controllers/customerController.js";
import {getUserProfile,saveBirthday} from "../../controllers/userController.js";
import {customerProfile,latestAdultBirthday,validateCustomerProfile} from "../../utils/customerProfile.js";
import {placedOrderFilter} from "../../utils/orderReporting.js";
import {validateCustomerProfile as clientValidation,latestAdultBirthday as clientCutoff,shouldCompleteCustomerProfile} from "../../../client/src/utils/customerProfile.js";

const now=new Date("2026-10-29T12:00:00+07:00");
const draft={fullName:"Nguyễn Thị Hương",phone:"0912345678",birthday:"2000-02-29"};
const pending={_id:"user_customer",username:"Clerk name",email:"customer@example.com",phone:"",birthday:"",role:"user",profileOnboardingRequired:true};
const finished={...pending,customerProfile:{fullName:draft.fullName,phone:"(+84) 912 345 678",completedAt:new Date()},birthday:draft.birthday};
const response=()=>({code:200,headers:{},set(k,v){this.headers[k]=v;return this;},status(code){this.code=code;return this;},json(body){this.body=body;return this;}});
const fail=error=>{throw error;};
const route=(router,path,method)=>router.stack.find(layer=>layer.route?.path===path&&layer.route.methods[method]).route.stack.map(layer=>layer.handle);

test("client and server require every field, a valid phone and a real full birthdate",()=>{
  for(const input of [{},null,{...draft,fullName:" "},{...draft,fullName:"<script>"},{...draft,fullName:123},{...draft,phone:912345678},{...draft,phone:"0112345678"},{...draft,birthday:"2025-02-29"},{...draft,birthday:"2000-04-31"},{...draft,birthday:"29/02/2000"},{...draft,birthday:"1899-01-01"},{...draft,birthday:"2099-01-01"}]){
    const server=validateCustomerProfile(input,now);assert.ok(Object.keys(server.errors).length);assert.deepEqual(server,clientValidation(input,now));
  }
  const valid=validateCustomerProfile({...draft,fullName:"  Nguyễn   Thị Hương  ",phone:"+84 912345678"},now);
  assert.deepEqual(valid,{errors:{},value:{...draft,phone:"(+84) 912 345 678"}});
});

test("18-year eligibility uses the exact Vietnam calendar day, not birth year",()=>{
  assert.equal(latestAdultBirthday(now),"2008-10-29");assert.equal(clientCutoff(now),"2008-10-29");
  assert.deepEqual(validateCustomerProfile({...draft,birthday:"2008-10-29"},now).errors,{});
  assert.ok(validateCustomerProfile({...draft,birthday:"2008-10-30"},now).errors.birthday);
  assert.ok(validateCustomerProfile({...draft,birthday:"2008-12-01"},now).errors.birthday);
  assert.equal(latestAdultBirthday(new Date("2026-10-28T16:59:59Z")),"2008-10-28");
  assert.equal(latestAdultBirthday(new Date("2026-10-28T17:00:00Z")),"2008-10-29");
  assert.equal(latestAdultBirthday(new Date("2028-02-29T12:00:00+07:00")),"2010-02-28");
  assert.ok(validateCustomerProfile({...draft,birthday:"2012-02-29"},new Date("2030-02-28T12:00:00+07:00")).errors.birthday);
  assert.deepEqual(validateCustomerProfile({...draft,birthday:"2012-02-29"},new Date("2030-03-01T12:00:00+07:00")).errors,{});
});

test("only unfinished new customer accounts trigger the homepage dialog; legacy/owner/guest/completed accounts do not",()=>{
  assert.equal(new User({_id:"old",username:"Old"}).profileOnboardingRequired,false);
  assert.equal(customerProfile({...pending,profileOnboardingRequired:undefined}).needsCompletion,false);
  assert.equal(customerProfile({...pending,role:"owner"}).needsCompletion,false);
  assert.equal(customerProfile(finished).needsCompletion,false);
  assert.equal(shouldCompleteCustomerProfile({userId:pending._id,profile:customerProfile(pending),pathname:"/"}),true);
  for(const options of [{userId:null,pathname:"/",profile:customerProfile(pending)},{userId:pending._id,pathname:"/collection",profile:customerProfile(pending)},{userId:pending._id,pathname:"/",profile:customerProfile(finished)},{userId:pending._id,pathname:"/",profile:null}])assert.equal(shouldCompleteCustomerProfile(options),false);
});

test("customer list/edit are owner-only; completion is account-authenticated and COD/QR cannot bypass incomplete onboarding",()=>{
  assert.deepEqual(route(userRouter,"/customers","get"),[authUser,requireOwner,listCustomers]);
  assert.deepEqual(route(userRouter,"/customers/:id","patch"),[authUser,requireOwner,updateCustomer]);
  assert.deepEqual(route(userRouter,"/profile","patch"),[authUser,completeCustomerProfile]);
  assert.deepEqual(route(userRouter,"/profile/phone","patch"),[authUser,updateContactPhone]);
  for(const path of ["/cod","/qr"])assert.ok(route(orderRouter,path,"post").includes(requireCustomerProfile));
  const res=response();requireCustomerProfile({user:pending},res,()=>assert.fail("Incomplete accounts cannot place orders"));assert.equal(res.code,403);
  for(const user of [finished,{...pending,profileOnboardingRequired:false},{...pending,role:"owner"}]){
    let passed=false;requireCustomerProfile({user},response(),()=>{passed=true;});assert.equal(passed,true);
  }
});

test("first-login bootstrap reads trusted Clerk identity if its webhook has not arrived",async t=>{
  t.mock.method(User,"findById",async()=>null);
  t.mock.method(customerIdentity,"read",async id=>{assert.equal(id,pending._id);return {id,firstName:"Trusted",lastName:"Member",primaryEmailAddressId:"verified",emailAddresses:[{id:"verified",emailAddress:"trusted@example.com",verification:{status:"verified"}}],phoneNumbers:[],unsafeMetadata:{role:"owner",birthday:"2000-01-01"}};});
  t.mock.method(User,"findOneAndUpdate",async(filter,update,opts)=>{
    assert.deepEqual(filter,{_id:pending._id});assert.deepEqual(Object.keys(update),["$setOnInsert"]);
    assert.equal(update.$setOnInsert.email,"trusted@example.com");assert.equal(update.$setOnInsert.profileOnboardingRequired,true);
    assert.equal(update.$setOnInsert.role,undefined);assert.equal(update.$setOnInsert.birthday,undefined);assert.equal(opts.upsert,true);
    return {...pending,email:"trusted@example.com"};
  });
  let passed=false;const req={auth:()=>({userId:pending._id}),body:{role:"owner",email:"untrusted@example.com"}};
  await authUser(req,response(),()=>{passed=true;});assert.equal(passed,true);assert.equal(req.user.email,"trusted@example.com");
});

test("existing users never require another Clerk API read and anonymous calls cannot bootstrap",async t=>{
  t.mock.method(User,"findById",async()=>finished);t.mock.method(customerIdentity,"read",()=>assert.fail("No redundant identity read"));
  let passed=false;await authUser({auth:()=>({userId:pending._id})},response(),()=>{passed=true;});assert.equal(passed,true);
  const res=response();await authUser({auth:()=>({})},res,()=>assert.fail("Anonymous request"));assert.equal(res.code,401);
});

test("verified webhook replays never reset completed contact details or onboarding state",async t=>{
  const secret=`whsec_${Buffer.from("customer-profile-webhook-test-key").toString("base64")}`;
  const previous=process.env.CLERK_WEBHOOK_SECRET;process.env.CLERK_WEBHOOK_SECRET=secret;
  t.after(()=>{if(previous===undefined)delete process.env.CLERK_WEBHOOK_SECRET;else process.env.CLERK_WEBHOOK_SECRET=previous;});
  t.mock.method(User,"findByIdAndUpdate",async(id,update)=>{
    assert.equal(id,pending._id);assert.deepEqual(update.$setOnInsert,{profileOnboardingRequired:true});
    assert.equal(update.$set.customerProfile,undefined);assert.equal(update.$set.birthday,undefined);assert.equal(update.$set.profileOnboardingRequired,undefined);
    assert.equal(customerProfile({...finished,...update.$set}).fullName,draft.fullName);
    assert.equal(customerProfile({...finished,...update.$set}).phone,"(+84) 912 345 678");
  });
  for(const type of ["user.created","user.updated","user.created"]){
    const payload=JSON.stringify({type,data:{id:pending._id,first_name:"Provider changed",email_addresses:[],phone_numbers:[],unsafe_metadata:{customerProfile:{fullName:"Forged"}}}});
    const timestamp=new Date(),eventId="msg_customer";const headers={"svix-id":eventId,"svix-timestamp":String(Math.floor(timestamp.getTime()/1000)),"svix-signature":new Webhook(secret).sign(eventId,timestamp,payload)};
    const res=response();await clerkWebhooks({body:Buffer.from(payload),headers},res);assert.equal(res.body.success,true);
  }
});

test("invalid or underage completion never writes or marks the popup completed",async t=>{
  t.mock.method(User,"findOneAndUpdate",()=>assert.fail("Invalid profile must not write"));
  for(const body of [{},{...draft,birthday:"2020-01-01"},{...draft,phone:""},{...draft,fullName:""}]){
    const res=response();await completeCustomerProfile({user:pending,body},res,fail);assert.equal(res.code,400);assert.ok(Object.keys(res.body.errors).length);
  }
});

test("completion atomically stores validated contact, birthday and timestamp only for the authenticated new account",async t=>{
  t.mock.method(User,"findOneAndUpdate",async(filter,update,options)=>{
    assert.deepEqual(filter,{_id:pending._id,profileOnboardingRequired:true,"customerProfile.completedAt":null});
    assert.equal(update.$set.birthdayMonthDay,"02-29");assert.equal(update.$set.customerProfile.phone,"(+84) 912 345 678");
    assert.ok(update.$set.customerProfile.completedAt instanceof Date);assert.equal(update.$set.email,undefined);assert.equal(update.$set.role,undefined);
    assert.equal(options.runValidators,true);return {...pending,...update.$set};
  });
  const res=response();await completeCustomerProfile({user:pending,body:{...draft,userId:"someone_else",role:"owner",email:"forged@example.com"}},res,fail);
  assert.equal(res.body.profile.needsCompletion,false);assert.equal(res.body.profile.fullName,draft.fullName);assert.equal(res.body.profile.email,pending.email);
  assert.equal(res.headers["Cache-Control"],"private, no-store");
});

test("repeat submission cannot overwrite the original profile and stale simultaneous tabs receive the saved result",async t=>{
  const write=t.mock.method(User,"findOneAndUpdate",async()=>null);t.mock.method(User,"findById",async()=>finished);
  const first=response();await completeCustomerProfile({user:finished,body:{...draft,fullName:"Changed"}},first,fail);
  assert.equal(write.mock.callCount(),0);assert.equal(first.body.profile.fullName,draft.fullName);
  const concurrent=response();await completeCustomerProfile({user:pending,body:{...draft,fullName:"Second tab"}},concurrent,fail);
  assert.equal(write.mock.callCount(),1);assert.equal(concurrent.body.profile.fullName,draft.fullName);assert.equal(concurrent.body.profile.needsCompletion,false);
});

test("legacy accounts are not forced through the one-time endpoint; failed writes leave completion retryable",async t=>{
  const write=t.mock.method(User,"findOneAndUpdate",async()=>{throw new Error("Temporary database failure");});
  const legacy=response();await completeCustomerProfile({user:{...pending,profileOnboardingRequired:false},body:draft},legacy,fail);assert.equal(legacy.code,409);assert.equal(write.mock.callCount(),0);
  let error;await completeCustomerProfile({user:pending,body:draft},response(),err=>{error=err;});assert.equal(error.message,"Temporary database failure");assert.equal(customerProfile(pending).needsCompletion,true);
});

test("private profile returns saved contact after later identity sync without exposing cart internals as profile",async()=>{
  const res=response();await getUserProfile({user:{...finished,username:"Clerk changed",phone:"",cartData:{},cartAddedAt:{}}},res);
  assert.equal(res.body.profile.fullName,draft.fullName);assert.equal(res.body.profile.phone,"(+84) 912 345 678");assert.equal(res.body.profile.needsCompletion,false);
  assert.equal(res.body.profile.role,undefined);assert.equal(res.headers["Cache-Control"],"private, no-store");
});

test("customers can update only their own validated contact phone",async t=>{
  const write=t.mock.method(User,"findOneAndUpdate",async(filter,update,options)=>{
    assert.deepEqual(filter,{_id:pending._id});
    assert.deepEqual(update,{$set:{contactPhone:"(+84) 987 654 321"}});
    assert.equal(options.runValidators,true);
    return {...finished,contactPhone:update.$set.contactPhone};
  });
  const saved=response();
  await updateContactPhone({user:pending,body:{phone:"0987654321",_id:"other",role:"owner"}},saved,fail);
  assert.equal(saved.body.success,true);assert.equal(saved.body.profile.phone,"(+84) 987 654 321");
  assert.equal(saved.headers["Cache-Control"],"private, no-store");
  const invalid=response();
  await updateContactPhone({user:pending,body:{phone:"0112345678"}},invalid,fail);
  assert.equal(invalid.code,400);assert.ok(invalid.body.errors.phone);assert.equal(write.mock.callCount(),1);
  assert.equal(customerProfile({...finished,contactPhone:"(+84) 987 654 321"}).phone,"(+84) 987 654 321");
});

const mockCustomerPage=(t,users)=>{
  const calls={};const query={};
  for(const name of ["select","sort","skip","limit"])query[name]=value=>{calls[name]=value;return query;};
  query.lean=async()=>users;t.mock.method(User,"find",filter=>{calls.filter=filter;return query;});
  t.mock.method(User,"countDocuments",async filter=>{assert.deepEqual(filter,calls.filter);return 62;});return calls;
};
test("customer pages aggregate confirmed orders only for visible customers and default missing totals to zero",async t=>{
  const calls=mockCustomerPage(t,[finished,{...pending,_id:"user_second"}]);
  t.mock.method(Order,"aggregate",async pipeline=>{
    assert.deepEqual(pipeline[0].$match,{userId:{$in:[pending._id,"user_second"]},...placedOrderFilter()});
    assert.deepEqual(pipeline[1].$group.paidTotal,{$sum:{$cond:["$isPaid","$amount",0]}});
    return [{_id:pending._id,orderCount:3,paidTotal:2500000}];
  });
  const res=response();await listCustomers({query:{page:2,pageSize:25}},res,fail);
  assert.deepEqual(calls.filter,{role:{$ne:"owner"}});assert.equal(calls.skip,25);assert.equal(calls.limit,25);assert.doesNotMatch(calls.select,/cartData|cartAddedAt/);
  assert.equal(res.body.totalPages,3);assert.equal(res.body.customers[0].orderCount,3);assert.equal(res.body.customers[0].paidTotal,2500000);assert.equal(res.body.customers[1].orderCount,0);
  assert.equal(res.headers["Cache-Control"],"private, no-store");
});

test("customer search escapes regex metacharacters and matches Vietnamese phone forms",async t=>{
  const calls=mockCustomerPage(t,[]);t.mock.method(Order,"aggregate",()=>assert.fail("Empty pages do not query orders"));
  await listCustomers({query:{q:"A.*[B]"}},response(),fail);const regex=calls.filter.$or[0]["customerProfile.fullName"].$regex;
  assert.equal(new RegExp(regex).test("A.*[B]"),true);assert.equal(new RegExp(regex).test("AXXXB"),false);
  await listCustomers({query:{q:"0912 345 678"}},response(),fail);
  assert.ok(calls.filter.$or.some(item=>item["customerProfile.phone"]&&new RegExp(item["customerProfile.phone"].$regex).test("(+84) 912 345 678")));
});

test("invalid customer pagination and search fail before database reads",async t=>{
  t.mock.method(User,"find",()=>assert.fail("No invalid read"));
  for(const query of [{page:0},{page:1.3},{page:100001},{pageSize:999},{q:"a".repeat(121)},{q:{$gt:""}}]){
    const res=response();await listCustomers({query},res,fail);assert.equal(res.code,400);
  }
});

test("delegated admin profile edits validate fields and atomically exclude privileged accounts",async t=>{
  t.mock.method(User,"findOneAndUpdate",async(filter,update)=>{
    assert.equal(filter._id,pending._id);assert.deepEqual(filter.role,{$ne:"owner"});
    assert.deepEqual(filter["adminAccess.enabled"],{$ne:true});assert.ok(Array.isArray(filter.email.$nin));
    assert.equal(update.$set.email,undefined);assert.equal(update.$set.role,undefined);assert.equal(update.$set.cartData,undefined);
    return {...pending,...update.$set};
  });
  const res=response();await updateCustomer({params:{id:pending._id},body:{...draft,email:"changed@example.com",role:"owner",cartData:{}}},res,fail);
  assert.equal(res.body.customer.fullName,draft.fullName);assert.equal(res.body.customer.email,pending.email);
  const invalid=response();await updateCustomer({params:{id:pending._id},body:{...draft,birthday:"2020-01-01"}},invalid,fail);assert.equal(invalid.code,400);
});

test("both roots can edit their own and each other's profile without changing identity or access",async t=>{
  const previous=process.env.ADMIN_EMAILS;process.env.ADMIN_EMAILS="root@example.com,other-root@example.com";
  t.after(()=>{if(previous===undefined)delete process.env.ADMIN_EMAILS;else process.env.ADMIN_EMAILS=previous;});
  const roots=[{...pending,_id:"user_root",email:"ROOT@example.com",role:"owner"},{...pending,_id:"user_other_root",email:"other-root@example.com",role:"user"}];
  t.mock.method(User,"findOneAndUpdate",async(filter,update,options)=>{
    assert.deepEqual(Object.keys(filter),["_id"]);assert.equal(options.runValidators,true);
    assert.deepEqual(Object.keys(update.$set).sort(),["birthday","birthdayMonthDay","customerProfile"]);
    return {...roots.find(user=>user._id===filter._id),...update.$set};
  });
  for(const actor of roots)for(const target of roots){
    const res=response();await updateCustomer({user:actor,params:{id:target._id},body:{...draft,_id:"changed",email:"changed@example.com",role:"user",adminAccess:{enabled:false},profileOnboardingRequired:false}},res,fail);
    assert.equal(res.code,200);assert.equal(res.body.customer._id,target._id);assert.equal(res.body.customer.email,target.email);assert.equal(res.body.customer.fullName,draft.fullName);assert.equal(res.body.customer.birthday,draft.birthday);assert.ok(res.body.customer.phone.includes("912"));
  }
});

test("delegated admins cannot edit roots or granted admins even with a stale user role cache",async t=>{
  const previous=process.env.ADMIN_EMAILS;process.env.ADMIN_EMAILS="root+shop@example.com,other-root@example.com";
  t.after(()=>{if(previous===undefined)delete process.env.ADMIN_EMAILS;else process.env.ADMIN_EMAILS=previous;});
  const targets=[{...pending,email:" ROOT+SHOP@EXAMPLE.COM "},{...pending,email:"other-root@example.com"},{...pending,adminAccess:{enabled:true}},{...pending,role:"owner"}];
  t.mock.method(User,"findOneAndUpdate",async(filter)=>{
    assert.deepEqual(filter.role,{$ne:"owner"});assert.deepEqual(filter["adminAccess.enabled"],{$ne:true});
    assert.equal(filter.email.$nin.some(regex=>regex.test("rootttshop@example.com")),false,"Root email regex is escaped");
    for(const target of targets)assert.ok(target.role==="owner"||target.adminAccess?.enabled===true||filter.email.$nin.some(regex=>regex.test(target.email)),"Every protected target is excluded by the write filter");
    return null;
  });
  const res=response();await updateCustomer({user:{...pending,role:"owner",adminAccess:{enabled:true}},params:{id:pending._id},body:draft},res,fail);assert.equal(res.code,404);
});

test("missing customers and malformed IDs are rejected without creating accounts",async t=>{
  const write=t.mock.method(User,"findOneAndUpdate",async()=>null);
  const invalid=response();await updateCustomer({params:{id:"$bad/id"},body:draft},invalid,fail);assert.equal(invalid.code,400);assert.equal(write.mock.callCount(),0);
  const missing=response();await updateCustomer({params:{id:"user_missing"},body:draft},missing,fail);assert.equal(missing.code,404);
});

test("the older birthday endpoint cannot accept a minor or bypass a new customer's mandatory profile",async t=>{
  t.mock.method(User,"findOneAndUpdate",()=>assert.fail("No birthday bypass"));
  const underage=response();await saveBirthday({user:{...pending,profileOnboardingRequired:false},body:{birthday:"2020-01-01"}},underage,fail);assert.equal(underage.code,400);
  const pendingRes=response();await saveBirthday({user:pending,body:{birthday:draft.birthday}},pendingRes,fail);assert.equal(pendingRes.code,409);
});

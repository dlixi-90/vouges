import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import User from "../../models/User.js";
import Order from "../../models/Order.js";
import UserAccessAudit from "../../models/UserAccessAudit.js";
import authUser, { requireOwner, requireRootOwner } from "../../middleware/authMiddleware.js";
import userRouter from "../../routes/userRoute.js";
import { accessStore, changeUserRole, isRootAdmin, userAccess, validateRoleChange } from "../../services/userAccess.js";
import { listUsers, listAccessAudit, setUserRole } from "../../controllers/userAccessController.js";
import { mapClerkProfile } from "../../utils/clerkProfile.js";

const response = () => ({code:200,headers:{},set(k,v){this.headers[k]=v;return this;},status(v){this.code=v;return this;},json(v){this.body=v;return this;}});
const root = {_id:"user_root",email:"ROOT@example.com",role:"owner"};
const customer = {_id:"user_customer",email:"customer@example.com",username:"Khách mới",role:"user",cartData:{private:true}};
const clone = value => structuredClone(value);
const value = {role:"owner",version:0,reason:"Bổ nhiệm quản trị cửa hàng",requestId:"request-grant-0001"};
test.beforeEach(t => {
  const previous = process.env.ADMIN_EMAILS;
  process.env.ADMIN_EMAILS="root@example.com,other-root@example.com";
  t.after(()=>{if(previous===undefined)delete process.env.ADMIN_EMAILS;else process.env.ADMIN_EMAILS=previous;});
});

function memory(t, initial=[root,customer]) {
  const users = new Map(initial.map(row=>[row._id,clone(row)])), audits = new Map();
  const state={users,audits,commits:0,writes:0,failAudit:false,conflict:false};
  const query=read=>({session(){return this;},lean:async()=>clone(read()),then(resolve,reject){return Promise.resolve(clone(read())).then(resolve,reject);}});
  t.mock.method(accessStore,"ready",async()=>{});
  t.mock.method(User,"findById",id=>query(()=>users.get(id)||null));
  t.mock.method(UserAccessAudit,"findById",id=>query(()=>audits.get(id)||null));
  t.mock.method(User,"findOneAndUpdate",async(filter,update,options)=>{
    assert.ok(options.session);assert.equal(options.runValidators,true);
    const target=users.get(filter._id);if(!target||state.conflict)return null;
    const expected=filter["adminAccess.version"]??0;assert.equal(target.adminAccess?.version||0,expected);
    assert.deepEqual(Object.keys(update.$set).sort(),["adminAccess","role"]);
    Object.assign(target,clone(update.$set));state.writes++;return clone(target);
  });
  t.mock.method(UserAccessAudit,"create",async(rows,options)=>{
    assert.ok(options.session);if(state.failAudit)throw Error("Audit unavailable");
    for(const row of rows){assert.ok(!audits.has(row._id));audits.set(row._id,clone(row));}return rows;
  });
  t.mock.method(mongoose,"startSession",async()=>({
    async withTransaction(callback){
      const beforeUsers=clone([...users]),beforeAudits=clone([...audits]);
      try{await callback();state.commits++;}catch(error){users.clear();audits.clear();for(const row of beforeUsers)users.set(...row);for(const row of beforeAudits)audits.set(...row);throw error;}
    },async endSession(){},
  }));
  return state;
}

test("effective access trusts protected emails and explicit grants, never a stale role or browser metadata",()=>{
  assert.equal(isRootAdmin(root),true);assert.equal(isRootAdmin({...root,email:"ROOT@EXAMPLE.COM"}),true);
  assert.equal(userAccess({...customer,role:"owner"}).role,"user");
  assert.equal(userAccess({...customer,adminAccess:{enabled:true,version:2}}).role,"owner");
  assert.equal(userAccess({...customer,adminAccess:{enabled:"true"}}).role,"user");
  const mapped=mapClerkProfile({unsafe_metadata:{role:"owner",adminAccess:{enabled:true}},public_metadata:{role:"owner"}});
  assert.equal(mapped.role,undefined);assert.equal(mapped.adminAccess,undefined);
});

test("management routes require owner and privilege writes plus audit additionally require root",()=>{
  const handlers=(path,method)=>userRouter.stack.find(layer=>layer.route?.path===path&&layer.route.methods[method]).route.stack.map(layer=>layer.handle);
  assert.deepEqual(handlers("/manage","get"),[authUser,requireOwner,listUsers]);
  assert.deepEqual(handlers("/manage/:id/role","patch"),[authUser,requireOwner,requireRootOwner,setUserRole]);
  assert.deepEqual(handlers("/access-audit","get"),[authUser,requireOwner,requireRootOwner,listAccessAudit]);
  const denied=response();requireRootOwner({user:{...customer,role:"owner"}},denied,()=>assert.fail("Delegated owner cannot grant roles"));assert.equal(denied.code,403);
});

test("grant commits access and append-only audit together, preserves customer information and survives authentication",async t=>{
  const state=memory(t);const result=await changeUserRole(root._id,customer._id,value);
  assert.equal(result.user.role,"owner");assert.equal(result.user.accessVersion,1);assert.equal(state.commits,1);
  const saved=state.users.get(customer._id);assert.equal(saved.adminAccess.enabled,true);assert.equal(saved.email,customer.email);assert.deepEqual(saved.cartData,customer.cartData);
  const audit=[...state.audits.values()][0];assert.equal(audit.fromRole,"user");assert.equal(audit.toRole,"owner");assert.equal(audit.actorId,root._id);assert.equal(audit.reason,value.reason);assert.ok(audit.at instanceof Date);
  let passed=false;const req={auth:()=>({userId:customer._id})};await authUser(req,response(),()=>{passed=true;});assert.equal(passed,true);assert.equal(req.user.role,"owner");
});

test("revocation denies the next authenticated management request and does not clear orders, points or profile",async t=>{
  const state=memory(t);await changeUserRole(root._id,customer._id,value);
  await changeUserRole(root._id,customer._id,{role:"user",version:1,reason:"Thu hồi quyền theo phân công mới",requestId:"request-revoke-01"});
  const req={auth:()=>({userId:customer._id})};await authUser(req,response(),()=>{});
  const res=response();requireOwner(req,res,()=>assert.fail("Revoked account cannot use admin API"));assert.equal(res.code,403);
  assert.equal(state.audits.size,2);assert.equal(state.users.get(customer._id).adminAccess.enabled,false);assert.deepEqual(state.users.get(customer._id).cartData,customer.cartData);
});

test("roots including another configured root and the current actor cannot be demoted",async t=>{
  const state=memory(t,[root,customer,{_id:"user_other_root",email:"other-root@example.com",role:"user"}]);
  for(const id of [root._id,"user_other_root"])await assert.rejects(changeUserRole(root._id,id,{...value,role:"user"}),error=>error.statusCode===403);
  assert.equal(state.writes,0);assert.equal(state.audits.size,0);
});

test("delegated owners and ordinary users cannot grant privilege even if the service is called directly",async t=>{
  const state=memory(t,[root,customer,{_id:"user_delegate",email:"delegate@example.com",role:"owner",adminAccess:{enabled:true,version:1}}]);
  for(const actor of [customer._id,"user_delegate"])await assert.rejects(changeUserRole(actor,customer._id,value),error=>error.statusCode===403);
  assert.equal(state.writes,0);
});

test("repeated request IDs do not add audit or grant access again after a later revocation",async t=>{
  const state=memory(t);await changeUserRole(root._id,customer._id,value);const replay=await changeUserRole(root._id,customer._id,value);
  assert.equal(replay.replayed,true);assert.equal(state.writes,1);assert.equal(state.audits.size,1);
  await changeUserRole(root._id,customer._id,{...value,role:"user",version:1,requestId:"request-revoke-02"});
  const oldRetry=await changeUserRole(root._id,customer._id,value);assert.equal(oldRetry.user.role,"user");assert.equal(state.writes,2);
  await assert.rejects(changeUserRole(root._id,customer._id,{...value,reason:"Changed intent with reused key"}),error=>error.statusCode===409);
});

test("stale versions, no-op changes and simultaneous edits fail without audit writes",async t=>{
  const state=memory(t);await changeUserRole(root._id,customer._id,value);
  await assert.rejects(changeUserRole(root._id,customer._id,{...value,requestId:"request-stale-001"}),error=>error.statusCode===409);
  await assert.rejects(changeUserRole(root._id,customer._id,{...value,version:1,requestId:"request-noop-0001"}),error=>error.statusCode===409);
  state.conflict=true;await assert.rejects(changeUserRole(root._id,customer._id,{...value,role:"user",version:1,requestId:"request-race-0001"}),error=>error.statusCode===409);
  assert.equal(state.audits.size,1);assert.equal(state.users.get(customer._id).role,"owner");
});

test("audit failure rolls back the role change instead of leaving an unaudited administrator",async t=>{
  const state=memory(t);state.failAudit=true;await assert.rejects(changeUserRole(root._id,customer._id,value),/Audit unavailable/);
  assert.equal(state.users.get(customer._id).role,"user");assert.equal(state.users.get(customer._id).adminAccess,undefined);assert.equal(state.audits.size,0);
});

test("invalid payload, absent verified email and unknown account cannot grant privilege",async t=>{
  const state=memory(t,[root,{...customer,email:""}]);
  for(const input of [null,{}, {...value,role:"superadmin"},{...value,version:-1},{...value,version:0.5},{...value,reason:" "},{...value,reason:"x".repeat(501)},{...value,requestId:"bad"}])assert.throws(()=>validateRoleChange(input));
  await assert.rejects(changeUserRole(root._id,customer._id,value),error=>error.statusCode===400);
  await assert.rejects(changeUserRole(root._id,"user_missing",value),error=>error.statusCode===404);
  await assert.rejects(changeUserRole(root._id,"$invalid/id",value),error=>error.statusCode===400);assert.equal(state.writes,0);
});

test("authorization recalculates effective access after a racing cache write returns a revoked account",async t=>{
  t.mock.method(User,"findById",async()=>({...customer,role:"user",adminAccess:{enabled:true,version:1}}));
  t.mock.method(User,"findOneAndUpdate",async(filter)=>{assert.equal(filter["adminAccess.version"],1);return {...customer,role:"user",adminAccess:{enabled:false,version:2}};});
  const req={auth:()=>({userId:customer._id})};await authUser(req,response(),()=>{});assert.equal(req.user.role,"user");
});

function pageMock(t,rows){
  const calls={};const query={};for(const n of ["select","sort","skip","limit"])query[n]=v=>{calls[n]=v;return query;};query.lean=async()=>rows;
  t.mock.method(User,"find",filter=>{calls.filter=filter;return query;});t.mock.method(User,"countDocuments",async()=>rows.length);
  t.mock.method(Order,"aggregate",()=>assert.fail("The user directory no longer loads order totals"));return calls;
}
test("user directory includes root, delegated admins and customers while hiding raw access data and private cart",async t=>{
  const rows=[root,{...customer,_id:"user_delegate",adminAccess:{enabled:true,version:3}},customer];const calls=pageMock(t,rows);
  const res=response();await listUsers({user:root,query:{}},res,error=>{throw error;});assert.equal(res.body.canManageRoles,true);assert.equal(res.body.users.length,3);
  assert.equal(res.body.users[0].isRootAdmin,true);assert.equal(res.body.users[0].canChangeRole,false);assert.equal(res.body.users[1].role,"owner");assert.equal(res.body.users[1].accessVersion,3);
  assert.equal(res.body.users[2].canChangeRole,true);assert.equal(res.body.users[2].cartData,undefined);assert.equal(res.body.users[1].adminAccess,undefined);assert.doesNotMatch(calls.select,/cartData/);
  assert.equal(res.body.users[2].orderCount,undefined);assert.equal(res.body.users[2].paidTotal,undefined);
  const delegate=response();await listUsers({user:rows[1],query:{}},delegate,error=>{throw error;});assert.equal(delegate.body.canManageRoles,false);assert.ok(delegate.body.users.every(row=>!row.canChangeRole));
});

test("role filtering and escaped searches are combined without losing either permission condition",async t=>{
  const calls=pageMock(t,[]);await listUsers({user:root,query:{role:"owner",q:"A.*[B]"}},response(),error=>{throw error;});
  assert.equal(calls.filter.$and.length,2);assert.equal(calls.filter.$and[0].$or[0].email.$in[0].test("ROOT@EXAMPLE.COM"),true);
  const search=calls.filter.$and[1].$or[0]["customerProfile.fullName"].$regex;assert.ok(new RegExp(search).test("A.*[B]"));assert.ok(!new RegExp(search).test("AXXXB"));
  await listUsers({user:root,query:{role:"user",q:"0912 345 678"}},response(),error=>{throw error;});assert.ok(calls.filter.$and[0].$nor);assert.ok(calls.filter.$and[1].$or.some(item=>item.phone?.$regex.includes("[\\s()-]*")));
});

test("malformed directory and audit filters fail before querying the database",async t=>{
  t.mock.method(User,"find",()=>assert.fail("Invalid directory read"));t.mock.method(UserAccessAudit,"find",()=>assert.fail("Invalid audit read"));
  for(const query of [{role:"root"},{q:{$gt:""}},{page:0},{pageSize:200},{q:"x".repeat(121)}]){const res=response();await listUsers({user:root,query},res,error=>{throw error;});assert.equal(res.code,400);}
  const res=response();await listAccessAudit({query:{userId:{$gt:""}}},res,error=>{throw error;});assert.equal(res.code,400);
});

test("access audit rejects updates, deletes and replacements through model operations",async()=>{
  await assert.rejects(UserAccessAudit.updateOne({},{$set:{reason:"Modified"}}),/append-only/);
  await assert.rejects(UserAccessAudit.deleteMany({}),/append-only/);
  await assert.rejects(UserAccessAudit.replaceOne({},{}),/append-only/);
});

// Browser-only fixtures. None of these writes reach MongoDB or Clerk.
export const createUserAccessFixtures = () => {
  const rows = [
    {_id:"qa-owner",fullName:"Quản trị gốc QA",email:"root.qa@example.com",role:"owner",isRootAdmin:true},
    {_id:"qa-delegate",fullName:"Quản trị được cấp QA",email:"admin.qa@example.com",role:"owner",isRootAdmin:false},
    {_id:"qa-new-customer",fullName:"Khách mới QA",email:"new.customer@example.com",role:"user",isRootAdmin:false},
    ...Array.from({length:27},(_,i)=>({_id:`qa-account-${i}`,fullName:`Khách kiểm thử ${i+1}`,email:`customer${i+1}@example.com`,role:"user",isRootAdmin:false})),
  ].map(row=>({...row,phone:"0912345678",birthday:"2000-01-01",completedAt:"2026-01-01",orderCount:0,paidTotal:0,accessVersion:0}));
  const state={isRoot:true,currentRole:"owner",failNext:false,conflictNext:false},requests=[],entries=[],keys=new Map();
  const ok=body=>({statusCode:200,body:{success:true,...body}}),failure=(statusCode,message)=>({statusCode,body:{success:false,message}});
  return {state,requests,entries,respond(request){
    const url=new URL(request.url),p=url.pathname;
    if(p==="/api/users/access")return ok({role:state.currentRole,isRootAdmin:state.isRoot});
    if(p==="/api/users/manage"&&request.method==="GET"){
      const q=(url.searchParams.get("q")||"").toLowerCase(),role=url.searchParams.get("role")||"all",page=Number(url.searchParams.get("page")||1),pageSize=Number(url.searchParams.get("pageSize")||25);
      const filtered=rows.filter(row=>(role==="all"||row.role===role)&&[row.fullName,row.email,row.phone].some(v=>v.toLowerCase().includes(q)));
      return ok({users:filtered.slice((page-1)*pageSize,page*pageSize).map(row=>({...row,canEditProfile:row.role==="user",canChangeRole:state.isRoot&&!row.isRootAdmin})),total:filtered.length,page,pageSize,totalPages:Math.max(1,Math.ceil(filtered.length/pageSize)),canManageRoles:state.isRoot});
    }
    if(p==="/api/users/access-audit"){
      if(!state.isRoot)return failure(403,"Chỉ quản trị gốc được quản lý phân quyền.");
      const userId=url.searchParams.get("userId"),page=Number(url.searchParams.get("page")||1),pageSize=Number(url.searchParams.get("pageSize")||10),filtered=entries.filter(row=>!userId||row.targetId===userId);
      return ok({entries:filtered.slice((page-1)*pageSize,page*pageSize),total:filtered.length,page,pageSize,totalPages:Math.max(1,Math.ceil(filtered.length/pageSize))});
    }
    if(request.method==="PATCH"&&/^\/api\/users\/manage\/[^/]+\/role$/.test(p)){
      const body=JSON.parse(request.postData),target=rows.find(row=>row._id===p.split("/")[4]);requests.push({path:p,body});
      if(!state.isRoot||target?.isRootAdmin)return failure(403,"Tài khoản được bảo vệ.");
      if(state.failNext){state.failNext=false;return failure(503,"Lỗi kiểm thử, vui lòng thử lại.");}
      if(state.conflictNext){state.conflictNext=false;return failure(409,"Quyền tài khoản vừa thay đổi. Hãy tải lại trước khi xác nhận.");}
      if(keys.has(body.requestId))return ok(keys.get(body.requestId));
      if(!target||body.version!==target.accessVersion)return failure(409,"Quyền vừa thay đổi.");
      entries.unshift({_id:`qa-audit-${entries.length}`,targetId:target._id,targetEmail:target.email,actorEmail:"root.qa@example.com",fromRole:target.role,toRole:body.role,reason:body.reason,at:new Date().toISOString()});
      target.role=body.role;target.accessVersion++;const result={user:{...target}};keys.set(body.requestId,result);return ok(result);
    }
    if(request.method==="PATCH"&&p.startsWith("/api/users/customers/")){
      const target=rows.find(row=>row._id===p.split("/")[4]);Object.assign(target,JSON.parse(request.postData));return ok({customer:target});
    }
    return null;
  }};
};

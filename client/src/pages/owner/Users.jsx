import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, Pencil, Save, X, ShieldCheck, LockKeyhole, History } from "lucide-react";
import { useAppContext } from "../../context/AppContext";
import { CatalogPage, CatalogState, RefreshButton, Badge, useCatalog, Pager } from "../../components/owner/CatalogUI";
import CustomerProfileFields from "../../components/CustomerProfileFields";
import usePaginationScroll from "../../hooks/usePaginationScroll";
import { validateCustomerProfile } from "../../utils/customerProfile";
import { formatVnd } from "../../utils/money";
import "../../customers.css";

const birthdayLabel = value => /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value.split("-").reverse().join("/") : "Chưa cập nhật";

export default function Users(){
  const [q,setQ]=useState(""),[role,setRole]=useState("all"),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(25),[editing,setEditing]=useState(null);
  const [roleTarget,setRoleTarget]=useState(null),[audit,setAudit]=useState(null);
  const query=useCatalog(`/manage?${new URLSearchParams({q,role,page:String(page),pageSize:String(pageSize)})}`,"/api/users");
  const {listRef,changePage}=usePaginationScroll({page,onPageChange:setPage,ready:!query.loading&&query.data?.page===page});
  const rows=query.data?.users || [];
  return <CatalogPage title="Người dùng" className="admin-customers-page" actions={<>{query.data?.canManageRoles&&<button type="button" className="perfume-button" onClick={()=>setAudit({})}><History size={15}/>Nhật ký phân quyền</button>}<RefreshButton onClick={query.reload} disabled={query.loading}/></>}>
    <p className="user-access-intro">Quản lý tài khoản, thông tin khách hàng và vai trò.{query.data?.canManageRoles?" Chỉ quản trị gốc được cấp hoặc thu hồi quyền Admin.":" Quyền Admin do quản trị gốc cấp hoặc thu hồi."}</p>
    <div className="perfume-filter-bar">
      <label className="perfume-search"><Search size={17} aria-hidden="true"/><input aria-label="Tìm người dùng" placeholder="Tìm họ tên, số điện thoại, email…" value={q} maxLength={120} onChange={event=>{setQ(event.target.value);setPage(1);}}/></label>
      <select aria-label="Lọc vai trò" value={role} onChange={event=>{setRole(event.target.value);setPage(1);}}><option value="all">Tất cả vai trò</option><option value="user">Khách hàng</option><option value="owner">Quản trị viên</option></select>
      <select aria-label="Số người dùng mỗi trang" value={pageSize} onChange={event=>{setPageSize(Number(event.target.value));setPage(1);}}>{[10,25,50].map(size=><option key={size} value={size}>{size} người dùng / trang</option>)}</select>
    </div>
    <CatalogState {...query}/>
    <section className="perfume-table-panel" aria-label="Danh sách người dùng">
      <div className="customer-table-heading"><strong>{Number(query.data?.total || 0).toLocaleString("vi-VN")}</strong> người dùng</div>
      <div className="perfume-table-scroll">
        <table className="perfume-table customer-table pagination-list-start" ref={listRef} tabIndex={-1} aria-busy={query.loading}>
          <thead><tr><th>Người dùng</th><th>Liên hệ</th><th>Ngày sinh</th><th>Vai trò</th><th>Đơn đặt hàng</th><th>Đã thanh toán</th><th>Thông tin</th><th>Thao tác</th></tr></thead>
          <tbody>{rows.map(customer=><tr key={customer._id}>
            <td><strong>{customer.fullName || "Chưa cập nhật"}</strong><span className="user-account-id">{customer._id}</span></td><td className="customer-email">{customer.email || "Chưa cập nhật email"}<span className="user-account-id">{customer.phone || "Chưa cập nhật điện thoại"}</span></td>
            <td className="customer-nowrap">{birthdayLabel(customer.birthday)}</td><td><Badge tone={customer.role==="owner"?"warning":"neutral"}>{customer.isRootAdmin?"Quản trị gốc":customer.role==="owner"?"Admin":"Khách hàng"}</Badge></td>
            <td className="customer-number">{Number(customer.orderCount).toLocaleString("vi-VN")}</td><td className="customer-nowrap"><strong>{formatVnd(customer.paidTotal)}</strong></td>
            <td><Badge>{customer.completedAt?"Đã hoàn thiện":"Chưa hoàn thiện"}</Badge></td>
            <td><div className="user-row-actions">{customer.canEditProfile&&<button type="button" className="perfume-button" aria-label={`Chỉnh sửa người dùng ${customer.fullName}`} onClick={()=>setEditing(customer)}><Pencil size={14} aria-hidden="true"/>Chỉnh sửa</button>}{customer.canChangeRole&&<button type="button" className="perfume-button" disabled={customer.role==="user"&&!customer.email} title={!customer.email?"Cần email đã xác minh để cấp quyền":"Thay đổi vai trò"} onClick={()=>setRoleTarget(customer)}><ShieldCheck size={14} aria-hidden="true"/>Phân quyền</button>}{customer.isRootAdmin&&<span className="user-protected"><LockKeyhole size={14} aria-hidden="true"/>Được bảo vệ</span>}</div></td>
          </tr>)}</tbody>
        </table>
        {!query.loading&&!rows.length&&!query.error&&<p className="perfume-empty">{q||role!=="all"?"Không tìm thấy người dùng phù hợp.":"Chưa có người dùng."}</p>}
      </div>
      <Pager page={page} totalPages={query.data?.totalPages} total={query.data?.total} onPage={changePage} disabled={query.loading}/>
    </section>
    {editing&&<CustomerEditor key={editing._id} customer={editing} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);query.reload();}}/>}
    {roleTarget&&<RoleEditor key={roleTarget._id} account={roleTarget} onClose={()=>setRoleTarget(null)} onSaved={()=>{setRoleTarget(null);query.reload();}} onHistory={()=>{setAudit({userId:roleTarget._id,name:roleTarget.fullName});setRoleTarget(null);}}/>}
    {audit&&<AccessAudit userId={audit.userId} name={audit.name} onClose={()=>setAudit(null)}/>}
  </CatalogPage>;
}

const roleLabel = role => role==="owner"?"Admin":"Khách hàng";

function UserDialog({title,children,busy,onClose,className=""}){
  const ref=useRef(null),close=useRef({busy,onClose});
  useEffect(()=>{close.current={busy,onClose};},[busy,onClose]);
  useEffect(()=>{
    const dialog=ref.current,opener=document.activeElement,overflow=document.body.style.overflow;
    const cancel=event=>{event.preventDefault();if(!close.current.busy)close.current.onClose();};
    dialog.addEventListener("cancel",cancel);dialog.showModal();document.body.style.overflow="hidden";
    return ()=>{dialog.removeEventListener("cancel",cancel);dialog.close();document.body.style.overflow=overflow;if(opener instanceof HTMLElement&&opener.isConnected)opener.focus({preventScroll:true});};
  },[]);
  return createPortal(<dialog ref={ref} className={`customer-profile-dialog customer-editor-dialog user-access-dialog ${className}`} aria-labelledby="user-access-title" aria-busy={Boolean(busy)}><header><h2 id="user-access-title">{title}</h2><button type="button" aria-label="Đóng cửa sổ" disabled={busy} onClick={onClose}><X size={20}/></button></header>{children}</dialog>,document.body);
}

function RoleEditor({account,onClose,onSaved,onHistory}){
  const {axios,getToken,storeResources}=useAppContext();
  const [role,setRole]=useState(account.role==="owner"?"user":"owner"),[reason,setReason]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const submitting=useRef(false),request=useRef(null),key=useRef(null);
  useEffect(()=>()=>request.current?.abort(),[]);
  const save=async event=>{
    event.preventDefault();if(submitting.current)return;
    if(reason.trim().length<5||reason.trim().length>500){setError("Nhập lý do từ 5 đến 500 ký tự.");return;}
    const fingerprint=JSON.stringify([role,reason.trim(),account.accessVersion]);
    if(key.current?.fingerprint!==fingerprint)key.current={fingerprint,id:crypto.randomUUID()};
    submitting.current=true;setBusy(true);setError("");const controller=new AbortController();request.current=controller;
    try{
      const token=await getToken();controller.signal.throwIfAborted();
      const {data}=await axios.patch(`/api/users/manage/${encodeURIComponent(account._id)}/role`,{role,reason:reason.trim(),version:account.accessVersion,requestId:key.current.id},{headers:{Authorization:`Bearer ${token}`},signal:controller.signal,timeout:15000});
      if(!data.success)throw Error(data.message||"Không thể cập nhật quyền.");
      if(!controller.signal.aborted){storeResources.invalidateCatalog();onSaved();}
    }catch(err){if(!controller.signal.aborted)setError(err.response?.data?.message||err.message);}
    finally{if(!controller.signal.aborted){submitting.current=false;setBusy(false);}request.current=null;}
  };
  return <UserDialog title="Phân quyền người dùng" busy={busy} onClose={onClose}><p className="customer-editor-email"><strong>{account.fullName}</strong><br/>{account.email}</p><form onSubmit={save} className="user-role-form">
    <label htmlFor="user-role">Vai trò mới</label><select id="user-role" value={role} onChange={event=>setRole(event.target.value)} disabled={busy}><option value="user">Khách hàng</option><option value="owner">Admin</option></select>
    <p className="user-role-explanation">{role==="owner"?"Admin được quản lý sản phẩm, đơn hàng, khách hàng, ưu đãi và hỗ trợ. Chỉ quản trị gốc được quản lý phân quyền.":"Tài khoản trở về khách hàng và không được truy cập API quản trị từ yêu cầu tiếp theo. Đơn hàng, điểm và lịch sử vẫn được giữ."}</p>
    <label htmlFor="user-role-reason">Lý do thay đổi <span aria-hidden="true">*</span></label><textarea id="user-role-reason" rows={3} minLength={5} maxLength={500} required value={reason} onChange={event=>setReason(event.target.value)} disabled={busy} placeholder="Ghi rõ lý do cấp hoặc thu hồi quyền…"/>
    <p className="user-role-note">Mọi thay đổi được lưu cùng người thực hiện và thời điểm.</p>
    {error&&<p role="alert" className="customer-field-error">{error}</p>}
    <footer><button type="button" className="perfume-button user-history-button" disabled={busy} onClick={onHistory}><History size={14}/>Lịch sử</button><button type="button" className="btn-outline" disabled={busy} onClick={onClose}>Hủy</button><button type="submit" className="btn-dark" disabled={busy||role===account.role||reason.trim().length<5}>{busy?"Đang cập nhật…":role==="owner"?"Xác nhận cấp Admin":"Xác nhận thu hồi"}</button></footer>
  </form></UserDialog>;
}

function AccessAudit({userId,name,onClose}){
  const [page,setPage]=useState(1);
  const query=useCatalog(`/access-audit?${new URLSearchParams({page:String(page),pageSize:"10",...(userId?{userId}:{})})}`,"/api/users");
  return <UserDialog title="Nhật ký phân quyền" onClose={onClose} className="user-audit-dialog"><p className="customer-editor-email">{name?`Tài khoản: ${name}`:"Lịch sử cấp và thu hồi quyền Admin trên website."}</p><CatalogState {...query}/><div className="user-audit-list">{(query.data?.entries||[]).map(entry=><article key={entry._id}><div><strong>{entry.targetEmail||entry.targetId}</strong><span>{roleLabel(entry.fromRole)} → {roleLabel(entry.toRole)}</span></div><p>{entry.reason}</p><small>{entry.actorEmail} · {new Date(entry.at).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"})}</small></article>)}{!query.loading&&!query.error&&!query.data?.entries?.length&&<p className="perfume-empty">Chưa có thay đổi phân quyền.</p>}</div><Pager page={page} totalPages={query.data?.totalPages} total={query.data?.total} onPage={setPage} disabled={query.loading}/></UserDialog>;
}

function CustomerEditor({customer,onClose,onSaved}){
  const {axios,getToken,storeResources}=useAppContext();
  const dialog=useRef(null),request=useRef(null),submitting=useRef(false);
  const [draft,setDraft]=useState({fullName:customer.fullName || "",phone:customer.phone || "",birthday:customer.birthday || ""});
  const [errors,setErrors]=useState({}),[error,setError]=useState(""),[busy,setBusy]=useState(false);
  const closeState=useRef({onClose,busy});
  useEffect(()=>{closeState.current={onClose,busy};},[onClose,busy]);
  useEffect(()=>{
    const element=dialog.current,previousOverflow=document.body.style.overflow;
    const cancel=event=>{event.preventDefault();if(!closeState.current.busy)closeState.current.onClose();};
    element.addEventListener("cancel",cancel);
    element.showModal();document.body.style.overflow="hidden";
    return ()=>{request.current?.abort();element.removeEventListener("cancel",cancel);element.close();document.body.style.overflow=previousOverflow;};
  },[]);
  const save=async event=>{
    event.preventDefault();if(submitting.current)return;
    const checked=validateCustomerProfile(draft);setErrors(checked.errors);setError("");
    if(Object.keys(checked.errors).length)return;
    submitting.current=true;setBusy(true);const controller=new AbortController();request.current=controller;
    try{
      const token=await getToken();controller.signal.throwIfAborted();
      const {data}=await axios.patch(`/api/users/customers/${encodeURIComponent(customer._id)}`,checked.value,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal,timeout:15000});
      if(!data.success)throw new Error(data.message || "Không thể lưu thông tin khách hàng.");
      if(controller.signal.aborted)return;
      storeResources.invalidateCatalog();onSaved();
    }catch(err){if(!controller.signal.aborted){setErrors(err.response?.data?.errors || {});setError(err.response?.data?.message || err.message);}}
    finally{if(!controller.signal.aborted){submitting.current=false;setBusy(false);}request.current=null;}
  };
  return createPortal(<dialog ref={dialog} className="customer-profile-dialog customer-editor-dialog" aria-labelledby="customer-editor-title" aria-busy={busy} onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
    <form onSubmit={save} noValidate>
      <header><h2 id="customer-editor-title">Thông tin khách hàng</h2><button type="button" aria-label="Đóng chỉnh sửa khách hàng" disabled={busy} onClick={onClose}><X size={20}/></button></header>
      <p className="customer-editor-email">Email đăng ký: {customer.email || "Chưa cập nhật"}</p>
      <CustomerProfileFields draft={draft} setDraft={setDraft} errors={errors} disabled={busy}/>
      {error&&<p role="alert" className="customer-field-error">{error}</p>}
      <footer><button type="button" className="btn-outline" disabled={busy} onClick={onClose}>Hủy</button><button type="submit" className="btn-dark" disabled={busy}><Save size={15}/>{busy?"Đang lưu…":"Lưu thay đổi"}</button></footer>
    </form>
  </dialog>,document.body);
}

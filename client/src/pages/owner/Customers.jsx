import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Search, Pencil, Save, X } from "lucide-react";
import { useAppContext } from "../../context/AppContext";
import { CatalogPage, CatalogState, RefreshButton, Badge, useCatalog, Pager } from "../../components/owner/CatalogUI";
import CustomerProfileFields from "../../components/CustomerProfileFields";
import usePaginationScroll from "../../hooks/usePaginationScroll";
import { validateCustomerProfile } from "../../utils/customerProfile";
import { formatVnd } from "../../utils/money";
import "../../customers.css";

const birthdayLabel = value => /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value.split("-").reverse().join("/") : "Chưa cập nhật";

export default function Customers(){
  const [q,setQ]=useState(""),[page,setPage]=useState(1),[pageSize,setPageSize]=useState(25),[editing,setEditing]=useState(null);
  const query=useCatalog(`/customers?${new URLSearchParams({q,page:String(page),pageSize:String(pageSize)})}`,"/api/users");
  const {listRef,changePage}=usePaginationScroll({page,onPageChange:setPage,ready:!query.loading&&query.data?.page===page});
  const rows=query.data?.customers || [];
  return <CatalogPage title="Khách hàng" className="admin-customers-page" actions={<RefreshButton onClick={query.reload} disabled={query.loading}/>}>
    <div className="perfume-filter-bar">
      <label className="perfume-search"><Search size={17} aria-hidden="true"/><input aria-label="Tìm khách hàng" placeholder="Tìm họ tên, số điện thoại, email…" value={q} maxLength={120} onChange={event=>{setQ(event.target.value);setPage(1);}}/></label>
      <select aria-label="Số khách hàng mỗi trang" value={pageSize} onChange={event=>{setPageSize(Number(event.target.value));setPage(1);}}>{[10,25,50].map(size=><option key={size} value={size}>{size} khách hàng / trang</option>)}</select>
    </div>
    <CatalogState {...query}/>
    <section className="perfume-table-panel" aria-label="Danh sách khách hàng">
      <div className="customer-table-heading"><strong>{Number(query.data?.total || 0).toLocaleString("vi-VN")}</strong> khách hàng</div>
      <div className="perfume-table-scroll">
        <table className="perfume-table customer-table pagination-list-start" ref={listRef} tabIndex={-1} aria-busy={query.loading}>
          <thead><tr><th>Họ và tên</th><th>Số điện thoại</th><th>Ngày sinh</th><th>Email</th><th>Đơn đặt hàng</th><th>Đã thanh toán</th><th>Thông tin</th><th><span className="sr-only">Chỉnh sửa</span></th></tr></thead>
          <tbody>{rows.map(customer=><tr key={customer._id}>
            <td><strong>{customer.fullName || "Chưa cập nhật"}</strong></td><td className="customer-nowrap">{customer.phone || "Chưa cập nhật"}</td>
            <td className="customer-nowrap">{birthdayLabel(customer.birthday)}</td><td className="customer-email">{customer.email || "Chưa cập nhật"}</td>
            <td className="customer-number">{Number(customer.orderCount).toLocaleString("vi-VN")}</td><td className="customer-nowrap"><strong>{formatVnd(customer.paidTotal)}</strong></td>
            <td><Badge>{customer.completedAt?"Đã hoàn thiện":"Chưa hoàn thiện"}</Badge></td>
            <td><button type="button" className="perfume-button" aria-label={`Chỉnh sửa khách hàng ${customer.fullName}`} onClick={()=>setEditing(customer)}><Pencil size={14} aria-hidden="true"/>Chỉnh sửa</button></td>
          </tr>)}</tbody>
        </table>
        {!query.loading&&!rows.length&&!query.error&&<p className="perfume-empty">{q?"Không tìm thấy khách hàng phù hợp.":"Chưa có khách hàng."}</p>}
      </div>
      <Pager page={page} totalPages={query.data?.totalPages} total={query.data?.total} onPage={changePage} disabled={query.loading}/>
    </section>
    {editing&&<CustomerEditor key={editing._id} customer={editing} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);query.reload();}}/>}
  </CatalogPage>;
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

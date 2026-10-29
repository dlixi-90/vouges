import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useClerk } from "@clerk/react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useAppContext } from "../context/AppContext";
import { validateCustomerProfile } from "../utils/customerProfile";
import CustomerProfileFields from "./CustomerProfileFields";

export default function CustomerProfileDialog() {
  const {customerProfile,authenticatedUserId,applyCustomerProfile,storeResources,axios,getToken} = useAppContext();
  const {signOut} = useClerk();
  const dialog = useRef(null), request = useRef(null), submitting = useRef(false);
  const [draft,setDraft] = useState({
    fullName:customerProfile.fullName==="Thành viên Velours"?"":customerProfile.fullName || "",
    phone:customerProfile.phone || "",birthday:customerProfile.birthday || "",
  });
  const [errors,setErrors] = useState({}), [error,setError] = useState(""), [busy,setBusy] = useState(false);
  useEffect(()=>{
    const element=dialog.current,previousFocus=document.activeElement,previousOverflow=document.body.style.overflow;
    const preventClose=event=>event.preventDefault();
    element.addEventListener("cancel",preventClose);
    element.showModal();document.body.style.overflow="hidden";
    return ()=>{request.current?.abort();element.removeEventListener("cancel",preventClose);element.close();document.body.style.overflow=previousOverflow;previousFocus?.focus?.({preventScroll:true});};
  },[]);
  const save = async event => {
    event.preventDefault();
    if(submitting.current)return;
    const checked=validateCustomerProfile(draft);setErrors(checked.errors);setError("");
    if(Object.keys(checked.errors).length){
      dialog.current.querySelector(`[name="${Object.keys(checked.errors)[0]}"]`)?.focus();return;
    }
    submitting.current=true;setBusy(true);
    const controller=new AbortController();request.current=controller;
    try{
      const token=await getToken();controller.signal.throwIfAborted();
      const {data}=await axios.patch("/api/users/profile",checked.value,{headers:{Authorization:`Bearer ${token}`},signal:controller.signal,timeout:15000});
      if(!data.success || data.profile?.needsCompletion!==false)throw new Error(data.message || "Không thể lưu thông tin khách hàng.");
      if(controller.signal.aborted)return;
      storeResources.invalidateMembership();
      applyCustomerProfile(authenticatedUserId,data.profile);
    }catch(err){
      if(!controller.signal.aborted){setErrors(err.response?.data?.errors || {});setError(err.response?.data?.message || err.message);}
    }finally{if(!controller.signal.aborted){submitting.current=false;setBusy(false);}request.current=null;}
  };
  return createPortal(<dialog ref={dialog} closedby="none" className="customer-profile-dialog" aria-labelledby="customer-profile-title" aria-describedby="customer-profile-intro" aria-busy={busy}
    onCancel={event=>event.preventDefault()}>
    <form onSubmit={save} noValidate>
      <p className="customer-profile-eyebrow">CHÀO MỪNG ĐẾN VỚI VELOURS</p>
      <h2 id="customer-profile-title">Hoàn thiện thông tin</h2>
      <p id="customer-profile-intro">Một vài thông tin để Velours chăm sóc bạn tốt hơn. Vui lòng hoàn tất trước khi tiếp tục.</p>
      <CustomerProfileFields draft={draft} setDraft={setDraft} errors={errors} disabled={busy}/>
      {error&&<p className="customer-field-error" role="alert">{error}</p>}
      <button type="submit" className="btn-dark customer-profile-submit" disabled={busy}>{busy?<><LoaderCircle size={17} className="animate-spin"/>Đang lưu thông tin…</>:<>Lưu và tiếp tục <ArrowRight size={17}/></>}</button>
      <button type="button" className="customer-profile-signout" disabled={busy} onClick={()=>signOut({redirectUrl:"/"})}>Đăng xuất</button>
    </form>
  </dialog>,document.body);
}

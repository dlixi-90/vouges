import {useCallback,useEffect,useState} from "react";
import {RefreshCw} from "lucide-react";
import Pagination from "../Pagination";
import {useAppContext} from "../../context/AppContext";

export function useCatalog(path,apiRoot="/api/catalog"){
  const {axios,getToken}=useAppContext();const [data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[attempt,setAttempt]=useState(0);
  const reload=useCallback(()=>setAttempt(value=>value+1),[]);
  useEffect(()=>{
    if(!path)return;const controller=new AbortController();
    const timer=setTimeout(async()=>{
      setLoading(true);setError("");
      try{const result=await axios.get(`${apiRoot}${path}`,{headers:{Authorization:`Bearer ${await getToken()}`},signal:controller.signal});if(!result.data.success)throw new Error(result.data.message);if(!controller.signal.aborted)setData(result.data);}
      catch(err){if(!controller.signal.aborted)setError(err.response?.data?.message||err.message);}
      finally{if(!controller.signal.aborted)setLoading(false);}
    },150);
    return()=>{clearTimeout(timer);controller.abort();};
  },[path,apiRoot,attempt,axios,getToken]);
  return {data,loading,error,reload};
}

export function CatalogPage({eyebrow="VELOURS / QUẢN TRỊ NƯỚC HOA",title,description,actions,children}){
  return <section className="perfume-workspace"><header className="perfume-page-heading"><div><p className="perfume-eyebrow">{eyebrow}</p><h1>{title}</h1>{description&&<p className="perfume-page-description">{description}</p>}</div><div className="perfume-heading-actions">{actions}</div></header>{children}</section>;
}
export function CatalogState({loading,error,reload}){
  return error?<div role="alert" className="perfume-alert">{error}<button type="button" onClick={reload}>Thử lại</button></div>:loading?<p className="perfume-loading" role="status">Đang tải dữ liệu…</p>:null;
}
export function RefreshButton({onClick,disabled}){return <button type="button" className="perfume-button" disabled={disabled} onClick={onClick}><RefreshCw size={15}/>Làm mới</button>;}
export function Badge({children,tone="neutral"}){return <span className={`perfume-badge tone-${tone}`}>{children}</span>;}
export function Pager({page,totalPages,total,onPage,disabled=false}){
  return <div className="perfume-pagination"><span>{Number(total||0).toLocaleString("vi-VN")} bản ghi · Trang {page}/{totalPages||1}</span><Pagination label="Phân trang dữ liệu" page={page} totalPages={totalPages} onPageChange={onPage} disabled={disabled}/></div>;
}
export const issueLabels={missing_brand:"Thiếu thương hiệu",missing_concentration:"Thiếu nồng độ",missing_scent_group:"Thiếu nhóm hương",missing_images:"Thiếu ảnh",missing_scent_notes:"Thiếu tầng hương",zero_source_price:"Có dung tích giá 0",source_assessment_anomaly:"Chỉ số nguồn bất thường"};

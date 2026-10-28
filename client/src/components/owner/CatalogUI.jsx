import {useCallback,useEffect,useRef,useState} from "react";
import {RefreshCw} from "lucide-react";
import Pagination from "../Pagination";
import {useAppContext} from "../../context/AppContext";

// Preserve the existing shared dashboard hook/component import API.
// eslint-disable-next-line react-refresh/only-export-components
export function useCatalog(path,apiRoot="/api/catalog"){
  const {storeResources,authenticatedUserId}=useAppContext();
  const key=`${authenticatedUserId}:${apiRoot}${path}`;
  const cached=path?storeResources.peekCatalog(path,apiRoot):null;
  const [result,setResult]=useState({key:"",data:null,error:""}),[attempt,setAttempt]=useState(0);
  const force=useRef(false);
  const reload=useCallback(()=>{force.current=true;setAttempt(value=>value+1);},[]);
  useEffect(()=>{
    if(!path)return;let active=true;
    const forceRead=force.current;force.current=false;
    const timer=setTimeout(async()=>{
      try{const data=await storeResources.loadCatalog(path,apiRoot,{force:forceRead});if(active)setResult({key,data,error:""});}
      catch(err){if(active&&err.name!=="AbortError"&&err.code!=="ERR_CANCELED")setResult(current=>({data:current.key===key?current.data:null,key,error:err.response?.data?.message||err.message}));}
    },/[?&]q=[^&]+/.test(path)?120:0);
    return()=>{clearTimeout(timer);active=false;};
  },[path,apiRoot,attempt,storeResources,key]);
  return {data:cached||(result.key===key?result.data:null),loading:Boolean(path&&!cached&&result.key!==key),error:result.key===key?result.error:"",reload};
}

export function CatalogPage({title,actions,children,className=""}){
  return <section className={`perfume-workspace ${className}`}><header className="perfume-page-heading"><h1>{title}</h1><div className="perfume-heading-actions">{actions}</div></header>{children}</section>;
}
export function CatalogState({loading,error,reload}){
  return error?<div role="alert" className="perfume-alert">{error}<button type="button" onClick={reload}>Thử lại</button></div>:loading?<p className="perfume-loading" role="status">Đang tải dữ liệu…</p>:null;
}
export function RefreshButton({onClick,disabled}){return <button type="button" className="perfume-button" disabled={disabled} onClick={onClick}><RefreshCw size={15}/>Làm mới</button>;}
export function Badge({children,tone="neutral"}){return <span className={`perfume-badge tone-${tone}`}>{children}</span>;}
export function Pager({page,totalPages,total,onPage,disabled=false}){
  return <div className="perfume-pagination"><span>{Number(total||0).toLocaleString("vi-VN")} bản ghi · Trang {page}/{totalPages||1}</span><Pagination label="Phân trang dữ liệu" page={page} totalPages={totalPages} onPageChange={onPage} disabled={disabled}/></div>;
}
// eslint-disable-next-line react-refresh/only-export-components
export const issueLabels={missing_brand:"Thiếu thương hiệu",missing_concentration:"Thiếu nồng độ",missing_scent_group:"Thiếu nhóm hương",missing_images:"Thiếu ảnh",missing_scent_notes:"Thiếu tầng hương",zero_source_price:"Có dung tích giá 0",source_assessment_anomaly:"Chỉ số nguồn bất thường"};

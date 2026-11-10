import {useEffect,useMemo,useRef} from "react";
import {RefreshCw} from "lucide-react";
import {Link} from "react-router-dom";
import Pagination from "../Pagination";
import {useAppContext} from "../../context/AppContext";
import useCachedResource from "../../hooks/useCachedResource";
import {LoadingStatus} from "../LoadingState";
import {prefetchOwnerRoute} from "../../utils/ownerPrefetch";

// Preserve the existing shared dashboard hook/component import API.
// eslint-disable-next-line react-refresh/only-export-components
export function useCatalog(path,apiRoot="/api/catalog"){
  const {storeResources,authenticatedUserId}=useAppContext();
  const resource=useMemo(()=>path?{
    peek:()=>storeResources.peekCatalog(path,apiRoot),
    load:options=>storeResources.loadCatalog(path,apiRoot,options),
  }:null,[storeResources,path,apiRoot]);
  const query=useCachedResource(resource,{scope:`${authenticatedUserId}:${apiRoot}${path?.split("?")[0]}`,keepPrevious:true,delay:/[?&]q=[^&]+/.test(path||"")?120:0});
  const {reload}=query;
  useEffect(()=>{
    if(!path||!storeResources.subscribeCatalog)return undefined;
    const unsubscribe=storeResources.subscribeCatalog(()=>reload());
    const onStorage=event=>{
      if(event.key==="velours:catalog-updated"){
        storeResources.invalidateCatalog();
      }
    };
    window.addEventListener("storage",onStorage);
    return()=>{
      unsubscribe();
      window.removeEventListener("storage",onStorage);
    };
  },[path,storeResources,reload]);
  return query;
}

export function CatalogPage({title,actions,children,className=""}){
  return <section className={`perfume-workspace ${className}`}><header className="perfume-page-heading"><h1>{title}</h1><div className="perfume-heading-actions">{actions}</div></header>{children}</section>;
}
export function OwnerLink({to,onPointerEnter,onPointerLeave,onFocus,onClick,...props}){
  const context=useAppContext(),timer=useRef(null);
  const cancel=()=>{window.clearTimeout(timer.current);timer.current=null;};
  const warm=()=>{if(typeof to==="string")void prefetchOwnerRoute(to,context);};
  useEffect(()=>()=>window.clearTimeout(timer.current),[]);
  return <Link {...props} to={to}
    onClick={event => {
      onClick?.(event);
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }}
    onPointerEnter={event=>{onPointerEnter?.(event);cancel();timer.current=window.setTimeout(warm,40);}}
    onPointerLeave={event=>{onPointerLeave?.(event);cancel();}}
    onFocus={event=>{onFocus?.(event);cancel();warm();}} />;
}
export function CatalogState({loading,error,reload,data}){
  return <div className="resource-loading-state">{error?<div role="alert" className="perfume-alert">{error}<button type="button" onClick={reload}>Thử lại</button></div>:<LoadingStatus active={loading && data == null} label="Đang tải dữ liệu…" />}</div>;
}
export function RefreshButton({onClick,disabled}){return <button type="button" className="perfume-button" disabled={disabled} onClick={onClick}><RefreshCw size={15}/>Làm mới</button>;}
export function Badge({children,tone="neutral"}){return <span className={`perfume-badge tone-${tone}`}>{children}</span>;}
export function Pager({page,totalPages,total,onPage,disabled=false}){
  return <div className="perfume-pagination"><span>{Number(total||0).toLocaleString("vi-VN")} bản ghi · Trang {page}/{totalPages||1}</span><Pagination label="Phân trang dữ liệu" page={page} totalPages={totalPages} onPageChange={onPage} disabled={disabled}/></div>;
}
// eslint-disable-next-line react-refresh/only-export-components
export const issueLabels={missing_brand:"Thiếu thương hiệu",missing_concentration:"Thiếu nồng độ",missing_scent_group:"Thiếu nhóm hương",missing_images:"Thiếu ảnh",missing_scent_notes:"Thiếu thông tin nốt hương",missing_sizes:"Chưa có dung tích",zero_source_price:"Có dung tích giá 0",source_assessment_anomaly:"Chỉ số nguồn bất thường",source_profile_conflict:"Thông tin nguồn chưa thống nhất"};

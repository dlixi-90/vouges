import ArticleEditorShell from "../../components/owner/ArticleEditorShell";
import { useCallback, useEffect, useRef, useState, lazy, Suspense } from "react";
import {useSearchParams} from "react-router-dom";
import {Search,X,Save,Plus,Pencil,Trash2,Upload} from "lucide-react";
import toast from "react-hot-toast";
import {useAppContext} from "../../context/AppContext";
import {CatalogPage,CatalogState,Pager,Badge,RefreshButton,useCatalog} from "../../components/owner/CatalogUI";
import usePaginationScroll from "../../hooks/usePaginationScroll";
import {sanitizeArticle,LIBRARY_ARTICLE_LIMITS} from "../../utils/productArticle";
import {LIBRARY_KINDS} from "../../utils/fragranceLibrary";
import {getProductImageUrl} from "../../utils/productImage";
const loadArticleEditor=()=>import("../../components/owner/ProductArticleEditor");
const ProductArticleEditor=lazy(loadArticleEditor);
const kinds=["group","accord","note"];
const libraryTitle=kind=>kind==="brand"?"Thương hiệu":LIBRARY_KINDS[kind].title;

export default function FragranceLibrary({brands=false}){
  const [params,setParams]=useSearchParams();
  const kind=brands?"brand":kinds.includes(params.get("kind"))?params.get("kind"):"group";
  return <LibraryManager key={kind} kind={kind} onKind={value=>setParams({kind:value})}/>;
}

function LibraryManager({kind,onKind}){
  const {storeResources,publicCatalog,dashboardCache}=useAppContext();
  const [q,setQ]=useState(""),[debouncedQ,setDebouncedQ]=useState(""),[status,setStatus]=useState(""),[page,setPage]=useState(1),[editing,setEditing]=useState(null),[deleting,setDeleting]=useState(null);
  const isComposingRef=useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isComposingRef.current) {
        setDebouncedQ(q);
        setPage(1);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [q]);

  const label=libraryTitle(kind).toLocaleLowerCase("vi-VN");
  const query=useCatalog(`/terms?${new URLSearchParams({kind,q:debouncedQ,status,page:String(page),pageSize:"25"})}`);
  const rows=(query.data?.terms||[]).filter(term=>term.kind===kind);
  const deletingTerm=deleting?{...deleting,productCount:deleting.productCount}:null;
  const {listRef,changePage}=usePaginationScroll({page,onPageChange:setPage,ready:!query.loading&&query.data?.page===page});
  const warmKind=useCallback(targetKind=>{
    if(!targetKind||targetKind==="brand")return;
    void storeResources.loadCatalog(`/terms?${new URLSearchParams({kind:targetKind,q:"",status:"",page:"1",pageSize:"25"})}`).catch(()=>{});
  },[storeResources]);
  // Warm the TipTap chunk and sibling library tabs immediately so switching tabs or
  // opening "Giới thiệu" does not wait on serial downloads.
  useEffect(()=>{
    if(kind==="brand")return;
    void loadArticleEditor().catch(()=>{});
    const idle=window.requestIdleCallback||(callback=>window.setTimeout(callback,180));
    const cancel=window.cancelIdleCallback||window.clearTimeout;
    const handle=idle(()=>{
      for(const otherKind of kinds){if(otherKind!==kind)warmKind(otherKind);}
    });
    return()=>cancel(handle);
  },[kind,warmKind]);
  const warmTerm=term=>{if(kind!=="brand"&&term?._id){void loadArticleEditor().catch(()=>{});void storeResources.loadCatalog(`/terms/${term._id}`).catch(()=>{});}};
  const changed=action=>{
    storeResources.invalidateCatalog();publicCatalog.clear();dashboardCache.clear();setEditing(null);setDeleting(null);
    if(action==="create"){setQ("");setStatus("");if(page!==1){setPage(1);return;}}
    if(action==="delete"&&rows.length===1&&page>1){setPage(page-1);return;}
    query.reload();
  };
  return <CatalogPage title={kind==="brand"?"Thương hiệu":"Thư viện hương"} actions={<><RefreshButton onClick={query.reload} disabled={query.loading}/><button type="button" className="perfume-button primary" onClick={()=>setEditing({kind,name:"",description:"",descriptionContent:null,image:"",contentStatus:"linked"})}><Plus size={16}/>Thêm {label}</button></>}>
    {kind!=="brand"&&<nav className="perfume-tabs" aria-label="Loại thư viện">{kinds.map(value=><button type="button" key={value} className={kind===value?"active":""} onPointerEnter={()=>warmKind(value)} onFocus={()=>warmKind(value)} onClick={()=>onKind(value)}>{LIBRARY_KINDS[value].title}</button>)}</nav>}
    <div className="perfume-filter-bar">
      <label className="perfume-search">
        <Search size={17} aria-hidden="true" />
        <input
          type="text"
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          aria-label="Tìm trong thư viện"
          placeholder={`Tìm ${label}…`}
          value={q}
          onChange={event => setQ(event.target.value)}
          onCompositionStart={() => { isComposingRef.current = true; }}
          onCompositionEnd={event => {
            isComposingRef.current = false;
            setQ(event.target.value);
          }}
          onKeyDown={event => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (!isComposingRef.current) {
                setDebouncedQ(q);
                setPage(1);
              }
            }
          }}
        />
        {q && (
          <button
            type="button"
            onClick={() => {
              setQ("");
              setDebouncedQ("");
              setPage(1);
            }}
            aria-label="Xóa từ khóa"
          >
            <X size={15} />
          </button>
        )}
      </label>
      {kind !== "brand" && (
        <select
          aria-label="Tình trạng nội dung"
          value={status}
          onChange={event => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Toàn bộ nội dung</option>
          <option value="linked">Cần biên soạn</option>
          <option value="complete">Đã hoàn thiện</option>
        </select>
      )}
    </div>
    <CatalogState {...query}/><section className="perfume-table-panel"><div className="perfume-table-scroll"><table ref={listRef} tabIndex={-1} className="perfume-table pagination-list-start"><thead><tr><th>{kind==="brand"?"Thương hiệu":"Tên mục"}</th><th>Sản phẩm liên kết</th>{kind!=="brand"&&<th>Nội dung</th>}<th><span className="sr-only">Thao tác</span></th></tr></thead><tbody>{rows.map(term=><tr key={term._id} onPointerEnter={()=>warmTerm(term)}><td><strong>{term.name||"Chưa có tên"}</strong></td><td>{term.productCount??0}</td>{kind!=="brand"&&<td><Badge tone={term.contentStatus==="complete"?"green":"amber"}>{term.contentStatus==="complete"?"Đã hoàn thiện":"Cần biên soạn"}</Badge></td>}<td><div className="perfume-library-actions"><button type="button" className="perfume-icon-button" onPointerEnter={()=>warmTerm(term)} onFocus={()=>warmTerm(term)} onClick={()=>setEditing(term)} aria-label={`Sửa ${label} ${term.name}`} title="Chỉnh sửa"><Pencil size={16}/></button><button type="button" className="perfume-icon-button perfume-library-delete" onClick={()=>setDeleting(term)} aria-label={`Xóa ${label} ${term.name}`} title="Xóa" style={{ color: "#ef4444" }}><Trash2 size={16} style={{ color: "#ef4444" }}/></button></div></td></tr>)}</tbody></table>{!query.loading&&!rows.length&&<p className="perfume-empty">Không tìm thấy mục phù hợp.</p>}</div><Pager page={page} totalPages={query.data?.totalPages} total={query.data?.total} onPage={changePage} disabled={query.loading}/></section>
    {editing&&<LibraryEditor key={editing._id||"new"} term={editing} onClose={()=>setEditing(null)} onSaved={()=>changed(editing._id?"edit":"create")}/>}
    {deletingTerm&&<DeleteLibraryDialog term={deletingTerm} onClose={()=>setDeleting(null)} onDeleted={()=>changed("delete")}/>}
  </CatalogPage>;
}

function useLibraryDialog(){
  const ref=useRef(null);
  useEffect(()=>{const dialog=ref.current,previous=document.body.style.overflow;dialog.showModal();document.body.style.overflow="hidden";return()=>{dialog.close();document.body.style.overflow=previous;};},[]);
  return ref;
}

function LibraryEditor({term,onClose,onSaved}){
  const {axios,getToken}=useAppContext(),ref=useLibraryDialog(),submitting=useRef(false);
  const detailQuery=useCatalog(term._id?`/terms/${term._id}`:null);
  const [draftOverrides,setDraftOverrides]=useState({});
  const [busy,setBusy]=useState(false),[uploading,setUploading]=useState(false),[coverUploading,setCoverUploading]=useState(false),[error,setError]=useState("");
  const source=detailQuery.data?.term||term;
  const draft={name:source.name||"",description:source.description||"",descriptionContent:source.descriptionContent??null,image:source.image||"",contentStatus:source.contentStatus||"linked",...draftOverrides};
  const updateDraft=patch=>setDraftOverrides(current=>({...current,...patch}));
  const detailsLoading=Boolean(term._id&&detailQuery.loading),detailsError=Boolean(term._id&&detailQuery.error),locked=busy||uploading||coverUploading,formLocked=locked||detailsLoading||detailsError,creating=!term._id,label=libraryTitle(term.kind).toLocaleLowerCase("vi-VN");
  const save=async event=>{
    event.preventDefault();if(locked||detailsLoading||detailsError||submitting.current)return;
    submitting.current=true;setBusy(true);setError("");
    try{
      const payload={...(term.kind==="brand"?{name:draft.name,image:draft.image}:{...draft,descriptionContent:sanitizeArticle(draft.descriptionContent,LIBRARY_ARTICLE_LIMITS)}),...(creating?{kind:term.kind}:{expectedUpdatedAt:term.updatedAt})};
      const options={headers:{Authorization:`Bearer ${await getToken()}`},timeout:30000};
      const {data}=creating?await axios.post("/api/catalog/terms",payload,options):await axios.patch(`/api/catalog/terms/${term._id}`,payload,options);
      if(!data.success)throw new Error(data.message||"Không thể lưu nội dung thư viện.");
      toast.success(creating?`Đã thêm ${label}`:"Đã lưu nội dung thư viện");onSaved();
    }catch(err){setError(err.response?.data?.message||err.message);}finally{submitting.current=false;setBusy(false);}
  };
  const uploadCover=async file=>{
    if(!file||locked)return;
    if(!["image/png","image/jpeg","image/webp"].includes(file.type)||file.size>5*1024*1024){setError("Chọn ảnh PNG, JPEG hoặc WebP, tối đa 5 MB.");return;}
    setCoverUploading(true);setError("");
    try{
      const form=new FormData();form.append("images",file);
      const {data}=await axios.post("/api/catalog/media",form,{headers:{Authorization:`Bearer ${await getToken()}`},timeout:30000});
      if(!data.success||!data.images?.[0])throw new Error(data.message||"Không thể tải ảnh.");
      updateDraft({image:data.images[0]});
    }catch(err){setError(err.response?.data?.message||err.message);}finally{setCoverUploading(false);}
  };
  return <dialog ref={ref} className="perfume-library-dialog" aria-labelledby="library-editor-title" aria-busy={formLocked} onCancel={event=>{event.preventDefault();if(!locked)onClose();}}>
    <form onSubmit={save}>
      <header><div><p className="perfume-eyebrow">THƯ VIỆN VELOURS</p><h2 id="library-editor-title">{creating?"Thêm":"Chỉnh sửa"} {label}</h2></div><button type="button" className="perfume-icon-button" disabled={locked} onClick={onClose} aria-label="Đóng biên tập"><X size={20}/></button></header>
      {term._id&&(term.kind==="brand"||detailsError)&&<CatalogState {...detailQuery}/>} {error&&<p role="alert" className="perfume-alert">{error}</p>}
      <label className="perfume-field"><span>Tên {label}</span><input autoFocus required maxLength={["note","accord"].includes(term.kind)?160:200} disabled={formLocked} value={draft.name} onChange={event=>updateDraft({name:event.target.value})}/></label>
      <section className="perfume-library-cover" aria-label="Ảnh đại diện">
        {draft.image&&<img src={getProductImageUrl(draft.image, 180)} alt="Ảnh đại diện" width="88" height="88" loading="lazy" decoding="async"/>}<div><p>Ảnh đại diện</p><div className="perfume-library-actions"><label className={`perfume-button${formLocked?" is-disabled":""}`}><Upload size={15}/>{coverUploading?"Đang tải…":draft.image?"Thay ảnh":"Thêm ảnh"}<input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Tải ảnh đại diện" disabled={formLocked} onChange={event=>{void uploadCover(event.target.files[0]);event.target.value="";}}/></label>{draft.image&&<button type="button" className="perfume-icon-button perfume-library-delete" disabled={formLocked} onClick={()=>updateDraft({image:""})} aria-label="Bỏ ảnh đại diện" style={{ color: "#ef4444" }}><Trash2 size={16} style={{ color: "#ef4444" }}/></button>}</div></div>
      </section>
      {term.kind!=="brand"&&<><section className="perfume-library-introduction" aria-labelledby="library-introduction-title"><h3 id="library-introduction-title">Giới thiệu</h3>{!detailsError&&<Suspense fallback={<ArticleEditorShell library label={detailsLoading?"Đang tải nội dung giới thiệu…":"Đang tải trình soạn thảo…"}/>}><ProductArticleEditor library loading={detailsLoading} value={draft.descriptionContent} text={draft.description} disabled={formLocked} ariaLabel="Trình soạn thảo giới thiệu" onUploadingChange={setUploading} onChange={(descriptionContent,description)=>updateDraft({descriptionContent,description})}/></Suspense>}</section>
      <label className="perfume-field"><span>Tình trạng biên soạn</span><select disabled={formLocked} value={draft.contentStatus} onChange={event=>updateDraft({contentStatus:event.target.value})}><option value="linked">Cần biên soạn</option><option value="complete">Đã hoàn thiện</option></select></label></>}
      <footer><button type="button" className="perfume-button" disabled={locked} onClick={onClose}>Hủy</button><button type="submit" className="perfume-button primary" disabled={formLocked}><Save size={15}/>{busy?"Đang lưu…":uploading||coverUploading?"Đang tải ảnh…":detailsLoading?"Đang tải…":creating?`Thêm ${label}`:"Lưu thay đổi"}</button></footer>
    </form>
  </dialog>;
}

function DeleteLibraryDialog({term,onClose,onDeleted}){
  const {axios,getToken}=useAppContext(),ref=useLibraryDialog(),submitting=useRef(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState("");
  const label=libraryTitle(term.kind).toLocaleLowerCase("vi-VN");
  const remove=async()=>{
    if(submitting.current)return;submitting.current=true;setBusy(true);setError("");
    try{
      const {data}=await axios.delete(`/api/catalog/terms/${term._id}`,{data:{expectedUpdatedAt:term.updatedAt},headers:{Authorization:`Bearer ${await getToken()}`},timeout:30000});
      if(!data.success)throw new Error(data.message||"Không thể xóa mục này.");
      toast.success(`Đã xóa ${label}`);onDeleted();
    }catch(err){setError(err.response?.data?.message||err.message);}finally{submitting.current=false;setBusy(false);}
  };
  return <dialog ref={ref} className="perfume-library-delete-dialog" aria-labelledby="library-delete-title" aria-describedby="library-delete-description" onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
    <h2 id="library-delete-title">Xóa {label}?</h2><p id="library-delete-description">Mục “{term.name}” và phần giới thiệu của mục sẽ bị xóa khỏi thư viện.</p>
    {term.productCount==null&&<p>Đang tải số sản phẩm liên kết; máy chủ sẽ kiểm tra trước khi xóa.</p>}{term.productCount>0&&<p>Có {term.productCount.toLocaleString("vi-VN")} sản phẩm đang liên kết. Cần đổi thông tin tương ứng trên các sản phẩm đó trước khi xóa mục này.</p>}
    {error&&<p role="alert" className="perfume-alert">{error}</p>}
    <footer><button autoFocus type="button" className="perfume-button" disabled={busy} onClick={onClose}>Hủy</button><button type="button" className="perfume-button perfume-library-delete-confirm" disabled={busy} onClick={remove}><Trash2 size={15}/>{busy?"Đang xóa…":`Xóa ${label}`}</button></footer>
  </dialog>;
}

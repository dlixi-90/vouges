import {useEffect,useId,useRef,useState} from "react";
import {useSearchParams} from "react-router-dom";
import toast from "react-hot-toast";
import {useAppContext} from "../../context/AppContext";
import {Award,ChevronDown,Crown,Gift,History,Plus,ReceiptText,RotateCw,Search,ShieldCheck,Sparkles,Users} from "lucide-react";
import {Badge,CatalogPage,CatalogState,RefreshButton} from "../../components/owner/CatalogUI";
import {OperationsEmptyState,OperationsMetric,OperationsPanel} from "../../components/owner/OperationsUI";
import OperationsDrawer from "../../components/owner/OperationsDrawer";
import useLoyaltyResource from "../../hooks/useLoyaltyResource";
import {formatVnd} from "../../utils/money";
import "../../loyalty-admin.css";

const ids=["signature","prestige","elite","private-circle"];
const statuses={Pending:"Chờ xác nhận",Confirmed:"Đã xác nhận",Fulfilled:"Đã hoàn tất",Cancelled:"Đã hủy"};
const campaignTypes={birthday:"Sinh nhật",upgrade:"Chúc mừng nâng hạng",vip:"Tri ân VIP",launch:"Ra mắt bộ sưu tập",personal:"Ưu đãi cá nhân"};
const tabs=[["policy","Chính sách hạng",Crown],["rewards","Danh mục quà",Gift],["campaigns","Chiến dịch VIP",Sparkles],["members","Thành viên",Users],["redemptions","Yêu cầu đổi quà",ReceiptText],["refunds","Hoàn trả & đối soát",RotateCw],["audit","Nhật ký",History]];
const date=value=>value?new Date(value).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"}):"—";
const localDate=value=>{if(!value)return "";const d=new Date(value);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
const iso=value=>value?new Date(value).toISOString():null;
const emptyReward=()=>({name:"",description:"",image:"",points:100,costVnd:0,stock:0,perCustomerLimit:null,tierIds:[...ids],active:false,startsAt:null,endsAt:null});
const emptyCampaign=()=>({name:"",description:"",type:"birthday",tierIds:[...ids],userIds:[],benefit:{type:"points",points:100,condition:""},startsAt:new Date().toISOString(),endsAt:new Date(Date.now()+30*86400000).toISOString(),maxUses:100,minOrderVnd:0,stackable:false,active:false});

function TierChoices({value,onChange,tiers}){return <fieldset className="loyalty-admin-checks"><legend>Hạng được áp dụng</legend>{tiers.map(tier=><label key={tier.id}><input type="checkbox" checked={value.includes(tier.id)} onChange={event=>onChange(event.target.checked?[...value,tier.id]:value.filter(id=>id!==tier.id))}/>{tier.name}</label>)}</fieldset>;}
function NumberField({label,value,onChange,min=0,max,optional=false}){return <label>{label}<input type="number" min={min} max={max} step="1" required={!optional} value={value??""} onChange={event=>onChange(event.target.value===""&&optional?null:Number(event.target.value))}/></label>;}
function FormActions({busy,onCancel,formId}){return <div className="loyalty-admin-actions"><button type="button" className="perfume-button" disabled={busy} onClick={onCancel}>Đóng</button><button type="submit" form={formId} className="perfume-button primary" disabled={busy}>{busy?"Đang lưu…":"Lưu thay đổi"}</button></div>;}
function FormError({error}){const ref=useRef(null);useEffect(()=>{if(error)ref.current?.scrollIntoView({block:"nearest",behavior:"instant"});},[error]);return error?<p ref={ref} role="alert" className="perfume-alert">{error}</p>:null;}
function ActiveBadge({active}){return <Badge tone={active?"green":"neutral"}>{active?"Đang bật":"Đang tắt"}</Badge>;}
function ListPager({page,total,pageSize,onPage}){return <div className="admin-operation-pagination"><span>{Number(total||0).toLocaleString("vi-VN")} bản ghi · Trang {page}</span><div className="perfume-toolbar-buttons"><button type="button" className="perfume-button" disabled={page===1} onClick={()=>onPage(page-1)}>Trước</button><button type="button" className="perfume-button" disabled={page*pageSize>=(total||0)} onClick={()=>onPage(page+1)}>Sau</button></div></div>;}

export default function Loyalty(){
  const [search]=useSearchParams();
  const editorFormId=useId();
  const {axios,getToken,storeResources}=useAppContext(),overview=useLoyaltyResource("/admin/summary"),[tab,setTab]=useState(()=>search.get("tab")==="refunds"?"refunds":"policy"),[editing,setEditing]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const lock=useRef(false);
  const prefetchMembers=()=>{void storeResources.loadCatalog("/admin/members?q=&page=1","/api/loyalty").catch(()=>{});};
  const rewardsQuery=useLoyaltyResource(tab==="rewards"||tab==="campaigns"?"/admin/rewards":null),campaignsQuery=useLoyaltyResource(tab==="campaigns"?"/admin/campaigns":null),reviewsQuery=useLoyaltyResource(tab==="refunds"?"/admin/reviews":null);
  const rewards=rewardsQuery.data?.rewards||[],campaigns=campaignsQuery.data?.campaigns||[];
  const mutate=async(method,path,body)=>{
    if(lock.current)return false;lock.current=true;setBusy(true);setError("");
    try{const {data}=await axios({method,url:`/api/loyalty/admin${path}`,data:body,headers:{Authorization:`Bearer ${await getToken()}`}});if(!data.success)throw Error(data.message);storeResources.invalidateCatalog();overview.reload();rewardsQuery.reload();campaignsQuery.reload();reviewsQuery.reload();setEditing(null);toast.success("Đã lưu thay đổi.");return true;}
    catch(err){setError(err.response?.data?.message||err.message);return false;}
    finally{lock.current=false;setBusy(false);}
  };
  const tiers=overview.data?.policy.tiers||[];
  const edit=(kind,draft)=>{setError("");setEditing({kind,draft});};
  const closeEditor=()=>{setEditing(null);setError("");};
  return <CatalogPage title="Thành viên & đặc quyền" className="admin-operations-page loyalty-admin" actions={<RefreshButton onClick={overview.reload} disabled={overview.loading||busy}/>}>
    {overview.data&&<div className="admin-metric-grid loyalty-admin-metrics">
      <OperationsMetric icon={ShieldCheck} label="Chương trình" value={overview.data.policy.enabled?"Đang bật":"Đang tắt"} detail="Trạng thái chính sách đã lưu" primary/>
      <OperationsMetric icon={Crown} label="Hạng thành viên" value={tiers.length} detail="Ngưỡng doanh số và quyền lợi cấu hình riêng"/>
      <OperationsMetric icon={Gift} label="Quà tặng" value={overview.data.rewardCount} detail={`${overview.data.activeRewardCount} quà đang bật trong danh mục`}/>
      <OperationsMetric icon={Sparkles} label="Chiến dịch VIP" value={overview.data.campaignCount} detail={`${overview.data.activeCampaignCount} chiến dịch đang bật`}/>
    </div>}
    <nav className="loyalty-admin-tabs" aria-label="Quản trị thành viên">{tabs.map(([id,label,Icon])=><button type="button" key={id} disabled={busy} aria-current={tab===id?"page":undefined} onPointerEnter={id==="members"?prefetchMembers:undefined} onFocus={id==="members"?prefetchMembers:undefined} onClick={()=>{setTab(id);setEditing(null);setError("");}}><Icon size={14} aria-hidden="true"/>{label}</button>)}</nav>
    <CatalogState {...overview}/>{!editing&&!["members","redemptions"].includes(tab)&&<FormError error={error}/>}
    {overview.data&&<>
      {tab==="policy"&&<PolicyForm key={overview.data.policy.version} policy={overview.data.policy} busy={busy} onSave={value=>mutate("put","/policy",value)}/>}
      {tab==="rewards"&&<OperationsPanel title="Danh mục quà tặng" description="Quản lý điểm đổi, tồn kho và điều kiện áp dụng theo từng hạng." actions={<><Badge>{rewards.length} quà tặng</Badge><button className="perfume-button primary" type="button" disabled={busy} onClick={()=>edit("reward",emptyReward())}><Plus size={14}/>Thêm quà</button></>}>
        <CatalogState {...rewardsQuery}/>{rewards.length?<div className="perfume-table-scroll"><table className="perfume-table"><caption className="sr-only">Danh mục quà dành cho thành viên</caption><thead><tr>{["Quà tặng","Điểm đổi","Tồn kho","Giá vốn nội bộ","Trạng thái","Thao tác"].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{rewards.map(reward=><tr key={reward._id}><td><strong>{reward.name}</strong></td><td className="admin-operation-nowrap">{reward.points.toLocaleString("vi-VN")} điểm</td><td>{reward.stock}</td><td className="admin-operation-nowrap">{formatVnd(reward.costVnd)}</td><td><ActiveBadge active={reward.active}/></td><td><button type="button" className="perfume-button" disabled={busy} onClick={()=>edit("reward",reward)}>Chỉnh sửa</button></td></tr>)}</tbody></table></div>:!rewardsQuery.loading&&!rewardsQuery.error&&<OperationsEmptyState icon={Gift} title="Chưa có quà tặng" description="Thêm quà và cấu hình điểm đổi, tồn kho trước khi mở cho thành viên."/>}
      </OperationsPanel>}
      {tab==="campaigns"&&<OperationsPanel title="Chiến dịch đặc quyền VIP" description="Quản lý quà sinh nhật, chúc mừng nâng hạng và ưu đãi cá nhân." actions={<><Badge>{campaigns.length} chiến dịch</Badge><button className="perfume-button primary" type="button" disabled={busy} onClick={()=>edit("campaign",emptyCampaign())}><Plus size={14}/>Thêm chiến dịch</button></>}>
        <p className="loyalty-admin-note">Không mặc định chiết khấu VIP cố định. Quà sinh nhật tối đa một quyền lợi mỗi năm cho mỗi khách, kể cả khi có nhiều chiến dịch sinh nhật.</p>
        <CatalogState {...campaignsQuery}/><CatalogState {...rewardsQuery}/>{campaigns.length?<div className="perfume-table-scroll"><table className="perfume-table"><caption className="sr-only">Chiến dịch đặc quyền dành cho thành viên</caption><thead><tr>{["Chiến dịch","Loại","Đã cấp / tối đa","Kết thúc","Trạng thái","Thao tác"].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{campaigns.map(row=><tr key={row._id}><td><strong>{row.name}</strong></td><td>{campaignTypes[row.type]||row.type}</td><td className="admin-operation-nowrap">{row.usedCount} / {row.maxUses}</td><td className="admin-operation-nowrap">{date(row.endsAt)}</td><td><ActiveBadge active={row.active}/></td><td><button type="button" className="perfume-button" disabled={busy} onClick={()=>edit("campaign",row)}>Chỉnh sửa</button></td></tr>)}</tbody></table></div>:!campaignsQuery.loading&&!campaignsQuery.error&&<OperationsEmptyState icon={Sparkles} title="Chưa có chiến dịch VIP" description="Tạo chiến dịch để cung cấp quyền lợi cho các hạng và khách hàng phù hợp."/>}
      </OperationsPanel>}
      {tab==="members"&&<Members tiers={tiers} busy={busy} mutate={mutate} error={error}/>}
      {tab==="redemptions"&&<Requests busy={busy} mutate={mutate} error={error}/>}
      {tab==="refunds"&&<><CatalogState {...reviewsQuery}/><Refunds busy={busy} mutate={mutate} initialOrder={search.get("order")||""} reviews={reviewsQuery.data?.reviews||[]}/></>}
      {tab==="audit"&&<Audit/>}
      {editing&&<OperationsDrawer title={editing.kind==="reward"?(editing.draft._id?"Chỉnh sửa quà tặng":"Thêm quà tặng"):(editing.draft._id?"Chỉnh sửa chiến dịch":"Thêm chiến dịch VIP")} description="Cấu hình điều kiện áp dụng và ghi lý do trước khi lưu." busy={busy} onClose={closeEditor} footer={<FormActions busy={busy} onCancel={closeEditor} formId={editorFormId}/>}>
        <FormError error={error}/>
        {editing.kind==="reward"?<RewardForm key={editing.draft._id||"new-reward"} formId={editorFormId} reward={editing.draft} tiers={tiers} busy={busy} onSave={value=>mutate(value._id?"put":"post",`/rewards${value._id?`/${value._id}`:""}`,value)}/>:<CampaignForm key={editing.draft._id||"new-campaign"} formId={editorFormId} campaign={editing.draft} tiers={tiers} rewards={rewards} busy={busy} onSave={value=>mutate(value._id?"put":"post",`/campaigns${value._id?`/${value._id}`:""}`,value)}/>}
      </OperationsDrawer>}
    </>}
  </CatalogPage>;
}

function PolicyForm({policy,busy,onSave}){
  const [draft,setDraft]=useState(()=>structuredClone(policy)),[reason,setReason]=useState("");
  const updateTier=(index,change)=>setDraft(current=>({...current,tiers:current.tiers.map((tier,i)=>i===index?{...tier,...change}:tier)}));
  const updateBenefit=(tierIndex,index,change)=>updateTier(tierIndex,{benefits:draft.tiers[tierIndex].benefits.map((benefit,i)=>i===index?{...benefit,...change}:benefit)});
  return <form className="loyalty-admin-form admin-dashboard-panel loyalty-admin-policy" onSubmit={event=>{event.preventDefault();void onSave({...draft,reason});}}>
    <header className="admin-panel-heading"><div><h2>Chính sách hạng thành viên</h2><p>Thiết lập doanh số, tỷ lệ tích điểm và quyền lợi của từng hạng.</p></div><Badge>Phiên bản {policy.version}</Badge></header>
    <div className="loyalty-admin-program"><div><strong>Chương trình thành viên</strong><p>Bật hoặc tạm dừng theo chính sách đã được phê duyệt.</p></div><label className="admin-toggle-switch"><input type="checkbox" role="switch" aria-label="Bật chương trình thành viên" checked={draft.enabled} onChange={event=>setDraft({...draft,enabled:event.target.checked})}/><span aria-hidden="true"/></label></div>
    <p className="loyalty-admin-note">Doanh số là tiền hàng sau giảm giá, không gồm vận chuyển, chỉ ghi nhận đơn hoàn tất đã thanh toán. Xét 12 tháng gần nhất; hạng có hiệu lực 12 tháng sau khi nâng hoặc tái xét. Đơn cũ hợp lệ được truy cộng điểm theo thứ tự hoàn tất.</p>
    <div className="loyalty-admin-tiers">{draft.tiers.map((tier,index)=><details key={tier.id} className="loyalty-admin-tier">
      <summary><span className="loyalty-admin-tier-name"><span className="admin-metric-icon"><Award size={17} aria-hidden="true"/></span><strong>{tier.name}</strong></span><span className="loyalty-admin-tier-threshold"><small>Doanh số 12 tháng từ</small><strong>{formatVnd(tier.thresholdVnd)}</strong></span><Badge>{tier.rate} điểm / triệu</Badge><ChevronDown size={16} aria-hidden="true"/></summary>
      <div className="loyalty-admin-tier-body"><div className="loyalty-admin-grid"><label>Tên hạng<input value={tier.name} maxLength={80} required onChange={event=>updateTier(index,{name:event.target.value})}/></label><NumberField label="Ngưỡng doanh số (VND)" min={0} value={tier.thresholdVnd} onChange={thresholdVnd=>updateTier(index,{thresholdVnd})}/><NumberField label="Điểm / 1.000.000 VND" min={1} max={10000} value={tier.rate} onChange={rate=>updateTier(index,{rate})}/></div>
        <h3>Quyền lợi & điều kiện cung cấp</h3><div className="loyalty-admin-benefits">{tier.benefits.map((benefit,i)=><fieldset key={`${tier.id}:${benefit.code}`} className="loyalty-admin-benefit"><legend>{benefit.title||"Quyền lợi mới"}</legend><label className="loyalty-admin-toggle"><input type="checkbox" checked={benefit.enabled} onChange={event=>updateBenefit(index,i,{enabled:event.target.checked})}/>Bật quyền lợi</label><label>Tên quyền lợi<input required value={benefit.title} onChange={event=>updateBenefit(index,i,{title:event.target.value})}/></label><label>Khả năng cung cấp<select value={benefit.availability} onChange={event=>updateBenefit(index,i,{availability:event.target.value})}><option value="available">Khả dụng</option><option value="conditional">Có điều kiện</option><option value="unavailable">Chưa khả dụng</option></select></label><label>Điều kiện / hướng dẫn<textarea value={benefit.condition} required={benefit.availability!=="available"} onChange={event=>updateBenefit(index,i,{condition:event.target.value})}/></label><button type="button" className="perfume-button" onClick={()=>updateTier(index,{benefits:tier.benefits.filter((_,j)=>j!==i)})}>Bỏ quyền lợi</button></fieldset>)}</div>
        <button type="button" className="perfume-button" onClick={()=>updateTier(index,{benefits:[...tier.benefits,{code:`perk-${crypto.randomUUID().slice(0,8)}`,title:"",enabled:false,availability:"unavailable",condition:""}]})}><Plus size={14}/>Thêm quyền lợi</button>
      </div>
    </details>)}</div>
    <label className="loyalty-admin-policy-reason">Lý do thay đổi chính sách<textarea required maxLength={500} value={reason} onChange={event=>setReason(event.target.value)}/></label><div className="loyalty-admin-actions"><button className="perfume-button primary" disabled={busy} type="submit">{busy?"Đang lưu…":"Lưu chính sách"}</button></div>
  </form>;
}
function RewardForm({reward,tiers,formId,onSave}){
  const [draft,setDraft]=useState(()=>structuredClone(reward)),[reason,setReason]=useState("");const patch=change=>setDraft({...draft,...change});
  return <form id={formId} className="loyalty-admin-form" onSubmit={event=>{event.preventDefault();void onSave({...draft,reason});}}><label>Tên quà<input required maxLength={160} value={draft.name} onChange={event=>patch({name:event.target.value})}/></label><label>Mô tả<textarea value={draft.description} onChange={event=>patch({description:event.target.value})}/></label><label>URL hình ảnh<input type="text" value={draft.image} placeholder="https://…" onChange={event=>patch({image:event.target.value})}/></label><div className="loyalty-admin-grid"><NumberField label="Điểm cần đổi" min={1} value={draft.points} onChange={points=>patch({points})}/><NumberField label="Giá vốn nội bộ (khách không thấy)" value={draft.costVnd} onChange={costVnd=>patch({costVnd})}/><NumberField label="Số lượng tồn" value={draft.stock} onChange={stock=>patch({stock})}/><NumberField optional min={1} label="Giới hạn mỗi khách (trống = không giới hạn)" value={draft.perCustomerLimit} onChange={perCustomerLimit=>patch({perCustomerLimit})}/></div><TierChoices tiers={tiers} value={draft.tierIds} onChange={tierIds=>patch({tierIds})}/><div className="loyalty-admin-grid"><label>Bắt đầu (tùy chọn)<input type="datetime-local" value={localDate(draft.startsAt)} onChange={event=>patch({startsAt:iso(event.target.value)})}/></label><label>Kết thúc (tùy chọn)<input type="datetime-local" value={localDate(draft.endsAt)} onChange={event=>patch({endsAt:iso(event.target.value)})}/></label></div><label className="loyalty-admin-toggle"><input type="checkbox" checked={draft.active} onChange={event=>patch({active:event.target.checked})}/>Mở đổi quà</label><label>Lý do chỉnh sửa<textarea required value={reason} onChange={event=>setReason(event.target.value)}/></label></form>;
}
function CampaignForm({campaign,tiers,rewards,formId,onSave}){
  const [draft,setDraft]=useState(()=>structuredClone(campaign)),[reason,setReason]=useState(""),[targetUsers,setTargetUsers]=useState(()=>campaign.userIds.join("\n"));const patch=change=>setDraft({...draft,...change}),benefit=change=>patch({benefit:{...draft.benefit,...change}});
  return <form id={formId} className="loyalty-admin-form" onSubmit={event=>{event.preventDefault();void onSave({...draft,userIds:targetUsers.split(/\s+/).filter(Boolean),reason});}}><label>Tên chiến dịch<input required maxLength={160} value={draft.name} onChange={event=>patch({name:event.target.value})}/></label><label>Mô tả<textarea value={draft.description} onChange={event=>patch({description:event.target.value})}/></label><div className="loyalty-admin-grid"><label>Loại chiến dịch<select value={draft.type} onChange={event=>patch({type:event.target.value})}>{[["birthday","Sinh nhật"],["upgrade","Chúc mừng nâng hạng"],["vip","Tri ân VIP"],["launch","Ra mắt bộ sưu tập"],["personal","Ưu đãi cá nhân"]].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label>Quyền lợi<select value={draft.benefit.type} onChange={event=>patch({benefit:{type:event.target.value,condition:draft.benefit.condition,points:100,offer:{type:"percent",value:10,maxDiscount:null},rewardId:"",instructions:"",available:false}})}>{[["points","Cộng điểm"],["gift","Quà tặng"],["offer","Ưu đãi riêng"],["event","Quyền tham gia sự kiện"]].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label></div>
    {draft.benefit.type==="points"&&<NumberField label="Số điểm" min={1} value={draft.benefit.points} onChange={points=>benefit({points})}/>}
    {draft.benefit.type==="gift"&&<label>Quà tặng<select required value={draft.benefit.rewardId} onChange={event=>benefit({rewardId:event.target.value})}><option value="">Chọn quà</option>{rewards.map(reward=><option key={reward._id} value={reward._id}>{reward.name} · Tồn {reward.stock}</option>)}</select></label>}
    {draft.benefit.type==="offer"&&<div className="loyalty-admin-grid"><label>Kiểu ưu đãi<select value={draft.benefit.offer.type} onChange={event=>benefit({offer:{...draft.benefit.offer,type:event.target.value}})}><option value="percent">Phần trăm</option><option value="fixed">Số tiền cố định</option></select></label><NumberField label="Giá trị" min={1} value={draft.benefit.offer.value} onChange={value=>benefit({offer:{...draft.benefit.offer,value}})}/><NumberField label="Giảm tối đa (trống = không giới hạn)" optional min={1} value={draft.benefit.offer.maxDiscount} onChange={maxDiscount=>benefit({offer:{...draft.benefit.offer,maxDiscount}})}/></div>}
    {draft.benefit.type==="event"&&<><label>Hướng dẫn tham gia<textarea required value={draft.benefit.instructions} onChange={event=>benefit({instructions:event.target.value})}/></label><label className="loyalty-admin-toggle"><input type="checkbox" checked={draft.benefit.available} onChange={event=>benefit({available:event.target.checked})}/>Đã xác nhận khả năng tổ chức/cung cấp</label></>}
    <label>Điều kiện cung cấp quyền lợi<textarea value={draft.benefit.condition} onChange={event=>benefit({condition:event.target.value})}/></label><TierChoices tiers={tiers} value={draft.tierIds} onChange={tierIds=>patch({tierIds})}/><label>Mã tài khoản được chỉ định (mỗi dòng một mã; bỏ trống = toàn bộ hạng đã chọn)<textarea value={targetUsers} onChange={event=>setTargetUsers(event.target.value)}/></label><div className="loyalty-admin-grid"><label>Bắt đầu<input type="datetime-local" required value={localDate(draft.startsAt)} onChange={event=>patch({startsAt:iso(event.target.value)})}/></label><label>Kết thúc<input type="datetime-local" required value={localDate(draft.endsAt)} onChange={event=>patch({endsAt:iso(event.target.value)})}/></label><NumberField label="Số lượt cấp tối đa" min={1} value={draft.maxUses} onChange={maxUses=>patch({maxUses})}/><NumberField label="Đơn tối thiểu (VND)" value={draft.minOrderVnd} onChange={minOrderVnd=>patch({minOrderVnd})}/></div><p>Với ưu đãi riêng, mức tối thiểu áp dụng cho đơn sử dụng mã. Với quà/điểm/sự kiện, khách cần chọn đơn hoàn tất trong thời gian chiến dịch.</p><label className="loyalty-admin-toggle"><input type="checkbox" checked={draft.stackable} onChange={event=>patch({stackable:event.target.checked})}/>Cho phép kết hợp quyền lợi khác theo điều kiện đơn hàng</label><label className="loyalty-admin-toggle"><input type="checkbox" checked={draft.active} onChange={event=>patch({active:event.target.checked})}/>Mở chiến dịch</label><label>Lý do chỉnh sửa<textarea required value={reason} onChange={event=>setReason(event.target.value)}/></label></form>;
}

function Members({tiers,busy,mutate,error}){
  const {axios,getToken}=useAppContext();
  const [q,setQ]=useState(""),[page,setPage]=useState(1),[selected,setSelected]=useState(null),[synced,setSynced]=useState({}),[syncFailed,setSyncFailed]=useState({}),query=useLoyaltyResource(`/admin/members?${new URLSearchParams({q,page})}`);
  const pendingIds=(query.data?.members||[]).filter(member=>member.syncPending&&!synced[member._id]).map(member=>member._id),pendingKey=pendingIds.join(",");
  useEffect(()=>{
    if(!pendingKey)return undefined;
    let active=true;
    void (async()=>{
      try{
        const {data}=await axios.post("/api/loyalty/admin/members/sync",{userIds:pendingKey.split(",")},{headers:{Authorization:`Bearer ${await getToken()}`}});
        if(!data.success)throw Error(data.message||"Không thể đồng bộ thành viên.");
        if(!active)return;
        setSynced(previous=>({...previous,...Object.fromEntries(data.members.map(member=>[member._id,member.membership]))}));
      }catch{if(active)setSyncFailed(previous=>({...previous,...Object.fromEntries(pendingKey.split(",").map(id=>[id,true]))}));}
    })();
    return()=>{active=false;};
  },[pendingKey,axios,getToken,query.reload]);
  const members=(query.data?.members||[]).map(member=>({...member,membership:synced[member._id]||member.membership,syncPending:member.syncPending&&!synced[member._id],syncFailed:Boolean(syncFailed[member._id])}));
  return <OperationsPanel title="Thành viên" description="Tra cứu hạng, doanh số và điểm; quản lý các điều chỉnh có nhật ký." actions={<Badge>{query.data?.total??"—"} thành viên</Badge>}>
    <div className="admin-operation-toolbar"><label className="perfume-search"><Search size={16} aria-hidden="true"/><input type="search" aria-label="Tìm thành viên" placeholder="Tên, điện thoại, mã tài khoản…" value={q} onChange={event=>{setQ(event.target.value);setPage(1);}}/></label></div>
    <CatalogState {...query}/>{!selected&&<FormError error={error}/>}
    {members.length?<div className="perfume-table-scroll"><table className="perfume-table"><caption className="sr-only">Hạng thành viên, doanh số và điểm thưởng của khách hàng</caption><thead><tr>{["Khách hàng","Hạng","Doanh số 12 tháng","Điểm","Hết hạn hạng","Thao tác"].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{members.map(member=><tr key={member._id}><td><strong>{member.name}</strong><small>{member.phone}</small><small className="loyalty-admin-id">{member._id}</small></td><td>{member.syncPending?<Badge tone="amber">{member.syncFailed?"Chưa đồng bộ":"Đang đồng bộ"}</Badge>:<Badge>{member.membership.tier.name}</Badge>}</td><td className="admin-operation-nowrap">{member.syncPending?"—":formatVnd(member.membership.salesVnd)}</td><td className="admin-operation-nowrap">{member.syncPending?"—":<>{member.membership.points.available.toLocaleString("vi-VN")}{member.membership.points.debt?<small>Nợ {member.membership.points.debt.toLocaleString("vi-VN")} điểm</small>:null}</>}</td><td className="admin-operation-nowrap">{member.syncPending?"—":date(member.membership.expiresAt)}</td><td><button type="button" className="perfume-button" disabled={busy} onClick={()=>setSelected(member)}>Quản lý</button></td></tr>)}</tbody></table></div>:!query.loading&&!query.error&&<OperationsEmptyState icon={Users} title={q?"Không tìm thấy thành viên phù hợp":"Chưa có thành viên"} description={q?"Thử tìm bằng tên, số điện thoại hoặc mã tài khoản khác.":"Khách hàng mới sẽ xuất hiện sau khi tạo tài khoản."}/>}
    <ListPager page={page} total={query.data?.total} pageSize={20} onPage={setPage}/>
    {selected&&<MemberTools key={selected._id} member={selected} tiers={tiers} busy={busy} error={error} onClose={()=>setSelected(null)} onSave={async(path,body)=>{if(await mutate("post",`/members/${encodeURIComponent(selected._id)}${path}`,body)){query.reload();setSelected(null);}}}/>}
  </OperationsPanel>;
}
function MemberTools({member,tiers,busy,onSave,onClose,error}){
  const formId=useId();
  const query=useLoyaltyResource(`/admin/members/${encodeURIComponent(member._id)}`),[mode,setMode]=useState("points"),[points,setPoints]=useState(0),[action,setAction]=useState("extend"),[months,setMonths]=useState(12),[tierIdOverride,setTierIdOverride]=useState(null),[reason,setReason]=useState(""),[requestId]=useState(()=>crypto.randomUUID());
  const tierId=tierIdOverride??query.data?.membership?.tier?.id??member.membership.tier.id;
  const current=query.data?.membership||member.membership;
  return <OperationsDrawer title={member.name} description={`${current.tier.name} · ${current.points.available.toLocaleString("vi-VN")} điểm khả dụng`} busy={busy} onClose={onClose} footer={mode==="history"?<button type="button" className="perfume-button" onClick={onClose}>Đóng</button>:<FormActions busy={busy} onCancel={onClose} formId={formId}/>}>
    <nav className="loyalty-admin-tabs" aria-label="Thao tác với thành viên">{[["points","Điều chỉnh điểm"],["tier","Gia hạn / điều chỉnh hạng"],["history","Lịch sử"]].map(([id,label])=><button key={id} type="button" disabled={busy} aria-current={mode===id?"page":undefined} onClick={()=>setMode(id)}>{label}</button>)}</nav>
    <CatalogState {...query}/><FormError error={error}/>
    {mode==="history"?<div className="loyalty-admin-history"><h3>Lịch sử điểm</h3>{query.data?.ledger.length?query.data.ledger.map(row=><article className="loyalty-admin-history-entry" key={row._id}><strong>{row.delta>0?"+":""}{row.delta.toLocaleString("vi-VN")} điểm</strong><p>{row.reason||row.source}</p><small>{date(row.at)} · {row.kind}</small></article>):!query.loading&&<p>Chưa có giao dịch điểm.</p>}<h3>Lịch sử hạng</h3>{query.data?.history.length?query.data.history.map(row=><article className="loyalty-admin-history-entry" key={row._id}><strong>{row.from||"—"} → {row.to}</strong><p>{row.reason}</p><small>{date(row.at)} · {row.kind}</small></article>):!query.loading&&<p>Chưa có thay đổi hạng.</p>}</div>:<form id={formId} className="loyalty-admin-form" onSubmit={event=>{event.preventDefault();void onSave(mode==="points"?"/points":"/tier",mode==="points"?{points,reason,requestId}:{action,months,tierId,reason,requestId});}}>
      {mode==="points"?<NumberField label="Số điểm điều chỉnh (số âm để trừ)" min={-1000000} max={1000000} value={points} onChange={setPoints}/>:<><label>Thao tác<select value={action} onChange={event=>setAction(event.target.value)}><option value="extend">Gia hạn hạng VIP đặc biệt</option><option value="adjust">Điều chỉnh hạng sau xem xét</option></select></label>{action==="extend"?<NumberField label="Số tháng gia hạn" min={1} max={36} value={months} onChange={setMonths}/>:<label>Hạng mới<select value={tierId} onChange={event=>setTierIdOverride(event.target.value)}>{tiers.map(tier=><option key={tier.id} value={tier.id}>{tier.name}</option>)}</select></label>}</>}
      <label>Lý do bắt buộc<textarea required maxLength={500} value={reason} onChange={event=>setReason(event.target.value)}/></label><p className="loyalty-admin-note">Mọi điều chỉnh đều được ghi nhật ký. Điều chỉnh hạng thủ công được giữ đến khi có đơn hợp lệ mới hoặc tới ngày tái xét; tải lại trang không tự đổi hạng vừa duyệt. Trừ điểm quá số dư sẽ ghi nhận khoản điểm cần bù, không xóa lịch sử.</p>
    </form>}
  </OperationsDrawer>;
}
function Requests({busy,mutate,error}){
  const formId=useId();
  const [status,setStatus]=useState("Pending"),[page,setPage]=useState(1),query=useLoyaltyResource(`/admin/redemptions?${new URLSearchParams({status,page})}`),[selected,setSelected]=useState(null),[next,setNext]=useState("Confirmed"),[reason,setReason]=useState("");
  return <OperationsPanel title="Yêu cầu đổi quà" description="Theo dõi xác nhận, giao quà và hoàn điểm khi hủy hợp lệ." actions={<Badge>{query.data?.total??"—"} yêu cầu</Badge>}>
    <div className="admin-operation-toolbar"><label className="loyalty-admin-filter">Trạng thái<select aria-label="Lọc trạng thái đổi quà" value={status} onChange={event=>{setStatus(event.target.value);setPage(1);}}><option value="">Tất cả</option>{Object.entries(statuses).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label></div>
    <CatalogState {...query}/>{!selected&&<FormError error={error}/>}
    {query.data?.requests.map(row=><article key={row._id} className="loyalty-admin-row"><div><div className="loyalty-admin-row-heading"><strong>{row.reward.name}</strong><Badge tone={row.status==="Pending"?"amber":row.status==="Fulfilled"?"green":"neutral"}>{statuses[row.status]}</Badge></div><p>{row.userId} · {row.points.toLocaleString("vi-VN")} điểm</p><small>{date(row.createdAt)}</small></div>{["Pending","Confirmed"].includes(row.status)&&<button className="perfume-button" type="button" disabled={busy} onClick={()=>{setSelected(row);setNext(row.status==="Pending"?"Confirmed":"Fulfilled");setReason("");}}>Xử lý</button>}</article>)}
    {!query.loading&&!query.error&&!query.data?.requests.length&&<OperationsEmptyState icon={Gift} title="Chưa có yêu cầu trong trạng thái này" description="Các yêu cầu đổi quà phù hợp sẽ xuất hiện tại đây."/>}
    <ListPager page={page} total={query.data?.total} pageSize={30} onPage={setPage}/>
    {selected&&<OperationsDrawer title={selected.reward.name} description={`${selected.points.toLocaleString("vi-VN")} điểm · ${statuses[selected.status]}`} busy={busy} onClose={()=>setSelected(null)} footer={<FormActions busy={busy} onCancel={()=>setSelected(null)} formId={formId}/>}><FormError error={error}/>
      <form id={formId} className="loyalty-admin-form" onSubmit={async event=>{event.preventDefault();if(await mutate("patch",`/redemptions/${selected._id}`,{status:next,reason})){query.reload();setSelected(null);}}}><label>Trạng thái mới<select value={next} onChange={event=>setNext(event.target.value)}>{selected.status==="Pending"?<option value="Confirmed">Đã xác nhận</option>:<option value="Fulfilled">Đã hoàn tất</option>}<option value="Cancelled">Hủy hợp lệ, hoàn điểm và tồn kho</option></select></label><label>Lý do / ghi chú xử lý<textarea required value={reason} onChange={event=>setReason(event.target.value)}/></label><p className="loyalty-admin-note">Điểm hoàn về giữ hạn của lô gốc; điểm đã hết hạn không trở thành điểm mới.</p></form>
    </OperationsDrawer>}
  </OperationsPanel>;
}
function Refunds({busy,mutate,initialOrder,reviews}){
  const [orderId,setOrderId]=useState(initialOrder),[amountVnd,setAmount]=useState(0),[reason,setReason]=useState(""),[requestId,setRequestId]=useState(()=>crypto.randomUUID());
  const preview=useLoyaltyResource(/^[a-fA-F0-9]{24}$/.test(orderId)?`/admin/orders/${orderId}`:null);
  return <div className="loyalty-admin-refund-layout">
    <form className="loyalty-admin-form admin-dashboard-panel" onSubmit={async event=>{event.preventDefault();if(await mutate("post",`/orders/${orderId}/refund`,{amountVnd,reason,requestId})){setAmount(0);setReason("");setRequestId(crypto.randomUUID());preview.reload();}}}>
      <header className="admin-panel-heading"><div><h2>Ghi nhận hoàn trả đã xác nhận</h2><p>Điều chỉnh doanh số và điểm cho đơn hàng đã xác minh.</p></div></header><p className="loyalty-admin-note">Chỉ nhập tiền hàng đủ điều kiện cần điều chỉnh sau khi cửa hàng xác nhận hoàn trả hoặc hủy doanh thu. Thao tác này điều chỉnh Loyalty, không thực hiện chuyển tiền ngân hàng và không tự nhập lại hàng.</p>
      <label>Mã đơn hàng<input required pattern="[a-fA-F0-9]{24}" value={orderId} onChange={event=>setOrderId(event.target.value.trim())}/></label>
      {preview.data&&<p>Tiền hàng hợp lệ: {formatVnd(preview.data.order.eligibleVnd)} · Đã hoàn: {formatVnd(preview.data.order.loyaltyRefundedVnd||0)} · Còn có thể điều chỉnh: {formatVnd(preview.data.order.remainingVnd)}</p>}
      {preview.error&&<p role="alert">{preview.error}</p>}
      <NumberField label="Tiền hàng hoàn trả lần này (VND, sau giảm giá, không gồm vận chuyển)" min={1} max={preview.data?.order.remainingVnd} value={amountVnd} onChange={setAmount}/>
      <label>Lý do / mã chứng từ hoàn trả<textarea required maxLength={500} value={reason} onChange={event=>setReason(event.target.value)}/></label>
      <p>Điểm được điều chỉnh theo tỷ lệ đã dùng khi ghi nhận đơn. Hạng không tự hạ giữa chu kỳ; với hoàn trả lớn hoặc gian lận, xem xét điều chỉnh hạng ở mục Thành viên và ghi rõ lý do.</p>
      <div className="loyalty-admin-actions"><button type="submit" className="perfume-button primary" disabled={busy||!preview.data?.order.remainingVnd}>Ghi nhận điều chỉnh</button></div>
    </form>
    <div className="loyalty-admin-reconcile-column"><OperationsPanel title="Đối soát & truy cộng đơn cũ" description="Kiểm tra doanh số, hạng và điểm theo chính sách hiện tại."><p>Xử lý các đơn hoàn tất đã thanh toán chưa ghi nhận, xét hạng hết hạn, điểm hết hạn và thông báo sinh nhật. Chạy lại không tạo điểm trùng.</p><button type="button" className="perfume-button" disabled={busy} onClick={()=>void mutate("post","/maintain",{})}><RotateCw size={14}/>Chạy đối soát</button></OperationsPanel>
      {reviews.map(row=><form key={row._id} className="loyalty-admin-form admin-dashboard-panel" onSubmit={event=>{event.preventDefault();void mutate("post",`/claims/${row._id}/review`,{reason:new FormData(event.currentTarget).get("reviewReason")});}}><header className="admin-panel-heading"><div><h2>Quà đã giao cần xem xét sau hoàn trả</h2><p>{row.benefit.campaignName}</p></div></header><p>{row.userId} · Đơn {row.orderId}</p><label>Kết quả xem xét<textarea name="reviewReason" required maxLength={500}/></label><button type="submit" className="perfume-button" disabled={busy}>Lưu kết quả xem xét</button></form>)}
    </div>
  </div>;
}
function Audit(){
  const [page,setPage]=useState(1),query=useLoyaltyResource(`/admin/audit?page=${page}`);
  const labels={policy:"Cập nhật chính sách",points:"Điều chỉnh điểm",tier:"Điều chỉnh hạng",reward:"Cập nhật quà tặng",campaign:"Cập nhật chiến dịch",redemption:"Xử lý đổi quà",refund:"Ghi nhận hoàn trả","claim-review":"Xem xét quyền lợi","campaign-refund-review":"Xem xét quyền lợi sau hoàn trả"};
  return <OperationsPanel title="Nhật ký quản trị" description="Theo dõi người thực hiện, lý do và dữ liệu trước/sau mỗi thay đổi." actions={<Badge>{query.data?.total??"—"} thao tác</Badge>}>
    <CatalogState {...query}/>
    {query.data?.entries.map(row=><article key={row._id} className="loyalty-admin-row"><div><div className="loyalty-admin-row-heading"><span className="admin-metric-icon"><History size={15} aria-hidden="true"/></span><strong>{labels[row.action]||row.action}</strong></div><p>{row.reason}</p><small>{date(row.at)} · {row.actorId}</small><small className="loyalty-admin-id">{row.subject}</small><details className="loyalty-admin-audit-details"><summary>Xem thay đổi</summary><pre>{JSON.stringify({before:row.before,after:row.after},null,2)}</pre></details></div></article>)}
    {!query.loading&&!query.error&&!query.data?.entries.length&&<OperationsEmptyState icon={History} title="Chưa có nhật ký quản trị" description="Các thao tác thay đổi chính sách, điểm và quyền lợi sẽ được lưu tại đây."/>}
    <ListPager page={page} total={query.data?.total} pageSize={50} onPage={setPage}/>
  </OperationsPanel>;
}

// Isolated browser fixtures; no MongoDB writes or media uploads.
export function createLibraryFixtures(image){
 let serial=10000,clock=Date.now();
 const requests=[],terms=['brand','group','accord','note'].flatMap((kind,k)=>Array.from({length:26},(_,i)=>({_id:(1000+k*100+i).toString(16).padStart(24,'0'),kind,key:`local:fixture:${kind}:${i}`,slug:`fixture-${kind}-${i}`,name:`Mục kiểm thử ${kind} ${String(i).padStart(2,'0')}`,description:'Nội dung kiểm thử trong bộ nhớ.',descriptionContent:null,image:'',contentStatus:'linked',productCount:i===0?2:0,updatedAt:new Date(clock).toISOString()})));
 const json=(body,statusCode=200)=>({statusCode,body:{success:statusCode<400,...body}}),nextDate=()=>new Date(++clock).toISOString();
 return {requests,terms,respond(request){
  const url=new URL(request.url),path=url.pathname;
  if(path==='/api/catalog/media'&&request.method==='POST'){requests.push({method:'POST',path});return json({images:[image]});}
  if(!/^\/api\/catalog\/terms(?:\/[^/]+)?$/u.test(path))return null;
  const body=request.method==='GET'?{}:JSON.parse(request.postData||'{}'),id=path.split('/')[4];
  if(request.method==='GET'){
   const kind=url.searchParams.get('kind'),q=(url.searchParams.get('q')||'').toLocaleLowerCase('vi-VN'),status=url.searchParams.get('status');
   const rows=terms.filter(t=>t.kind===kind&&(!q||t.name.toLocaleLowerCase('vi-VN').includes(q))&&(!status||t.contentStatus===status)).sort((a,b)=>a.name.localeCompare(b.name,'vi'));
   const page=Number(url.searchParams.get('page')||1),pageSize=25;
   return json({terms:rows.slice((page-1)*pageSize,page*pageSize),total:rows.length,page,pageSize,totalPages:Math.max(1,Math.ceil(rows.length/pageSize))});
  }
  requests.push({method:request.method,path,body});
  if(request.method==='POST'){
   if(terms.some(t=>t.kind===body.kind&&t.name.toLocaleLowerCase('vi-VN')===body.name.trim().toLocaleLowerCase('vi-VN')))return json({message:'Tên mục đã tồn tại trong thư viện này.'},409);
   const term={...body,_id:(serial++).toString(16).padStart(24,'0'),key:`local:${serial}`,slug:`created-${serial}`,productCount:0,updatedAt:nextDate()};terms.push(term);return json({term},201);
  }
  const index=terms.findIndex(t=>t._id===id),term=terms[index];if(!term)return json({message:'Không tìm thấy mục thư viện'},404);
  if(body.expectedUpdatedAt!==term.updatedAt)return json({message:'Nội dung đã thay đổi. Vui lòng tải lại.'},409);
  if(request.method==='PATCH'){Object.assign(term,body,{updatedAt:nextDate()});return json({term,updatedProducts:0});}
  if(request.method==='DELETE'){
   if(term.productCount)return json({message:'Có 2 sản phẩm đang sử dụng mục này. Hãy đổi thông tin tương ứng trên các sản phẩm đó trước khi xóa.'},409);
   terms.splice(index,1);return json({id});
  }
  return json({message:'Unsupported fixture action'},400);
 }};
}

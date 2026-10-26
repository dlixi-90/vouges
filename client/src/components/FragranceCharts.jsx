export default function FragranceCharts({fragrance={},showSourceIssues=false}){
  const percent=value=>Number.isFinite(value)?Math.max(0,Math.min(100,value)):0;
  return <div className="perfume-fragrance-charts">
    {[{key:"longevity",title:"Lưu hương"},{key:"sillage",title:"Tỏa hương"}].map(({key,title})=><section className="perfume-chart" key={key}><h3>{title}</h3>{(fragrance[key]||[]).map((row,index)=><div className="perfume-chart-row" key={`${row.label}-${index}`}><span>{row.label}</span><small>{row.displayedCount??"—"}</small><div className="perfume-chart-track"><span style={{width:`${percent(row.displayedPercent)}%`}}/></div>{showSourceIssues&&(row.sourceCountIssue||row.sourceValueIssue)&&<em>Giá trị nguồn: {row.sourceRawCount??row.sourceRawPercent}</em>}</div>)}{!fragrance[key]?.length&&<p>Chưa có dữ liệu.</p>}</section>)}
    <section className="perfume-chart"><h3>Mùa và thời điểm</h3><div className="perfume-suitability">{(fragrance.suitability||[]).map((row,index)=><div key={`${row.label}-${index}`}><span>{row.label}</span><strong>{row.displayedPercent===null?"—":`${row.displayedPercent}%`}</strong><div className="perfume-chart-track"><span style={{width:`${percent(row.displayedPercent)}%`}}/></div>{showSourceIssues&&row.sourceValueIssue&&<small>Nguồn: {row.sourceRawPercent}%</small>}</div>)}</div></section>
  </div>;
}

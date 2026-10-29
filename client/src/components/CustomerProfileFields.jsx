import { useId } from "react";
import { latestAdultBirthday } from "../utils/customerProfile";
import "../customer-profile.css";

export default function CustomerProfileFields({draft,setDraft,errors={},disabled=false}) {
  const id = useId();
  return <div className="customer-profile-fields">
    {[
      {name:"fullName",label:"Họ và tên",type:"text",autoComplete:"name",maxLength:120},
      {name:"phone",label:"Số điện thoại",type:"tel",autoComplete:"tel",maxLength:30},
      {name:"birthday",label:"Ngày, tháng, năm sinh",type:"date",autoComplete:"bday",min:"1900-01-01",max:latestAdultBirthday()},
    ].map(({name,label,...inputProps})=><label key={name} htmlFor={`${id}-${name}`}>
      <span>{label} <span aria-hidden="true">*</span></span>
      <input {...inputProps} id={`${id}-${name}`} name={name} required disabled={disabled}
        value={draft[name]} onChange={event=>setDraft(current=>({...current,[name]:event.target.value}))}
        aria-invalid={Boolean(errors[name])} aria-describedby={errors[name]?`${id}-${name}-error`:name==="birthday"?`${id}-age-help`:undefined}/>
      {errors[name]&&<small id={`${id}-${name}-error`} className="customer-field-error" role="alert">{errors[name]}</small>}
      {name==="birthday"&&<small id={`${id}-age-help`}>Khách hàng phải đủ 18 tuổi tính đến ngày hôm nay.</small>}
    </label>)}
  </div>;
}

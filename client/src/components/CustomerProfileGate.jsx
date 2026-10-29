import { lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import { shouldCompleteCustomerProfile } from "../utils/customerProfile";

const CustomerProfileDialog=lazy(()=>import("./CustomerProfileDialog"));
export default function CustomerProfileGate(){
  const {authenticatedUserId,customerProfile}=useAppContext();
  const {pathname}=useLocation();
  if(!shouldCompleteCustomerProfile({userId:authenticatedUserId,profile:customerProfile,pathname}))return null;
  return <Suspense fallback={null}><CustomerProfileDialog key={authenticatedUserId}/></Suspense>;
}

import {useMemo} from "react";
import {useAppContext} from "../context/AppContext";
import useCachedResource from "./useCachedResource";
export default function useLoyaltyResource(path){
  const {storeResources,authenticatedUserId}=useAppContext();
  const resource=useMemo(()=>path&&authenticatedUserId?({peek:()=>storeResources.peekCatalog(path,"/api/loyalty"),load:options=>storeResources.loadCatalog(path,"/api/loyalty",options)}):null,[path,authenticatedUserId,storeResources]);
  return useCachedResource(resource,{scope:`loyalty:${authenticatedUserId}:${path}`,delay:/[?&]q=[^&]+/.test(path||"")?180:0});
}

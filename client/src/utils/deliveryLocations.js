import { createResourceCache } from "./resourceCache.js";

const COUNTRIES_API = "https://countriesnow.space/api/v0.1";
const PROVINCES_API = "https://provinces.open-api.vn/api/v2/?depth=2";

export const createDeliveryLocations = ({ axios, cache = createResourceCache({ maxAge:3600000,maxEntries:32 }) }) => {
  const read = async (url, signal, country) => {
    const response = country
      ? await axios.post(url,{country},{signal,timeout:10000})
      : await axios.get(url,{signal,timeout:10000});
    const data = response.data;
    if (!Array.isArray(url === PROVINCES_API ? data : data?.data)) throw new Error("Không thể tải danh sách địa chỉ.");
    return data;
  };
  return {
    countries: () => cache.load("countries",signal=>read(`${COUNTRIES_API}/countries/iso`,signal)),
    provinces: () => cache.load("vietnam",signal=>read(PROVINCES_API,signal)),
    cities: country => cache.load(`cities:${country}`,signal=>read(`${COUNTRIES_API}/countries/cities`,signal,country)),
    peekCountries: () => cache.peek("countries"),
    peekProvinces: () => cache.peek("vietnam"),
  };
};

// Public geography only; no customer addresses or authentication enter this cache.
const byClient = new WeakMap();
export const getDeliveryLocations = axios => {
  if(!byClient.has(axios))byClient.set(axios,createDeliveryLocations({axios}));
  return byClient.get(axios);
};

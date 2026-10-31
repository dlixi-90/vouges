import { useEffect, useId, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { useAppContext } from "../../context/AppContext";
import { validateDeliveryPhone } from "../../utils/deliveryPhone";
import { getDeliveryLocations } from "../../utils/deliveryLocations";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const countryDisplayNames = new Intl.DisplayNames(["vi"], { type: "region" });
const getEmailError = (value) => {
  if (!value.trim()) return "Vui lòng nhập địa chỉ email.";
  if (!value.includes("@"))
    return "Địa chỉ email phải có dấu @, ví dụ: ten@gmail.com.";
  return emailPattern.test(value.trim())
    ? ""
    : "Địa chỉ email không đúng định dạng. Ví dụ: ten@gmail.com.";
};

const contactFields = [
  {
    name: "firstName",
    label: "Tên",
  },
  {
    name: "lastName",
    label: "Họ",
  },
  {
    name: "email",
    label: "Email",
    type: "email",
  },
  {
    name: "phone",
    label: "Số điện thoại",
    type: "tel",
  },
  {
    name: "street",
    label: "Số nhà, tên đường",
    fullWidth: true,
  },
];

const inputClass =
  "w-full rounded-md border border-gray-200 bg-white px-4 py-3 outline-none transition focus:border-secondary focus:ring-1 focus:ring-secondary";

const normalizeLocationName = (value) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/thanh pho|tinh|province|city/g, "")
    .replace(/[^a-z0-9]/g, "");

const getUniqueLocationNames = (values, locale) => {
  const locationsByKey = new Map();

  for (const value of values || []) {
    const name = String(value || "").trim();
    const key = normalizeLocationName(name);

    if (name && key && !locationsByKey.has(key)) {
      locationsByKey.set(key, name);
    }
  }

  return [...locationsByKey.values()].sort((a, b) =>
    a.localeCompare(b, locale),
  );
};

const DeliveryAddressFields = ({ address, setAddress, disabled = false }) => {
  const { axios } = useAppContext();
  const locations = useMemo(() => getDeliveryLocations(axios), [axios]);
  const [phoneError, setPhoneError] = useState("");
  const phoneHelpId = useId();
  const [emailError, setEmailError] = useState("");
  const emailHelpId = useId();
  const [countries, setCountries] = useState([]);
  const [countryCodes, setCountryCodes] = useState({ Vietnam: "VN" });
  const [cities, setCities] = useState([]);
  const [vietnamProvinces, setVietnamProvinces] = useState([]);
  const [isLoadingCountries, setIsLoadingCountries] = useState(true);
  const [isLoadingCities, setIsLoadingCities] = useState(false);
  const [countriesApiFailed, setCountriesApiFailed] = useState(false);
  const [citiesApiFailed, setCitiesApiFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    const loadCountries = async () => {
      try {
        setIsLoadingCountries(true);

        const data = await locations.countries();
        if (controller.signal.aborted) return;
        const countryNames = Array.isArray(data?.data)
          ? getUniqueLocationNames(
              data.data.map((country) => country.name),
              "en",
            )
          : [];

        if (Array.isArray(data?.data)) {
          setCountryCodes(
            Object.fromEntries(
              data.data.map((country) => [country.name, country.Iso2]),
            ),
          );
        }
        setCountries(countryNames);
        setCountriesApiFailed(countryNames.length === 0);
      } catch (error) {
        if (!controller.signal.aborted && error.code !== "ERR_CANCELED") {
          setCountriesApiFailed(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingCountries(false);
        }
      }
    };

    loadCountries();

    return () => controller.abort();
  }, [locations]);

  useEffect(() => {
    if (!address.country) return undefined;

    const controller = new AbortController();

    const loadCities = async () => {
      try {
        setIsLoadingCities(true);

        let cityNames = [];

        if (address.country === "Vietnam") {
          const data = await locations.provinces();
          if (controller.signal.aborted) return;
          const provinces = Array.isArray(data) ? data : [];

          setVietnamProvinces(provinces);
          cityNames = getUniqueLocationNames(
            provinces.map((province) => province.name),
            "vi",
          );
        } else {
          const data = await locations.cities(address.country);
          if (controller.signal.aborted) return;

          cityNames = Array.isArray(data?.data)
            ? getUniqueLocationNames(data.data, "en")
            : [];
        }

        setCities(cityNames);
        setCitiesApiFailed(cityNames.length === 0);
      } catch (error) {
        if (!controller.signal.aborted && error.code !== "ERR_CANCELED") {
          setCitiesApiFailed(true);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoadingCities(false);
        }
      }
    };

    loadCities();

    return () => controller.abort();
  }, [address.country, locations]);

  const wards = useMemo(() => {
    if (address.country !== "Vietnam" || !address.city) return [];

    const selectedProvince = vietnamProvinces.find(
      (province) => province.name === address.city,
    );

    return getUniqueLocationNames(
      (selectedProvince?.wards || []).map((ward) => ward.name),
      "vi",
    );
  }, [address.city, address.country, vietnamProvinces]);

  const handleChange = (event) => {
    const { name, value } = event.target;

    if (name === "phone") {
      if (!/^[\d\s()+]*$/.test(value)) {
        const message =
          "Chỉ chấp nhận chữ số, khoảng trắng và tiền tố +84 hoặc (+84).";
        setPhoneError(message);
        event.target.setCustomValidity(message);
        return;
      }
      event.target.setCustomValidity("");
      if (phoneError) setPhoneError(validateDeliveryPhone(value).error);
    }
    if (name === "email") {
      const message = emailError ? getEmailError(value) : "";
      setEmailError(message);
      event.target.setCustomValidity(message);
      if (!message) toast.dismiss(emailHelpId);
    }

    setAddress((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const handleContactBlur = (event) => {
    if (event.target.name === "phone") {
      const result = validateDeliveryPhone(event.target.value);
      setPhoneError(result.error);
      event.target.setCustomValidity(result.error);
      if (result.valid)
        setAddress((current) => ({ ...current, phone: result.normalized }));
    }
    if (event.target.name === "email") {
      const value = event.target.value.trim();
      const message = getEmailError(value);
      setEmailError(message);
      event.target.setCustomValidity(message);
      setAddress((current) => ({ ...current, email: value }));
      if (message) toast.error(message, { id: emailHelpId });
      else toast.dismiss(emailHelpId);
    }
  };

  const handleCountryChange = (event) => {
    const country = event.target.value;

    setAddress((current) => ({
      ...current,
      country,
      city: "",
      state: "",
    }));
    setCities([]);
    setVietnamProvinces([]);
    setCitiesApiFailed(false);
  };

  const handleCityChange = (event) => {
    const city = event.target.value;

    setAddress((current) => ({
      ...current,
      city,
      state: "",
    }));
  };

  return (
    <fieldset disabled={disabled}>
      <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2">
        {contactFields.map((field) => (
          <label
            key={field.name}
            className={field.fullWidth ? "sm:col-span-2" : ""}
          >
            <span className="mb-2 block text-sm font-medium">
              {field.label}{" "}
              <span className="text-red-500" aria-hidden="true">
                *
              </span>
            </span>

            <input
              required
              type={field.type || "text"}
              name={field.name}
              value={address[field.name]}
              onChange={handleChange}
              inputMode={
                field.name === "phone"
                  ? "tel"
                  : field.name === "email"
                    ? "email"
                    : undefined
              }
              pattern={field.name === "email" ? emailPattern.source : undefined}
              maxLength={field.name === "email" ? 254 : undefined}
              placeholder={field.name === "email" ? "ten@gmail.com" : undefined}
              onBlur={handleContactBlur}
              onInvalid={
                field.name === "email"
                  ? (event) => {
                      event.preventDefault();
                      const message = getEmailError(event.target.value);
                      setEmailError(message);
                      event.target.setCustomValidity(message);
                      event.target.focus();
                      toast.error(message, { id: emailHelpId });
                    }
                  : undefined
              }
              aria-invalid={
                field.name === "phone"
                  ? Boolean(phoneError)
                  : field.name === "email"
                    ? Boolean(emailError)
                    : undefined
              }
              aria-describedby={
                field.name === "phone"
                  ? phoneHelpId
                  : field.name === "email" && emailError
                    ? emailHelpId
                    : undefined
              }
              autoComplete={field.name}
              className={`${inputClass} ${field.name === "email" && emailError ? "border-red-500" : ""}`}
            />
            {field.name === "email" && emailError && (
              <span id={emailHelpId} className="sr-only">{emailError}</span>
            )}
            {field.name === "phone" && (
              <span
                id={phoneHelpId}
                className={`mt-2 block text-xs ${phoneError ? "text-red-600" : "text-gray-500"}`}
                aria-live="polite"
              >
                {phoneError}
              </span>
            )}
          </label>
        ))}

        <label>
          <span className="mb-2 block text-sm font-medium">
            Quốc gia{" "}
            <span className="text-red-500" aria-hidden="true">
              *
            </span>
          </span>

          {countriesApiFailed ? (
            <input
              required
              type="text"
              name="country"
              value={address.country}
              onChange={handleCountryChange}
              autoComplete="country-name"
              className={inputClass}
            />
          ) : (
            <select
              required
              name="country"
              value={address.country}
              onChange={handleCountryChange}
              disabled={isLoadingCountries}
              autoComplete="country-name"
              className={`${inputClass} disabled:cursor-wait`}
            >
              <option value="">
                {isLoadingCountries
                  ? "Đang tải danh sách quốc gia…"
                  : "Chọn quốc gia"}
              </option>
              {address.country && !countries.includes(address.country) && (
                <option value={address.country}>
                  {countryCodes[address.country]
                    ? countryDisplayNames.of(countryCodes[address.country])
                    : address.country}
                </option>
              )}
              {countries.map((country) => (
                <option key={country} value={country}>
                  {countryCodes[country]
                    ? countryDisplayNames.of(countryCodes[country])
                    : country}
                </option>
              ))}
            </select>
          )}
        </label>

        <label>
          <span className="mb-2 block text-sm font-medium">
            Tỉnh/Thành phố{" "}
            <span className="text-red-500" aria-hidden="true">
              *
            </span>
          </span>

          {citiesApiFailed ? (
            <input
              required
              type="text"
              name="city"
              value={address.city}
              onChange={handleCityChange}
              autoComplete="address-level1"
              className={inputClass}
            />
          ) : (
            <select
              required
              name="city"
              value={address.city}
              onChange={handleCityChange}
              disabled={!address.country || isLoadingCities}
              autoComplete="address-level1"
              className={`${inputClass} disabled:cursor-not-allowed`}
            >
              <option value="">
                {isLoadingCities
                  ? "Đang tải danh sách tỉnh/thành phố…"
                  : address.country === "Vietnam"
                    ? "Chọn tỉnh/thành phố"
                    : "Chọn tỉnh/thành phố"}
              </option>
              {address.city && !cities.includes(address.city) && (
                <option value={address.city}>{address.city}</option>
              )}
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          )}
        </label>

        <label>
          <span className="mb-2 block text-sm font-medium">
            {address.country === "Vietnam" ? "Phường/Xã" : "Bang/Tỉnh"}{" "}
            <span className="text-red-500" aria-hidden="true">
              *
            </span>
          </span>

          {address.country === "Vietnam" &&
          !citiesApiFailed &&
          (isLoadingCities || wards.length > 0) ? (
            <select
              required
              name="state"
              value={address.state}
              onChange={handleChange}
              disabled={!address.city || isLoadingCities || wards.length === 0}
              autoComplete="address-level2"
              className={`${inputClass} disabled:cursor-not-allowed`}
            >
              <option value="">Chọn phường/xã</option>
              {address.state && !wards.includes(address.state) && (
                <option value={address.state}>{address.state}</option>
              )}
              {wards.map((ward) => (
                <option key={ward} value={ward}>
                  {ward}
                </option>
              ))}
            </select>
          ) : (
            <input
              required
              type="text"
              name="state"
              value={address.state}
              onChange={handleChange}
              autoComplete="address-level2"
              className={inputClass}
            />
          )}
        </label>

        <label>
          <span className="mb-2 block text-sm font-medium">Mã bưu chính</span>
          <input
            type="text"
            name="zipcode"
            value={address.zipcode}
            onChange={handleChange}
            autoComplete="postal-code"
            className={inputClass}
          />
        </label>
      </div>
    </fieldset>
  );
};

export default DeliveryAddressFields;

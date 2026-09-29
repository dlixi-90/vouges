import { useEffect, useId, useMemo, useState } from "react";
import { useAppContext } from "../../context/AppContext";
import { validateDeliveryPhone } from "../../utils/deliveryPhone";

const COUNTRIES_NOW_API = "https://countriesnow.space/api/v0.1";
const VIETNAM_PROVINCES_API = "https://provinces.open-api.vn/api/v2/?depth=2";

const contactFields = [
  {
    name: "firstName",
    label: "First name",
  },
  {
    name: "lastName",
    label: "Last name",
  },
  {
    name: "email",
    label: "Email",
    type: "email",
  },
  {
    name: "phone",
    label: "Phone",
    type: "tel",
  },
  {
    name: "street",
    label: "Street address",
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
  const [phoneError, setPhoneError] = useState("");
  const phoneHelpId = useId();
  const [countries, setCountries] = useState([]);
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

        const { data } = await axios.get(`${COUNTRIES_NOW_API}/countries/iso`, {
          signal: controller.signal,
        });
        const countryNames = Array.isArray(data?.data)
          ? getUniqueLocationNames(
              data.data.map((country) => country.name),
              "en",
            )
          : [];

        setCountries(countryNames);
        setCountriesApiFailed(countryNames.length === 0);
      } catch (error) {
        if (error.code !== "ERR_CANCELED") {
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
  }, [axios]);

  useEffect(() => {
    if (!address.country) return undefined;

    const controller = new AbortController();

    const loadCities = async () => {
      try {
        setIsLoadingCities(true);

        let cityNames = [];

        if (address.country === "Vietnam") {
          const { data } = await axios.get(VIETNAM_PROVINCES_API, {
            signal: controller.signal,
          });
          const provinces = Array.isArray(data) ? data : [];

          setVietnamProvinces(provinces);
          cityNames = getUniqueLocationNames(
            provinces.map((province) => province.name),
            "vi",
          );
        } else {
          const { data } = await axios.post(
            `${COUNTRIES_NOW_API}/countries/cities`,
            { country: address.country },
            { signal: controller.signal },
          );

          cityNames = Array.isArray(data?.data)
            ? getUniqueLocationNames(data.data, "en")
            : [];
        }

        setCities(cityNames);
        setCitiesApiFailed(cityNames.length === 0);
      } catch (error) {
        if (error.code !== "ERR_CANCELED") {
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
  }, [address.country, axios]);

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
        const message = "Only digits, spaces and the (+84) prefix are accepted.";
        setPhoneError(message);
        event.target.setCustomValidity(message);
        return;
      }
      event.target.setCustomValidity("");
      if (phoneError) setPhoneError(validateDeliveryPhone(value).error);
    }

    setAddress((current) => ({
      ...current,
      [name]: value,
    }));
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
              {field.label} <span className="text-red-500" aria-hidden="true">*</span>
            </span>

            <input
              required
              type={field.type || "text"}
              name={field.name}
              value={address[field.name]}
              onChange={handleChange}
              inputMode={field.name === "phone" ? "tel" : undefined}
              onBlur={field.name === "phone" ? (event) => {
                const result = validateDeliveryPhone(event.target.value);
                setPhoneError(result.error);
                event.target.setCustomValidity(result.error);
                if (result.valid) setAddress((current) => ({ ...current, phone: result.normalized }));
              } : undefined}
              aria-invalid={field.name === "phone" ? Boolean(phoneError) : undefined}
              aria-describedby={field.name === "phone" ? phoneHelpId : undefined}
              autoComplete={field.name}
              className={inputClass}
            />
            {field.name === "phone" && (
              <span id={phoneHelpId} className={`mt-2 block text-xs ${phoneError ? "text-red-600" : "text-gray-500"}`} aria-live="polite">
                {phoneError || "0xxxxxxxxx (10 digits) or (+84) xxx xxx xxx (9 digits)."}
              </span>
            )}
          </label>
        ))}

        <label>
          <span className="mb-2 block text-sm font-medium">
            Country <span className="text-red-500" aria-hidden="true">*</span>
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
                {isLoadingCountries ? "Loading countries..." : "Select country"}
              </option>
              {address.country && !countries.includes(address.country) && (
                <option value={address.country}>{address.country}</option>
              )}
              {countries.map((country) => (
                <option key={country} value={country}>
                  {country}
                </option>
              ))}
            </select>
          )}
        </label>

        <label>
          <span className="mb-2 block text-sm font-medium">
            City <span className="text-red-500" aria-hidden="true">*</span>
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
              disabled={
                !address.country || isLoadingCities
              }
              autoComplete="address-level1"
              className={`${inputClass} disabled:cursor-not-allowed`}
            >
              <option value="">
                {isLoadingCities
                  ? "Loading cities..."
                  : address.country === "Vietnam"
                    ? "Select city"
                    : "Select city"}
              </option>
              {address.city && !cities.includes(address.city) && <option value={address.city}>{address.city}</option>}
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
            {address.country === "Vietnam"
              ? "Ward/ Commune"
              : "State/ Province"}{" "}
            <span className="text-red-500" aria-hidden="true">*</span>
          </span>

          {address.country === "Vietnam" && !citiesApiFailed && (isLoadingCities || wards.length > 0) ? (
            <select
              required
              name="state"
              value={address.state}
              onChange={handleChange}
              disabled={!address.city || isLoadingCities || wards.length === 0}
              autoComplete="address-level2"
              className={`${inputClass} disabled:cursor-not-allowed`}
            >
              <option value="">Select ward/ commune</option>
              {address.state && !wards.includes(address.state) && <option value={address.state}>{address.state}</option>}
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
          <span className="mb-2 block text-sm font-medium">
            ZIP code (optional)
          </span>
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

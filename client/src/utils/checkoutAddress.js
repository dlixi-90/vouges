export const initialCheckoutAddress = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  street: "",
  city: "",
  state: "",
  zipcode: "",
  country: "Vietnam",
};

export const resolveCheckoutAddress = (current, saved, user) => {
  const selected = saved.find((entry) => entry._id === current._id);
  if (selected) return selected;
  // Keep an unfinished form when navigating back from the cart step.
  if (!current._id && (current.street || current.phone)) return current;
  return saved.find((entry) => entry.isDefault) || saved[0] || {
    ...initialCheckoutAddress,
    ...(current._id ? {} : current),
    firstName: current.firstName || user?.firstName || "",
    lastName: current.lastName || user?.lastName || "",
    email: current.email || user?.primaryEmailAddress?.emailAddress || "",
  };
};

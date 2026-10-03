// Map only identity fields; webhooks must never overwrite membership or roles.
export const mapClerkProfile = (data) => {
  const email = data.email_addresses?.find((entry) =>
    entry.id === data.primary_email_address_id && entry.verification?.status === "verified");
  const phone = data.phone_numbers?.find((entry) =>
    entry.id === data.primary_phone_number_id && entry.verification?.status === "verified");
  return {
    email: email?.email_address || "",
    phone: phone?.phone_number || "",
    username: [data.first_name, data.last_name].filter(Boolean).join(" ").trim()
      || data.username || "Thành viên Velours",
    image: data.image_url || "",
  };
};

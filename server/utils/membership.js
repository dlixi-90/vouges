export const vietnamDate = (now = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type) => parts.find((entry) => entry.type === type).value;
  return `${part("year")}-${part("month")}-${part("day")}`;
};

export const validateBirthday = (value, now = new Date()) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    && value <= vietnamDate(now) && value >= "1900-01-01";
};

// Feb 29 birthdays are celebrated on Feb 28 in a non-leap year.
// A seven-day window also recovers awards after a missed scheduled run.
export const birthdayWindow = (birthday, now = new Date()) => {
  if (!validateBirthday(birthday, now)) return null;
  const today = vietnamDate(now);
  const year = Number(today.slice(0, 4));
  for (const candidateYear of [year, year - 1]) {
    const leap = new Date(Date.UTC(candidateYear, 1, 29)).getUTCMonth() === 1;
    const monthDay = birthday.slice(5) === "02-29" && !leap ? "02-28" : birthday.slice(5);
    const date = `${candidateYear}-${monthDay}`;
    const startsAt = new Date(`${date}T00:00:00+07:00`);
    const expiresAt = new Date(startsAt.getTime() + 7 * 86400000);
    if (now >= startsAt && now < expiresAt) return { year: candidateYear, startsAt, expiresAt };
  }
  return null;
};

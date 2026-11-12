export const notificationBadge = count => Number(count) > 9 ? "9+" : String(Math.max(0, Number(count) || 0));

export const newestNotificationSnapshot = (current, incoming) => {
  if (current?.asOf && incoming?.asOf && new Date(current.asOf) > new Date(incoming.asOf)) return current;
  return incoming;
};

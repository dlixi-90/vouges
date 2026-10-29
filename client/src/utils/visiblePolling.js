// Keep payment status fresh on return without polling while a bank app/tab is open.
export const pollWhileVisible = (refresh, intervalMs, { documentTarget = document, timers = window } = {}) => {
  const tick = () => { if(!documentTarget.hidden)void refresh(); };
  const interval = timers.setInterval(tick,intervalMs);
  documentTarget.addEventListener("visibilitychange",tick);
  return () => { timers.clearInterval(interval); documentTarget.removeEventListener("visibilitychange",tick); };
};

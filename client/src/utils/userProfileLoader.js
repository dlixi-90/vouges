// Share one profile read per active account; ignore replies after sign-out.
export const createUserProfileLoader = ({ request, onSuccess, onError }) => {
  let active;
  const cancel = () => {
    active?.controller.abort();
    active = undefined;
  };
  return {
    cancel,
    load(userId, getToken) {
      if (!userId) { cancel(); return Promise.resolve(); }
      if (active?.userId === userId) return active.promise;
      cancel();
      const entry = { userId, controller: new AbortController() };
      active = entry;
      entry.promise = Promise.resolve()
        .then(() => {
          entry.controller.signal.throwIfAborted();
          return request(userId, entry.controller.signal, getToken);
        })
        .then((data) => {
          if (active === entry) onSuccess(userId, data);
        })
        .catch((error) => {
          if (active === entry && !entry.controller.signal.aborted) onError(userId, error);
        })
        .finally(() => { if (active === entry) active = undefined; });
      return entry.promise;
    },
  };
};

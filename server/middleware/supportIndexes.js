import Conversation from "../models/SupportConversation.js";
import Message from "../models/SupportMessage.js";
import Usage from "../models/SupportUsage.js";

let initialization;
// Support's uniqueness indexes must exist before support writes, but unrelated
// catalog/page reads do not need to wait for these three initialization calls.
export const ensureSupportIndexes = (req, _res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req?.method)) return next();
  initialization ||= Promise.all([Conversation.init(), Message.init(), Usage.init()]).catch(error => {
    initialization = undefined;
    throw error;
  });
  return initialization.then(() => next(), next);
};

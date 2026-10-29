import { clerkClient } from "@clerk/express";

// Resolve the identity on the server; browser metadata is never trusted here.
export const customerIdentity = { read: userId => clerkClient.users.getUser(userId) };

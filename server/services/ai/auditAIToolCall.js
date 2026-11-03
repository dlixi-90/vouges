import { randomUUID } from "node:crypto";
import AIToolAudit from "../../models/AIToolAudit.js";
import { parseBudgetAmount } from "./budgetAmount.js";

const DEFAULT_RETENTION_DAYS = 30;
const MAX_RETENTION_DAYS = 365;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
const SAFE_ARGUMENT_FIELDS = {
  searchProducts: [
    "category",
    "type",
    "minPrice",
    "maxPrice",
    "priceCurrency",
    "sort",
    "limit",
  ],
  getProductDetails: ["productId"],
  compareProducts: [],
  getMyOrders: ["status", "limit"],
  getMyCart: [],
  prepareAddToCart: ["productId", "size", "quantity"],
  prepareUpdateCart: ["productId", "size", "quantity"],
  prepareRemoveFromCart: ["productId", "size"],
};

const readRetentionDays = () => {
  const parsedValue = Number.parseInt(process.env.AI_AUDIT_RETENTION_DAYS, 10);

  if (!Number.isInteger(parsedValue) || parsedValue < 1) {
    return DEFAULT_RETENTION_DAYS;
  }

  return Math.min(parsedValue, MAX_RETENTION_DAYS);
};

const normalizeAuditValue = (value) => {
  if (typeof value === "string") return value.trim().slice(0, 100);
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return "[invalid-type]";
};

const sanitizeErrorMessage = (value) => {
  if (!value) return null;

  return String(value)
    .replace(/mongodb(?:\+srv)?:\/\/\S+/gi, "[redacted-database-url]")
    .replace(/bearer\s+\S+/gi, "Bearer [redacted]")
    .slice(0, 300);
};

export const sanitizeToolArguments = (toolName, argumentsValue) => {
  const source =
    argumentsValue &&
    typeof argumentsValue === "object" &&
    !Array.isArray(argumentsValue)
      ? argumentsValue
      : {};
  const allowedFields = SAFE_ARGUMENT_FIELDS[toolName] || [];
  const safeArguments = {};

  for (const field of allowedFields) {
    if (source[field] === undefined) continue;
    if(toolName==="searchProducts"&&["minPrice","maxPrice"].includes(field)&&source[field]!==null){
      try{const budget=parseBudgetAmount(source[field],source.priceCurrency);safeArguments[field]=budget.amount;safeArguments[`${field}Currency`]=budget.currency;}
      catch{safeArguments[field]="[invalid-budget]";}
    }else safeArguments[field] = normalizeAuditValue(source[field]);
  }

  if (toolName === "searchProducts" && source.query !== undefined) {
    safeArguments.queryProvided = Boolean(String(source.query).trim());
    safeArguments.queryLength = Math.min(String(source.query).length, 100000);
  }

  if (toolName === "compareProducts" && Array.isArray(source.productIds)) {
    safeArguments.productIds = source.productIds
      .filter((productId) => typeof productId === "string")
      .slice(0, 4)
      .map((productId) => productId.slice(0, 40));
  }

  return {
    safeArguments,
    argumentKeys: Object.keys(source)
      .slice(0, 20)
      .map((key) => key.slice(0, 80)),
  };
};

export const auditAIToolCall = async ({
  context = {},
  toolCallId,
  toolName,
  argumentsValue,
  outcome,
  errorMessage,
  durationMs = 0,
}) => {
  const userId = String(context.userId || "unknown").slice(0, 160);
  const requestId = String(context.requestId || randomUUID()).slice(0, 160);
  const normalizedToolName = String(toolName || "unknown").slice(0, 80);
  const sanitizedArguments = sanitizeToolArguments(
    normalizedToolName,
    argumentsValue,
  );
  const expiresAt = new Date(
    Date.now() + readRetentionDays() * MILLISECONDS_PER_DAY,
  );

  try {
    await AIToolAudit.create({
      requestId,
      userId,
      toolCallId: toolCallId ? String(toolCallId).slice(0, 160) : null,
      toolName: normalizedToolName,
      outcome,
      arguments: sanitizedArguments.safeArguments,
      argumentKeys: sanitizedArguments.argumentKeys,
      errorMessage: sanitizeErrorMessage(errorMessage),
      durationMs: Math.max(Number(durationMs) || 0, 0),
      expiresAt,
    });
  } catch (auditError) {
    console.error("AI tool audit error:", auditError.message);
  }
};

export default auditAIToolCall;

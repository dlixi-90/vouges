import AIUsage from "../models/AIUsage.js";

const DEFAULT_MINUTE_LIMIT = 5;
const DEFAULT_DAY_LIMIT = 20;
const MILLISECONDS_PER_MINUTE = 60 * 1000;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const readLimit = (environmentValue, fallback) => {
  const parsedValue = Number.parseInt(environmentValue, 10);
  return Number.isInteger(parsedValue) && parsedValue > 0
    ? parsedValue
    : fallback;
};

const getWindow = (now, duration) => {
  const startTime = Math.floor(now.getTime() / duration) * duration;

  return {
    start: new Date(startTime),
    end: new Date(startTime + duration),
  };
};

const incrementExistingUsage = ({ key, limit }) =>
  AIUsage.findOneAndUpdate(
    {
      key,
      count: {
        $lt: limit,
      },
    },
    {
      $inc: {
        count: 1,
      },
    },
    {
      new: true,
    },
  ).lean();

const consumeWindow = async ({
  userId,
  windowType,
  windowStart,
  windowEnd,
  limit,
}) => {
  const key = `user:${userId}:${windowType}:${windowStart.toISOString()}`;

  let usage = await incrementExistingUsage({
    key,
    limit,
  });

  if (!usage) {
    try {
      usage = await AIUsage.create({
        key,
        userId,
        windowType,
        windowStart,
        count: 1,
        expiresAt: windowEnd,
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;

      usage = await incrementExistingUsage({
        key,
        limit,
      });
    }
  }

  if (!usage) {
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetAt: windowEnd,
    };
  }

  return {
    allowed: true,
    limit,
    remaining: Math.max(limit - usage.count, 0),
    resetAt: windowEnd,
  };
};

const sendRateLimitResponse = (res, result, windowLabel) => {
  const retryAfter = Math.max(
    Math.ceil((result.resetAt.getTime() - Date.now()) / 1000),
    1,
  );

  res.set("Retry-After", String(retryAfter));

  return res.status(429).json({
    success: false,
    code: "AI_RATE_LIMITED",
    message: `Bạn đã đạt giới hạn AI ${windowLabel}. Vui lòng thử lại sau.`,
    retryAfter,
    resetAt: result.resetAt.toISOString(),
  });
};

const setRateLimitHeaders = (res, minuteResult, dayResult) => {
  res.set({
    "X-AI-RateLimit-Minute-Limit": String(minuteResult.limit),
    "X-AI-RateLimit-Minute-Remaining": String(minuteResult.remaining),
    "X-AI-RateLimit-Minute-Reset": minuteResult.resetAt.toISOString(),
    "X-AI-RateLimit-Day-Limit": String(dayResult.limit),
    "X-AI-RateLimit-Day-Remaining": String(dayResult.remaining),
    "X-AI-RateLimit-Day-Reset": dayResult.resetAt.toISOString(),
  });
};

export const aiRateLimit = async (req, res, next) => {
  try {
    const { userId } = req.auth();

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Bạn không có quyền thực hiện thao tác này",
      });
    }

    const minuteLimit = readLimit(
      process.env.AI_RATE_LIMIT_PER_MINUTE,
      DEFAULT_MINUTE_LIMIT,
    );
    const dayLimit = readLimit(
      process.env.AI_RATE_LIMIT_PER_DAY,
      DEFAULT_DAY_LIMIT,
    );
    const now = new Date();
    const minuteWindow = getWindow(now, MILLISECONDS_PER_MINUTE);
    const dayWindow = getWindow(now, MILLISECONDS_PER_DAY);

    const minuteResult = await consumeWindow({
      userId,
      windowType: "minute",
      windowStart: minuteWindow.start,
      windowEnd: minuteWindow.end,
      limit: minuteLimit,
    });

    if (!minuteResult.allowed) {
      return sendRateLimitResponse(res, minuteResult, "mỗi phút");
    }

    const dayResult = await consumeWindow({
      userId,
      windowType: "day",
      windowStart: dayWindow.start,
      windowEnd: dayWindow.end,
      limit: dayLimit,
    });

    if (!dayResult.allowed) {
      return sendRateLimitResponse(res, dayResult, "mỗi ngày");
    }

    setRateLimitHeaders(res, minuteResult, dayResult);
    return next();
  } catch (error) {
    console.error("AI rate limit error:", error.message);

    return res.status(503).json({
      success: false,
      code: "AI_RATE_LIMIT_UNAVAILABLE",
      message: "Không thể kiểm tra giới hạn AI. Vui lòng thử lại sau.",
    });
  }
};

export default aiRateLimit;

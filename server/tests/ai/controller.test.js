import assert from "node:assert/strict";
import test from "node:test";
import { chatWithAI } from "../../controllers/aiController.js";

const CLERK_USER_ID = "user_clerk_current";

const createResponse = () => {
  const state = { status: 200, payload: null };

  return {
    state,
    response: {
      status(statusCode) {
        state.status = statusCode;
        return this;
      },
      json(payload) {
        state.payload = payload;
        return payload;
      },
    },
  };
};

const callController = async ({ userId = CLERK_USER_ID, body = {} }) => {
  const { state, response } = createResponse();

  await chatWithAI(
    {
      body,
      auth: () => ({ userId }),
    },
    response,
  );

  return state;
};

test("chatWithAI chặn request không hợp lệ trước khi gọi Groq", async () => {
  const originalApiKey = process.env.GROQ_API_KEY;
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;
  let fetchCalls = 0;

  process.env.GROQ_API_KEY = "test-key";
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("Groq should not be called");
  };
  console.error = () => {};

  try {
    const unauthorized = await callController({
      userId: null,
      body: { message: "Xin chào" },
    });
    const emptyMessage = await callController({ body: { message: "   " } });
    const longMessage = await callController({
      body: { message: "a".repeat(2001) },
    });
    const invalidHistory = await callController({
      body: { message: "Xin chào", history: [{ role: "tool", content: "x" }] },
    });

    assert.equal(unauthorized.status, 401);
    assert.equal(emptyMessage.status, 400);
    assert.equal(longMessage.status, 400);
    assert.equal(invalidHistory.status, 400);
    assert.equal(fetchCalls, 0);

    delete process.env.GROQ_API_KEY;
    const missingConfiguration = await callController({
      body: { message: "Xin chào" },
    });
    assert.equal(missingConfiguration.status, 500);
  } finally {
    if (originalApiKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = originalApiKey;
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});

test("chatWithAI giới hạn history và chỉ gửi tool definitions liên quan", async () => {
  const originalApiKey = process.env.GROQ_API_KEY;
  const originalFetch = globalThis.fetch;
  let groqRequestBody;

  process.env.GROQ_API_KEY = "test-key";
  globalThis.fetch = async (url, options) => {
    groqRequestBody = JSON.parse(options.body);

    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { role: "assistant", content: "OK" } }],
      }),
    };
  };

  try {
    const history = Array.from({ length: 13 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      content: `history-${index}`,
    }));
    const state = await callController({
      body: { message: "So sánh sản phẩm", history },
    });

    assert.equal(state.status, 200);
    assert.equal(state.payload.success, true);
    assert.equal(groqRequestBody.messages.length, 8);
    assert.equal(groqRequestBody.messages[1].content, "history-7");
    assert.equal(groqRequestBody.messages.at(-1).content, "So sánh sản phẩm");
    assert.equal(
      groqRequestBody.tools.some(
        (tool) => tool.function.name === "compareProducts",
      ),
      true,
    );
    assert.equal(
      groqRequestBody.tools.some(
        (tool) => tool.function.name === "prepareRemoveFromCart",
      ),
      false,
    );
    assert.deepEqual(groqRequestBody.tools.map((tool) => tool.function.name), [
      "searchProducts", "getProductDetails", "compareProducts",
    ]);
  } finally {
    if (originalApiKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = originalApiKey;
    globalThis.fetch = originalFetch;
  }
});

test("chatWithAI chuyển Groq 429 thành thông báo giới hạn công khai", async () => {
  const originalApiKey = process.env.GROQ_API_KEY;
  const originalFetch = globalThis.fetch;
  const originalConsoleError = console.error;

  process.env.GROQ_API_KEY = "test-key";
  globalThis.fetch = async () => ({
    ok: false,
    status: 429,
    json: async () => ({ error: { message: "provider detail" } }),
  });
  console.error = () => {};

  try {
    const state = await callController({ body: { message: "Xin chào" } });

    assert.equal(state.status, 429);
    assert.equal(state.payload.success, false);
    assert.match(state.payload.message, /giới hạn/);
    assert.equal(state.payload.message.includes("provider detail"), false);
  } finally {
    if (originalApiKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = originalApiKey;
    globalThis.fetch = originalFetch;
    console.error = originalConsoleError;
  }
});

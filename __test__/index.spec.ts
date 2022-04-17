import { createRequestClient, APISchema } from "../lib";

interface TestAPISchema extends APISchema {
  testApi: {
    request: {};
    response: string;
  };
}

const apis = createRequestClient<TestAPISchema>({
  apis: {
    testApi: "GET /xxx",
  },
});

describe("ApiIsFunction", () => {
  it("Api should be a function", () => {
    expect(typeof apis.testApi).toBe('function');
  });
});

describe("ApiReturnPromise", () => {
  it("Api return a Promise", () => {
    expect(apis.testApi({})).toBeInstanceOf(Promise)
  });
});

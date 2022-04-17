/* eslint-disable @typescript-eslint/no-unused-vars */
import http from "http";
import assert from "assert";
import { createRequestClient, APISchema } from "../lib";

let server: http.Server | null;
let proxy: http.Server | null;

interface TestAPISchema extends APISchema {
  testApi: {
    request: {};
    response: {
      data: {};
    };
  };
}

describe("supports http with nodejs", () => {
  afterEach(() => {
    if (server) {
      server.close();
      server = null;
    }
    if (proxy) {
      proxy.close();
      proxy = null;
    }
    if (process.env.http_proxy) {
      delete process.env.http_proxy;
    }
    if (process.env.no_proxy) {
      delete process.env.no_proxy;
    }
  });

  it("should throw an error if timeout", done => {
    server = http
      .createServer((req, res) => {
        setTimeout(() => {
          res.end();
        }, 1000);
      })
      .listen(4444, () => {
        let success = false;
        let failure = false;
        let error: any;

        createRequestClient<TestAPISchema>({
          baseURL: "http://localhost:4444/",
          timeout: 250,
          apis: {
            testApi: "GET /",
          },
        })
          .testApi({})
          .then(() => {
            success = true;
          })
          .catch(err => {
            error = err;
            failure = true;
          });

        setTimeout(() => {
          assert.equal(success, false, "request should not succeed");
          assert.equal(failure, true, "request should fail");
          assert.equal(error.code, "ECONNABORTED");
          assert.equal(error.message, "timeout of 250ms exceeded");
          done();
        }, 300);
      });
  });

  it("should success", done => {
    server = http
      .createServer((req, res) => {
        res.end();
      })
      .listen(4444, () => {
        let success = false;
        let failure = false;
        let error: any;

        createRequestClient<TestAPISchema>({
          baseURL: "http://localhost:4444/",
          timeout: 250,
          apis: {
            testApi: "GET /",
          },
        })
          .testApi({})
          .then(() => {
            success = true;
          })
          .catch(err => {
            error = err;
            failure = true;
          });

        setTimeout(() => {
          assert.equal(success, true, "request should succeed");
          done();
        }, 300);
      });
  });

  it("should allow passing JSON", done => {
    const data = {
      firstName: "Fred",
      lastName: "Flintstone",
      emailAddr: "fred@example.com",
    };

    server = http
      .createServer((req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(data));
      })
      .listen(4444, () => {
        createRequestClient<TestAPISchema>({
          baseURL: "http://localhost:4444/",
          apis: {
            testApi: "GET /",
          },
        })
          .testApi({})
          .then(() => {
            assert.deepEqual(data, data);
            done();
          });
      });
  });
});

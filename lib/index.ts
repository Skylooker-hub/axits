import axios, {
  AxiosInstance,
  AxiosRequestHeaders,
  AxiosError,
  Method,
  AxiosRequestConfig,
  AxiosResponse,
} from "axios";

type RemoveIndexSignature<Obj extends Record<string, any>> = {
  [Key in keyof Obj as Key extends `${infer Str}` ? Str : never]: Obj[Key];
};

type IsEqual<A, B> = (A extends B ? true : false) &
  (B extends A ? true : false);

type Includes<Arr extends unknown[], FindItem> = Arr extends [
  infer First,
  ...infer Rest
]
  ? IsEqual<First, FindItem> extends true
    ? true
    : Includes<Rest, FindItem>
  : false;

type OmitArray<T, K extends Array<string | number | symbol>> = {
  [Key in keyof T as Includes<K, Key> extends true ? never : Key]: T[Key];
};

type RequiredArray<T, K extends Array<string | number | symbol>> = {
  [Key in keyof T as Includes<K, Key> extends true ? Key : never]-?: T[Key];
} & OmitArray<T, K>;

type RequestOptions = RequiredArray<
  OmitArray<AxiosRequestConfig, ["params", "data"]>,
  ["url", "method"]
>;

type RequestPath = `${RequestOptions["method"]} ${string}`;

type RequestFunction<P = Record<string, any>, R = any> = (
  params: P,
  options?: AxiosRequestConfig
) => Promise<R>;

type APIConfig = RequestPath | RequestOptions;

type HeaderHandler = (
  config?: AxiosRequestConfig
) => Promise<AxiosRequestHeaders>;
type RequestErrorHandler = (error: AxiosError) => void;

type APIType = {
  request: Record<string, any>;
  response: any;
};

type APISchema = Record<string, APIType>;

type CreateRequestConfig<T extends APISchema> = {
  /** Async handle headers */
  headerHandlers?: Array<HeaderHandler>;
  errorHandler?: RequestErrorHandler;
  requestInterceptor?: (
    config: AxiosRequestConfig
  ) => Promise<AxiosRequestConfig>;
  responseInterceptor?: (res: AxiosResponse) => Promise<AxiosResponse>;
  apis: {
    [K in keyof RemoveIndexSignature<T>]:
      | RequestFunction<
          RemoveIndexSignature<T>[K]["request"],
          RemoveIndexSignature<T>[K]["response"]
        >
      | APIConfig;
  };
} & OmitArray<AxiosRequestConfig, ["url", "method", "params", "data"]>;

type CreateRequestClient<T extends APISchema> = {
  [K in keyof RemoveIndexSignature<T>]: RequestFunction<
    RemoveIndexSignature<T>[K]["request"],
    RemoveIndexSignature<T>[K]["response"]
  >;
};

export type { APISchema, APIType };

const MATCH_METHOD =
  /^(GET|POST|PUT|DELETE|HEAD|OPTIONS|LINK|UNLINK|PURGE|PATCH)\s+/i;
const MATCH_PATH_PARAMS = /:(\w+)/g;
const USE_DATA_METHODS = ["POST", "PUT", "PATCH", "DELETE"];

function attachAPI<T extends APISchema>(
  client: AxiosInstance,
  apis: CreateRequestConfig<T>["apis"]
): CreateRequestClient<T> {
  const hostApi: CreateRequestClient<T> = Object.create(null);
  for (const apiName in apis) {
    const apiConfig = apis[apiName];
    if (typeof apiConfig === "function") {
      hostApi[apiName] = apiConfig as RequestFunction;
      continue;
    }
    let apiOptions = {};
    let apiPath = apiConfig as RequestPath;
    if (typeof apiConfig === "object") {
      const { url, ...rest } = apiConfig as RequestOptions;
      apiPath = url as RequestPath;
      apiOptions = rest;
    }
    hostApi[apiName] = (params, options = {}) => {
      const _params = { ...(params || {}) };
      const [prefix, method] = apiPath.match(MATCH_METHOD) || ["GET ", "GET"];
      let url = apiPath.replace(prefix, "");
      const matchParams = apiPath.match(MATCH_PATH_PARAMS);
      if (matchParams) {
        matchParams.forEach((match) => {
          const key = match.replace(":", "");
          if (Reflect.has(_params, key)) {
            url = url.replace(match, Reflect.get(_params, key));
            Reflect.deleteProperty(_params, key);
          }
        });
      }
      const requestParams = USE_DATA_METHODS.includes(method.toUpperCase())
        ? { data: _params }
        : { params: _params };
      return client.request({
        url,
        method: method as Method,
        ...requestParams,
        ...apiOptions,
        ...options,
      });
    };
  }
  return hostApi;
}

export function createRequestClient<T extends APISchema>(
  requestConfig: CreateRequestConfig<T>
): CreateRequestClient<T> {
  const {
    apis,
    headerHandlers,
    errorHandler,
    requestInterceptor,
    responseInterceptor,
    ...otherConfigs
  } = requestConfig;
  const client = axios.create(otherConfigs);

  client.interceptors.request.use(
    async (config) => {
      config = requestInterceptor ? await requestInterceptor(config) : config;

      const headerHandlersPromises = (headerHandlers || []).map(
        (handler, index) =>
          handler(config)
            .then((mixHeaders: AxiosRequestHeaders) => {
              Object.assign(config.headers, mixHeaders);
            })
            .catch(() => new Error(`headerHandlers[${index}] Error!!! `))
      );
      await Promise.all(headerHandlersPromises);
      return config;
    },
    (error: AxiosError) => {
      const requestError = errorHandler ? errorHandler(error) : error;
      return Promise.reject(requestError);
    }
  );

  client.interceptors.response.use(
    async (res) => {
      res = responseInterceptor ? await responseInterceptor(res) : res;
      return res;
    },
    (error: AxiosError) => {
      const requestError = errorHandler ? errorHandler(error) : error;
      return Promise.reject(requestError);
    }
  );

  return attachAPI<T>(client, apis);
}

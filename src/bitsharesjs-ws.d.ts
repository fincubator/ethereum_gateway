declare module 'bitsharesjs-ws' {
  export interface DBApi {
    exec(method: string, parameters: any[]): Promise<any>;
  }

  export interface Apis {
    init_promise: Promise<any>;
    db_api(): DBApi;
  }

  export type CloseCallbackReturn<T> = T | Promise<T>;

  export interface ApisSingleton {
    setAutoReconnect(autoRecconect: boolean): void;
    instance(
      provider?: string,
      connect?: boolean,
      connectTimeout?: number,
      optionalApis?: any,
      closeCallback?: () => CloseCallbackReturn<any>
    ): Apis;
  }

  export let Apis: ApisSingleton;
}

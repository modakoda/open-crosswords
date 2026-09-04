/** Per-request context threaded through every procedure. */
export interface RpcContext {
  headers: Headers;
}

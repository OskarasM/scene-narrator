// React 19 wants to know it is in a test environment before it will let the R3F reconciler
// flush updates synchronously. Without this every render logs "not configured to support
// act(...)" and the warnings drown out real output.
declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true

export {}

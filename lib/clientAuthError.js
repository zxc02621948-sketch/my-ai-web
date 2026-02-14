export function getErrorStatus(errorOrStatus) {
  if (typeof errorOrStatus === "number") return errorOrStatus;
  return errorOrStatus?.response?.status ?? null;
}

export function isAuthError(errorOrStatus) {
  const status = getErrorStatus(errorOrStatus);
  return status === 401 || status === 403;
}

export function getAuthErrorMessage(errorOrStatus, fallback = "權限驗證失敗") {
  const status = getErrorStatus(errorOrStatus);
  if (status === 401) return "登入已失效，請重新登入";
  if (status === 403) return "您沒有權限執行此操作";
  return fallback;
}

export function getApiErrorMessage(error, fallback = "請稍後再試") {
  if (isAuthError(error)) return getAuthErrorMessage(error, fallback);
  return error?.response?.data?.error || error?.response?.data?.message || fallback;
}

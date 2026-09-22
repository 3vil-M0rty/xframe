import api from "./api";

export const getTwoFactorStatus = async () => {
  const response = await api.get("/2fa/status");
  return response.data.data;
};

export const startTwoFactorSetup = async () => {
  const response = await api.post("/2fa/setup");
  return response.data.data; // { qrCodeDataUrl, secret }
};

export const confirmTwoFactorSetup = async (token) => {
  const response = await api.post("/2fa/verify-setup", { token });
  return response.data.data; // { backupCodes: [...] }
};

export const disableTwoFactor = async (password) => {
  const response = await api.post("/2fa/disable", { password });
  return response.data;
};

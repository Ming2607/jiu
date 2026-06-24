/**
 * 部署配置
 * ─────────────────────────────────────────
 * 国内用户：Vercel 常无法访问，请用腾讯云云函数，见 DEPLOY-CN.md
 * 本地开发（localhost）会自动走本机 server.js
 */
window.APP_CONFIG = {
  // 腾讯云 CloudBase 云函数（国内可访问）
  API_BASE: 'https://pinjianjiangnan-d0f2mt6713493228-1445879452.ap-shanghai.app.tcloudbase.com',
  API_PATH: '/order',
  // 收款码图片（可替换为 pay-alipay.jpg / pay-wechat.jpg）
  PAYMENT: {
    alipay: 'images/pay-alipay.svg',
    wechat: 'images/pay-wechat.svg',
  },
};

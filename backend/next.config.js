/** @type {import("next").NextConfig} */
const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: false,
  experimental: {
    serverActions: { bodySizeLimit: "500mb" },
    outputFileTracingRoot: "/app",
    outputFileTracingIncludes: {
      // EDU PDF-генератор тянет TTF и data-файлы pdfkit/fontkit
      "/api/edu/documents/**": [
        "./lib/fonts/**",
        "./node_modules/pdfkit/**",
        "./node_modules/fontkit/**",
        "./node_modules/linebreak/**",
        "./node_modules/png-js/**",
      ],
      // 2FA — otplib и зависимости
      "/api/auth/**": [
        "./node_modules/otplib/**",
        "./node_modules/@otplib/**",
        "./node_modules/thirty-two/**",
      ],
    },
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
    ];
  },
};
module.exports = nextConfig;

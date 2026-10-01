import next from "eslint-config-next";

const config = [
  ...next,
  { ignores: [".next/**", ".open-next/**", ".wrangler/**", "cloudflare-env.d.ts"] },
];

export default config;

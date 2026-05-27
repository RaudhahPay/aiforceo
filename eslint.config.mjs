// Flat ESLint config for Next.js 15.
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

export default [
  ...compat.config({ extends: ["next/core-web-vitals", "next/typescript"] }),
  {
    rules: {
      // SOP §4.4: no `any` to paper over real errors.
      "@typescript-eslint/no-explicit-any": ["error", { ignoreRestArgs: false }],
      // Encourage explicit return types on exported functions for clarity in
      // server-action files.
      "@typescript-eslint/explicit-module-boundary-types": "off",
      // Server actions return promises; awaits inside them are fine without `await`.
      "@typescript-eslint/require-await": "off"
    }
  },
  { ignores: [".next/**", ".open-next/**", "node_modules/**", "dist/**"] }
];

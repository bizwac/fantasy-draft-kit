import js from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  { ignores: ["dist", "dev-dist"] },
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: "module"
    },
    plugins: {
      "@typescript-eslint": tseslint,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      // TS already catches genuine undefined identifiers, and does it
      // correctly for ambient DOM/lib types and globals — no-undef is
      // ESLint's own documented false-positive source in TS projects.
      // This file previously hand-maintained a globals list (window/
      // document/navigator/crypto) that silently missed fetch,
      // localStorage, File, Response, process, React's ambient JSX
      // namespace, and more — 54 false-positive errors by the time
      // anyone actually ran `npm run lint`.
      "no-undef": "off"
    }
  }
];

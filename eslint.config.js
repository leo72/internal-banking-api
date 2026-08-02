import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["coverage/**", "dist/**", "src/generated/**"],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
      curly: ["error", "all"],
      eqeqeq: ["error", "always"],
      "no-console": "error",
      "no-duplicate-imports": "error",
      "object-shorthand": "error",
    },
  },
);

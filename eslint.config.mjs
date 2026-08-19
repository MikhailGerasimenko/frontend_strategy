import js from "@eslint/js";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import jsxA11y from "eslint-plugin-jsx-a11y";
import prettierRecommended from "eslint-plugin-prettier/recommended";
import reactPlugin from "eslint-plugin-react";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
    globalIgnores([
        "**/node_modules/**",
        "**/dist/**",
        "**/*.local",
    ]),
    js.configs.recommended,
    ...tsPlugin.configs["flat/recommended"],
    reactPlugin.configs.flat.recommended,
    reactPlugin.configs.flat["jsx-runtime"],
    jsxA11y.flatConfigs.recommended,
    {
        plugins: {
            "simple-import-sort": simpleImportSort,
        },

        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.node,
            },
            ecmaVersion: "latest",
            sourceType: "module",
        },

        settings: {
            react: {
                version: "detect",
            },
        },

        rules: {
            "react/prop-types": "off",
            "@typescript-eslint/explicit-function-return-type": "off",
            "simple-import-sort/imports": "error",
            "simple-import-sort/exports": "error",
            "jsx-a11y/anchor-is-valid": ["error", {
                components: ["Link"],
                specialLink: ["hrefLeft", "hrefRight"],
                aspects: ["invalidHref", "preferButton"],
            }],
        },
    },
    prettierRecommended,
]);

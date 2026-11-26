import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

/**
 * Regra customizada SDD (Constituição C2 / RNF14):
 * Proíbe operações aritméticas nativas em ponto flutuante e `toFixed`
 * dentro de `packages/domain/src/**` para garantir uso exclusivo de `decimal.js`.
 */
const noNativeFloatMathInDomain = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Constituição C2: Proíbe .toFixed() e aritmética binária sobre notas em packages/domain/src",
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (
          node.callee.type === "MemberExpression" &&
          node.callee.property.type === "Identifier" &&
          node.callee.property.name === "toFixed"
        ) {
          context.report({
            node,
            message:
              "[C2] Proibido usar Number.prototype.toFixed() em @app/domain. Use Decimal.toDecimalPlaces(..., Decimal.ROUND_HALF_UP).",
          });
        }
        if (
          node.callee.type === "MemberExpression" &&
          node.callee.object.type === "Identifier" &&
          node.callee.object.name === "Math" &&
          node.callee.property.type === "Identifier" &&
          ["round", "ceil", "floor", "trunc"].includes(node.callee.property.name)
        ) {
          context.report({
            node,
            message:
              "[C2] Proibido usar Math.round/ceil/floor em @app/domain. Utilize decimal.js.",
          });
        }
      },
    };
  },
};

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      "**/coverage/**",
      "**/next-env.d.ts",
      "apps/web/tests/perf/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    files: ["packages/domain/src/**/*.ts"],
    plugins: {
      sdd: {
        rules: {
          "no-native-float-math": noNativeFloatMathInDomain,
        },
      },
    },
    rules: {
      "sdd/no-native-float-math": "error",
    },
  }
);

// Revisión automática del código (npm run lint).
// La app usa <script> clásicos que comparten variables globales entre archivos (y los onclick del HTML
// llaman funciones por su nombre), así que no se revisan "variables no definidas" ni "sin usar":
// eso lo cubre tests/unidad/estructura.test.js cargando todos los archivos en orden.
const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  { ignores: ["node_modules/**", "js/logo.js"] },
  {
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: { ...globals.browser, firebase: "readonly", emailjs: "readonly", XLSX: "readonly", Chart: "readonly" },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-undef": "off",
      "no-unused-vars": "off",
      "no-redeclare": "off",
      "no-useless-escape": "off", // p. ej. "<\/script>" en las plantillas de impresión: inofensivo y a propósito
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  {
    files: ["tests/**/*.js", "eslint.config.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "commonjs", globals: { ...globals.node, ...globals.browser } },
    rules: {
      ...js.configs.recommended.rules,
      "no-empty": ["error", { allowEmptyCatch: true }],
      // el código que corre dentro del navegador (page.evaluate) usa funciones globales de la app
      "no-undef": "off",
    },
  },
];

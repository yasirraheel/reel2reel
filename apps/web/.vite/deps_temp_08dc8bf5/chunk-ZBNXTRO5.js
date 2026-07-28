import {
  lua
} from "./chunk-2YFZXD47.js";
import {
  markupTemplating
} from "./chunk-ANDF52T3.js";

// ../../node_modules/.pnpm/refractor@5.0.0/node_modules/refractor/lang/etlua.js
etlua.displayName = "etlua";
etlua.aliases = [];
function etlua(Prism) {
  Prism.register(lua);
  Prism.register(markupTemplating);
  (function(Prism2) {
    Prism2.languages.etlua = {
      delimiter: {
        pattern: /^<%[-=]?|-?%>$/,
        alias: "punctuation"
      },
      "language-lua": {
        pattern: /[\s\S]+/,
        inside: Prism2.languages.lua
      }
    };
    Prism2.hooks.add("before-tokenize", function(env) {
      var pattern = /<%[\s\S]+?%>/g;
      Prism2.languages["markup-templating"].buildPlaceholders(
        env,
        "etlua",
        pattern
      );
    });
    Prism2.hooks.add("after-tokenize", function(env) {
      Prism2.languages["markup-templating"].tokenizePlaceholders(env, "etlua");
    });
  })(Prism);
}

export {
  etlua
};
//# sourceMappingURL=chunk-ZBNXTRO5.js.map

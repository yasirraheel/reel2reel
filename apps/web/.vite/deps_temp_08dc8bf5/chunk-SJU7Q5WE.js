import {
  jsx
} from "./chunk-X6RQ54AR.js";
import {
  typescript
} from "./chunk-MJ4XVDPF.js";

// ../../node_modules/.pnpm/refractor@5.0.0/node_modules/refractor/lang/tsx.js
tsx.displayName = "tsx";
tsx.aliases = [];
function tsx(Prism) {
  Prism.register(jsx);
  Prism.register(typescript);
  (function(Prism2) {
    var typescript2 = Prism2.util.clone(Prism2.languages.typescript);
    Prism2.languages.tsx = Prism2.languages.extend("jsx", typescript2);
    delete Prism2.languages.tsx["parameter"];
    delete Prism2.languages.tsx["literal-property"];
    var tag = Prism2.languages.tsx.tag;
    tag.pattern = RegExp(
      /(^|[^\w$]|(?=<\/))/.source + "(?:" + tag.pattern.source + ")",
      tag.pattern.flags
    );
    tag.lookbehind = true;
  })(Prism);
}

export {
  tsx
};
//# sourceMappingURL=chunk-SJU7Q5WE.js.map

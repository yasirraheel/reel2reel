import {
  require_jsx_runtime
} from "./chunk-UJXXQ7FR.js";
import {
  require_react
} from "./chunk-HNE2JHRD.js";
import {
  __toESM
} from "./chunk-DP4XHQAG.js";

// ../../node_modules/.pnpm/@radix-ui+react-direction@1.1.1_@types+react@18.3.27_react@18.3.1/node_modules/@radix-ui/react-direction/dist/index.mjs
var React = __toESM(require_react(), 1);
var import_jsx_runtime = __toESM(require_jsx_runtime(), 1);
var DirectionContext = React.createContext(void 0);
function useDirection(localDir) {
  const globalDir = React.useContext(DirectionContext);
  return localDir || globalDir || "ltr";
}

export {
  useDirection
};
//# sourceMappingURL=chunk-YQC4F7K7.js.map

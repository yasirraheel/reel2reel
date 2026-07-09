import {
  useControllableState
} from "./chunk-FTLIEYQ2.js";
import {
  Primitive,
  composeEventHandlers
} from "./chunk-V5M3KBYR.js";
import {
  require_jsx_runtime
} from "./chunk-UJXXQ7FR.js";
import {
  require_react
} from "./chunk-HNE2JHRD.js";
import {
  __toESM
} from "./chunk-DP4XHQAG.js";

// ../../node_modules/.pnpm/@radix-ui+react-toggle@1.1.10_@types+react-dom@18.3.7_@types+react@18.3.27__@types+react@18.3_y4c2rq2eeoc5lejozbtp5cj7im/node_modules/@radix-ui/react-toggle/dist/index.mjs
var React = __toESM(require_react(), 1);
var import_jsx_runtime = __toESM(require_jsx_runtime(), 1);
var NAME = "Toggle";
var Toggle = React.forwardRef((props, forwardedRef) => {
  const { pressed: pressedProp, defaultPressed, onPressedChange, ...buttonProps } = props;
  const [pressed, setPressed] = useControllableState({
    prop: pressedProp,
    onChange: onPressedChange,
    defaultProp: defaultPressed ?? false,
    caller: NAME
  });
  return (0, import_jsx_runtime.jsx)(
    Primitive.button,
    {
      type: "button",
      "aria-pressed": pressed,
      "data-state": pressed ? "on" : "off",
      "data-disabled": props.disabled ? "" : void 0,
      ...buttonProps,
      ref: forwardedRef,
      onClick: composeEventHandlers(props.onClick, () => {
        if (!props.disabled) {
          setPressed(!pressed);
        }
      })
    }
  );
});
Toggle.displayName = NAME;
var Root = Toggle;

export {
  Toggle,
  Root
};
//# sourceMappingURL=chunk-6LHEVDJ2.js.map

import { TextDecoder, TextEncoder } from "node:util";

// jsdom lacks these, and react-dom/server needs them when it loads, so this
// module is imported before it. The channel never opens a port.
function StubChannel(this: { port1: object; port2: object }) {
  this.port1 = { postMessage: () => undefined };
  this.port2 = {};
}

Object.assign(globalThis, {
  TextEncoder,
  TextDecoder,
  MessageChannel: StubChannel,
});

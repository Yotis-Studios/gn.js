# Feasibility Analysis: Translating gn.js to Hemlock

## gn.js Overview

- **Purpose**: Lightweight event-driven WebSocket networking library for Node.js with GameMaker compatibility
- **Size**: ~612 lines of source code across 6 files
- **Dependencies**: `ws` (WebSocket) + Node.js built-ins (`http`, `events`, `buffer`)
- **Language features**: ES6 classes, EventEmitter pattern, Buffer manipulation, callbacks/events
- **No native bindings** — pure JavaScript

## Hemlock Overview

- **Repository**: [hemlang/hemlock](https://github.com/hemlang/hemlock)
- **Type**: Systems scripting language — "a small, unsafe language for writing unsafe things safely"
- **Paradigm**: Imperative, dynamic by default with optional type annotations, manual memory management
- **Concurrency**: async/await with real OS threads (pthreads), channels for inter-task communication
- **Status**: Active, v1.9.1 (April 2, 2026), 1,599 commits, 46 releases, MIT license
- **Implementation**: Written in C (92.3%), includes interpreter and C-code-generating compiler (hemlockc)
- **Tooling**: Package manager (hpm), LSP server, REPL, WebAssembly support

### Hemlock Standard Library (43 modules)

Key modules relevant to this translation:
- `@stdlib/websocket` — WebSocket client/server with SSL/TLS support
- `@stdlib/net` — TCP/UDP sockets and DNS resolution
- `@stdlib/http` — HTTP/HTTPS client using libwebsockets
- `@stdlib/json` — JSON parsing and serialization
- `@stdlib/encoding` — Base64, hex, URL encoding
- `@stdlib/async` — Async primitives
- `@stdlib/collections` — HashMap, Queue, Stack, Set, LinkedList
- `@stdlib/testing` — Test framework with describe/test/expect syntax
- `@stdlib/fs` — File and directory operations
- `@stdlib/crypto` — Cryptography utilities

## Verdict: Feasible

The translation is feasible. Hemlock provides all the core building blocks needed to reimplement gn.js.

### Feature Mapping

| gn.js Feature | Hemlock Equivalent |
|---|---|
| `ws` WebSocket library | `@stdlib/websocket` — built-in WebSocket client/server with SSL |
| Node.js `Buffer` | `buffer` type — native binary data type with pointer-level control |
| `EventEmitter` pattern | Callbacks/closures + channels for async event dispatch |
| ES6 Classes (`Server`, `Client`, `Connection`) | Objects with methods (Hemlock has object types) |
| `http.createServer()` | `@stdlib/net` TCP sockets or `@stdlib/http` |
| Binary serialization (u8, u16, u32, f32, etc.) | Native integer types `i8`-`i64`, `u8`-`u64`, `f32`/`f64` + `buffer` type |
| Jest tests | `@stdlib/testing` with describe/test/expect syntax |
| `console.log` debugging | `@stdlib/logging` or built-in `print()`/`write()` |
| npm package distribution | `hpm` package manager with GitHub-based registry |
| async operations | `async`/`await` with real pthread parallelism |

### Advantages of Translation

1. **Native WebSocket support** — `@stdlib/websocket` provides client/server WebSocket out of the box, no external dependency needed
2. **Stronger type control** — Hemlock's numeric types (`u8`-`u64`, `f32`/`f64`) map directly to gn.js's `Packet` binary format types, potentially with better performance
3. **Manual memory management** — Explicit control over allocation could improve performance for high-throughput packet processing
4. **Buffer type** — Native `buffer` type with pointer-level access is a natural fit for binary packet serialization
5. **C FFI** — If needed, direct C interop via `extern` functions for performance-critical paths
6. **WebAssembly target** — Hemlock can compile to WASM, enabling browser deployment
7. **Test parity** — `@stdlib/testing` uses describe/test/expect syntax similar to Jest, easing test translation

### Challenges

| Challenge | Mitigation |
|---|---|
| **No EventEmitter abstraction** | Implement a simple event emitter using callbacks/closures and an object-based registry. ~50 lines of Hemlock code. |
| **GameMaker binary protocol** | The custom binary format (type-prefixed fields) must be reimplemented using Hemlock's `buffer` type and integer operations. Straightforward given native numeric types. |
| **Small ecosystem** | Only 2 stars/2 forks — community support is minimal. However, the stdlib covers all needed functionality. |
| **Language maturity** | v1.9.1 with 46 releases is reasonably mature for a niche language, but edge cases and bugs are more likely than with Node.js. |
| **Dynamic typing by default** | Without discipline, could lose the implicit type safety that gn.js's consistent patterns provide. Use optional type annotations on public APIs. |

### Translation Plan

1. **EventEmitter** — Create a reusable `EventEmitter` object using a HashMap of event names to callback arrays
2. **Packet** — Reimplement binary serialization using `buffer` type with read/write operations for each data type (u8, u16, u32, s8, s16, s32, f16, f32, f64, string)
3. **gmConvert** — Port type conversion utilities using Hemlock's native numeric types and buffer operations
4. **Server** — WebSocket server using `@stdlib/websocket`, wrapping connections and emitting events
5. **Client** — WebSocket client using `@stdlib/websocket` with event-based API
6. **Connection** — Connection wrapper with send/broadcast/kick methods
7. **Tests** — Port all 5 test suites to `@stdlib/testing` (describe/test/expect maps nearly 1:1 from Jest)
8. **Package** — Publish as an `hpm` package

### Estimated Effort

- **Source translation**: ~800-1000 lines of Hemlock (slight increase due to explicit memory management and EventEmitter implementation)
- **Test translation**: ~700 lines (near 1:1 mapping thanks to similar test syntax)
- **Timeline**: Small project — straightforward for a developer familiar with Hemlock

## Recommendation

Proceed with translation. Hemlock's stdlib provides WebSocket, buffer, networking, and testing primitives that map well to gn.js's requirements. The main work is implementing a lightweight EventEmitter pattern and porting the binary serialization logic, both of which are straightforward given Hemlock's capabilities.

The WebAssembly compilation target is a bonus that could enable browser-side use cases not possible with the current Node.js-only implementation.

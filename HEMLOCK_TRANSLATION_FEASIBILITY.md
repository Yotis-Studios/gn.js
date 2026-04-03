# Feasibility Analysis: Translating gn.js to Hemlock

## gn.js Overview

- **Purpose**: Lightweight event-driven WebSocket networking library for Node.js with GameMaker compatibility
- **Size**: ~612 lines of source code across 6 files
- **Dependencies**: `ws` (WebSocket) + Node.js built-ins (`http`, `events`, `buffer`)
- **Language features**: ES6 classes, EventEmitter pattern, Buffer manipulation, callbacks/events
- **No native bindings** — pure JavaScript

## Hemlock Overview

- **Type**: Systems programming language (ML-family) emphasizing reliable parallel computation
- **Paradigm**: Functional-first, immutable by default, effectless by default
- **Concurrency model**: Shared-nothing message-passing (Erlang-style)
- **Status**: Work in progress — not yet self-hosting (written in OCaml), not suited for production use
- **Repository**: [BranchTaken/Hemlock](https://github.com/BranchTaken/Hemlock) (note: `hemlang/hemlock` does not appear to exist)

## Verdict: Not Feasible

### Blocking Issues

| Concern | Detail |
|---------|--------|
| **Hemlock is pre-production** | The language is still under active development, not self-hosting, and explicitly not ready for production use. There is no stable compiler to target. |
| **No networking/IO ecosystem** | Hemlock has no WebSocket library, HTTP server, or Buffer/binary manipulation primitives equivalent to Node.js. gn.js fundamentally depends on network I/O. |
| **No EventEmitter equivalent** | gn.js is built entirely around the event-driven callback pattern (Node.js EventEmitter). Hemlock's model is functional + message-passing, requiring a complete architectural redesign. |
| **No package ecosystem** | There is no package manager or library ecosystem. The sole runtime dependency (`ws`) would need to be reimplemented from scratch. |
| **Paradigm mismatch** | gn.js is imperative, mutable, OOP (classes with inheritance). Hemlock is functional, immutable-by-default, with ML-style modules. A "translation" would be a ground-up rewrite. |

### What Would Be Required (If Attempted)

1. Wait for Hemlock to reach a usable state with I/O primitives
2. Implement a WebSocket protocol handler from scratch
3. Redesign the entire architecture from OOP/event-driven to functional/message-passing
4. Reimplement binary serialization without Node.js Buffer
5. Write all tests from scratch (no Jest equivalent exists)

## Recommendation

This translation is not feasible given Hemlock's current maturity level. The language lacks the fundamental building blocks (networking, binary I/O, ecosystem) needed to support this kind of library.

If the goal is to port gn.js to a systems-level functional language, more mature alternatives would be far more practical:

- **OCaml** — Hemlock's own implementation language; mature ecosystem with networking libraries
- **Rust** — Systems language with strong type system, excellent WebSocket libraries (tokio-tungstenite)
- **Elixir/Erlang** — Message-passing concurrency model similar to Hemlock's goals, with mature networking

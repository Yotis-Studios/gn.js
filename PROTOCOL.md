# gn Wire Protocol

This document specifies the binary protocol spoken by gn.js and its ports
([gn.hml](https://github.com/Yotis-Studios/gn.hml) and GameMaker clients). Any
implementation that follows it can talk to any other.

All multi-byte integers and floats are **little-endian**. Byte values below are
written in hex.

## 1. Transport

- Packets travel over **WebSocket binary messages** (opcode 0x2). Text messages
  are not part of the protocol: the gn.js server reports them as an `error`
  event and ignores them, and gn.hml drops them.
- One WebSocket message carries **one or more packets**, concatenated back to
  back. A packet never spans two messages.
- The protocol has no handshake, versioning, acknowledgement or keepalive beyond
  what WebSocket itself provides. Connect, then exchange packets.

## 2. Framing

A WebSocket message is a sequence of frames:

```
+----------------+----------------------------+----------------+-------
| size (u16 LE)  | payload (size bytes)       | size (u16 LE)  | ...
+----------------+----------------------------+----------------+-------
```

- `size` is the length of the payload that follows, **not** counting the 2
  size bytes themselves. Maximum 65535.
- A receiver walks the message from offset 0:
  1. If fewer than 2 bytes remain, stop.
  2. Read `size`. If `size == 0`, or fewer than `size` bytes remain, **stop**
     and discard the rest of the message.
  3. Decode `payload` as a packet (section 3), then advance by `2 + size`.

Because a zero `size` or an over-long `size` ends parsing, any packets after a
corrupt frame in the same message are lost; earlier ones are still delivered.

## 3. Packet payload

```
+----------------+---------+---------+-----
| netId (u16 LE) | value 0 | value 1 | ...
+----------------+---------+---------+-----
```

- `netId` is an application-defined message identifier (0–65535). gn assigns it
  no meaning; applications typically use it as an enum of message kinds.
- A valid payload is at least 2 bytes. A payload of 0 or 1 bytes yields a packet
  with no `netId` and no values.
- The rest of the payload is zero or more **values** (section 4), read in order
  until the payload ends. There is no value count: the number of values is
  implied by the payload length.

A packet with `netId` 1 and no values is therefore `02 00 01 00`.

## 4. Values

Every value is a 1-byte **type id** followed by type-specific data:

| Id | Name        | Data after the type byte                       | Data size     | Decoded as         |
|---:|-------------|------------------------------------------------|---------------|--------------------|
|  0 | `u8`        | unsigned 8-bit integer                         | 1             | number             |
|  1 | `u16`       | unsigned 16-bit integer                        | 2             | number             |
|  2 | `u32`       | unsigned 32-bit integer                        | 4             | number             |
|  3 | `s8`        | signed 8-bit integer (two's complement)        | 1             | number             |
|  4 | `s16`       | signed 16-bit integer                          | 2             | number             |
|  5 | `s32`       | signed 32-bit integer                          | 4             | number             |
|  6 | `f16`       | IEEE 754 half-precision float                  | 2             | number             |
|  7 | `f32`       | IEEE 754 single-precision float                | 4             | number             |
|  8 | `f64`       | IEEE 754 double-precision float                | 8             | number             |
|  9 | `string`    | `len` (u16) then `len` bytes of UTF-8          | 2 + `len`     | string             |
| 10 | `buffer`    | `len` (u8) then `len` raw bytes                | 1 + `len`     | Buffer             |
| 11 | `undefined` | nothing                                        | 0             | `undefined`/`null` |

Type ids 12–255 are invalid.

### 4.1 Strings

```
09 | len (u16 LE) | UTF-8 bytes ... | 00
```

- Encoders append a NUL terminator, and `len` **includes** it. `"hi"` becomes
  `09 03 00 68 69 00`, and the empty string becomes `09 01 00 00`.
- Decoders read `len` bytes and, if the last one is `00`, drop it before
  decoding UTF-8. A string without a terminator is therefore also accepted.
- `len` counts bytes, not characters: `"é"` is `09 03 00 c3 a9 00`.
- Maximum encoded string: 65534 bytes of UTF-8 (65535 with the terminator).
  Encoders throw on anything longer.
- Edge case: gn.js does not add a terminator to a string that already ends in
  `\0`, so the decoder strips that character and it does not round-trip.

### 4.2 Buffers

```
0a | len (u8) | raw bytes ...
```

At most 255 bytes. Encoders throw on anything longer. There is no terminator.

### 4.3 f16

Neither gn.js nor gn.hml ever *produces* `f16`, but both decode it (for example
from GameMaker's `buffer_f16`). Decoding follows IEEE 754 binary16:
1 sign bit, 5 exponent bits (bias 15), 10 fraction bits, with subnormals,
±Infinity and NaN.

### 4.4 undefined

Type `11` carries no data. It represents an absent value (`undefined` in
JavaScript, `null` in Hemlock) and does **not** end the packet: the values after
it are decoded normally.

## 5. Choosing a type when encoding

Encoders pick the smallest type that fits, based on the value's runtime type:

**Integers** (JavaScript: a `number` for which `Number.isInteger` is true;
Hemlock: any integer type):

| Range                              | Type  |
|------------------------------------|-------|
| 0 … 255                            | `u8`  |
| 256 … 65535                        | `u16` |
| 65536 … 4294967295                 | `u32` |
| −128 … −1                          | `s8`  |
| −32768 … −129                      | `s16` |
| −2147483648 … −32769               | `s32` |
| anything else                      | error |

**Non-integer numbers** (including NaN and ±Infinity): `f32` if
`|value| <= 16777216` (2^24), otherwise `f64`. NaN and ±Infinity fail that
comparison and are sent as `f64`. NaN is always written as the canonical
quiet NaN `00 00 00 00 00 00 f8 7f` (whatever its sign or payload bits), so the
same packet encodes to the same bytes everywhere. Note that `f32` keeps only ~7 significant
digits: `0.1` is sent as `07 cd cc cc 3d` and decodes as `0.10000000149011612`.
If you need full precision for small fractional values, scale them to integers.

gn.js can't tell an integral double from an integer, so it applies the
integer rules to every whole number and refuses anything outside the 32-bit
range (e.g. `Date.now()`, or any double above 2^53). Typed implementations send
those as `f64`.

**Booleans** become `u8` `1` or `0`. Receivers get a number, not a boolean.

**Strings** become `string`. **Buffers** (Node `Buffer`, Hemlock `buffer`)
become `buffer`.

**Anything else** (`undefined`, `null`, arrays, plain objects) becomes
`undefined`. Arrays passed to `Packet.add()` are flattened into separate values
first; only nested values hit this rule.

The two ports differ in one way. JavaScript has a single number type, so `3.0`
is the integer `3` and is sent as `u8`. Hemlock distinguishes floats from
integers, so a Hemlock `3.0` is sent as `f32`. Both decode to a number equal to
3.

### Limits enforced by encoders

Encoders throw rather than put a wrapped or truncated value on the wire when:

- an integer falls outside the u32/s32 ranges above
- `netId` is outside 0–65535
- a string exceeds 65534 bytes, or a buffer exceeds 255 bytes
- the packet payload (2 + all encoded values) exceeds 65535 bytes

## 6. Decoding rules

A decoder reads values from offset 2 of the payload until the payload ends. It
**stops early, without error**, and keeps the values decoded so far, when it
finds:

- a type id ≥ 12
- a fixed-size value with fewer bytes left than its size
- a `string` or `buffer` whose length prefix is missing or longer than the bytes
  left

Malformed input therefore never throws. Even when a packet is damaged, the
receiver still gets that packet's `netId` and every value before the damage.
Handlers should treat a missing value as absent: `packet.get(i)` past the end
returns `undefined` (gn.js) or `null` (gn.hml).

## 7. Worked example

A packet with `netId` 7 and the values
`42, 300, -5, 1.5, "hi", Buffer [1, 2], undefined, true`:

```
1b 00                     size = 27
07 00                     netId = 7
00 2a                     u8      42
01 2c 01                  u16     300
03 fb                     s8      -5
07 00 00 c0 3f            f32     1.5
09 03 00 68 69 00         string  "hi"  (len 3 includes NUL)
0a 02 01 02               buffer  [1, 2]
0b                        undefined
00 01                     u8      1     (true)
```

Two packets can share one WebSocket message by concatenating them:
`02 00 01 00 02 00 02 00` delivers empty packets with `netId` 1 and then 2.

## 8. Conformance vectors

[`test/vectors/protocol.json`](test/vectors/protocol.json) holds the test
vectors every implementation should pass:

- `encode`: build a packet from a `netId` and values; the bytes must match exactly.
- `encode_errors`: packets an encoder must refuse to build.
- `decode`: payloads (including malformed ones) and the values they must decode to.
- `frames`: WebSocket messages and the packets they must split into.

gn.js runs them in `test/vectors.test.js`. Ports should copy the file and run
the same cases, rather than keeping their own copies of the rules.

## 9. Implementation checklist

- [ ] Use little-endian for every multi-byte field.
- [ ] Prefix every packet with its u16 payload size; accept several packets per
      WebSocket message.
- [ ] Stop parsing a message on a zero or over-long size.
- [ ] Count the NUL terminator in a string's `len`, and strip it on decode.
- [ ] Treat `undefined` (11) as a value with no data, not as end of packet.
- [ ] Bounds-check every read; on a short or invalid value, stop and keep what
      was already decoded.
- [ ] Decode `f16` as 2 bytes of IEEE 754 binary16.
- [ ] Refuse to encode values that don't fit their field instead of wrapping.

The reference implementation is `src/util/gmConvert.js` (values) and
`src/network/Packet.js` (packet payloads). The receive loops in
`src/network/Server.js` and `src/network/Client.js` handle framing.

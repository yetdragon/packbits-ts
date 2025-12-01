# packbits-ts

[![JSR](https://jsr.io/badges/@yetdragon/packbits)](https://jsr.io/@yetdragon/packbits)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE.md)

A TypeScript implementation of the [PackBits](https://en.wikipedia.org/wiki/PackBits) compression algorithm, commonly used in TIFF and Macintosh PICT files.

## Usage

```typescript
import { compress, decompress } from "jsr:@yetdragon/packbits"

// Example data
const data = new Uint8Array([
  0xAA, 0xAA, 0xAA, 0x80, 0x00, 0x2A, 0xAA, 0xAA, 0xAA, 0xAA,
  0x80, 0x00, 0x2A, 0x22, 0xAA, 0xAA, 0xAA, 0xAA, 0xAA, 0xAA,
  0xAA, 0xAA, 0xAA, 0xAA
])

// Compress the data
const compressed = compress(data)
console.log("Compressed size:", compressed.length)

// Decompress back
const decompressed = decompress(compressed)
console.log("Original size:", decompressed.length)
```

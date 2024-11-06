// path: /src/mod.bench.ts

import { compress, decompress } from "../src/mod.ts"

const REPEATS = 1000

/**
 * Test data with mixed content:
 * - Repeated sequences
 * - Single values
 * - Alternating values
 */
const TEST_PATTERNS = {
	repeated: [0xAA, 0xAA, 0xAA, 0xAA, 0xAA],
	single: [0x80, 0x00],
	alternating: [0xAA, 0x55, 0xAA, 0x55]
}

// Generate test data by repeating patterns
const UNCOMPRESSED = new Uint8Array(
	new Array(REPEATS).fill([
		...TEST_PATTERNS.repeated,
		...TEST_PATTERNS.single,
		...TEST_PATTERNS.alternating
	]).flat()
)

// Pre-compress the test data for decompression benchmark
const COMPRESSED = compress(UNCOMPRESSED)


Deno.bench({
	name: "Compress mixed patterns",
	fn: () => {
		compress(UNCOMPRESSED)
	}
})

Deno.bench({
	name: "Decompress mixed patterns",
	fn: () => {
		decompress(COMPRESSED)
	}
})

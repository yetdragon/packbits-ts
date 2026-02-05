import { compress, decompress } from "./mod.ts"

const PATTERNS = {
	repeating:   [0xAA, 0xAA, 0xAA, 0xAA, 0xAA],
	single:      [0x80, 0x00],
	alternating: [0xAA, 0x55, 0xAA, 0x55]
}

const DATA = new Uint8Array(
	new Array(1000).fill([
		...PATTERNS.repeating,
		...PATTERNS.single,
		...PATTERNS.alternating
	]).flat()
)

const COMPRESSED = compress(DATA)

Deno.bench({
	name: "Compression",
	fn: () => {
		compress(DATA)
	}
})

Deno.bench({
	name: "Decompression",
	fn: () => {
		decompress(COMPRESSED)
	}
})

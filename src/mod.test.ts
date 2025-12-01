import { assertEquals } from "@std/assert"

import { PackBitsError, compress, decompress } from "./mod.ts"

const TEST_CASES = [
	{
		name: `Example data`,
		data: new Uint8Array([
			0xAA, 0xAA, 0xAA, 0x80, 0x00, 0x2A, 0xAA, 0xAA, 0xAA, 0xAA,
			0x80, 0x00, 0x2A, 0x22, 0xAA, 0xAA, 0xAA, 0xAA, 0xAA, 0xAA,
			0xAA, 0xAA, 0xAA, 0xAA
		]),
		compressed: new Uint8Array([
			0xFE, 0xAA, 0x02, 0x80, 0x00, 0x2A, 0xFD, 0xAA, 0x03, 0x80,
			0x00, 0x2A, 0x22, 0xF7, 0xAA
		])
	},
	{
		name: `Empty data`,
		data: new Uint8Array([]),
		compressed: new Uint8Array([])
	},
	{
		name: `Single byte`,
		data: new Uint8Array([0xAA]),
		compressed: new Uint8Array([0x00, 0xAA])
	},
	{
		name: `Long repetitive bytes`,
		data: new Uint8Array(new Array(200).fill(0xAA)),
		compressed: new Uint8Array([0x81, 0xAA, 0xB9, 0xAA])
	},
	{
		// 200 bytes of alternating data → two literal runs (128 + 72 bytes)
		name: `Long alternating bytes`,
		data: new Uint8Array(new Array(100).fill([0xAA, 0x55]).flat()),
		compressed: new Uint8Array([
			0x7F, // 128 literal bytes
			...new Array(64).fill([0xAA, 0x55]).flat(),
			0x47, // 72 literal bytes
			...new Array(36).fill([0xAA, 0x55]).flat()
		])
	},
	{
		name: `Maximum run length (128 bytes)`,
		data: new Uint8Array(new Array(128).fill(0xFF)),
		compressed: new Uint8Array([0x81, 0xFF])
	},
	{
		name: "2-byte replicate run optimization when preceded and followed by literal runs",
		data: new Uint8Array([0x54, 0xAA, 0xAA, 0x80, 0x00]),
		compressed: new Uint8Array([0x04, 0x54, 0xAA, 0xAA, 0x80, 0x00])
	}
]

Deno.test(`Compress original data`, async (t) => {
	for (const { name, data, compressed } of TEST_CASES) {
		await t.step(name, () => {
			const result = compress(data)
			assertEquals(result, compressed)
		})
	}
})

Deno.test(`Decompress compressed data`, async (t) => {
	for (const { name, data, compressed } of TEST_CASES) {
		await t.step(name, () => {
			const result = decompress(compressed)
			assertEquals(result, data)
		})
	}
})

// Roundtrip tests
Deno.test(`Roundtrip compression/decompression`, async (t) => {
	const testData = [
		new Uint8Array([...Array(256)].map((_, i) => i)), // All byte values
		new Uint8Array(new Array(1000).fill(0x55)), // Long repeating sequence
		new Uint8Array([...Array(1000)].map(() => Math.floor(Math.random() * 256))) // Random data
	]

	for (const data of testData) {
		await t.step(`Data length: ${data.length}`, () => {
			const compressed = compress(data)
			const decompressed = decompress(compressed)
			assertEquals(decompressed, data)
		})
	}
})

Deno.test(`Handle decompression errors`, async (t) => {
	await t.step(`Malformed compressed data (truncated)`, () => {
		try {
			decompress(new Uint8Array([0x7F])) // count byte without data
			throw new Error(`Expected error was not thrown`)
		} catch (error) {
			assertEquals(error instanceof PackBitsError, true)
			if (error instanceof PackBitsError) {
				assertEquals(error.message, `Unexpected end of compressed data`)
			}
		}
	})
})

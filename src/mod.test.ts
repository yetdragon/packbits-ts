import { assertEquals, assertThrows } from "@std/assert"

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
		name: `Maximum run length (128 bytes)`,
		data: new Uint8Array(new Array(128).fill(0xFF)),
		compressed: new Uint8Array([0x81, 0xFF])
	},
	{
		name: `Long repetitive bytes`,
		data: new Uint8Array(new Array(200).fill(0xAA)),
		compressed: new Uint8Array([0x81, 0xAA, 0xB9, 0xAA])
	},
	{
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
		name: `L128-R2-L128`, // Algorithm treating R2 as L2 will fail
		data: new Uint8Array([
			...new Array(128).keys(),
			0x80, 0x80,
			...new Array(128).keys()
		]),
		compressed: new Uint8Array([
			0x7F, ...new Array(128).keys(),
			0xFF, 0x80,
			0x7F, ...new Array(128).keys()
		])
	},
	{
		name: "L-R2-L",
		data: new Uint8Array([0x54, 0xAA, 0xAA, 0x80, 0x00]),
		compressed: new Uint8Array([0x04, 0x54, 0xAA, 0xAA, 0x80, 0x00])
	},
	{
		name: `L-R2-R2-R2-L`,
		data: new Uint8Array([0x10, 0x20, 0x30, 0x30, 0x40, 0x40, 0x50, 0x50, 0x60, 0x70]),
		compressed: new Uint8Array([0x09, 0x10, 0x20, 0x30, 0x30, 0x40, 0x40, 0x50, 0x50, 0x60, 0x70])
	}
]

Deno.test(`Compression`, async (t) => {
	for (const { name, data, compressed } of TEST_CASES) {
		await t.step(name, () => {
			const result = compress(data)
			assertEquals(result, compressed)
		})
	}
})

Deno.test(`Decompression`, async (t) => {
	for (const { name, data, compressed } of TEST_CASES) {
		await t.step(name, () => {
			const result = decompress(compressed)
			assertEquals(result, data)
		})
	}
})

const TEST_CASES_ROUNDTRIP = [
	new Uint8Array([...new Array(256).keys()]), // All byte values
	new Uint8Array(new Array(1000).fill(0x55)), // Long repeating sequence
	new Uint8Array([...Array(1000)].map(() => Math.floor(Math.random() * 256))), // Random data
	new Uint8Array([94, 88, 130, 170, 121, 145, 5, 54, 203, 161, 9, 207, 218, 55, 78, 121, 77, 37, 37, 157, 104, 248, 125, 102, 132, 249, 242, 126, 13, 16, 121, 132, 175, 179, 179, 253, 57, 172, 225, 42, 238, 183, 20, 152, 149, 22, 80, 15, 48, 32, 149, 10, 93, 146, 254, 41, 220, 4, 51, 171, 245, 244, 87, 69, 64, 141, 200, 245, 216, 57, 131, 184, 33, 209, 30, 61, 30, 161, 85, 224, 78, 190, 95, 201, 212, 205, 203, 97, 104, 9, 111, 158, 12, 245, 125, 1, 199, 169, 243, 253, 45, 249, 84, 122, 177, 236, 114, 28, 140, 42, 216, 28, 9, 113, 157, 97, 174, 12, 125, 51, 139, 41, 170, 246, 230, 151, 108, 136, 24, 188, 253, 1, 213, 210, 147, 93, 57, 127, 251, 110, 20, 69, 83, 50, 61, 123, 176, 251, 81, 121, 246, 106, 39, 208, 98, 233, 63, 46, 121, 15, 52, 66, 34, 22, 111, 106, 23, 56, 192, 26])
]

Deno.test(`Roundtrip compression/decompression`, async (t) => {
	for (const data of TEST_CASES_ROUNDTRIP) {
		await t.step(`Data length: ${data.length}`, () => {
			const compressed = compress(data)
			const decompressed = decompress(compressed)
			assertEquals(decompressed, data)
		})
	}
})

const TEST_CASES_ERROR = [
	{
		name: `Truncated literal run`,
		data: new Uint8Array([0x7F]), // literal run of 128 bytes without data
		errorMessage: `Unexpected end of PackBits data: expected 128 more byte(s)`
	},
	{
		name: `Truncated replicate run`,
		data: new Uint8Array([0xFF]), // replicate run without byte
		errorMessage: `Unexpected end of PackBits data: expected 1 more byte`
	}
]

Deno.test(`Decompression error handling`, async (t) => {
	for (const { name, data, errorMessage } of TEST_CASES_ERROR) {
		await t.step(name, () => {
			const error = assertThrows(() => decompress(data), PackBitsError)
			assertEquals(error.message, errorMessage)
		})
	}
})

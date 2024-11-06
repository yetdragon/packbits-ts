// path: /src/mod.ts

/**
 * @module packbits
 *
 * PackBits is a simple run-length compression algorithm used in Macintosh PICT and TIFF files.
 */

const MAX_RUN_LENGTH = 128

/**
 * Error thrown when invalid input is provided to PackBits functions
 */
export class PackBitsError extends Error {
	constructor(message: string) {
		super(message)
		this.name = `PackBitsError`
	}
}

/**
 * Validates that the input is a `Uint8Array`
 * @throws {PackBitsError} if the input is not a `Uint8Array`
 */
function validateInput(data: unknown): asserts data is Uint8Array {
	if (!(data instanceof Uint8Array)) {
		throw new PackBitsError(`Input must be a \`Uint8Array\``)
	}
}

/**
 * Compress data using the PackBits algorithm
 *
 * @param data The data to compress
 * @returns The compressed data
 * @throws {PackBitsError} If the input is invalid
 * @example
 * ```typescript
 * const data = new Uint8Array([0xAA, 0xAA, 0xAA, 0x80, 0x00])
 * const compressed = compress(data)
 * // Result: Uint8Array [0xFE, 0xAA, 0x01, 0x80, 0x00]
 * ```
 */
export function compress(data: Uint8Array): Uint8Array {
	validateInput(data)

	const result = new Uint8Array(2 * data.length)
	let writeIndex = 0

	let readIndex = 0
	while (readIndex < data.length) {
		const runStart = readIndex

		// Look for repeated bytes
		while (
			readIndex < data.length - 1 &&
			data[readIndex] === data[readIndex + 1] &&
			readIndex - runStart < MAX_RUN_LENGTH - 1
		) {
			readIndex += 1
		}
		const runLength = readIndex - runStart + 1
		if (runLength > 1) {
			// Write repeated run
			result[writeIndex++] = 257 - runLength
			result[writeIndex++] = data[runStart]
			readIndex += 1
		} else {
			// Collect literal bytes
			const literalStart = readIndex
			let literalCount = 0
			while (
				readIndex < data.length &&
				literalCount < MAX_RUN_LENGTH &&
				(readIndex === data.length - 1 || data[readIndex] !== data[readIndex + 1])
			) {
				literalCount += 1
				readIndex += 1
			}

			// Write literal run
			result[writeIndex++] = literalCount - 1
			for (let j = 0; j < literalCount; j += 1) {
				result[writeIndex++] = data[literalStart + j]
			}
		}
	}

	return result.slice(0, writeIndex)
}

/**
 * Decompress PackBits compressed data
 * @param data The PackBits compressed data
 * @returns The decompressed data
 * @throws {PackBitsError} If the input is invalid or compressed data is malformed
 * @example
 * ```typescript
 * const compressed = new Uint8Array([0xFE, 0xAA, 0x01, 0x80, 0x00])
 * const decompressed = decompress(compressed)
 * // Result: Uint8Array [0xAA, 0xAA, 0xAA, 0x80, 0x00]
 * ```
 */
export function decompress(data: Uint8Array): Uint8Array {
	validateInput(data)

	const resultSize = calculateDecompressedSize(data)
	const result = new Uint8Array(resultSize)
	let writeIndex = 0

	let readIndex = 0
	while (readIndex < data.length) {
		const count = data[readIndex++]

		if (count < MAX_RUN_LENGTH) {
			// Literal run
			const runLength = count + 1
			for (let j = 0; j < runLength; j += 1) {
				result[writeIndex++] = data[readIndex + j]
			}
			readIndex += runLength
		} else if (count > MAX_RUN_LENGTH) {
			// Repeated run
			const runLength = 257 - count
			for (let j = 0; j < runLength; j += 1) {
				result[writeIndex + j] = data[readIndex]
			}
			writeIndex += runLength
			readIndex += 1
		}

		// n === 128; no-op
	}

	return result
}

function calculateDecompressedSize(data: Uint8Array): number {
	let size = 0
	let index = 0

	while (index < data.length) {
		const count = data[index++]

		if (index >= data.length) {
			throw new PackBitsError(`Unexpected end of compressed data`)
		}

		if (count < MAX_RUN_LENGTH) {
			// Literal run
			const runLength = count + 1
			if (index + runLength > data.length) {
				throw new PackBitsError(`Malformed compressed data: literal run exceeds data length`)
			}
			size += runLength
			index += runLength
		} else if (count > MAX_RUN_LENGTH) {
			// Repeated run
			size += 257 - count
			index += 1
		}

		// n === 128; no-op
	}

	return size
}

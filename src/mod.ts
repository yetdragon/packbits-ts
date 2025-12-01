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
		this.name = PackBitsError.name
	}
}

/**
 * Compress data using the PackBits algorithm
 *
 * @param data The data to compress
 * @returns The compressed data
 * @throws {PackBitsError} if the input is invalid
 * @example
 * ```typescript
 * const data = new Uint8Array([0xAA, 0xAA, 0xAA, 0x80, 0x00])
 * const compressed = compress(data)
 * // Result: Uint8Array [0xFE, 0xAA, 0x01, 0x80, 0x00]
 * ```
 */
export function compress(data: Uint8Array): Uint8Array {
	const result = new Uint8Array(2 * data.length)
	let writeIndex = 0
	let readIndex = 0

	while (readIndex < data.length) {
		// Collect literal bytes, absorbing short repeat runs when beneficial
		const literalStart = readIndex
		let literalCount = 0

		while (readIndex < data.length && literalCount < MAX_RUN_LENGTH) {
			// Count consecutive repeated bytes starting at current position
			let repeatCount = 1
			while (
				readIndex + repeatCount < data.length &&
				data[readIndex + repeatCount] === data[readIndex] &&
				repeatCount < MAX_RUN_LENGTH
			) {
				repeatCount += 1
			}

			// Decide whether to encode as repeat run or absorb into literal run
			//
			// A repeat run of length N costs 2 bytes (header + value).
			// Including N bytes in a literal run costs N bytes (no extra header if already in literal).
			//
			// Break out for repeat run when:
			// - Run length >= 3: repeat (2 bytes) beats literal (3 bytes)
			// - Run length == 2 at start: repeat (2 bytes) equals literal (3 bytes with header),
			//   but we prefer repeat for consistency
			// - Run length == 2 mid-literal: absorb into literal (2 bytes) beats new repeat (2 bytes + literal overhead)
			const isAtLiteralStart = literalCount === 0
			const shouldStartRepeatRun = repeatCount >= 3 || (repeatCount === 2 && isAtLiteralStart)

			if (shouldStartRepeatRun) {
				break
			}

			// Absorb into literal run (either single byte or short repeat that's cheaper to inline)
			const bytesToAbsorb = Math.min(repeatCount, MAX_RUN_LENGTH - literalCount)
			literalCount += bytesToAbsorb
			readIndex += bytesToAbsorb
		}

		// Write accumulated literal run if any
		if (literalCount > 0) {
			result[writeIndex++] = literalCount - 1
			for (let j = 0; j < literalCount; j += 1) {
				result[writeIndex++] = data[literalStart + j]
			}
		}

		// Handle repeat run only if we broke out due to shouldStartRepeatRun (not due to hitting MAX_RUN_LENGTH)
		// If literalCount == MAX_RUN_LENGTH, we should continue to next iteration to start a new literal run
		if (readIndex < data.length && literalCount < MAX_RUN_LENGTH) {
			let repeatCount = 1
			while (
				readIndex + repeatCount < data.length &&
				data[readIndex + repeatCount] === data[readIndex] &&
				repeatCount < MAX_RUN_LENGTH
			) {
				repeatCount += 1
			}

			result[writeIndex++] = 257 - repeatCount
			result[writeIndex++] = data[readIndex]
			readIndex += repeatCount
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

export default {
	PackBitsError,
	compress,
	decompress
}

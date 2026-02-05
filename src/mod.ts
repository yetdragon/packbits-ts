/**
 * PackBits is a simple run-length compression algorithm used in Macintosh PICT and TIFF files.
 *
 * @example
 * ```typescript
 * import { compress, decompress } from "jsr:@yetdragon/packbits"
 *
 * // Example data
 * const data = new Uint8Array([
 *   0xAA, 0xAA, 0xAA, 0x80, 0x00, 0x2A, 0xAA, 0xAA, 0xAA, 0xAA,
 *   0x80, 0x00, 0x2A, 0x22, 0xAA, 0xAA, 0xAA, 0xAA, 0xAA, 0xAA,
 *   0xAA, 0xAA, 0xAA, 0xAA
 * ])
 *
 * // Compress the data
 * const compressed = compress(data)
 * console.log("Compressed size:", compressed.length)
 *
 * // Decompress back
 * const decompressed = decompress(compressed)
 * console.log("Original size:", decompressed.length)
 * ```
 *
 * @module packbits
 */

const COPY_THRESHOLD = 32

export class PackBitsError extends Error {
	constructor(message: string) {
		super(message)
		this.name = PackBitsError.name
	}
}

/**
 * @param [buffer] Pre-allocated buffer of minimum length ⌈1.5 × `data.length`⌉
 * @returns the compressed data as a subarray of the buffer
 * @throws {PackBitsError} if the provided buffer is too small
 * @example
 * ```typescript
 * const data = new Uint8Array([0xAA, 0xAA, 0xAA, 0x80, 0x00])
 * const compressed = compress(data)
 * // Result: Uint8Array [0xFE, 0xAA, 0x01, 0x80, 0x00]
 * ```
 */
export function compress(data: Uint8Array, buffer?: Uint8Array): Uint8Array {
	if (buffer === undefined) {
		// Worst case: R2-R2-...-R2
		buffer = new Uint8Array(Math.ceil(1.5*data.length))
	} else if (buffer.length < Math.ceil(1.5*data.length)) {
		throw new PackBitsError(`Provided buffer is too small: expected minimum of ${Math.ceil(1.5*data.length)}, got ${buffer.length} bytes`)
	}

	if (data.length === 0) {
		return buffer.subarray(0, 0)
	} else if (data.length === 1) {
		buffer[0] = 0x00
		buffer[1] = data[0]
		return buffer.subarray(0, 2)
	}

	let anchor = data[0]
	let crnt = data[1]
	let iRead = 2

	let iStack = buffer.length - 1
	let countLastLiteral = 0

	// Collect runs
	loop: while (true) {
		let n
gotoBreakAfterAnchor: {
		if (anchor === crnt) { // replicate run
			n = 255

			do {
				if (iRead >= data.length) {
					// Try merge R2 into previous L
					if (n === 255 && countLastLiteral > 0 && countLastLiteral + 2 <= 128) {
						countLastLiteral += 2
						buffer[iStack + 1] = countLastLiteral - 1
					} else {
						buffer[iStack--] = n
						countLastLiteral = 0
					}
					break loop
				}

				crnt = data[iRead++]
				if (crnt !== anchor) {
					if (n === 255 && countLastLiteral > 0 && countLastLiteral + 2 <= 128) {
						countLastLiteral += 2
						buffer[iStack + 1] = countLastLiteral - 1
					} else {
						buffer[iStack--] = n
						countLastLiteral = 0
					}
					anchor = crnt
					break gotoBreakAfterAnchor
				}

				n -= 1
			} while (n > 129)

			buffer[iStack--] = n
			countLastLiteral = 0
		} else { // literal run
			n = 1

			let prev = crnt

			do {
				if (iRead >= data.length) {
					// Try merge L into previous L, a result of previous R2 merge
					if (countLastLiteral > 0 && countLastLiteral + n + 1 <= 128) {
						countLastLiteral += n + 1
						buffer[iStack + 1] = countLastLiteral - 1
					} else {
						buffer[iStack--] = n
						countLastLiteral = n + 1
					}
					break loop
				}

				crnt = data[iRead++]
				if (crnt === prev) {
					if (countLastLiteral > 0 && countLastLiteral + n <= 128) {
						countLastLiteral += n
						buffer[iStack + 1] = countLastLiteral - 1
					} else {
						buffer[iStack--] = n - 1
						countLastLiteral = n
					}
					anchor = prev
					continue loop
				}

				prev = crnt
				n += 1
			} while (n < 127)

			if (countLastLiteral > 0 && countLastLiteral + n + 1 <= 128) {
				countLastLiteral += n + 1
				buffer[iStack + 1] = countLastLiteral - 1
			} else {
				buffer[iStack--] = n
				countLastLiteral = n + 1
			}
		}

		if (iRead >= data.length) break

		anchor = data[iRead++]
} // afterAnchor:
		if (iRead >= data.length) {
			// Try merge last byte into previous L
			if (countLastLiteral > 0 && countLastLiteral + 1 <= 128) {
				countLastLiteral += 1
				buffer[iStack + 1] = countLastLiteral - 1
			} else {
				buffer[iStack--] = 0x00
			}
			break
		}
		crnt = data[iRead++]
	}

	// Write runs
	iRead = 0
	let iStackRead = buffer.length - 1
	let iWrite = 0

	while (iStackRead > iStack) {
		const n = buffer[iStackRead--]
		if (n > 128) { // replicate run
			const byte = data[iRead]
			buffer[iWrite++] = n
			buffer[iWrite++] = byte
			iRead += 257 - n
		} else if (n < 128) { // literal run
			const runLength = n + 1
			buffer[iWrite++] = n
			if (runLength >= COPY_THRESHOLD) {
				buffer.set(data.subarray(iRead, iRead + runLength), iWrite)
				iRead += runLength
				iWrite += runLength
			} else {
				for (let i = 0; i < runLength; i += 1) {
					buffer[iWrite++] = data[iRead++]
				}
			}
		}
		// n === 128: no-op
	}

	return buffer.subarray(0, iWrite)
}

/**
 * @returns decompressed data in a new {@link Uint8Array}
 * @throws {PackBitsError} if `data` is invalid
 * @example
 * ```typescript
 * const compressed = new Uint8Array([0xFE, 0xAA, 0x01, 0x80, 0x00])
 * const decompressed = decompress(compressed)
 * // Result: Uint8Array [0xAA, 0xAA, 0xAA, 0x80, 0x00]
 * ```
 */
export function decompress(data: Uint8Array): Uint8Array {
	const result = new Uint8Array(calculateSizeDecompressed(data))

	let iRead = 0
	let iWrite = 0

	while (iRead < data.length) {
		const n = data[iRead++]

		if (n > 128) { // replicate run
			const runLength = 257 - n

			const byte = data[iRead++]
			if (runLength >= COPY_THRESHOLD) {
				result.fill(byte, iWrite, iWrite + runLength)
				iWrite += runLength
			} else {
				for (let i = 0; i < runLength; i += 1) {
					result[iWrite++] = byte
				}
			}
		} else if (n < 128) { // literal run
			const runLength = n + 1

			if (runLength >= COPY_THRESHOLD) {
				result.set(data.subarray(iRead, iRead + runLength), iWrite)
				iWrite += runLength
				iRead += runLength
			} else {
				for (let i = 0; i < runLength; i += 1) {
					result[iWrite++] = data[iRead++]
				}
			}
		}
	}

	return result
}

function calculateSizeDecompressed(data: Uint8Array): number {
	let i = 0
	let size = 0

	while (i < data.length) {
		const n = data[i++]

		if (n > 128) { // replicate run
			if (i >= data.length) {
				throw new PackBitsError(`Unexpected end of PackBits data: expected 1 more byte`)
			}

			size += 257 - n
			i += 1
		} else if (n < 128) { // literal run
			const runLength = n + 1
			if (i + runLength > data.length) {
				throw new PackBitsError(`Unexpected end of PackBits data: expected ${i + runLength - data.length} more byte(s)`)
			}

			size += runLength
			i += runLength
		}
	}

	return size
}

export default {
	PackBitsError,
	compress,
	decompress
}

export function decodeBytes(input: string) {
  try {
    // Remove "bytes:" prefix
    const hexString = input.replace(/^bytes:/, "");

    // Extract ALL hex bytes in sequence
    const hexMatches = hexString.match(/\\x([0-9a-fA-F]{2})/g);

    if (!hexMatches || hexMatches.length === 0) {
      return input;
    }

    // Convert all hex values to bytes
    const bytes = hexMatches.map((hex) => parseInt(hex.replace("\\x", ""), 16));

    // Let TextDecoder handle the variable-length UTF-8 sequences
    const byteArray = new Uint8Array(bytes);
    const decoder = new TextDecoder("utf-8", { fatal: false });

    return decoder.decode(byteArray);
  } catch (error) {
    console.error("Error converting bytes to Unicode:", error);
    return input;
  }
}

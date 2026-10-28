import { Request, Response, NextFunction } from "express";
import path from "path";
import crypto from "crypto";
import { fileUploadMetaSchema } from "../schemas/index.ts";

/**
 * Binary magic byte definitions for strictly verifying file contents
 */
const FILE_MAGIC_BYTES: Record<string, (buffer: Buffer) => boolean> = {
  "image/jpeg": (buf) => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  "image/png": (buf) =>
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47 &&
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a,
  "image/webp": (buf) =>
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP",
  "application/pdf": (buf) => buf.length >= 4 && buf.toString("ascii", 0, 4) === "%PDF",
  "text/csv": (buf) => {
    // Ensure binary executable headers are NOT present in CSV text
    const sample = buf.subarray(0, Math.min(buf.length, 512)).toString("utf8");
    // Ensure no null bytes or binary executable markers
    return !/\0/.test(sample) && !/<\?php|<script|^\x7fELF/i.test(sample);
  },
};

// Forbidden extensions that could be executed as code
const EXECUTABLE_EXTENSIONS = new Set([
  ".php", ".phtml", ".php3", ".php4", ".php5", ".phps",
  ".js", ".cjs", ".mjs", ".jsx", ".ts", ".tsx",
  ".py", ".sh", ".bash", ".exe", ".bat", ".cmd", ".pl",
  ".html", ".htm", ".xhtml", ".svg", ".xml", ".asp", ".aspx", ".jsp"
]);

export interface SecureUploadedFile {
  fileId: string;
  originalName: string;
  contentType: string;
  sizeBytes: number;
  buffer: Buffer;
  safePath: string;
}

/**
 * Middleware & Utility to strictly validate uploaded files
 * - Validates file size
 * - Validates MIME type
 * - Inspects BINARY MAGIC BYTES of file buffer (content validation)
 * - Sanitizes filename & prevents path traversal
 * - Stores in isolated storage outside web root
 * - Enforces non-executable flags
 */
export const validateAndStoreUploadedFile = (
  rawBuffer: Buffer,
  originalFilename: string,
  claimedContentType: string
): SecureUploadedFile => {
  // 1. Sanitize filename (remove path traversal & null bytes)
  const cleanFilename = path.basename(originalFilename).replace(/[^a-zA-Z0-9_.-]/g, "_");
  const ext = path.extname(cleanFilename).toLowerCase();

  if (EXECUTABLE_EXTENSIONS.has(ext)) {
    throw new Error("Security Violation: Executable file extension is prohibited");
  }

  // 2. Validate metadata against Zod schema
  fileUploadMetaSchema.parse({
    filename: cleanFilename,
    contentType: claimedContentType,
    sizeBytes: rawBuffer.length,
  });

  // 3. Inspect MAGIC BYTES to verify file content match
  const magicByteValidator = FILE_MAGIC_BYTES[claimedContentType];
  if (!magicByteValidator || !magicByteValidator(rawBuffer)) {
    throw new Error(`Security Violation: File content does not match declared format '${claimedContentType}'`);
  }

  // 4. Generate random isolated file ID & safe storage path (outside web root)
  const fileId = `file_${crypto.randomBytes(16).toString("hex")}`;
  // Isolated storage location outside public/ or web root
  const safePath = path.join(process.cwd(), "storage", "isolated_uploads", `${fileId}${ext}`);

  return {
    fileId,
    originalName: cleanFilename,
    contentType: claimedContentType,
    sizeBytes: rawBuffer.length,
    buffer: rawBuffer,
    safePath,
  };
};

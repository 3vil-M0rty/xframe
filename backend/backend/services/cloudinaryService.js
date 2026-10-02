const cloudinary = require("../config/cloudinary");
const streamifier = require("streamifier");

const uploadImage = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: [
          {
            width: 1000,
            height: 1000,
            crop: "limit",
            quality: "auto",
            fetch_format: "auto",
          },
        ],
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    streamifier
      .createReadStream(buffer)
      .pipe(uploadStream);
  });
};

/**
 * Generic file upload — unlike uploadImage above, this does NOT
 * force an image-only transformation, so it also works for PDFs
 * (very common for employee documents: CIN scans, signed
 * contracts, diplomas).
 *
 * Cloudinary-account note (this is the fix for "the PDF uploads
 * fine but won't open from the app"): by default, Cloudinary
 * accounts created after April 2018 have delivery of RAW PDF/ZIP
 * files disabled for security reasons — the file uploads
 * successfully, but its URL returns 401 Unauthorized when opened.
 * Uploading PDFs with `resource_type: "image"` (Cloudinary's own
 * documented recommendation for PDFs — it's what makes page
 * thumbnails/transformations available too) sidesteps that RAW
 * restriction in most cases. If a PDF still won't open after this
 * change, the account-level fix is: Cloudinary Console → Settings
 * → Security → enable "Allow delivery of PDF and ZIP files".
 */
const uploadFile = (buffer, folder, originalName, mimetype, { private: isPrivate = false } = {}) => {
  const isPdf = mimetype === "application/pdf";

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        // PDFs go up as "image" (Cloudinary's recommended resource
        // type for PDFs); anything else (a photo, etc.) is
        // auto-detected as before.
        resource_type: isPdf ? "image" : "auto",
        use_filename: true,
        filename_override: originalName,
        // Ensures the response has a real file extension in its
        // secure_url (e.g. ".pdf") — without this, some PDF
        // uploads resolve to an extensionless URL that browsers
        // don't reliably know how to render inline.
        format: isPdf ? "pdf" : undefined,
        // Private files (HR documents, supplier invoices...): stored
        // as "authenticated" — no public URL works for them; the app
        // hands out a link that expires after a few minutes instead
        // (see privateFileUrl below and routes/files.js).
        ...(isPrivate ? { type: "authenticated" } : {}),
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      }
    );

    streamifier
      .createReadStream(buffer)
      .pipe(uploadStream);
  });
};

const deleteImage = async (publicId) => {
  if (!publicId) return null;

  return cloudinary.uploader.destroy(publicId);
};

/**
 * Deletes a file uploaded via uploadFile. PDFs are now uploaded as
 * resource_type "image" (see uploadFile above), but older records
 * uploaded before this fix may have been stored as "raw" — try
 * "image" first, then fall back to "raw".
 *
 * Note: cloudinary.uploader.destroy() does NOT reject its promise
 * for a not-found/wrong-resource-type file — it resolves with
 * `{ result: "not found" }`. A try/catch alone wouldn't trigger the
 * fallback, so this checks `result.result` explicitly instead.
 */
const deleteFile = async (publicId) => {
  if (!publicId) return null;

  const first = await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
  });

  if (first?.result === "ok") return first;

  // Private uploads live under type "authenticated".
  const priv = await cloudinary.uploader.destroy(publicId, { resource_type: "image", type: "authenticated" });
  if (priv?.result === "ok") return priv;
  const privRaw = await cloudinary.uploader.destroy(publicId, { resource_type: "raw", type: "authenticated" });
  if (privRaw?.result === "ok") return privRaw;

  return cloudinary.uploader.destroy(publicId, { resource_type: "raw" });
};

/**
 * Uploads a document privately and returns what to store on the
 * record. `url` is left empty on purpose: the only way to open the
 * file is a short-lived signed link from privateFileUrl().
 */
const uploadPrivateFile = async (buffer, folder, originalName, mimetype) => {
  const result = await uploadFile(buffer, folder, originalName, mimetype, { private: true });
  return {
    url: "",
    publicId: result.public_id,
    originalName,
    private: true,
    resourceType: result.resource_type,
    format: result.format || "",
  };
};

/** Default lifetime of a signed file link, in seconds. */
const FILE_LINK_TTL_SECONDS = 5 * 60;

/**
 * A link to open a stored file. Private files get a signed link that
 * stops working after `ttlSeconds`; files uploaded before private
 * storage existed keep their original URL.
 */
const privateFileUrl = (file, { ttlSeconds = FILE_LINK_TTL_SECONDS } = {}) => {
  if (!file) return null;
  if (!file.private) return file.url || null;
  if (!file.publicId) return null;
  return cloudinary.utils.private_download_url(file.publicId, file.format || "", {
    resource_type: file.resourceType || "image",
    type: "authenticated",
    expires_at: Math.floor(Date.now() / 1000) + ttlSeconds,
  });
};

module.exports = {
  uploadPrivateFile,
  privateFileUrl,
  FILE_LINK_TTL_SECONDS,
  uploadImage,
  uploadFile,
  deleteImage,
  deleteFile,
};
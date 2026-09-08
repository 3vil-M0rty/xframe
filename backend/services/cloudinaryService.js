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

const deleteImage = async (publicId) => {
  if (!publicId) return null;

  return cloudinary.uploader.destroy(publicId);
};

module.exports = {
  uploadImage,
  deleteImage,
};
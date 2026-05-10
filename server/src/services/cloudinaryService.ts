import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import streamifier from 'streamifier';
import cloudinaryConfig from '../config/cloudinary';

// Initialize cloudinary with config
cloudinaryConfig;

export interface ICloudinaryResponse {
    url: string;
    public_id: string;
}

/**
 * Uploads a buffer to Cloudinary
 * @param buffer The file buffer (from multer)
 * @param folder The folder path in Cloudinary
 * @returns Object containing secure_url and public_id
 */
export const uploadImage = (buffer: Buffer, folder: string): Promise<ICloudinaryResponse> => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder,
                use_filename: true,
                unique_filename: true,
                resource_type: 'auto',
            },
            (error, result: UploadApiResponse | undefined) => {
                if (error || !result) {
                    console.error('Cloudinary Upload Error:', error);
                    return reject(new Error('Cloudinary upload failed'));
                }
                resolve({
                    url: result.secure_url,
                    public_id: result.public_id,
                });
            }
        );

        streamifier.createReadStream(buffer).pipe(uploadStream);
    });
};

/**
 * Deletes an image from Cloudinary using its public_id
 * @param public_id The Cloudinary public_id
 * @returns Promise resolving to the deletion result
 */
export const deleteImage = async (public_id: string): Promise<any> => {
    if (!public_id) return null;
    try {
        const result = await cloudinary.uploader.destroy(public_id);
        if (result.result !== 'ok' && result.result !== 'not found') {
            console.warn(`Cloudinary Deletion Warning for ${public_id}:`, result);
        }
        return result;
    } catch (error) {
        console.error(`Cloudinary Deletion Error for ${public_id}:`, error);
        // We don't throw here to avoid crashing the controller logic, 
        // but we log the error for tracking.
        return null;
    }
};

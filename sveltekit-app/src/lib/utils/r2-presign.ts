import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Generate a presigned URL for uploading to R2
 */
export async function generatePresignedUploadUrl(
	accessKeyId: string,
	secretAccessKey: string,
	accountId: string,
	bucketName: string,
	key: string,
	contentType: string,
	expiresIn: number = 3600 // 1 hour default
): Promise<string> {
	const s3Client = new S3Client({
		region: 'auto',
		endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
		credentials: {
			accessKeyId,
			secretAccessKey
		}
	});

	const command = new PutObjectCommand({
		Bucket: bucketName,
		Key: key,
		ContentType: contentType
	});

	const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });
	return presignedUrl;
}

/**
 * Generate a presigned URL for downloading from R2
 */
export async function generatePresignedDownloadUrl(
	accessKeyId: string,
	secretAccessKey: string,
	accountId: string,
	bucketName: string,
	key: string,
	expiresIn: number = 3600 // 1 hour default
): Promise<string> {
	const s3Client = new S3Client({
		region: 'auto',
		endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
		credentials: {
			accessKeyId,
			secretAccessKey
		}
	});

	const command = new GetObjectCommand({
		Bucket: bucketName,
		Key: key
	});

	const presignedUrl = await getSignedUrl(s3Client, command, { expiresIn });
	return presignedUrl;
}

/**
 * Generate a unique key for an uploaded file
 */
export function generateFileKey(filename: string): string {
	const timestamp = Date.now();
	const random = Math.random().toString(36).substring(2, 15);
	const extension = filename.split('.').pop() || '';
	return `${timestamp}-${random}.${extension}`;
}


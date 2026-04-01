import { error, json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { getDb } from "$lib/server/db";
import { artifacts, artifactImages } from "$lib/server/db/schema";
import { eq } from "drizzle-orm";

// POST /api/artifacts/[id]/images - Add an image to an artifact
export async function POST({ params, locals, request, platform }: RequestEvent) {
	const { id } = params;
	if (!locals.user) throw error(401, "Must be logged in");
	if (!id) throw error(400, "Artifact ID is required");

	const db = getDb(platform!.env.DB);

	// Verify ownership
	const existing = await db
		.select({ userId: artifacts.userId })
		.from(artifacts)
		.where(eq(artifacts.id, id))
		.limit(1);

	if (existing.length === 0) throw error(404, "Artifact not found");
	if (existing[0].userId !== locals.user.id) throw error(403, "Not authorized");

	let imageUrl: string;

	const contentType = request.headers.get("content-type") || "";

	if (contentType.includes("application/json")) {
		// JSON body: associate an already-uploaded image URL
		const body = await request.json();
		if (!body.imageUrl || typeof body.imageUrl !== "string") {
			throw error(400, "imageUrl is required");
		}
		imageUrl = body.imageUrl;
	} else {
		// Form data: upload a new image file
		const formData = await request.formData();
		const file = formData.get("image") as File;

		if (!file) throw error(400, "No image file provided");

		const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
		if (!allowedTypes.includes(file.type)) {
			throw error(400, "Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.");
		}

		const maxSize = 5 * 1024 * 1024;
		if (file.size > maxSize) {
			throw error(400, "File too large. Maximum size is 5MB.");
		}

		const timestamp = Date.now();
		const randomString = Math.random().toString(36).substring(2, 15);
		const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
		const filename = `${locals.user.id}/${timestamp}-${randomString}.${extension}`;

		const bucket = platform!.env.BUCKET;
		const arrayBuffer = await file.arrayBuffer();

		await bucket.put(filename, arrayBuffer, {
			httpMetadata: { contentType: file.type },
		});

		imageUrl = `/api/images/${filename}`;
	}

	// Get max sort order
	const existingImages = await db
		.select({ sortOrder: artifactImages.sortOrder })
		.from(artifactImages)
		.where(eq(artifactImages.artifactId, id));

	const maxOrder = existingImages.length > 0
		? Math.max(...existingImages.map(i => i.sortOrder))
		: -1;

	const imageId = crypto.randomUUID();
	await db.insert(artifactImages).values({
		id: imageId,
		artifactId: id,
		imageUrl,
		sortOrder: maxOrder + 1,
		createdAt: new Date(),
	});

	return json({ success: true, id: imageId, imageUrl });
}

// DELETE /api/artifacts/[id]/images - Delete an image
export async function DELETE({ params, locals, request, platform }: RequestEvent) {
	const { id } = params;
	if (!locals.user) throw error(401, "Must be logged in");
	if (!id) throw error(400, "Artifact ID is required");

	const body = await request.json();
	const { imageId } = body;
	if (!imageId) throw error(400, "Image ID is required");

	const db = getDb(platform!.env.DB);

	// Verify artifact ownership
	const existing = await db
		.select({ userId: artifacts.userId })
		.from(artifacts)
		.where(eq(artifacts.id, id))
		.limit(1);

	if (existing.length === 0) throw error(404, "Artifact not found");
	if (existing[0].userId !== locals.user.id) throw error(403, "Not authorized");

	// Get image URL to delete from R2
	const imageResult = await db
		.select({ imageUrl: artifactImages.imageUrl })
		.from(artifactImages)
		.where(eq(artifactImages.id, imageId))
		.limit(1);

	if (imageResult.length > 0) {
		const r2Key = imageResult[0].imageUrl.replace("/api/images/", "");
		try {
			await platform!.env.BUCKET.delete(r2Key);
		} catch {
			// Non-fatal if R2 delete fails
		}
	}

	await db.delete(artifactImages).where(eq(artifactImages.id, imageId));

	return json({ success: true });
}

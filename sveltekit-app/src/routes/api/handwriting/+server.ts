import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

/**
 * POST /api/handwriting
 *
 * Proxies handwriting recognition requests to Google Input Tools API
 * to avoid CORS restrictions from the browser.
 */
export const POST: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { strokes, language = "ja" } = body;

	// Build the language code for Google Input Tools
	// ja-t-i0-handwrit = Japanese handwriting
	// zh-t-i0-handwrit = Chinese handwriting
	const langCode = language === "zh" ? "zh-t-i0-handwrit" : "ja-t-i0-handwrit";

	const ink = strokes.map((stroke: { x: number[]; y: number[]; t: number[] }) => [
		stroke.x,
		stroke.y,
		stroke.t,
	]);

	const jsonBody = JSON.stringify({
		app_version: 0.4,
		api_level: "537.36",
		device: "5.0 (X11; Linux x86_64) AppleWebKit/537.36",
		input_type: 0,
		options: "enable_pre_space",
		requests: [
			{
				writing_guide: {
					writing_area_width: 250,
					writing_area_height: 250,
				},
				ink,
				pre_context: "",
				max_num_results: 5,
				max_completions: 0,
			},
		],
	});

	const url = `https://inputtools.google.com/request?itc=${langCode}&app=translate`;

	try {
		const response = await fetch(url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: jsonBody,
		});

		if (!response.ok) {
			return json(
				{ error: "Google API request failed", status: response.status },
				{ status: 502 }
			);
		}

		const data = await response.json();

		// Extract candidates from the response
		// Response format: ["SUCCESS", [["", [candidates...], ...]]]
		let candidates: string[] = [];
		if (data[0] === "SUCCESS" && data[1]?.[0]?.[1]) {
			candidates = data[1][0][1];
		}

		return json({ candidates });
	} catch (err) {
		console.error("Handwriting recognition error:", err);
		return json({ error: "Failed to contact recognition service" }, { status: 500 });
	}
};

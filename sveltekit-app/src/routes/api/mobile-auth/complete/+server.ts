import { redirect, type RequestHandler } from '@sveltejs/kit';

const APP_CALLBACK = 'kiokun://auth';

export const GET: RequestHandler = async ({ request, url }) => {
	const state = url.searchParams.get('state') ?? '';
	const error = url.searchParams.get('error') ?? '';
	const errorDescription = url.searchParams.get('error_description') ?? '';
	const cookie = request.headers.get('cookie')?.trim() ?? '';

	const callback = new URL(APP_CALLBACK);
	if (state) callback.searchParams.set('state', state);

	if (error) {
		callback.searchParams.set('error', error);
		if (errorDescription) callback.searchParams.set('error_description', errorDescription);
	} else if (!cookie) {
		callback.searchParams.set('error', 'missing_cookie');
		callback.searchParams.set('error_description', 'Better Auth did not issue a session cookie');
	}

	if (cookie) {
		const fragment = new URLSearchParams();
		fragment.set('cookie', cookie);
		callback.hash = fragment.toString();
	}

	throw redirect(302, callback.toString());
};

import { redirect } from '@sveltejs/kit';

export function GET() {
	redirect(308, '/favicon-32x32.png');
}

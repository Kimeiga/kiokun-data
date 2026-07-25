import { redirect } from '@sveltejs/kit';

// Learning Resources was merged into /learning. Keep this path working for
// existing links and the deeper /learning-resources/* sub-pages' back-links.
export const load = () => {
	throw redirect(308, '/learning');
};

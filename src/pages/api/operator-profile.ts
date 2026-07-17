import type { APIRoute } from 'astro';
import { parseDisplayName } from '@/lib/operator-profile';
import { saveOperatorProfile } from '@/lib/portal-data';

export const POST: APIRoute = async ({ request, locals, url }) => {
	try {
		const form = await request.formData();
		const profile = await saveOperatorProfile(locals.user.email, parseDisplayName(form.get('display_name')), url.pathname);
		return Response.json(profile, { headers: { 'Cache-Control': 'no-store' } });
	} catch (error) {
		return Response.json({ error: error instanceof Error ? error.message : 'Could not save profile.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
	}
};

// @ts-check
import { defineConfig, envField } from 'astro/config';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
	output: 'server',
	adapter: node({ mode: 'standalone' }),
	server: { host: true },
	env: {
		schema: {
			PORTAL_ORIGIN: envField.string({ context: 'server', access: 'secret', optional: true, url: true }),
			CF_ACCESS_AUD: envField.string({ context: 'server', access: 'secret', optional: true }),
			CF_ACCESS_TEAM_DOMAIN: envField.string({ context: 'server', access: 'secret', optional: true, url: true }),
			SUPABASE_URL: envField.string({ context: 'server', access: 'secret', optional: true, url: true }),
			SUPABASE_SERVICE_ROLE_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
			DEV_AUTH_EMAIL: envField.string({ context: 'server', access: 'secret', optional: true }),
		},
	},
});

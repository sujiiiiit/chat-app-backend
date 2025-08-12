import app from '../src/app';

export default function handler(req: any, res: any) {
	// Vercel strips the "/api" prefix when invoking this function.
	// Our Express app defines routes starting with "/api/...", so re-prefix here.
	if (req.url && !req.url.startsWith('/api')) {
		req.url = '/api' + req.url;
	}
	return (app as any)(req, res);
}
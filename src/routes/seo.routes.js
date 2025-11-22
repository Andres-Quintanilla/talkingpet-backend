import { Router } from 'express';

const r = Router();

const BASE = process.env.PUBLIC_BASE_URL || 'http://localhost:5173';

const staticPaths = [
    '/', '/productos', '/servicios', '/cursos',
    '/carrito', '/checkout', '/login', '/register'
];

async function fetchDynamicPaths() {
    // TODO: reemplazar por consultas reales
    const productSlugs = ['alimento-premium-15kg', 'juguete-interactivo', 'cama-ortopedica', 'collar-gps'];
    const serviceSlugs = ['bano-completo', 'peluqueria-canina', 'veterinaria', 'adiestramiento'];
    const courseSlugs = ['adiestramiento-basico', 'primeros-auxilios', 'nutricion-canina'];

    return [
        ...productSlugs.map(s => `/producto/${s}`),
        ...serviceSlugs.map(s => `/servicio/${s}`),
        ...courseSlugs.map(s => `/curso/${s}`)
    ];
}

r.get('/robots.txt', async (_req, res) => {
    const body = [
        'User-agent: *',
        'Allow: /',
        `Sitemap: ${BASE}/sitemap.xml`
    ].join('\n');

    res.type('text/plain').send(body);
});

r.get('/sitemap.xml', async (_req, res) => {
    const dyn = await fetchDynamicPaths();
    const all = [...staticPaths, ...dyn];

    const urls = all.map(p => {
        const priority = p === '/' ? '1.0' : p.startsWith('/producto/') ? '0.9' : '0.8';
        const changefreq = p === '/' ? 'daily' : 'weekly';

        return `
  <url>
    <loc>${BASE}${p}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
    }).join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;

    res.type('application/xml').send(xml);
});

export default r;

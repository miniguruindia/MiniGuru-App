/**
 * mg_add_amazon_proxy.js
 * Run from /workspaces/MiniGuru-App/backend/
 *
 * Adds GET /admin/amazon/product?asin=XXX endpoint to adminRoutes.ts.
 * Fetches the Amazon.in product page, parses:
 *   - og:title → product name
 *   - og:description → description
 *   - og:image → image URL
 *   - price from span#priceblock_ourprice or meta tags
 *
 * This runs server-side so CORS is not an issue.
 */

const fs   = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'src/routes/adminRoutes.ts');

if (!fs.existsSync(FILE)) {
  console.error('ERROR: src/routes/adminRoutes.ts not found. Run from backend/');
  process.exit(1);
}

let src = fs.readFileSync(FILE, 'utf8');

if (src.includes('/admin/amazon/product')) {
  console.log('SKIP: Amazon proxy endpoint already exists.');
  process.exit(0);
}

const ENDPOINT = `
// ── GET /admin/amazon/product?asin=XXX ─────────────────────────────────────
// Fetches Amazon.in product page and extracts meta info.
// Used by admin ProductForm to auto-fill name/description/image/price.
adminRouter.get('/amazon/product', adminMiddleware, async (req: any, res: any) => {
  const asin = (req.query.asin as string)?.trim().toUpperCase();
  if (!asin || !/^[A-Z0-9]{10}$/.test(asin)) {
    return res.status(400).json({ error: 'Invalid ASIN' });
  }
  try {
    const url = \`https://www.amazon.in/dp/\${asin}\`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
                      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-IN,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      return res.status(502).json({ error: 'Amazon returned ' + response.status });
    }

    const html = await response.text();

    // Parse meta tags
    const getMeta = (prop: string) => {
      const m = html.match(new RegExp(\`<meta[^>]+property=["']\${prop}["'][^>]+content=["']([^"']+)["']\`, 'i'))
             ?? html.match(new RegExp(\`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']\${prop}["']\`, 'i'));
      return m?.[1]?.trim() ?? null;
    };

    const getTitle = () => {
      // Try og:title first, then <title>, then #productTitle
      const og = getMeta('og:title');
      if (og) return og;
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch) return titleMatch[1].replace(/ : Amazon\.in.*$/i, '').trim();
      const spanMatch = html.match(/id="productTitle"[^>]*>\\s*([^<]+)/i);
      return spanMatch?.[1]?.trim() ?? null;
    };

    const getPrice = () => {
      // Try multiple Amazon price selectors in HTML
      const patterns = [
        /class="a-price-whole"[^>]*>([\\d,]+)/i,
        /"priceAmount":([\\d.]+)/i,
        /id="priceblock_ourprice"[^>]*>[^\\d]*([\\d,]+)/i,
        /"price":"INR ([\\d.]+)"/i,
      ];
      for (const p of patterns) {
        const m = html.match(p);
        if (m) return parseFloat(m[1].replace(/,/g, ''));
      }
      return null;
    };

    const name        = getTitle();
    const description = getMeta('og:description');
    const imageUrl    = getMeta('og:image')
                     ?? \`https://images-na.ssl-images-amazon.com/images/P/\${asin}.01.LZZZZZZZ.jpg\`;
    const price       = getPrice();

    res.json({
      asin,
      name:        name        ?? \`Amazon Product \${asin}\`,
      description: description ?? '',
      imageUrl,
      price:       price       ?? 0,
      affiliateUrl: \`https://www.amazon.in/dp/\${asin}?tag=miniguru08-21\`,
    });
  } catch (err: any) {
    console.error('Amazon proxy error:', err.message);
    // Return partial data with ASIN thumbnail so form still works
    res.json({
      asin,
      name:        \`Amazon Product \${asin}\`,
      description: '',
      imageUrl: \`https://images-na.ssl-images-amazon.com/images/P/\${asin}.01.LZZZZZZZ.jpg\`,
      price: 0,
      affiliateUrl: \`https://www.amazon.in/dp/\${asin}?tag=miniguru08-21\`,
    });
  }
});
`;

// Insert before the export default at end of file
const ANCHOR = 'export default adminRouter';
if (!src.includes(ANCHOR)) {
  console.error('ERROR: "export default adminRouter" not found in adminRoutes.ts');
  process.exit(1);
}

src = src.replace(ANCHOR, ENDPOINT + '\n' + ANCHOR);
fs.writeFileSync(FILE, src, 'utf8');

console.log('✓ Added GET /admin/amazon/product endpoint to adminRoutes.ts');
console.log('  Returns: { asin, name, description, imageUrl, price, affiliateUrl }');
console.log('  Fallback: returns ASIN thumbnail + empty fields on any error');
console.log('\nVerify: npx tsc --noEmit  (from backend/)');

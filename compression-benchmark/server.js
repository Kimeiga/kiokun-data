import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.gz': 'application/gzip',
    '.gz1': 'application/gzip',
    '.gz6': 'application/gzip',
    '.gz9': 'application/gzip',
    '.br': 'application/x-br',
    '.br1': 'application/x-br',
    '.br6': 'application/x-br',
    '.br11': 'application/x-br',
    '.lz4': 'application/x-lz4',
    '.zst': 'application/zstd',
    '.zst1': 'application/zstd',
    '.zst10': 'application/zstd',
    '.zst19': 'application/zstd',
};

const server = http.createServer((req, res) => {
    // Remove query string and decode URL
    let filePath = decodeURIComponent(req.url.split('?')[0]);
    
    // Default to index.html
    if (filePath === '/') {
        filePath = '/index.html';
    }
    
    const fullPath = path.join(__dirname, filePath);
    
    // Security check - prevent directory traversal
    if (!fullPath.startsWith(__dirname)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    
    // Get file extension
    const ext = path.extname(fullPath).toLowerCase();
    
    // Handle special extensions like .gz6, .br11, etc.
    let mimeType = MIME_TYPES[ext];
    if (!mimeType) {
        // Check for compound extensions like .json.gz6
        const parts = filePath.split('.');
        if (parts.length >= 3) {
            const compoundExt = '.' + parts[parts.length - 1];
            mimeType = MIME_TYPES[compoundExt];
        }
    }
    
    if (!mimeType) {
        mimeType = 'application/octet-stream';
    }
    
    // Read and serve file
    fs.readFile(fullPath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error');
            }
            return;
        }
        
        // Set CORS headers for local development
        res.writeHead(200, {
            'Content-Type': mimeType,
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache'
        });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`🚀 Server running at http://localhost:${PORT}/`);
    console.log(`📊 Open http://localhost:${PORT}/ to run the benchmark`);
});


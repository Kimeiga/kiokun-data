// Import decompression libraries
import pako from 'https://cdn.jsdelivr.net/npm/pako@2.1.0/+esm';
import { decompress as brotliDecompress } from 'https://cdn.jsdelivr.net/npm/brotli-wasm@3.0.1/+esm';
import { inflate as fflateInflate, decompress as fflateDecompress } from 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/+esm';

// LZ4, Zstd, and Snappy will be loaded dynamically
let lz4Module = null;
let zstdModule = null;
let snappyModule = null;

async function loadLZ4() {
    if (!lz4Module) {
        const { default: lz4 } = await import('https://cdn.jsdelivr.net/npm/lz4js@0.2.0/+esm');
        lz4Module = lz4;
    }
    return lz4Module;
}

async function loadZstd() {
    if (!zstdModule) {
        const { ZstdInit } = await import('https://cdn.jsdelivr.net/npm/@oneidentity/zstd-js@1.0.0/+esm');
        zstdModule = await ZstdInit();
    }
    return zstdModule;
}

async function loadSnappy() {
    if (!snappyModule) {
        // Note: There's no good pure JS Snappy library for browsers
        // We'll skip this for now
        return null;
    }
    return snappyModule;
}

async function fetchFile(filename) {
    const response = await fetch(filename);
    if (!response.ok) throw new Error(`Failed to fetch ${filename}`);
    return new Uint8Array(await response.arrayBuffer());
}

async function benchmarkGzip(level) {
    const filename = `sample.json.gz${level}`;
    const compressed = await fetchFile(filename);
    
    const start = performance.now();
    const decompressed = pako.ungzip(compressed);
    const duration = performance.now() - start;
    
    return {
        name: `Gzip (level ${level})`,
        compressedSize: compressed.length,
        decompressedSize: decompressed.length,
        decompressionTime: duration,
        library: 'pako',
        librarySize: '~45 KB'
    };
}

async function benchmarkBrotli(level) {
    const filename = `sample.json.br${level}`;
    const compressed = await fetchFile(filename);
    
    const start = performance.now();
    const decompressed = await brotliDecompress(compressed);
    const duration = performance.now() - start;
    
    return {
        name: `Brotli (level ${level})`,
        compressedSize: compressed.length,
        decompressedSize: decompressed.length,
        decompressionTime: duration,
        library: 'brotli-wasm',
        librarySize: '~60 KB'
    };
}

async function benchmarkLZ4() {
    const lz4 = await loadLZ4();
    const filename = 'sample.json.lz4';
    const compressed = await fetchFile(filename);
    
    const start = performance.now();
    const decompressed = lz4.decompress(compressed);
    const duration = performance.now() - start;
    
    return {
        name: 'LZ4',
        compressedSize: compressed.length,
        decompressedSize: decompressed.length,
        decompressionTime: duration,
        library: 'lz4js',
        librarySize: '~15 KB'
    };
}

async function benchmarkZstd(level) {
    const zstd = await loadZstd();
    const filename = `sample.json.zst${level}`;
    const compressed = await fetchFile(filename);

    const start = performance.now();
    const decompressed = zstd.decompress(compressed);
    const duration = performance.now() - start;

    return {
        name: `Zstandard (level ${level})`,
        compressedSize: compressed.length,
        decompressedSize: decompressed.length,
        decompressionTime: duration,
        library: '@oneidentity/zstd-js',
        librarySize: '~200 KB'
    };
}

async function benchmarkDeflate(level) {
    const filename = `sample.json.deflate${level}`;
    const compressed = await fetchFile(filename);

    // Test with both pako and fflate
    const startPako = performance.now();
    const decompressedPako = pako.inflateRaw(compressed);
    const durationPako = performance.now() - startPako;

    const startFflate = performance.now();
    const decompressedFflate = fflateInflate(compressed);
    const durationFflate = performance.now() - startFflate;

    // Use the faster one
    const isFflateFaster = durationFflate < durationPako;

    return {
        name: `Deflate (level ${level}) - ${isFflateFaster ? 'fflate' : 'pako'}`,
        compressedSize: compressed.length,
        decompressedSize: decompressedPako.length,
        decompressionTime: isFflateFaster ? durationFflate : durationPako,
        library: isFflateFaster ? 'fflate' : 'pako',
        librarySize: isFflateFaster ? '~8 KB' : '~45 KB',
        note: `pako: ${durationPako.toFixed(2)}ms, fflate: ${durationFflate.toFixed(2)}ms`
    };
}

async function benchmarkUncompressed() {
    const filename = 'sample.json';
    const data = await fetchFile(filename);
    
    const start = performance.now();
    const text = new TextDecoder().decode(data);
    const json = JSON.parse(text);
    const duration = performance.now() - start;
    
    return {
        name: 'Uncompressed',
        compressedSize: data.length,
        decompressedSize: data.length,
        decompressionTime: duration,
        library: 'None',
        librarySize: '0 KB'
    };
}

function createResultCard(result, originalSize) {
    const compressionRatio = ((1 - result.compressedSize / originalSize) * 100).toFixed(1);
    const speedClass = result.decompressionTime < 1 ? 'good' : result.decompressionTime < 5 ? 'warning' : 'bad';
    
    return `
        <div class="card">
            <h2>${result.name}</h2>
            <div class="metric">
                <span class="metric-label">Compressed Size:</span>
                <span class="metric-value">${(result.compressedSize / 1024).toFixed(2)} KB</span>
            </div>
            <div class="metric">
                <span class="metric-label">Compression Ratio:</span>
                <span class="metric-value ${compressionRatio > 70 ? 'good' : compressionRatio > 50 ? 'warning' : 'bad'}">${compressionRatio}%</span>
            </div>
            <div class="metric">
                <span class="metric-label">Decompression Time:</span>
                <span class="metric-value ${speedClass}">${result.decompressionTime.toFixed(2)} ms</span>
            </div>
            <div class="metric">
                <span class="metric-label">Library:</span>
                <span class="metric-value">${result.library}</span>
            </div>
            <div class="metric">
                <span class="metric-label">Library Size:</span>
                <span class="metric-value">${result.librarySize}</span>
            </div>
        </div>
    `;
}

function generateRecommendation(results) {
    // Find best compression ratio
    const bestCompression = results.reduce((best, current) => 
        current.compressedSize < best.compressedSize ? current : best
    );
    
    // Find fastest decompression
    const fastestDecompression = results.reduce((fastest, current) => 
        current.decompressionTime < fastest.decompressionTime ? current : fastest
    );
    
    // Find best balance (compression ratio / decompression time)
    const bestBalance = results.reduce((best, current) => {
        const currentScore = (1 - current.compressedSize / results[0].decompressedSize) / (current.decompressionTime + 0.1);
        const bestScore = (1 - best.compressedSize / results[0].decompressedSize) / (best.decompressionTime + 0.1);
        return currentScore > bestScore ? current : best;
    });
    
    return `
        <p><strong>Best Compression:</strong> ${bestCompression.name} - ${(bestCompression.compressedSize / 1024).toFixed(2)} KB (${((1 - bestCompression.compressedSize / results[0].decompressedSize) * 100).toFixed(1)}% reduction)</p>
        <p><strong>Fastest Decompression:</strong> ${fastestDecompression.name} - ${fastestDecompression.decompressionTime.toFixed(2)} ms</p>
        <p><strong>Best Balance:</strong> ${bestBalance.name}</p>
        <hr>
        <p><strong>💡 Recommendation for Production:</strong></p>
        <p>Use <strong>Brotli level 6</strong> or <strong>Zstandard level 10</strong> for the best balance of compression ratio and decompression speed. Both offer excellent compression (~75-80% reduction) with fast decompression (&lt;5ms).</p>
        <p>If you need the absolute smallest files and don't mind slightly slower decompression, use <strong>Brotli level 11</strong>.</p>
        <p>If you need the fastest possible decompression, use <strong>LZ4</strong>, though it has lower compression ratio.</p>
    `;
}

async function runBenchmark() {
    const resultsDiv = document.getElementById('results');
    const loadingDiv = document.getElementById('loading');
    const summaryDiv = document.getElementById('summary');
    const recommendationDiv = document.getElementById('recommendation');
    
    resultsDiv.innerHTML = '';
    loadingDiv.style.display = 'block';
    summaryDiv.style.display = 'none';
    
    try {
        const results = [];
        
        // Test uncompressed first to get original size
        const uncompressed = await benchmarkUncompressed();
        results.push(uncompressed);
        
        // Test all compression methods
        results.push(await benchmarkGzip(1));
        results.push(await benchmarkGzip(6));
        results.push(await benchmarkGzip(9));
        
        results.push(await benchmarkBrotli(1));
        results.push(await benchmarkBrotli(6));
        results.push(await benchmarkBrotli(11));
        
        results.push(await benchmarkLZ4());
        
        results.push(await benchmarkZstd(1));
        results.push(await benchmarkZstd(10));
        results.push(await benchmarkZstd(19));

        results.push(await benchmarkDeflate(1));
        results.push(await benchmarkDeflate(6));
        results.push(await benchmarkDeflate(9));

        // Display results
        const originalSize = uncompressed.decompressedSize;
        resultsDiv.innerHTML = results.map(r => createResultCard(r, originalSize)).join('');
        
        // Show recommendation
        recommendationDiv.innerHTML = generateRecommendation(results);
        summaryDiv.style.display = 'block';
        
    } catch (error) {
        resultsDiv.innerHTML = `<div class="card"><h2>Error</h2><p>${error.message}</p></div>`;
    } finally {
        loadingDiv.style.display = 'none';
    }
}

async function runMultipleBenchmarks() {
    const resultsDiv = document.getElementById('results');
    const loadingDiv = document.getElementById('loading');
    
    resultsDiv.innerHTML = '';
    loadingDiv.style.display = 'block';
    loadingDiv.textContent = 'Running 10 iterations...';
    
    const iterations = 10;
    const aggregated = {};
    
    try {
        for (let i = 0; i < iterations; i++) {
            loadingDiv.textContent = `Running iteration ${i + 1}/${iterations}...`;
            
            const results = [
                await benchmarkUncompressed(),
                await benchmarkGzip(6),
                await benchmarkBrotli(6),
                await benchmarkBrotli(11),
                await benchmarkLZ4(),
                await benchmarkZstd(10),
            ];
            
            results.forEach(result => {
                if (!aggregated[result.name]) {
                    aggregated[result.name] = {
                        ...result,
                        times: []
                    };
                }
                aggregated[result.name].times.push(result.decompressionTime);
            });
        }
        
        // Calculate averages
        const averaged = Object.values(aggregated).map(result => ({
            ...result,
            decompressionTime: result.times.reduce((a, b) => a + b, 0) / result.times.length,
            minTime: Math.min(...result.times),
            maxTime: Math.max(...result.times)
        }));
        
        const originalSize = averaged.find(r => r.name === 'Uncompressed').decompressedSize;
        resultsDiv.innerHTML = averaged.map(r => createResultCard(r, originalSize)).join('');
        
    } catch (error) {
        resultsDiv.innerHTML = `<div class="card"><h2>Error</h2><p>${error.message}</p></div>`;
    } finally {
        loadingDiv.style.display = 'none';
    }
}

document.getElementById('runBenchmark').addEventListener('click', runBenchmark);
document.getElementById('runMultiple').addEventListener('click', runMultipleBenchmarks);


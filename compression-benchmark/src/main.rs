use std::fs;
use std::io::{Read, Write};
use std::time::Instant;
use flate2::write::GzEncoder;
use flate2::Compression as GzCompression;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Read the sample JSON file
    let json_content = fs::read("sample.json")?;
    let original_size = json_content.len();
    
    println!("📊 Compression Benchmark");
    println!("========================");
    println!("Original size: {} bytes ({:.2} KB)", original_size, original_size as f64 / 1024.0);
    println!();

    // Test Gzip compression
    println!("🔹 Gzip Compression:");
    for level in [1, 6, 9] {
        let start = Instant::now();
        let mut encoder = GzEncoder::new(Vec::new(), GzCompression::new(level));
        encoder.write_all(&json_content)?;
        let compressed = encoder.finish()?;
        let duration = start.elapsed();
        
        let compressed_size = compressed.len();
        let ratio = (1.0 - compressed_size as f64 / original_size as f64) * 100.0;
        
        println!("  Level {}: {} bytes ({:.2} KB) - {:.1}% reduction - {:?}", 
                 level, compressed_size, compressed_size as f64 / 1024.0, ratio, duration);
        
        fs::write(format!("sample.json.gz{}", level), compressed)?;
    }
    println!();

    // Test Brotli compression
    println!("🔹 Brotli Compression:");
    for level in [1, 6, 11] {
        let start = Instant::now();
        let mut compressed = Vec::new();
        let mut compressor = brotli::CompressorWriter::new(
            &mut compressed,
            4096, // buffer size
            level,
            22, // window size
        );
        compressor.write_all(&json_content)?;
        drop(compressor);
        let duration = start.elapsed();
        
        let compressed_size = compressed.len();
        let ratio = (1.0 - compressed_size as f64 / original_size as f64) * 100.0;
        
        println!("  Level {}: {} bytes ({:.2} KB) - {:.1}% reduction - {:?}", 
                 level, compressed_size, compressed_size as f64 / 1024.0, ratio, duration);
        
        fs::write(format!("sample.json.br{}", level), compressed)?;
    }
    println!();

    // Test LZ4 compression
    println!("🔹 LZ4 Compression:");
    let start = Instant::now();
    let compressed = lz4::block::compress(&json_content, None, false)?;
    let duration = start.elapsed();
    
    let compressed_size = compressed.len();
    let ratio = (1.0 - compressed_size as f64 / original_size as f64) * 100.0;
    
    println!("  Default: {} bytes ({:.2} KB) - {:.1}% reduction - {:?}", 
             compressed_size, compressed_size as f64 / 1024.0, ratio, duration);
    
    fs::write("sample.json.lz4", compressed)?;
    println!();

    // Test Zstandard compression
    println!("🔹 Zstandard Compression:");
    for level in [1, 10, 19] {
        let start = Instant::now();
        let compressed = zstd::encode_all(&json_content[..], level)?;
        let duration = start.elapsed();

        let compressed_size = compressed.len();
        let ratio = (1.0 - compressed_size as f64 / original_size as f64) * 100.0;

        println!("  Level {}: {} bytes ({:.2} KB) - {:.1}% reduction - {:?}",
                 level, compressed_size, compressed_size as f64 / 1024.0, ratio, duration);

        fs::write(format!("sample.json.zst{}", level), compressed)?;
    }
    println!();

    // Test Snappy compression
    println!("🔹 Snappy Compression:");
    let start = Instant::now();
    let mut compressed = Vec::new();
    let mut encoder = snap::write::FrameEncoder::new(&mut compressed);
    encoder.write_all(&json_content)?;
    drop(encoder);
    let duration = start.elapsed();

    let compressed_size = compressed.len();
    let ratio = (1.0 - compressed_size as f64 / original_size as f64) * 100.0;

    println!("  Default: {} bytes ({:.2} KB) - {:.1}% reduction - {:?}",
             compressed_size, compressed_size as f64 / 1024.0, ratio, duration);

    fs::write("sample.json.snappy", compressed)?;
    println!();

    // Test Deflate (raw, no gzip headers)
    println!("🔹 Deflate Compression (raw, no headers):");
    for level in [1, 6, 9] {
        let start = Instant::now();
        let mut encoder = flate2::write::DeflateEncoder::new(Vec::new(), GzCompression::new(level));
        encoder.write_all(&json_content)?;
        let compressed = encoder.finish()?;
        let duration = start.elapsed();

        let compressed_size = compressed.len();
        let ratio = (1.0 - compressed_size as f64 / original_size as f64) * 100.0;

        println!("  Level {}: {} bytes ({:.2} KB) - {:.1}% reduction - {:?}",
                 level, compressed_size, compressed_size as f64 / 1024.0, ratio, duration);

        fs::write(format!("sample.json.deflate{}", level), compressed)?;
    }
    println!();

    println!("✅ All compressed files generated!");
    println!("📁 Files saved in compression-benchmark/");

    Ok(())
}


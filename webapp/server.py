#!/usr/bin/env python3
"""
Simple HTTP server for Kiokun webapp
Serves the webapp and handles routing for dictionary lookups
"""

import http.server
import socketserver
import os
import json
from urllib.parse import unquote
import mimetypes

class KiokunHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Set the directory to serve files from
        super().__init__(*args, directory=os.path.dirname(os.path.abspath(__file__)), **kwargs)
    
    def do_GET(self):
        # Parse the path and decode URL encoding
        path = unquote(self.path, encoding='utf-8')

        print(f"Request path: {self.path} -> decoded: {path}")  # Debug logging

        # Handle root path
        if path == '/':
            self.serve_index()
            return

        # Handle character lookup paths (e.g., /的, /和, etc.)
        if len(path) > 1 and not path.startswith('/static') and not '.' in path:
            # This is a character lookup
            self.serve_index()
            return
        
        # Handle JSON file requests from output_dictionary
        if path.startswith('/output_dictionary/') and path.endswith('.json'):
            self.serve_json_file(path)
            return

        # Handle static files (CSS, JS, etc.)
        if path.startswith('/static') or '.' in path:
            super().do_GET()
            return
        
        # Default to serving index for any other path
        self.serve_index()
    
    def serve_index(self):
        """Serve the main index.html file"""
        try:
            with open('index.html', 'rb') as f:
                content = f.read()
            
            self.send_response(200)
            self.send_header('Content-type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            
        except FileNotFoundError:
            self.send_error(404, "index.html not found")

    def serve_json_file(self, path):
        """Serve JSON files from the output_dictionary with proper UTF-8 handling"""
        # Extract the character from the path
        # path is like "/output_dictionary/的.json"
        filename = path.split('/')[-1]  # Get "的.json"
        character = filename[:-5]  # Remove ".json" to get "的"

        # Construct the actual file path
        json_file_path = os.path.join('..', 'output_dictionary', f'{character}.json')

        print(f"Serving JSON: {path} -> {json_file_path} (character: {character})")

        try:
            with open(json_file_path, 'r', encoding='utf-8') as f:
                content = f.read()

            self.send_response(200)
            self.send_header('Content-type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(content.encode('utf-8'))))
            self.end_headers()
            self.wfile.write(content.encode('utf-8'))

        except FileNotFoundError:
            print(f"JSON file not found: {json_file_path}")
            self.send_error(404, f"Character '{character}' not found")
        except Exception as e:
            print(f"Error serving JSON file: {e}")
            self.send_error(500, f"Error loading character data: {e}")
    
    def end_headers(self):
        # Add CORS headers to allow cross-origin requests
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

def main():
    PORT = 8000
    
    # Change to the webapp directory
    webapp_dir = os.path.dirname(os.path.abspath(__file__))
    os.chdir(webapp_dir)
    
    print(f"Starting Kiokun webapp server...")
    print(f"Server directory: {webapp_dir}")
    print(f"Dictionary path: {os.path.abspath('../output_dictionary')}")
    print(f"Server running at: http://localhost:{PORT}")
    print(f"Try: http://localhost:{PORT}/的")
    print(f"Try: http://localhost:{PORT}/和")
    print(f"Try: http://localhost:{PORT}/空")
    print("\nPress Ctrl+C to stop the server")
    
    with socketserver.TCPServer(("", PORT), KiokunHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")
            httpd.shutdown()

if __name__ == "__main__":
    main()

"""Serve site/ locally with caching off, so every reload runs the code on disk.
Run: python tools/serve.py [port]   (default 8765)"""
import functools, http.server, os, sys

class NoStore(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "site")
http.server.ThreadingHTTPServer(("127.0.0.1", port), functools.partial(NoStore, directory=root)).serve_forever()

#!/usr/bin/env python3
"""Build a local, attribution-preserving Wikimedia Commons image catalogue.

Images and metadata are resolved during GitHub Actions, not from each learner's
browser. This removes the browser-to-Commons API/CORS dependency.
"""
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

API = "https://commons.wikimedia.org/w/api.php"
USER_AGENT = "GoSVTMaroc/1.0 (educational media catalogue; https://gosvtmaroc.com/)"
QUERIES = [
    "plant cell microscopy chloroplast",
    "leaf stomata scanning electron microscopy",
    "human blood cells microscopy",
    "human heart anatomy specimen",
    "lung alveoli histology microscopy",
    "fossils biodiversity paleontology",
    "plant cell light microscopy real micrograph",
    "green leaf macro photography leaf veins",
    "onion epidermis cells light microscopy",
    "leaf stomata light microscope",
    "human blood smear microscope red white blood cells",
    "leaf mesophyll chloroplast microscope",
    "human digestive system anatomy specimen",
    "human lungs respiratory system anatomy specimen",
    "human heart cardiovascular anatomy specimen",
    "human brain spinal cord anatomy specimen",
    "human kidneys urinary system anatomy specimen",
    "human skeleton bones anatomy specimen",
]

def api(params):
    url = API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=35) as response:
        return json.loads(response.read().decode("utf-8"))

def plain(value):
    if isinstance(value, dict):
        value = value.get("value", "")
    import re, html
    return re.sub(r"\\s+", " ", html.unescape(re.sub(r"<[^>]*>", " ", str(value or "")))).strip()

catalogue = {}
for query in QUERIES:
    try:
        search = api({
            "action": "query", "format": "json", "list": "search",
            "srnamespace": 6, "srsearch": query, "srlimit": 20,
        })
        titles = [item.get("title") for item in search.get("query", {}).get("search", []) if item.get("title")]
        if not titles:
            catalogue[query] = {"error": "No matching files found on Wikimedia Commons"}
            print("NO RESULTS:", query)
            continue
        details = api({
            "action": "query", "format": "json", "prop": "imageinfo",
            "titles": "|".join(titles), "iiprop": "url|extmetadata|size|mime",
            "iiurlwidth": 900,
        })
        candidates = []
        for page in details.get("query", {}).get("pages", {}).values():
            info = (page.get("imageinfo") or [{}])[0]
            mime = info.get("mime", "")
            if not mime.startswith("image/") or mime in ("image/svg+xml", "image/vnd.djvu"):
                continue
            if not (info.get("thumburl") or info.get("url")):
                continue
            if int(info.get("width", 0)) < 240 or int(info.get("height", 0)) < 160:
                continue
            metadata = info.get("extmetadata") or {}
            candidates.append({
                "title": page.get("title", ""),
                "image_url": info.get("thumburl") or info.get("url"),
                "source_url": info.get("descriptionurl", ""),
                "author": plain(metadata.get("Artist")) or plain(metadata.get("Credit")) or "Auteur non indiqué",
                "license": plain(metadata.get("LicenseShortName")) or "Licence non indiquée",
                "width": int(info.get("width", 0)),
                "height": int(info.get("height", 0)),
                "mime": mime,
            })
        candidates.sort(key=lambda item: item["width"] * item["height"], reverse=True)
        if candidates:
            catalogue[query] = candidates[0]
            print("OK:", query, "=>", candidates[0]["title"])
        else:
            catalogue[query] = {"error": "No suitable raster image found"}
            print("NO SUITABLE IMAGE:", query)
    except Exception as exc:
        catalogue[query] = {"error": str(exc)[:240]}
        print("ERROR:", query, str(exc)[:240])
    time.sleep(0.15)

Path("science-media.json").write_text(
    json.dumps({"generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "source": "Wikimedia Commons", "items": catalogue}, ensure_ascii=False, indent=2),
    encoding="utf-8",
)
print("Wrote science-media.json with", sum(1 for value in catalogue.values() if value.get("image_url")), "images out of", len(QUERIES))

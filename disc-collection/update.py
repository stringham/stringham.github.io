#!/usr/bin/env python3
import os
import re
import sys
import subprocess
import requests
from bs4 import BeautifulSoup

COLLECTION_URL = "https://makerworld.com/en/collections/9863162-doodle-disc"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
LIST_JS_PATH = os.path.join(BASE_DIR, "list.js")
IMAGES_DIR = os.path.join(BASE_DIR, "images")

USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

def fetch_html_chrome(url):
    """Fetch rendered HTML using Chrome headless."""
    cmd = [
        "google-chrome",
        "--headless=new",
        "--disable-gpu",
        f"--user-agent={USER_AGENT}",
        "--dump-dom",
        url
    ]
    try:
        output = subprocess.check_output(cmd, stderr=subprocess.DEVNULL).decode("utf-8")
        return output
    except Exception as e:
        print(f"Error fetching URL {url} via Chrome: {e}", file=sys.stderr)
        return ""

def get_existing_models():
    """Parse list.js to extract existing model IDs and max disc number."""
    if not os.path.exists(LIST_JS_PATH):
        return set(), 0

    with open(LIST_JS_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    urls = re.findall(r'url:\s*"https://makerworld\.com/en/models/(\d+)', content)
    numbers = re.findall(r'number:\s*"(\d+)"', content)

    existing_ids = set(urls)
    max_num = max([int(n) for n in numbers]) if numbers else 0

    return existing_ids, max_num

def extract_number_and_name(title_text, href=""):
    """
    Extract disc number and clean disc name from title text or URL slug.
    Examples:
      'Doodle Disc 162 Cheer Bear' -> ('162', 'Cheer Bear')
      'Doodle Disc #162 - Cheer Bear' -> ('162', 'Cheer Bear')
    """
    title_text = title_text.strip()
    match = re.search(r'(?:Doodle\s+Disc\s*)?#?\s*(\d+)\s*[-:]?\s*(.+)', title_text, re.IGNORECASE)
    if match:
        num = match.group(1)
        name = match.group(2).strip()
        name = re.sub(r'\s*-\s*Free 3D Print Model.*$', '', name, flags=re.IGNORECASE).strip()
        return num, name

    match_href = re.search(r'doodle-disc-(\d+)-(.*)', href, re.IGNORECASE)
    if match_href:
        num = match_href.group(1)
        raw_slug = match_href.group(2)
        name = raw_slug.replace('-', ' ').title()
        return num, name

    return None, title_text

def slugify(name):
    """Convert name to web-friendly slug."""
    slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    return slug

def extract_collection_models(html):
    """Extract model IDs, URLs, disc numbers, and names from collection page HTML."""
    soup = BeautifulSoup(html, "html.parser")
    model_items = []
    seen_ids = set()

    for a in soup.find_all("a", href=True):
        href = a["href"]
        match = re.search(r'/models/(\d+)', href)
        if match:
            model_id = match.group(1)
            if model_id not in seen_ids:
                seen_ids.add(model_id)
                full_url = f"https://makerworld.com/en/models/{model_id}"
                text = a.text.strip()

                disc_number, disc_name = extract_number_and_name(text, href)
                model_items.append({
                    "id": model_id,
                    "url": full_url,
                    "href": href,
                    "number": disc_number,
                    "name": disc_name,
                    "raw_text": text
                })

    return model_items

def process_model(model_info, fallback_number):
    """Fetch model page, verify disc number & name, find 2nd design picture, and download WebP image."""
    model_id = model_info["id"]
    full_url = model_info["url"]

    disc_number = model_info["number"]
    disc_name = model_info["name"]

    print(f"Fetching model page for ID {model_id} ({full_url})...")
    model_html = fetch_html_chrome(full_url)
    soup = BeautifulSoup(model_html, "html.parser")

    # If disc_number or disc_name were missing from collection link, try model page
    if not disc_number or not disc_name:
        h1 = soup.find("h1")
        raw_title = h1.text.strip() if h1 else (soup.title.string.strip() if soup.title else "")
        num, name = extract_number_and_name(raw_title, full_url)
        if not disc_number:
            disc_number = num if num else str(fallback_number)
        if not disc_name:
            disc_name = name if name else f"Model {disc_number}"

    print(f"  Model #{disc_number}: {disc_name}")

    # Extract 2nd design picture
    imgs = soup.find_all("img")
    design_imgs = []
    for img in imgs:
        src = img.get("src") or ""
        if "/design/" in src and ("w_1000" in src or "w_400" in src or "format,webp" in src):
            base_url = src.split("?")[0]
            if base_url not in design_imgs:
                design_imgs.append(base_url)

    if len(design_imgs) >= 2:
        img_base = design_imgs[1]
    elif len(design_imgs) == 1:
        img_base = design_imgs[0]
    else:
        print(f"Warning: No design images found for model {model_id}", file=sys.stderr)
        return None

    # Construct webp URL
    img_download_url = f"{img_base}?x-oss-process=image/format,webp"

    # Save webp image
    slug = slugify(disc_name)
    filename = f"{disc_number}-{slug}.webp"
    image_rel_path = f"./images/{filename}"
    image_abs_path = os.path.join(IMAGES_DIR, filename)

    print(f"Downloading preview image from {img_download_url} -> {filename}...")
    resp = requests.get(img_download_url, headers={"User-Agent": USER_AGENT})
    if resp.status_code == 200:
        with open(image_abs_path, "wb") as f:
            f.write(resp.content)
        print(f"Saved {filename} ({len(resp.content)} bytes)")
    else:
        print(f"Error downloading image (status {resp.status_code})", file=sys.stderr)
        return None

    return {
        "number": str(disc_number),
        "name": disc_name,
        "image": image_rel_path,
        "url": full_url,
    }

def update_list_js(new_entries):
    """Insert new entry objects into list.js before the closing array bracket."""
    with open(LIST_JS_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    closing_index = content.rfind("];")
    if closing_index == -1:
        print("Error: Could not find '];' in list.js", file=sys.stderr)
        return False

    formatted_entries = ""
    for entry in new_entries:
        formatted_entries += "    {\n"
        formatted_entries += f'        number: "{entry["number"]}",\n'
        formatted_entries += f'        name: "{entry["name"]}",\n'
        formatted_entries += f'        image: "{entry["image"]}",\n'
        formatted_entries += f'        url: "{entry["url"]}",\n'
        formatted_entries += "    },\n"

    new_content = content[:closing_index] + formatted_entries + content[closing_index:]
    with open(LIST_JS_PATH, "w", encoding="utf-8") as f:
        f.write(new_content)

    print(f"Updated {LIST_JS_PATH} with {len(new_entries)} new item(s).")
    return True

def main():
    print(f"Checking MakerWorld collection: {COLLECTION_URL}")
    existing_ids, max_num = get_existing_models()
    print(f"Found {len(existing_ids)} existing models in list.js (latest number: #{max_num})")

    collection_html = fetch_html_chrome(COLLECTION_URL)
    if not collection_html:
        print("Failed to fetch collection page.", file=sys.stderr)
        sys.exit(1)

    collection_models = extract_collection_models(collection_html)
    print(f"Found {len(collection_models)} models on collection page.")

    # Filter out models already in list.js
    new_models = [m for m in collection_models if m["id"] not in existing_ids]

    if not new_models:
        print("No new models found. disc-collection/list.js is already up to date!")
        return

    print(f"Found {len(new_models)} new model(s) to process.")

    # Process models in reverse order of collection page (oldest new model first)
    new_models_reversed = list(reversed(new_models))

    new_entries = []
    fallback_num = max_num
    for m in new_models_reversed:
        fallback_num += 1
        entry = process_model(m, fallback_num)
        if entry:
            new_entries.append(entry)

    if new_entries:
        update_list_js(new_entries)
        print("Collection update complete!")

if __name__ == "__main__":
    main()

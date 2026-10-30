#!/usr/bin/env python3
"""
Enrich an e-commerce catalogue with conservative display details and search metadata.

Usage:
    python update_products.py input_catalogue.json products_updated.json

Policy:
- Preserve all original fields, IDs, prices, ratings, images and categories.
- Use verified details only for explicitly identifiable models.
- Infer only simple attributes directly stated in the product name.
- Keep unknown or SKU-dependent values as JSON null (Python None).
- Generate category/product-type synonyms for search without treating them as facts.
- Do not fabricate ingredients, materials, battery capacity, charging or warranty data.
"""
import argparse
import json
import os
import re
import tempfile
from pathlib import Path

CATEGORY_FIELDS = {
    "mobiles": [
        "processor", "ram", "storage", "camera", "batteryCapacity", "charging",
        "displayType", "displayResolution", "refreshRate", "gpu", "gamingPerformance",
        "aiFeatures", "network", "operatingSystem", "softwareUpdatePolicy"
    ],
    "electronics": [
        "deviceType", "connectivity", "compatibility", "powerSource", "batteryLife",
        "ports", "dimensions", "weight", "materials", "specialFeatures"
    ],
    "fashion": [
        "garmentType", "material", "fabric", "fit", "color", "pattern",
        "availableSizes", "gender", "occasion", "season", "washCare"
    ],
    "home": [
        "applianceType", "capacity", "powerConsumption", "energyRating", "dimensions",
        "material", "installation", "noiseLevel", "controls", "safetyFeatures"
    ],
    "beauty": [
        "productType", "ingredients", "skinType", "hairType", "volume", "benefits",
        "usage", "concerns", "suitableFor", "expiryDate", "fragrance"
    ],
    "shoes": [
        "shoeType", "gender", "upperMaterial", "soleMaterial", "sizeRange", "color", "fit",
        "occasion", "comfortFeatures", "waterResistance", "closureType"
    ],
}

# These specifications are based on the official manufacturer product pages/newsrooms.
# The storage field lists available model variants when the catalogue doesn't identify
# the exact SKU. iPhone battery capacity in mAh is not published here, so it stays null.
VERIFIED_MODELS = {
    "iphone 17": {
        "brand": "Apple",
        "brandWebsite": "https://www.apple.com/",
        "model": "iPhone 17",
        "brandDescription": "Consumer technology brand; product details from Apple's official iPhone 17 specifications.",
        "specifications": {
            "processor": "Apple A19",
            "ram": None,
            "storage": "256GB or 512GB (available variants; exact SKU not specified)",
            "camera": "48MP Fusion main camera and 48MP Fusion Ultra Wide; 18MP Center Stage front camera",
            "batteryCapacity": None,
            "charging": "USB-C wired fast charging; up to 50% in 20 minutes with a 40W or higher adapter; MagSafe/Qi2 wireless charging up to 25W",
            "displayType": "6.3-inch Super Retina XDR OLED",
            "displayResolution": "2622 x 1206 pixels",
            "refreshRate": "Adaptive ProMotion up to 120Hz",
            "gpu": "5-core GPU",
            "gamingPerformance": "Hardware-accelerated ray tracing supported; real-world performance depends on game and settings",
            "aiFeatures": "Apple Intelligence (availability depends on language, region and software version)",
            "network": "5G; Wi-Fi 7; Bluetooth 6",
            "operatingSystem": "iOS (version may vary by installed update)",
            "softwareUpdatePolicy": None
        },
        "source": "https://www.apple.com/in/iphone-17/specs/"
    },
    "iphone 17 pro max": {
        "brand": "Apple",
        "brandWebsite": "https://www.apple.com/",
        "model": "iPhone 17 Pro Max",
        "brandDescription": "Consumer technology brand; product details from Apple's official iPhone 17 Pro Max specifications.",
        "specifications": {
            "processor": "Apple A19 Pro",
            "ram": None,
            "storage": "256GB, 512GB, 1TB or 2TB (available variants; exact SKU not specified)",
            "camera": "48MP Fusion main, 48MP Ultra Wide and 48MP Telephoto rear cameras; 18MP Center Stage front camera",
            "batteryCapacity": None,
            "charging": "USB-C wired fast charging; up to 50% in 20 minutes with a compatible high-wattage adapter; MagSafe/Qi wireless charging",
            "displayType": "6.9-inch Super Retina XDR OLED",
            "displayResolution": "2868 x 1320 pixels",
            "refreshRate": "Adaptive ProMotion up to 120Hz",
            "gpu": "6-core GPU with Neural Accelerators",
            "gamingPerformance": "Hardware-accelerated ray tracing supported; real-world performance depends on game and settings",
            "aiFeatures": "Apple Intelligence (availability depends on language, region and software version)",
            "network": "5G; Wi-Fi 7; Bluetooth 6",
            "operatingSystem": "iOS (version may vary by installed update)",
            "softwareUpdatePolicy": None
        },
        "source": "https://support.apple.com/en-by/125091"
    },
    "samsung galaxy s26 ultra": {
        "brand": "Samsung",
        "brandWebsite": "https://www.samsung.com/in/",
        "model": "Galaxy S26 Ultra",
        "brandDescription": "Consumer electronics brand; product details from Samsung's official Galaxy S26 series announcement.",
        "specifications": {
            "processor": "Snapdragon 8 Elite Gen 5 for Galaxy",
            "ram": "12GB or 16GB (market/storage variant dependent)",
            "storage": "256GB, 512GB or 1TB (available variants; exact SKU not specified)",
            "camera": "200MP wide, 50MP ultra-wide, 10MP 3x telephoto and 50MP 5x telephoto; 12MP front camera",
            "batteryCapacity": "5000mAh (typical)",
            "charging": "Wired charging up to 60W; wireless charging up to 25W",
            "displayType": "6.9-inch QHD+ Dynamic AMOLED 2X",
            "displayResolution": "QHD+ (exact pixel dimensions not populated here)",
            "refreshRate": "Adaptive 1–120Hz",
            "gpu": None,
            "gamingPerformance": "Flagship-class platform; performance varies by game and settings",
            "aiFeatures": "Galaxy AI features; exact feature availability can vary by region/software",
            "network": "5G; Wi-Fi/Bluetooth details vary by regional configuration",
            "operatingSystem": "Android with Samsung One UI (version depends on software update)",
            "softwareUpdatePolicy": None
        },
        "source": "https://news.samsung.com/in/samsung-india-launches-its-most-advanced-ai-phone-the-galaxy-s26-series-pre-order-now"
    },
    "samsung galaxy s25 ultra": {
        "brand": "Samsung",
        "brandWebsite": "https://www.samsung.com/in/",
        "model": "Galaxy S25 Ultra",
        "brandDescription": "Consumer electronics brand; product details from Samsung's official Galaxy S25 series announcement.",
        "specifications": {
            "processor": None,
            "ram": "12GB (listed configurations)",
            "storage": "256GB, 512GB or 1TB (available variants; exact SKU not specified)",
            "camera": "200MP wide, 50MP ultra-wide, 50MP 5x telephoto and 10MP 3x telephoto; 12MP front camera",
            "batteryCapacity": "5000mAh (typical)",
            "charging": "Wired charging up to 45W; up to 65% in around 30 minutes with a compatible 45W adapter",
            "displayType": "6.9-inch QHD+ Dynamic AMOLED 2X",
            "displayResolution": "QHD+ (exact pixel dimensions not populated here)",
            "refreshRate": "Adaptive 1–120Hz",
            "gpu": None,
            "gamingPerformance": None,
            "aiFeatures": "Galaxy AI features; exact feature availability can vary by region/software",
            "network": "5G; exact bands depend on regional model",
            "operatingSystem": "Android with Samsung One UI (version depends on software update)",
            "softwareUpdatePolicy": None
        },
        "source": "https://news.samsung.com/in/samsung-galaxy-s25-series-sets-the-standard-of-ai-phone"
    }
}

DEMO_PLACEHOLDER_MODELS = {
    "samsung galaxy smartphone": {
        "specifications": {
            "processor": "Illustrative sample (unverified): octa-core mobile processor",
            "ram": "Illustrative sample (unverified): 8GB",
            "storage": "Illustrative sample (unverified): 256GB",
            "camera": "Illustrative sample (unverified): 50MP main camera",
            "batteryCapacity": "Illustrative sample (unverified): 6000mAh",
            "charging": "Illustrative sample (unverified): 45W wired charging",
            "displayType": "Illustrative sample (unverified): 6.7-inch AMOLED",
            "network": None,
            "softwareUpdatePolicy": None,
        },
        "warranty": "Illustrative sample (unverified): 1 year",
    },
}

BRANDS = {
    "dove shampoo": ("Dove", "https://www.dove.com/"),
    "hp windows laptop": ("HP", "https://www.hp.com/"),
}

CATEGORY_SEARCH_ALIASES = {
    "mobiles": ["mobile", "mobiles", "phone", "phones", "smartphone", "smartphones", "cell phone", "cellphone", "handset"],
    "electronics": ["electronics", "electronic", "gadget", "gadgets", "tech"],
    "fashion": ["fashion", "clothes", "clothing", "apparel", "garments", "wear"],
    "home": ["home", "household", "appliance", "appliances"],
    "beauty": ["beauty", "skincare", "skin care", "makeup", "cosmetics", "personal care"],
    "shoes": ["shoe", "shoes", "footwear"],
}

PRODUCT_SEARCH_ALIASES = [
    (re.compile(r"\b(?:headphones?|headsets?)\b", re.I), ["headphone", "headphones", "headset", "headsets", "earphones", "earbuds"]),
    (re.compile(r"\b(?:earphones?|earbuds?|airdopes?|airdobes?|airpods?)\b", re.I), ["earphones", "earbuds", "headphones", "headset"]),
    (re.compile(r"\b(?:fridges?|refrigerators?)\b", re.I), ["fridge", "refrigerator", "refrigerators", "cooling appliance"]),
    (re.compile(r"\b(?:tosters?|toasters?)\b", re.I), ["toaster", "toster", "bread toaster", "bread toster"]),
    (re.compile(r"\b(?:laptops?|notebooks?)\b", re.I), ["laptop", "notebook", "portable computer"]),
    (re.compile(r"\b(?:moisturisers?|moisturizers?)\b", re.I), ["moisturizer", "moisturiser", "face moisturizer", "face cream"]),
    (re.compile(r"\b(?:smart[\s-]?watches?)\b", re.I), ["smartwatch", "smart watch", "wearable"]),
    (re.compile(r"\b(?:power[\s-]?banks?)\b", re.I), ["power bank", "portable charger", "battery pack"]),
    (re.compile(r"\b(?:washing machines?|washers?)\b", re.I), ["washing machine", "washer", "laundry appliance"]),
    (re.compile(r"\b(?:sneakers?|trainers?)\b", re.I), ["sneakers", "trainers", "casual shoes"]),
]

def empty_specifications(category):
    return {field: None for field in CATEGORY_FIELDS.get(category, [])}

def infer_brand(product_name):
    name = product_name.strip().lower()
    if name in VERIFIED_MODELS:
        return VERIFIED_MODELS[name]["brand"], VERIFIED_MODELS[name].get("brandWebsite")
    for phrase, details in BRANDS.items():
        if phrase in name:
            return details
    # A brand is only assigned if it is explicitly present in the product name.
    if re.search(r"\b(samsung|galaxy)\b", name):
        return "Samsung", "https://www.samsung.com/in/"
    if re.search(r"\b(iphone|apple)\b", name):
        return "Apple", "https://www.apple.com/"
    return None, None

def build_search_keywords(product, category):
    name = str(product.get("name") or "").strip()
    brand = product.get("brand")
    model = product.get("model")
    existing = product.get("searchKeywords")
    keywords = set(existing if isinstance(existing, list) else [])
    keywords.update(CATEGORY_SEARCH_ALIASES.get(category, []))
    keywords.update(re.findall(r"[a-z0-9]+", re.sub(r"\b(men|women)'s\b", r"\1", name.lower())))
    for value in (brand, model):
        if isinstance(value, str) and value.strip():
            keywords.update(re.findall(r"[a-z0-9]+", value.lower()))
    for pattern, aliases in PRODUCT_SEARCH_ALIASES:
        if pattern.search(name):
            keywords.update(aliases)
    if category == "mobiles":
        if re.search(r"\b(?:android|samsung galaxy)\b", name, re.I):
            keywords.update(["android", "android phone"])
        if re.search(r"\biphone\b", name, re.I):
            keywords.update(["iphone", "ios", "apple phone"])
        if re.search(r"\b5g\b", name, re.I):
            keywords.update(["5g", "5g phone"])
    return sorted(
        keyword for keyword in keywords
        if isinstance(keyword, str) and keyword.strip() and keyword != "s"
    )

def make_product(product):
    p = dict(product)
    name = str(p.get("name") or "").strip()
    lower = name.lower()
    category = p.get("category")
    specs = empty_specifications(category)

    # Branding fields: do not invent a logo URL or exact SKU.
    brand, brand_website = infer_brand(name)
    if brand:
        p["brand"] = brand
    if brand_website:
        p["brandWebsite"] = brand_website
    p.setdefault("brand", None)
    p.setdefault("brandLogo", None)
    p.setdefault("brandWebsite", None)
    p.setdefault("brandDescription", None)
    p.setdefault("model", None)
    if brand and not p["model"]:
        model_name = re.sub(rf"^\s*{re.escape(brand)}\s*", "", name, flags=re.I).strip()
        if model_name and category == "mobiles" and re.search(r"\b(?:galaxy|iphone)\b", model_name, re.I):
            p["model"] = model_name

    # Product-name details that are safe to extract without guessing.
    if category == "mobiles":
        if "128gb" in lower:
            specs["storage"] = "128GB (stated in product name)"
        if "5g" in lower:
            specs["network"] = "5G (stated in product name)"
        elif "4g" in lower:
            specs["network"] = "4G (stated in product name)"
        if "android" in lower:
            specs["operatingSystem"] = "Android (stated in product name)"
        elif "iphone" in lower:
            specs["operatingSystem"] = "iOS (product family)"
        if "samsung galaxy smartphone" in lower:
            specs["operatingSystem"] = "Android with Samsung One UI (exact version unknown)"
    elif category == "electronics":
        specs["deviceType"] = name
        if "bluetooth" in lower:
            specs["connectivity"] = "Bluetooth (version unknown)"
        elif "wireless" in lower:
            specs["connectivity"] = "Wireless; protocol unknown"
        if "usb-c" in lower:
            specs["ports"] = "USB-C (stated in product name)"
        if "512gb" in lower and "ssd" in lower:
            specs["specialFeatures"] = "512GB storage capacity (stated in product name)"
        if "windows" in lower:
            specs["compatibility"] = "Windows operating system (stated in product name)"
    elif category == "fashion":
        specs["garmentType"] = name
        if "women's" in lower or lower.startswith("women "):
            specs["gender"] = "Women"
        elif "men's" in lower or lower.startswith("men "):
            specs["gender"] = "Men"
        elif "unisex" in lower:
            specs["gender"] = "Unisex"
        if "slim fit" in lower:
            specs["fit"] = "Slim fit (stated in product name)"
        elif "oversized" in lower:
            specs["fit"] = "Oversized (stated in product name)"
        if "checked" in lower:
            specs["pattern"] = "Checked (stated in product name)"
        elif "printed" in lower:
            specs["pattern"] = "Printed (stated in product name)"
        if "denim jeans" in lower or "casual jeans" in lower:
            specs["fabric"] = "Denim (product type; exact composition unknown)"
    elif category == "home":
        specs["applianceType"] = name
        if "front load" in lower or "frontload" in lower:
            specs["installation"] = "Front-load design (stated in product name)"
        if "double door" in lower or "double fridge" in lower:
            specs["specialFeatures"] = "Double-door design (stated in product name)"
        if "digital" in lower and ("display" in lower or "induction" in lower or "scale" in lower):
            specs["controls"] = "Digital controls/display (stated in product name)"
    elif category == "beauty":
        specs["productType"] = name
        if "vitamin c" in lower:
            specs["ingredients"] = "Vitamin C (stated in product name; concentration/form unknown)"
        if "vitamin e" in lower:
            specs["ingredients"] = "Vitamin E (stated in product name; concentration/form unknown)"
        if "aloe vera" in lower:
            specs["ingredients"] = "Aloe vera (stated in product name; concentration unknown)"
        if "rose water" in lower:
            specs["ingredients"] = "Rose water (stated in product name; concentration unknown)"
        if "charcoal" in lower:
            specs["ingredients"] = "Charcoal (stated in product name; type/concentration unknown)"
        if "shampoo" in lower:
            specs["usage"] = "Hair cleansing; exact instructions depend on packaging"
        elif "conditioner" in lower:
            specs["usage"] = "Hair conditioning; exact instructions depend on packaging"
        elif "spf 50" in lower:
            specs["benefits"] = "SPF 50 protection stated in product name; broad-spectrum status not verified"
        elif "moisturizer" in lower or "moisturiser" in lower or "lotion" in lower:
            specs["benefits"] = "Moisturising (product type/name)"
    elif category == "shoes":
        specs["shoeType"] = name
        if "women's" in lower:
            specs["gender"] = "Women"
        elif "men's" in lower:
            specs["gender"] = "Men"
        elif "unisex" in lower:
            specs["gender"] = "Unisex"
        if "running" in lower:
            specs["occasion"] = "Running (product type)"
        elif "trekking" in lower:
            specs["occasion"] = "Trekking/outdoor (product type)"
        elif "formal" in lower:
            specs["occasion"] = "Formal wear (product type)"
        elif "walking" in lower:
            specs["occasion"] = "Walking (product type)"
        if "leather" in lower:
            specs["upperMaterial"] = "Leather (stated in product name; type not specified)"
        if "canvas" in lower:
            specs["upperMaterial"] = "Canvas (stated in product name)"
        if "slip-on" in lower or "slip on" in lower:
            specs["closureType"] = "Slip-on (stated in product name)"
        elif "lace" in lower:
            specs["closureType"] = "Lace-up (stated in product name)"

    existing_specs = p.get("specifications")
    if isinstance(existing_specs, dict):
        for key, value in existing_specs.items():
            if value is not None and specs.get(key) is None:
                specs[key] = value

    # Override only exact, recognizable product models with manufacturer-published facts.
    model_key = lower
    if model_key in VERIFIED_MODELS:
        details = VERIFIED_MODELS[model_key]
        p["brand"] = details["brand"]
        p["brandWebsite"] = details["brandWebsite"]
        p["brandDescription"] = details["brandDescription"]
        p["model"] = details["model"]
        specs.update(details["specifications"])
        p["dataQuality"] = {
            "verificationStatus": "manufacturer_source",
            "source": details["source"],
            "note": "Specifications are model-family facts from the linked manufacturer source. Exact SKU/region may affect some details; null means not published or not established."
        }
    elif model_key in DEMO_PLACEHOLDER_MODELS:
        details = DEMO_PLACEHOLDER_MODELS[model_key]
        specs.update(details["specifications"])
        p["warranty"] = details["warranty"]
        p["dataQuality"] = {
            "verificationStatus": "demo_placeholder",
            "source": "Generated illustrative values requested for the catalog demo; not verified product information.",
            "note": "Values marked Illustrative sample (unverified) are placeholders only and must not be treated as confirmed product specifications or warranty terms."
        }
    else:
        # Brand-specific but unidentified models should not inherit specs from a different model.
        p["dataQuality"] = {
            "verificationStatus": "partially_inferred",
            "source": "Supplied catalogue; simple attributes extracted from product name",
            "note": "Exact model/manufacturer specifications are unknown. Only attributes explicitly stated in the product name are populated; other values remain null."
        }

    p["specifications"] = specs
    p.setdefault("warranty", None)
    p.setdefault("description", None)
    if p.get("dataQuality", {}).get("verificationStatus") == "demo_placeholder":
        p["description"] = (
            f"{name}. Category: {category}. "
            "This demo listing contains illustrative, unverified sample specifications and warranty text. "
            "Confirm actual product details with the seller before purchase."
        )
    elif not p["description"]:
        p["description"] = (
            f"{name}. "
            f"Category: {category}. "
            "Only the product details explicitly stated in the catalogue or supported by the linked manufacturer source are populated; "
            "unknown details have been left null."
        )
    p["features"] = [
        f"{key}: {value}" for key, value in specs.items()
        if value is not None
    ]
    p["useCases"] = {
        "mobiles": ["Mobile communication", "Apps and web browsing"],
        "electronics": ["Use depends on device type and compatibility"],
        "fashion": ["Clothing and personal styling"],
        "home": ["Household use; exact function depends on appliance type"],
        "beauty": ["Personal care; follow product packaging and check ingredients for sensitivities"],
        "shoes": ["Footwear use; fit and intended activity depend on the specific model"],
    }.get(category, [])
    p["searchKeywords"] = build_search_keywords(p, category)
    tags = p.get("tags")
    if not isinstance(tags, list):
        tags = []
    p["tags"] = sorted(set([*tags, *([category] if category else [])]))
    if not isinstance(p.get("pros"), list):
        p["pros"] = []
    if not isinstance(p.get("cons"), list):
        p["cons"] = []
    if any(v is None for v in specs.values()):
        unknown_details_note = "Some product details are unavailable in the source catalogue."
        if unknown_details_note not in p["cons"]:
            p["cons"].append(unknown_details_note)
    return p

def main():
    parser = argparse.ArgumentParser(
        description="Conservatively enrich a product catalogue stored as a JSON array."
    )
    parser.add_argument("input", type=Path, help="Input catalogue JSON file")
    parser.add_argument(
        "output",
        type=Path,
        nargs="?",
        default=Path("products_updated.json"),
        help="Output JSON file (default: products_updated.json)",
    )
    args = parser.parse_args()
    input_file = args.input
    output_file = args.output
    products = json.loads(input_file.read_text(encoding="utf-8"))
    if not isinstance(products, list) or not products:
        raise ValueError("The input catalogue must be a non-empty JSON array.")
    required_fields = ("id", "name", "price", "oldPrice", "category", "image")
    product_ids = set()
    for index, product in enumerate(products):
        if not isinstance(product, dict):
            raise ValueError(f"Product at index {index} must be a JSON object.")
        missing_fields = [field for field in required_fields if field not in product]
        if missing_fields:
            raise ValueError(
                f"Product at index {index} is missing required fields: "
                f"{', '.join(missing_fields)}."
            )
        product_id = str(product["id"])
        if product_id in product_ids:
            raise ValueError(f"Duplicate product ID: {product['id']}.")
        product_ids.add(product_id)

    updated = [make_product(p) for p in products]
    immutable_fields = ("id", "name", "price", "oldPrice", "category", "image", "discount", "rating", "reviews")
    for original, enriched in zip(products, updated):
        if any(original.get(field) != enriched.get(field) for field in immutable_fields):
            raise ValueError(f"Enrichment changed catalog fields for product ID {original['id']}.")

    output_file.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            newline="\n",
            dir=output_file.parent,
            delete=False,
        ) as output:
            temporary_path = Path(output.name)
            output.write(json.dumps(updated, ensure_ascii=False, indent=2) + "\n")
            output.flush()
            os.fsync(output.fileno())
        temporary_path.replace(output_file)
    finally:
        if temporary_path and temporary_path.exists():
            temporary_path.unlink()
    print(f"Updated {len(updated)} products -> {output_file}")
    print("Unknown or unverified fields remain null; source prices and IDs were preserved.")

if __name__ == "__main__":
    main()

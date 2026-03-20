def clean_competitor_data(data):

    if not data:
        return {"competitors": []}

    competitors = data.get("competitors") or data.get("input") or []

    cleaned = []
    seen = set()

    for comp in competitors:

        name = comp.get("product_name", "Unknown").strip()

        if name.lower() in seen:
            continue

        seen.add(name.lower())

        desc = comp.get("short_description", "No description available")

        pricing = comp.get("pricing", "Pricing not available")

        if isinstance(pricing, dict):
            pricing = ", ".join(
                [f"{k}: {v}" for k, v in pricing.items()]
            )

        cleaned.append({
            "product_name": name,
            "description": desc,
            "pricing": pricing
        })

    return {"competitors": cleaned}
import os
import requests
import json
from dotenv import load_dotenv

# Load env
load_dotenv()
API_KEY = os.getenv("TINYFISH_API_KEY")

url = "https://agent.tinyfish.ai/v1/automation/run-sse"

payload = {
    "url": "https://google.com",
    "goal": """
    Extract the first 2 product names and prices for laptop under 50k.

    Return ONLY valid JSON:
    {
      "products": [
        {"name": "...", "price": "..."},
        {"name": "...", "price": "..."}
      ]
    }
    """
}

headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json",
}

final_result = None
current_event = None

print("🚀 Starting stream...\n")

with requests.post(url, headers=headers, json=payload, stream=True) as response:
    for line in response.iter_lines():
        if not line:
            continue

        decoded = line.decode("utf-8")

        # 🔹 Detect event type
        if decoded.startswith("event:"):
            current_event = decoded.replace("event:", "").strip()
            print(f"\n🔵 EVENT: {current_event}")

        # 🔹 Detect data
        elif decoded.startswith("data:"):
            data_str = decoded.replace("data:", "").strip()

            print(f"🟢 DATA: {data_str}")  # 👈 LIVE DATA PRINT

            try:
                data_json = json.loads(data_str)
            except:
                continue

            # 🎯 Capture final result
            if data_json.get("type") == "COMPLETE":
             final_result = data_json
                

print("\n===== FINAL OUTPUT =====")

if final_result:
    if "result" in final_result:
        result_data = final_result["result"]

        print("✅ Final Extracted Data:")
        print(result_data)

    else:
        print("⚠️ Unexpected format:")
        print(final_result)
else:
    print("❌ No final result received")
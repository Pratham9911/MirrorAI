from tinyfish import TinyFish
import time
import os
from dotenv import load_dotenv

load_dotenv()

client = TinyFish(api_key=os.getenv("TINYFISH_API_KEY"))
with client.agent.stream(url="https://example.com/", goal="What is the domain name? Return JSON {'domain': '...'}") as s:
    for e in s:
        pass
time.sleep(2)
print("Finished stream, run_id:", e.run_id)
r = client.runs.get(e.run_id)
print("result JSON is:", r.result_json)

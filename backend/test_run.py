import json
from tinyfish import TinyFish
import os
from dotenv import load_dotenv

load_dotenv()

client = TinyFish(api_key=os.getenv("TINYFISH_API_KEY"))
res = client.agent.run(url="https://example.com/", goal="Please just return a JSON object with {'success': true}")
print(res.model_dump())

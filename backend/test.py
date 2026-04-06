from tinyfish import TinyFish
import os
from dotenv import load_dotenv

load_dotenv()
    

client = TinyFish(api_key=os.getenv("TINYFISH_API_KEY"))


with client.agent.stream(
    url="https://scrapeme.live/shop",
    goal="Extract the first 2 product names and prices. Return ONLY valid JSON.",
) as stream:
    for event in stream:
        print(event)

        if event.type.name == "COMPLETE":
            print("\nFINAL RESULT JSON:\n", event.result_json)
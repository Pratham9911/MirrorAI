from tinyfish import TinyFish
import os
from dotenv import load_dotenv

load_dotenv()

client = TinyFish(api_key=os.getenv("TINYFISH_API_KEY"))

with client.agent.stream(
    url="https://www.google.com",
    goal="Extract the first 1 job postings. For each, get the full title text as shown on the page, the URL it links to, and the posting date. Return as JSON array with keys: title, url, posted.",
) as stream:
    for event in stream:
        print(event)
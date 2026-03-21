from tinyfish import TinyFish
import os
from dotenv import load_dotenv

load_dotenv()

client = TinyFish(api_key=os.getenv("TINYFISH_API_KEY"))

result = client.agent.run(
    url="https://www.google.com",
    goal="take out prices and product details for the top 2 results for laptops under 50000 INR",
)

print(result)
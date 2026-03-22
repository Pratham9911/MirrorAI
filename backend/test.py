from tinyfish import TinyFish
import os
    

client = TinyFish(api_key="")

result = client.agent.run(
    url="https://www.google.com",
    goal="take out prices and product details for the top 2 results for laptops under 50000 INR",
)

print(result)
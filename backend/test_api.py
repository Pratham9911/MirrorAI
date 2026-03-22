import requests
import json

url = "http://localhost:8000/api/threads"
payload = {
    "threadName": "Test Persist",
    "productName": "Mirror",
    "description": "Testing",
    "tags": ["tag1"],
    "competitors": [{"name": "Comp1", "url": "https://comp1.com"}]
}
headers = {"Content-Type": "application/json"}
response = requests.post(url, data=json.dumps(payload), headers=headers)
print(response.status_code)
print(response.json())

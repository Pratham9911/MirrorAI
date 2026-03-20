from tinyfish import TinyFish
import os
from dotenv import load_dotenv

load_dotenv()

client = TinyFish(api_key=os.getenv("TINYFISH_API_KEY"))


def run_agent(company):

    goal = f"""
    Search Google for competitors of {company}.
    Open the top 1 competitor website.
    Extract:
    - product name`
    - short description
    - pricing if available
    Ensure the list contains 1 competitors.
    Return results in JSON.
    """

    with client.agent.stream(
        url="https://www.google.com",
        goal=goal,
    ) as stream:

        for event in stream:

            if event.type == "PROGRESS":
                yield {
                    "type": "progress",
                    "message": event.purpose
                }

            if event.type == "COMPLETE":
                yield {
                    "type": "result",
                    "data": event.result_json
                }
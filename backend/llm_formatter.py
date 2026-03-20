from groq import Groq
import json
import os
from dotenv import load_dotenv

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def format_report(company, competitor_data):

    prompt = f"""
You are a business intelligence analyst.

Analyze competitors of {company}.

Competitor data:
{json.dumps(competitor_data, indent=2)}

Generate a clean competitor analysis report with:

1. Competitor Overview
2. Pricing Comparison
3. Key Differentiators
4. Strategic Insights

only use the provided data. Do not make assumptions or add information not present in the data.
Keep the report concise and structured.
"""

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": "You are an expert market research analyst."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.3
    )

    return response.choices[0].message.content
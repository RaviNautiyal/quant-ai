import requests
import os
from dotenv import load_dotenv

load_dotenv()

NEWS_API_KEY = os.getenv("NEWS_API_KEY")

def get_stock_news(ticker: str, company_name: str = ""):
    try:
        query = company_name if company_name else ticker
        url = f"https://newsapi.org/v2/everything?q={query} stock&language=en&sortBy=publishedAt&pageSize=5&apiKey={NEWS_API_KEY}"
        
        response = requests.get(url)
        data = response.json()

        if data.get("status") != "ok":
            return []

        articles = []
        for article in data.get("articles", []):
            articles.append({
                "title": article.get("title", ""),
                "description": article.get("description", ""),
                "url": article.get("url", ""),
                "publishedAt": article.get("publishedAt", ""),
                "source": article.get("source", {}).get("name", "")
            })

        return articles

    except Exception as e:
        return []
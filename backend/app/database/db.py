from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI")

client = MongoClient(MONGO_URI)
db = client["finance_app"]
alerts_collection = db["alerts"]
watchlist_collection = db["watchlist"]
portfolio_collection = db["portfolio"]
users_collection = db["users"]
transactions_collection = db["transactions"]  # NEW
push_subscriptions_collection = db["push_subscriptions"]
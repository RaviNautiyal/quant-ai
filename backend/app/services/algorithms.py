# ============================================
# FINANCIAL ALGORITHMS & DATA STRUCTURES
# ============================================


# 1. HASH MAP — Fast stock data lookup
class StockHashMap:
    def __init__(self):
        self.map = {}

    def insert(self, ticker: str, data: dict):
        self.map[ticker] = data

    def get(self, ticker: str):
        return self.map.get(ticker, None)

    def get_all(self):
        return self.map


# 2. MOVING AVERAGE — Trend detection
def simple_moving_average(prices: list, window: int = 7):
    if len(prices) < window:
        return []

    result = []
    for i in range(window - 1, len(prices)):
        avg = sum(prices[i - window + 1:i + 1]) / window
        result.append(round(avg, 2))

    return result


def exponential_moving_average(prices: list, window: int = 7):
    if not prices:
        return []

    k = 2 / (window + 1)
    ema = [prices[0]]

    for price in prices[1:]:
        ema.append(round(price * k + ema[-1] * (1 - k), 2))

    return ema


# 3. SEGMENT TREE — Fast range queries on stock prices
class SegmentTree:
    def __init__(self, prices: list):
        self.n = len(prices)
        self.tree = [0] * (4 * self.n)
        if prices:
            self.build(prices, 0, 0, self.n - 1)

    def build(self, prices, node, start, end):
        if start == end:
            self.tree[node] = prices[start]
        else:
            mid = (start + end) // 2
            self.build(prices, 2 * node + 1, start, mid)
            self.build(prices, 2 * node + 2, mid + 1, end)
            self.tree[node] = max(
                self.tree[2 * node + 1],
                self.tree[2 * node + 2]
            )

    def query_max(self, node, start, end, left, right):
        if right < start or end < left:
            return float('-inf')
        if left <= start and end <= right:
            return self.tree[node]
        mid = (start + end) // 2
        left_max = self.query_max(2 * node + 1, start, mid, left, right)
        right_max = self.query_max(2 * node + 2, mid + 1, end, left, right)
        return max(left_max, right_max)

    def get_max_in_range(self, left: int, right: int):
        if self.n == 0:
            return 0
        return self.query_max(0, 0, self.n - 1, left, right)


# 4. VOLATILITY — Risk calculation
def calculate_volatility(prices: list):
    if len(prices) < 2:
        return 0

    returns = []
    for i in range(1, len(prices)):
        daily_return = (prices[i] - prices[i - 1]) / prices[i - 1]
        returns.append(daily_return)

    mean = sum(returns) / len(returns)
    variance = sum((r - mean) ** 2 for r in returns) / len(returns)
    volatility = variance ** 0.5

    return round(volatility * 100, 4)


# 5. KNAPSACK PORTFOLIO OPTIMIZER
def portfolio_optimizer(stocks: list, budget: float, risk_tolerance: str = "medium"):
    if not stocks or budget <= 0:
        return []

    risk_limits = {"low": 0.1, "medium": 0.2, "high": 0.4}
    max_risk = risk_limits.get(risk_tolerance, 0.2)

    eligible = [s for s in stocks if s.get("risk", 1) <= max_risk]

    if not eligible:
        eligible = stocks

    eligible.sort(
        key=lambda x: x.get("expected_return", 0) / max(x.get("risk", 0.1), 0.01),
        reverse=True
    )

    allocated = []
    remaining = budget

    for stock in eligible:
        if remaining <= 0:
            break

        min_inv = stock.get("min_investment", 1000)
        if remaining >= min_inv:
            allocation = min(remaining * 0.4, remaining)
            allocated.append({
                "ticker": stock["ticker"],
                "allocation": round(allocation, 2),
                "expected_return": stock.get("expected_return", 0),
                "risk": stock.get("risk", 0)
            })
            remaining -= allocation

    return allocated


# 6. SHARPE RATIO — Risk adjusted return
def sharpe_ratio(prices: list, risk_free_rate: float = 0.05):
    if len(prices) < 2:
        return 0

    returns = [(prices[i] - prices[i - 1]) / prices[i - 1] for i in range(1, len(prices))]
    avg_return = sum(returns) / len(returns) * 252
    volatility = calculate_volatility(prices) / 100 * (252 ** 0.5)

    if volatility == 0:
        return 0

    return round((avg_return - risk_free_rate) / volatility, 4)
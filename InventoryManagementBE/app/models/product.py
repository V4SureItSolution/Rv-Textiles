from app import db
from datetime import datetime


class Product(db.Model):
    __tablename__ = "products"

    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(db.String(100), nullable=False)
    product_code = db.Column(db.String(50), unique=True, nullable=True)
    category = db.Column(db.String(100))
    unit = db.Column(db.String(50))

    buy_price = db.Column(db.Float, nullable=False)
    sell_price = db.Column(db.Float, nullable=False)
    quantity = db.Column(db.Integer, nullable=False)

    supplier_id = db.Column(db.Integer, db.ForeignKey('suppliers.id'), nullable=True)

    profit_percent = db.Column(db.Float)
    amount = db.Column(db.Float)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship to Supplier
    supplier = db.relationship('Supplier', backref='products', lazy=True)

    def calculate_values(self):
        if self.buy_price and self.buy_price > 0:
            self.profit_percent = round(
                ((self.sell_price - self.buy_price) / self.buy_price) * 100, 2
            )
        else:
            self.profit_percent = 0

        self.amount = round(self.sell_price * self.quantity, 2)

    def to_dict(self):
        supplier_name = None
        if self.supplier:
            supplier_name = f"{self.supplier.name} ({self.supplier.company})"

        return {
            "id": self.id,
            "name": self.name,
            "productCode": self.product_code,
            "category": self.category,
            "unit": self.unit,
            "buyPrice": self.buy_price,
            "sellPrice": self.sell_price,
            "quantity": self.quantity,
            "supplierId": self.supplier_id,
            "supplierName": supplier_name,
            "profitPercent": self.profit_percent,
            "amount": self.amount,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
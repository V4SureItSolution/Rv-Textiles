from app import db
from datetime import datetime


class Product(db.Model):
    __tablename__ = "products"

    id = db.Column(db.Integer, primary_key=True)

    name = db.Column(db.String(100), nullable=False)
    site_name = db.Column(db.String(100), nullable=True)
    product_code = db.Column(db.String(50), unique=True, nullable=True)
    category = db.Column(db.String(100))
    unit = db.Column(db.String(50))
    size = db.Column(db.String(50), nullable=True)
    colour = db.Column(db.String(50), nullable=True)
    fh_shirts = db.Column(db.String(50), nullable=True)
    style = db.Column(db.String(100), nullable=True)

    buy_price = db.Column(db.Float, nullable=False, default=0.0)
    sell_price = db.Column(db.Float, nullable=False, default=0.0)
    mrp = db.Column(db.Float, nullable=True)
    quantity = db.Column(db.Integer, nullable=False, default=0)

    supplier_id = db.Column(db.Integer, db.ForeignKey('suppliers.id'), nullable=True)

    profit_percent = db.Column(db.Float)
    amount = db.Column(db.Float)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship to Supplier
    supplier = db.relationship('Supplier', backref='products', lazy=True)

    def calculate_values(self):
        if self.mrp is not None and (self.sell_price is None or self.sell_price == 0.0):
            self.sell_price = self.mrp
        elif self.sell_price is not None and self.mrp is None:
            self.mrp = self.sell_price
        elif self.sell_price is None:
            self.sell_price = 0.0

        if self.buy_price and self.buy_price > 0:
            effective_sell = self.sell_price if (self.sell_price and self.sell_price > 0) else (self.mrp or 0.0)
            self.profit_percent = round(
                ((effective_sell - self.buy_price) / self.buy_price) * 100, 2
            )
        else:
            self.profit_percent = 0

        effective_val = self.mrp if (self.mrp is not None and self.mrp > 0) else (self.sell_price or 0.0)
        self.amount = round(effective_val * (self.quantity or 0), 2)

    def to_dict(self):
        supplier_name = None
        if self.supplier:
            supplier_name = f"{self.supplier.name} ({self.supplier.company})"

        return {
            "id": self.id,
            "name": self.name,
            "siteName": self.site_name or "",
            "site_name": self.site_name or "",
            "productCode": self.product_code or "",
            "barcode": self.product_code or "",
            "category": self.category or "",
            "unit": self.unit or "",
            "size": self.size or "",
            "colour": self.colour or "",
            "color": self.colour or "",
            "fhShirts": self.fh_shirts or "",
            "fh_shirts": self.fh_shirts or "",
            "style": self.style or "",
            "buyPrice": self.buy_price or 0.0,
            "sellPrice": self.sell_price or 0.0,
            "mrp": self.mrp if self.mrp is not None else (self.sell_price or 0.0),
            "quantity": self.quantity or 0,
            "qty": self.quantity or 0,
            "supplierId": self.supplier_id,
            "supplierName": supplier_name,
            "profitPercent": self.profit_percent,
            "amount": self.amount,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            # Backwards compatibility aliases
            "type": self.category or "",
            "model": self.product_code or "",
        }
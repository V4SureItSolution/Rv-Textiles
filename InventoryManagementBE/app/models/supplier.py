from app import db
from datetime import datetime

class Supplier(db.Model):
    __tablename__ = 'suppliers'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    company = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100))
    phone = db.Column(db.String(20))
    address = db.Column(db.Text)
    created_by = db.Column(db.Integer, db.ForeignKey('login.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    items = db.relationship('Item', backref='supplier', lazy=True, cascade='all, delete-orphan')
    
    def __repr__(self):
        return f"<Supplier {self.name} - {self.company}>"
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'company': self.company,
            'email': self.email,
            'phone': self.phone,
            'address': self.address,
            'created_by': self.created_by,
            'items': [item.to_dict() for item in self.items] if self.items else [],
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }


class Item(db.Model):
    __tablename__ = 'items'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    product_code = db.Column(db.String(50), nullable=True)   # SKU / product code
    category = db.Column(db.String(100), nullable=True)      # e.g. Cotton, Silk, Polyester
    unit = db.Column(db.String(50), nullable=True)           # e.g. Meters, Yards, Kilograms
    buy_price = db.Column(db.Float, nullable=False)
    supplier_id = db.Column(db.Integer, db.ForeignKey('suppliers.id'), nullable=False)

    status = db.Column(db.String(50), default="Active")
    attachment = db.Column(db.String(255))  # stores file path (pdf/excel/word)
    quantity = db.Column(db.Integer, default=0)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<Item {self.name} ({self.category or 'No Category'})>"
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'productCode': self.product_code or '',
            'category': self.category or '',
            'unit': self.unit or '',
            'buy_price': self.buy_price,
            'supplier_id': self.supplier_id,
            'status': self.status,
            'attachment': self.attachment,
            'quantity': self.quantity,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            # Backwards compatibility aliases
            'type': self.category or '',
            'model': self.product_code or '',
        }
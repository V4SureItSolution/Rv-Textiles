from flask import Blueprint, request, jsonify
from app.models.product import Product
from app.models.supplier import Supplier
from app import db
from flask_cors import CORS


product_bp = Blueprint("product_bp", __name__)
CORS(product_bp)

TEXTILE_CATEGORIES = [
    "Cotton", "Silk", "Polyester", "Linen", "Denim",
    "Wool", "Rayon", "Nylon", "Chiffon", "Georgette",
    "Velvet", "Satin", "Knit", "Fleece", "Other"
]

TEXTILE_UNITS = ["Meters", "Yards", "Kilograms", "Pieces", "Rolls", "Bundles", "Boxes"]


# Validation function
def validate_product_data(data):
    errors = []

    if not data.get('name'):
        errors.append('Product name is required')

    try:
        buy_price = float(data.get('buyPrice', 0))
        if buy_price < 0:
            errors.append('Purchase price cannot be negative')
    except (TypeError, ValueError):
        errors.append('Invalid purchase price')

    try:
        sell_price = float(data.get('sellPrice', 0))
        if sell_price < 0:
            errors.append('Selling price cannot be negative')
    except (TypeError, ValueError):
        errors.append('Invalid selling price')

    try:
        quantity = int(data.get('quantity', 0))
        if quantity < 0:
            errors.append('Quantity cannot be negative')
    except (TypeError, ValueError):
        errors.append('Invalid quantity')

    return errors


# ------------------ GET CATEGORIES & UNITS ------------------
@product_bp.route("/products/categories", methods=["GET"])
def get_categories():
    return jsonify({"categories": TEXTILE_CATEGORIES}), 200


@product_bp.route("/products/units", methods=["GET"])
def get_units():
    return jsonify({"units": TEXTILE_UNITS}), 200


# ------------------ CREATE PRODUCT ------------------
@product_bp.route("/products", methods=["POST"])
def create_product():
    try:
        data = request.get_json()

        errors = validate_product_data(data)
        if errors:
            return jsonify({"errors": errors}), 400

        # Check product_code uniqueness if provided (supports 'productCode' or 'model')
        product_code = (data.get('productCode') or data.get('model') or '').strip() or None
        if product_code:
            existing = Product.query.filter_by(product_code=product_code).first()
            if existing:
                return jsonify({"errors": [f"Product code '{product_code}' already exists"]}), 400

        supplier_id = data.get('supplierId') or None
        if supplier_id:
            supplier_id = int(supplier_id)
            if not db.session.get(Supplier, supplier_id):
                supplier_id = None

        category = (data.get("category") or data.get("type") or "").strip() or None
        unit = (data.get("unit") or "").strip() or None
        mrp = float(data.get("mrp")) if data.get("mrp") is not None and str(data.get("mrp")).strip() != "" else None

        product = Product(
            name=data.get("name", "").strip(),
            product_code=product_code,
            category=category,
            unit=unit,
            buy_price=float(data.get("buyPrice", 0)),
            sell_price=float(data.get("sellPrice", 0)),
            mrp=mrp,
            quantity=int(data.get("quantity", 0)),
            supplier_id=supplier_id,
        )

        product.calculate_values()
        db.session.add(product)
        db.session.commit()

        return jsonify(product.to_dict()), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400


# ------------------ GET ALL PRODUCTS ------------------
@product_bp.route("/products", methods=["GET"])
def get_products():
    try:
        from sqlalchemy import func

        page = request.args.get('page', 1, type=int)
        per_page = min(request.args.get('per_page', 10, type=int), 200)

        # --- Filter params ---
        category        = request.args.get('category')
        supplier_id     = request.args.get('supplier_id', type=int)
        unit            = request.args.get('unit')
        min_price       = request.args.get('min_price', type=float)
        max_price       = request.args.get('max_price', type=float)
        search          = request.args.get('search', '').strip()
        low_stock       = request.args.get('low_stock', '').lower() == 'true'
        low_stock_thres = request.args.get('low_stock_threshold', 5, type=int)

        # --- Sort params ---
        sort_by    = request.args.get('sort_by', 'created_at')
        sort_order = request.args.get('sort_order', 'desc').lower()

        # Shared filter helper — applied to both main query and aggregate query
        def apply_filters(q):
            if category:
                q = q.filter(Product.category == category)
            if supplier_id:
                q = q.filter(Product.supplier_id == supplier_id)
            if unit:
                q = q.filter(Product.unit == unit)
            if min_price is not None:
                q = q.filter(Product.sell_price >= min_price)
            if max_price is not None:
                q = q.filter(Product.sell_price <= max_price)
            if low_stock:
                q = q.filter(Product.quantity <= low_stock_thres)
            if search:
                q = q.filter(
                    db.or_(
                        Product.name.ilike(f'%{search}%'),
                        Product.product_code.ilike(f'%{search}%'),
                        Product.category.ilike(f'%{search}%'),
                    )
                )
            return q

        # --- Main query ---
        query = apply_filters(Product.query)

        # Sorting
        sort_column_map = {
            'name':           Product.name,
            'product_code':   Product.product_code,
            'category':       Product.category,
            'unit':           Product.unit,
            'buy_price':      Product.buy_price,
            'sell_price':     Product.sell_price,
            'quantity':       Product.quantity,
            'amount':         Product.amount,
            'profit_percent': Product.profit_percent,
            'created_at':     Product.created_at,
        }
        sort_col = sort_column_map.get(sort_by, Product.created_at)
        query = query.order_by(sort_col.desc() if sort_order == 'desc' else sort_col.asc())

        # --- Aggregate summary on the full filtered set (before pagination) ---
        agg = apply_filters(
            db.session.query(
                func.count(Product.id).label('total_products'),
                func.coalesce(func.sum(Product.quantity), 0).label('total_qty'),
                func.coalesce(func.sum(Product.amount), 0).label('total_value'),
                func.coalesce(func.avg(Product.sell_price), 0).label('avg_sell_price'),
            )
        ).first()

        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify({
            'items':          [p.to_dict() for p in pagination.items],
            'total':          pagination.total,
            'pages':          pagination.pages,
            'current_page':   page,
            'per_page':       per_page,
            'filter_summary': {
                'total_products': int(agg.total_products or 0),
                'total_qty':      int(agg.total_qty or 0),
                'total_value':    round(float(agg.total_value or 0), 2),
                'avg_sell_price': round(float(agg.avg_sell_price or 0), 2),
            },
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 400


# ------------------ GET SINGLE PRODUCT ------------------
@product_bp.route("/products/<int:id>", methods=["GET"])
def get_product(id):
    try:
        product = db.get_or_404(Product, id)
        return jsonify(product.to_dict()), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400


# ------------------ UPDATE PRODUCT ------------------
@product_bp.route("/products/<int:id>", methods=["PUT"])
def update_product(id):
    try:
        product = db.get_or_404(Product, id)
        data = request.get_json()

        if data.get('buyPrice') is not None or data.get('sellPrice') is not None or data.get('quantity') is not None:
            errors = validate_product_data({
                'name': data.get('name', product.name),
                'buyPrice': data.get('buyPrice', product.buy_price),
                'sellPrice': data.get('sellPrice', product.sell_price),
                'quantity': data.get('quantity', product.quantity),
            })
            if errors:
                return jsonify({"errors": errors}), 400

        if data.get('name') is not None:
            product.name = data['name'].strip()

        code_val = data.get('productCode') if 'productCode' in data else data.get('model')
        if code_val is not None:
            new_code = code_val.strip() or None
            if new_code and new_code != product.product_code:
                existing = Product.query.filter_by(product_code=new_code).first()
                if existing:
                    return jsonify({"errors": [f"Product code '{new_code}' already exists"]}), 400
            product.product_code = new_code

        category_val = data.get('category') if 'category' in data else data.get('type')
        if category_val is not None:
            product.category = category_val.strip() or None
        if 'unit' in data:
            product.unit = data['unit'].strip() or None
        if data.get('buyPrice') is not None:
            product.buy_price = float(data['buyPrice'])
        if data.get('sellPrice') is not None:
            product.sell_price = float(data['sellPrice'])
        if 'mrp' in data:
            product.mrp = float(data['mrp']) if data['mrp'] is not None and str(data['mrp']).strip() != '' else None
        if data.get('quantity') is not None:
            product.quantity = int(data['quantity'])

        if 'supplierId' in data:
            supplier_id = data['supplierId'] or None
            if supplier_id:
                supplier_id = int(supplier_id)
                if not db.session.get(Supplier, supplier_id):
                    supplier_id = None
            product.supplier_id = supplier_id

        product.calculate_values()
        db.session.commit()

        return jsonify(product.to_dict()), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400


# ------------------ DELETE PRODUCT ------------------
@product_bp.route("/products/<int:id>", methods=["DELETE"])
def delete_product(id):
    try:
        product = db.session.get(Product, id)
        if not product:
            return jsonify({"message": "Product already deleted"}), 200

        # Unlink product from historical items so past bills/invoices/quotations preserve snapshot data
        from app.models.billing import BillItem
        from app.models.invoice import InvoiceItem
        from app.models.quotation import QuotationItem

        BillItem.query.filter_by(product_id=id).update({'product_id': None})
        InvoiceItem.query.filter_by(product_id=id).update({'product_id': None})
        QuotationItem.query.filter_by(product_id=id).update({'product_id': None})

        db.session.delete(product)
        db.session.commit()
        return jsonify({"message": "Product deleted successfully"}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400


# ------------------ BULK CREATE PRODUCTS ------------------
@product_bp.route("/products/bulk", methods=["POST"])
def bulk_create_products():
    try:
        data = request.get_json()
        products = data.get('products', [])

        if not products:
            return jsonify({"error": "No products provided"}), 400

        created_products = []
        errors = []

        for idx, product_data in enumerate(products):
            try:
                validation_errors = validate_product_data(product_data)
                if validation_errors:
                    errors.append({'index': idx, 'errors': validation_errors, 'data': product_data})
                    continue

                product_code = product_data.get('productCode', '').strip() or None
                if product_code:
                    existing = Product.query.filter_by(product_code=product_code).first()
                    if existing:
                        existing.quantity += int(product_data.get('quantity', 0))
                        existing.calculate_values()
                        created_products.append(existing)
                        continue

                supplier_id = product_data.get('supplierId') or None
                if supplier_id:
                    supplier_id = int(supplier_id)

                product = Product(
                    name=product_data.get("name", "").strip(),
                    product_code=product_code,
                    category=product_data.get("category", "").strip() or None,
                    unit=product_data.get("unit", "").strip() or None,
                    buy_price=float(product_data.get("buyPrice", 0)),
                    sell_price=float(product_data.get("sellPrice", 0)),
                    quantity=int(product_data.get("quantity", 0)),
                    supplier_id=supplier_id,
                )

                product.calculate_values()
                db.session.add(product)
                created_products.append(product)

            except Exception as e:
                errors.append({'index': idx, 'error': str(e), 'data': product_data})

        if created_products:
            db.session.commit()

        return jsonify({
            'created': [p.to_dict() for p in created_products],
            'errors': errors,
            'total_created': len(created_products),
            'total_errors': len(errors)
        }), 201 if created_products else 400

    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 400


# ------------------ PRODUCT STATISTICS ------------------
@product_bp.route("/products/statistics", methods=["GET"])
def get_product_statistics():
    try:
        from sqlalchemy import func

        stats = db.session.query(
            func.count(Product.id).label('total_products'),
            func.sum(Product.quantity).label('total_quantity'),
            func.avg(Product.sell_price).label('avg_sell_price'),
            func.avg(Product.buy_price).label('avg_buy_price'),
            func.sum(Product.amount).label('total_value')
        ).first()

        category_counts = db.session.query(
            Product.category,
            func.count(Product.id).label('count')
        ).group_by(Product.category).all()

        unit_counts = db.session.query(
            Product.unit,
            func.count(Product.id).label('count')
        ).group_by(Product.unit).all()

        return jsonify({
            'total_products': stats.total_products or 0,
            'total_quantity': stats.total_quantity or 0,
            'average_sell_price': round(stats.avg_sell_price or 0, 2),
            'average_buy_price': round(stats.avg_buy_price or 0, 2),
            'total_inventory_value': round(stats.total_value or 0, 2),
            'products_by_category': [{'category': c[0] or 'Uncategorized', 'count': c[1]} for c in category_counts],
            'products_by_unit': [{'unit': u[0] or 'N/A', 'count': u[1]} for u in unit_counts],
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 400
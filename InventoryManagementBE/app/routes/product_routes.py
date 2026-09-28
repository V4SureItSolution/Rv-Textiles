from flask import Blueprint, request, jsonify
from app.models.product import Product
from app.models.supplier import Supplier
from app import db
from flask_cors import CORS


product_bp = Blueprint("product_bp", __name__)
CORS(product_bp)

TEXTILE_CATEGORIES = [
    # Men's
    "F-SHIRT", "H-SHIRT", "T..F SHIRT", "T..H SHIRT",
    "F PANT", "JEANS", "TRACKS", "SHORTS", "INNERS",
    # Ladies'
    "S -TOP", "2 PCS SET TOPS", "3-PCS SET TOP",
    "Cotton", "Silk", "Polyester", "Linen", "Denim", "Other",
]

TEXTILE_UNITS = ["Meters", "Yards", "Kilograms", "Pieces", "Rolls", "Bundles", "Boxes"]


# Validation function
def validate_product_data(data):
    errors = []

    # Name is optional now if category/style/barcode is present
    name = (data.get('name') or '').strip()
    category = (data.get('category') or data.get('type') or '').strip()
    barcode = (data.get('productCode') or data.get('barcode') or data.get('model') or '').strip()
    style = (data.get('style') or '').strip()

    if not name and not category and not barcode and not style:
        errors.append('Product identifier (name, category, style, or barcode) is required')

    try:
        buy_price = float(data.get('buyPrice', 0) or 0)
        if buy_price < 0:
            errors.append('Purchase price cannot be negative')
    except (TypeError, ValueError):
        errors.append('Invalid purchase price')

    try:
        sell_price = float(data.get('sellPrice', 0) or 0)
        if sell_price < 0:
            errors.append('Selling price cannot be negative')
    except (TypeError, ValueError):
        errors.append('Invalid selling price')

    try:
        quantity = int(data.get('quantity', 0) if data.get('quantity') is not None else (data.get('qty', 0) or 0))
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

        # Check product_code / barcode uniqueness if provided
        product_code = (data.get('productCode') or data.get('barcode') or data.get('model') or '').strip() or None
        if product_code:
            existing = Product.query.filter_by(product_code=product_code).first()
            if existing:
                return jsonify({"errors": [f"Barcode / Product code '{product_code}' already exists"]}), 400

        supplier_id = data.get('supplierId') or None
        if supplier_id:
            supplier_id = int(supplier_id)
            if not db.session.get(Supplier, supplier_id):
                supplier_id = None

        category = (data.get("category") or data.get("type") or "").strip() or None
        unit = (data.get("unit") or "").strip() or None
        site_name = (data.get("siteName") or data.get("site_name") or "").strip() or None
        size = (data.get("size") or "").strip() or None
        colour = (data.get("colour") or data.get("color") or "").strip() or None
        fh_shirts = (data.get("fhShirts") or data.get("fh_shirts") or "").strip() or None
        style = (data.get("style") or "").strip() or None

        mrp_raw = data.get("mrp")
        mrp = float(mrp_raw) if mrp_raw is not None and str(mrp_raw).strip() != "" else None

        sell_price_raw = data.get("sellPrice")
        sell_price = float(sell_price_raw) if sell_price_raw is not None and str(sell_price_raw).strip() != "" else (mrp or 0.0)

        buy_price_raw = data.get("buyPrice")
        buy_price = float(buy_price_raw) if buy_price_raw is not None and str(buy_price_raw).strip() != "" else 0.0

        quantity_raw = data.get("quantity") if data.get("quantity") is not None else data.get("qty")
        quantity = int(quantity_raw or 0)

        name = (data.get("name") or "").strip()
        if not name:
            parts = [p for p in [category, style, fh_shirts, size, colour] if p]
            name = " ".join(parts) if parts else (site_name or product_code or "Textile Item")

        product = Product(
            name=name,
            site_name=site_name,
            product_code=product_code,
            category=category,
            unit=unit,
            size=size,
            colour=colour,
            fh_shirts=fh_shirts,
            style=style,
            buy_price=buy_price,
            sell_price=sell_price,
            mrp=mrp,
            quantity=quantity,
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
        per_page = min(request.args.get('per_page', 10, type=int), 2000)

        # --- Filter params ---
        category        = request.args.get('category')
        supplier_id     = request.args.get('supplier_id', type=int)
        unit            = request.args.get('unit')
        site_name       = request.args.get('site_name') or request.args.get('siteName')
        size            = request.args.get('size')
        colour          = request.args.get('colour') or request.args.get('color')
        fh_shirts       = request.args.get('fh_shirts') or request.args.get('fhShirts')
        style           = request.args.get('style')
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
            if site_name:
                q = q.filter(Product.site_name.ilike(f'%{site_name}%'))
            if size:
                q = q.filter(Product.size.ilike(f'%{size}%'))
            if colour:
                q = q.filter(Product.colour.ilike(f'%{colour}%'))
            if fh_shirts:
                q = q.filter(Product.fh_shirts.ilike(f'%{fh_shirts}%'))
            if style:
                q = q.filter(Product.style.ilike(f'%{style}%'))
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
                        Product.site_name.ilike(f'%{search}%'),
                        Product.size.ilike(f'%{search}%'),
                        Product.colour.ilike(f'%{search}%'),
                        Product.fh_shirts.ilike(f'%{search}%'),
                        Product.style.ilike(f'%{search}%'),
                    )
                )
            return q

        # --- Main query ---
        query = apply_filters(Product.query)

        # Sorting
        sort_column_map = {
            'id':             Product.id,
            'name':           Product.name,
            'site_name':      Product.site_name,
            'siteName':       Product.site_name,
            'product_code':   Product.product_code,
            'barcode':        Product.product_code,
            'category':       Product.category,
            'unit':           Product.unit,
            'size':           Product.size,
            'colour':         Product.colour,
            'color':          Product.colour,
            'fh_shirts':      Product.fh_shirts,
            'fhShirts':       Product.fh_shirts,
            'style':          Product.style,
            'mrp':            Product.mrp,
            'buy_price':      Product.buy_price,
            'sell_price':     Product.sell_price,
            'quantity':       Product.quantity,
            'qty':            Product.quantity,
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

        if data.get('buyPrice') is not None or data.get('sellPrice') is not None or data.get('quantity') is not None or data.get('qty') is not None:
            errors = validate_product_data({
                'name': data.get('name', product.name),
                'category': data.get('category', product.category),
                'style': data.get('style', product.style),
                'productCode': data.get('productCode', product.product_code),
                'buyPrice': data.get('buyPrice', product.buy_price),
                'sellPrice': data.get('sellPrice', product.sell_price),
                'quantity': data.get('quantity', product.quantity) if data.get('quantity') is not None else data.get('qty', product.quantity),
            })
            if errors:
                return jsonify({"errors": errors}), 400

        if data.get('name') is not None:
            name_val = data['name'].strip()
            if name_val:
                product.name = name_val

        code_val = data.get('productCode') if 'productCode' in data else (data.get('barcode') if 'barcode' in data else data.get('model'))
        if code_val is not None:
            new_code = str(code_val).strip() or None
            if new_code and new_code != product.product_code:
                existing = Product.query.filter_by(product_code=new_code).first()
                if existing:
                    return jsonify({"errors": [f"Barcode / Product code '{new_code}' already exists"]}), 400
            product.product_code = new_code

        category_val = data.get('category') if 'category' in data else data.get('type')
        if category_val is not None:
            product.category = category_val.strip() or None
        if 'unit' in data:
            product.unit = data['unit'].strip() or None
        if 'siteName' in data or 'site_name' in data:
            product.site_name = (data.get('siteName') or data.get('site_name') or '').strip() or None
        if 'size' in data:
            product.size = (data.get('size') or '').strip() or None
        if 'colour' in data or 'color' in data:
            product.colour = (data.get('colour') or data.get('color') or '').strip() or None
        if 'fhShirts' in data or 'fh_shirts' in data:
            product.fh_shirts = (data.get('fhShirts') or data.get('fh_shirts') or '').strip() or None
        if 'style' in data:
            product.style = (data.get('style') or '').strip() or None

        if data.get('buyPrice') is not None:
            product.buy_price = float(data['buyPrice'] or 0)
        if data.get('sellPrice') is not None:
            product.sell_price = float(data['sellPrice'] or 0)
        if 'mrp' in data:
            product.mrp = float(data['mrp']) if data['mrp'] is not None and str(data['mrp']).strip() != '' else None
            if product.sell_price is None or product.sell_price == 0:
                product.sell_price = product.mrp or 0.0

        if data.get('quantity') is not None:
            product.quantity = int(data['quantity'])
        elif data.get('qty') is not None:
            product.quantity = int(data['qty'])

        if 'supplierId' in data:
            supplier_id = data['supplierId'] or None
            if supplier_id:
                supplier_id = int(supplier_id)
                if not db.session.get(Supplier, supplier_id):
                    supplier_id = None
            product.supplier_id = supplier_id

        # If name is still default or empty, construct meaningful name
        if not product.name or product.name == "Textile Item":
            parts = [p for p in [product.category, product.style, product.fh_shirts, product.size, product.colour] if p]
            if parts:
                product.name = " ".join(parts)

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

                product_code = (product_data.get('productCode') or product_data.get('barcode') or '').strip() or None
                if product_code:
                    existing = Product.query.filter_by(product_code=product_code).first()
                    if existing:
                        existing.quantity += int(product_data.get('quantity') or product_data.get('qty') or 0)
                        if product_data.get('siteName') or product_data.get('site_name'):
                            existing.site_name = product_data.get('siteName') or product_data.get('site_name')
                        if product_data.get('size'):
                            existing.size = product_data.get('size')
                        if product_data.get('colour') or product_data.get('color'):
                            existing.colour = product_data.get('colour') or product_data.get('color')
                        if product_data.get('fhShirts') or product_data.get('fh_shirts'):
                            existing.fh_shirts = product_data.get('fhShirts') or product_data.get('fh_shirts')
                        if product_data.get('style'):
                            existing.style = product_data.get('style')
                        if product_data.get('mrp') is not None:
                            existing.mrp = float(product_data.get('mrp'))
                        existing.calculate_values()
                        created_products.append(existing)
                        continue

                supplier_id = product_data.get('supplierId') or None
                if supplier_id:
                    supplier_id = int(supplier_id)

                category = (product_data.get("category") or "").strip() or None
                unit = (product_data.get("unit") or "").strip() or None
                site_name = (product_data.get("siteName") or product_data.get("site_name") or "").strip() or None
                size = (product_data.get("size") or "").strip() or None
                colour = (product_data.get("colour") or product_data.get("color") or "").strip() or None
                fh_shirts = (product_data.get("fhShirts") or product_data.get("fh_shirts") or "").strip() or None
                style = (product_data.get("style") or "").strip() or None

                mrp_raw = product_data.get("mrp")
                mrp = float(mrp_raw) if mrp_raw is not None and str(mrp_raw).strip() != "" else None
                sell_price = float(product_data.get("sellPrice") or mrp or 0)
                buy_price = float(product_data.get("buyPrice") or 0)
                quantity = int(product_data.get("quantity") or product_data.get("qty") or 0)

                name = (product_data.get("name") or "").strip()
                if not name:
                    parts = [p for p in [category, style, fh_shirts, size, colour] if p]
                    name = " ".join(parts) if parts else (site_name or product_code or "Textile Item")

                product = Product(
                    name=name,
                    site_name=site_name,
                    product_code=product_code,
                    category=category,
                    unit=unit,
                    size=size,
                    colour=colour,
                    fh_shirts=fh_shirts,
                    style=style,
                    buy_price=buy_price,
                    sell_price=sell_price,
                    mrp=mrp,
                    quantity=quantity,
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
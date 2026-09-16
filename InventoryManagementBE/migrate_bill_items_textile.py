"""
Textile Inventory — DB Migration for BillItem & Item tables.

Changes:
  bill_items:
    - rename product_model  -> product_category (VARCHAR 100)
    - rename product_type   -> product_unit     (VARCHAR 50)
    - add    product_code   (VARCHAR 50, NULL)

  items (supplier items):
    - drop  model, type, watts
    - add   product_code (VARCHAR 50, NULL)
    - add   category     (VARCHAR 100, NULL)
    - add   unit         (VARCHAR 50, NULL)

Run with:
    python migrate_bill_items_textile.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import re
import pymysql
from config import Config

db_url = Config.SQLALCHEMY_DATABASE_URI
m = re.match(r'mysql\+pymysql://([^:]+):([^@]+)@([^/]+)/(.+)', db_url)
user, password, host, database = m.group(1), m.group(2), m.group(3), m.group(4)

conn = pymysql.connect(host=host, user=user, password=password, database=database, charset='utf8mb4')
cursor = conn.cursor()
print(f"Connected to: {database}\n")


# Helper

def existing_columns(table):
    cursor.execute(f"DESCRIBE `{table}`")
    return {row[0] for row in cursor.fetchall()}

def run_alter(table, statements):
    if not statements:
        print(f"  [{table}] No changes needed.")
        return
    sql = f"ALTER TABLE `{table}` " + ", ".join(statements)
    print(f"  [{table}] Running: {sql}")
    cursor.execute(sql)
    conn.commit()
    print(f"  [{table}] Done.\n")


# 1. bill_items

print("=== bill_items ===")
cols = existing_columns("bill_items")
print(f"  Existing columns: {sorted(cols)}")

stmts = []

# Rename product_model -> product_category (if old column exists and new one doesn't)
if "product_model" in cols and "product_category" not in cols:
    stmts.append("CHANGE COLUMN `product_model` `product_category` VARCHAR(100) NULL")
elif "product_model" not in cols and "product_category" not in cols:
    stmts.append("ADD COLUMN `product_category` VARCHAR(100) NULL AFTER `product_name`")

# Rename product_type -> product_unit (if old column exists and new one doesn't)
if "product_type" in cols and "product_unit" not in cols:
    stmts.append("CHANGE COLUMN `product_type` `product_unit` VARCHAR(50) NULL")
elif "product_type" not in cols and "product_unit" not in cols:
    stmts.append("ADD COLUMN `product_unit` VARCHAR(50) NULL AFTER `product_category`")

# Add product_code if it doesn't exist
if "product_code" not in cols:
    stmts.append("ADD COLUMN `product_code` VARCHAR(50) NULL AFTER `product_name`")

run_alter("bill_items", stmts)


# 2. items (supplier items)

print("=== items ===")
cols = existing_columns("items")
print(f"  Existing columns: {sorted(cols)}")

stmts = []

# Drop electronics-era columns
for old_col in ["model", "type", "watts"]:
    if old_col in cols:
        stmts.append(f"DROP COLUMN `{old_col}`")

# Add textile columns
if "product_code" not in cols:
    stmts.append("ADD COLUMN `product_code` VARCHAR(50) NULL AFTER `name`")
if "category" not in cols:
    stmts.append("ADD COLUMN `category` VARCHAR(100) NULL AFTER `product_code`")
if "unit" not in cols:
    stmts.append("ADD COLUMN `unit` VARCHAR(50) NULL AFTER `category`")

run_alter("items", stmts)


# Final schema check

print("=== Final Schemas ===")
for table in ["bill_items", "items"]:
    cursor.execute(f"DESCRIBE `{table}`")
    print(f"\n  {table}:")
    for row in cursor.fetchall():
        print(f"    {row[0]:30} {row[1]}")

cursor.close()
conn.close()
print("\nMigration complete!")

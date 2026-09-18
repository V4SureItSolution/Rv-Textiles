"""
Direct SQL migration: updates products table from electronics to textile schema.
Run with: python migrate_textile.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import re
import pymysql
from config import Config

db_url = Config.SQLALCHEMY_DATABASE_URI
# Parse: mysql+pymysql://user:pass@host/dbname
m = re.match(r'mysql\+pymysql://([^:]+):([^@]+)@([^/]+)/(.+)', db_url)
user, password, host, database = m.group(1), m.group(2), m.group(3), m.group(4)

conn = pymysql.connect(host=host, user=user, password=password, database=database, charset='utf8mb4')
cursor = conn.cursor()
print("Connected to:", database)

cursor.execute("DESCRIBE products")
existing_cols = {row[0] for row in cursor.fetchall()}
print("Existing columns:", existing_cols)

drops, adds = [], []
for col in ['model', 'type', 'watts']:
    if col in existing_cols:
        drops.append(f"DROP COLUMN `{col}`")

new_cols = {
    'product_code': 'VARCHAR(50) NULL',
    'category': 'VARCHAR(100) NULL',
    'unit': 'VARCHAR(50) NULL',
    'supplier_id': 'INT NULL',
    'mrp': 'FLOAT NULL',
}
for col, defn in new_cols.items():
    if col not in existing_cols:
        adds.append(f"ADD COLUMN {col} {defn}")

changes = drops + adds
if changes:
    sql = "ALTER TABLE products " + ", ".join(changes)
    print("Running:", sql)
    cursor.execute(sql)
    conn.commit()
    print("Table updated successfully!")
else:
    print("No column changes needed.")

# Add foreign key only if supplier_id was just added
if 'supplier_id' not in existing_cols:
    try:
        cursor.execute("""
            ALTER TABLE products
            ADD CONSTRAINT fk_product_supplier
            FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
            ON DELETE SET NULL
        """)
        conn.commit()
        print("Foreign key fk_product_supplier added.")
    except Exception as e:
        print("FK note:", e)

# Clear stale alembic version
try:
    cursor.execute("DELETE FROM alembic_version")
    conn.commit()
    print("Cleared alembic_version.")
except Exception as e:
    print("alembic_version:", e)

cursor.execute("DESCRIBE products")
print("\nFinal schema:")
for row in cursor.fetchall():
    print(f"  {row[0]:25} {row[1]}")

cursor.close()
conn.close()
print("\nDone!")

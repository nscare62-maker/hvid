"""Create the plan purchase ledger table without changing other schema."""
from app import app
from extensions import db
from models import PlanPurchase


with app.app_context():
    PlanPurchase.__table__.create(bind=db.engine, checkfirst=True)
    print('Plan purchase ledger table is ready.')
"""
Shared Flask extensions — initialized here to avoid circular imports.
Import db and migrate from this module, NOT from app.py.
"""
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate

db      = SQLAlchemy()
migrate = Migrate()

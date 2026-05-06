import logging
from logging.config import fileConfig

from flask import current_app
from alembic import context
import sys
import os

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Import our database setup
from database import Base, engine
from models import User, Employee, Vehicle, Visitor, Approval, GateLog

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
fileConfig(config.config_file_name)
logger = logging.getLogger("alembic.env")


def get_engine():
    """Get the database engine - use our custom one"""
    return engine


def get_engine_url():
    """Get the database URL"""
    return get_engine().url.render_as_string(hide_password=False).replace("%", "%%")


# add your model's MetaData object here
# for 'autogenerate' support
target_metadata = Base.metadata

# Set the SQLAlchemy URL from our engine
config.set_main_option("sqlalchemy.url", get_engine_url())

# Target metadata for autogenerate
target_metadata = Base.metadata


def get_metadata():
    """Return target metadata for migrations"""
    return target_metadata


def run_migrations_offline():
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=get_metadata(), literal_binds=True)

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    """Run migrations in 'online' mode."""

    # this callback is used to prevent an auto-migration from being generated
    def process_revision_directives(context, revision, directives):
        if getattr(config.cmd_opts, "autogenerate", False):
            script = directives[0]
            if script.upgrade_ops.is_empty():
                directives[:] = []
                logger.info("No changes in schema detected.")

    conf_args = {}

    connectable = get_engine()

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=get_metadata(), **conf_args
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

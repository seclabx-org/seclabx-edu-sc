import logging
from app.db.session import engine
from app.models.base import Base
from app.db.init_db import migrate_resource_columns

logger = logging.getLogger(__name__)


def run_migrations_safely():
    """
    轻量自动迁移：
    - create_all 确保缺失表会创建（不会删除已有数据）
    - 调用 migrate_resource_columns 增量添加新列/默认值
    """
    try:
        Base.metadata.create_all(bind=engine)
        migrate_resource_columns()
        logger.info("Auto migration completed")
    except Exception as e:
        logger.exception("Auto migration failed: %s", e)
        raise

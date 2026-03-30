# import aici la toate modelele
#sqlalchemy le da register in Base.metadata
# alembic autogenerate detecteaza toate tabelele
# relatiile de tip string se rezolva

from app.models.base import Base, TimestampMixin, UUIDMixin  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.workspace import Workspace, WorkspaceMember  # noqa: F401
from app.models.api_key import ApiKey  # noqa: F401
from app.models.event import Event  # noqa: F401
from app.models.funnel import Funnel, FunnelResult  # noqa: F401
from app.models.retention import RetentionCohort  # noqa: F401
from app.models.anomaly import Anomaly  # noqa: F401
from app.models.report import Report  # noqa: F401
from app.models.saved_query import AiQuery, SavedQuery  # noqa: F401

__all__ = [
    "Base",
    "User",
    "Workspace",
    "WorkspaceMember",
    "ApiKey",
    "Event",
    "Funnel",
    "FunnelResult",
    "RetentionCohort",
    "Anomaly",
    "Report",
    "AiQuery",
    "SavedQuery",
]

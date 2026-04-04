import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AdditionalContact(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str = ""
    email: str = ""


class ClientBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str
    company_name: str = ""
    industry_vertical: str = ""
    company_address: str = ""
    additional_contacts: list[AdditionalContact] = []
    client_status: str = "active"
    primary_contact: str = ""
    contact_email: str = ""


class ClientCreate(ClientBase):
    pass


class ClientUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    name: str | None = None
    company_name: str | None = None
    industry_vertical: str | None = None
    company_address: str | None = None
    additional_contacts: list[AdditionalContact] | None = None
    client_status: str | None = None
    primary_contact: str | None = None
    contact_email: str | None = None


class ClientRead(ClientBase):
    id: uuid.UUID
    is_archived: bool
    archived_at: datetime | None
    created_at: datetime
    updated_at: datetime

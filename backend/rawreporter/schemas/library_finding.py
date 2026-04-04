import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from rawreporter.schemas.library_finding_reference import LibraryFindingReferenceRead
from rawreporter.utils.enums import SeverityEnum


class ImportPayload(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    report_id: uuid.UUID
    target_section_id: uuid.UUID | None = None


class LibraryFindingBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    title: str
    summary: str = ""
    observation: str = ""
    description_technical: str = ""
    description_executive: str = ""
    severity: SeverityEnum
    cvss_score_default: float | None = None
    recommendation: str = ""
    remediation_steps: str = ""
    remediation_steps_enabled: bool = True
    vertical: str = ""
    tags: list[str] = []
    framework_refs: list[str] = []
    questionnaire_trigger: list[str] = []
    is_ot_specific: bool = False
    ref_cve_enabled: bool = False
    ref_cwe_enabled: bool = False
    ref_cisa_enabled: bool = False
    ref_nist_enabled: bool = False
    ref_nvd_enabled: bool = False
    ref_manufacturer_enabled: bool = False


class LibraryFindingCreate(LibraryFindingBase):
    pass


class LibraryFindingUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    title: str | None = None
    summary: str | None = None
    observation: str | None = None
    description_technical: str | None = None
    description_executive: str | None = None
    severity: SeverityEnum | None = None
    cvss_score_default: float | None = None
    recommendation: str | None = None
    remediation_steps: str | None = None
    remediation_steps_enabled: bool | None = None
    vertical: str | None = None
    tags: list[str] | None = None
    framework_refs: list[str] | None = None
    questionnaire_trigger: list[str] | None = None
    is_ot_specific: bool | None = None
    ref_cve_enabled: bool | None = None
    ref_cwe_enabled: bool | None = None
    ref_cisa_enabled: bool | None = None
    ref_nist_enabled: bool | None = None
    ref_nvd_enabled: bool | None = None
    ref_manufacturer_enabled: bool | None = None


class LibraryFindingRead(LibraryFindingBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    references: list[LibraryFindingReferenceRead] = []
    is_archived: bool = False
    archived_at: datetime | None = None
    archived_by: uuid.UUID | None = None

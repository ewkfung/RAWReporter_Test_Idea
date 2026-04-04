import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, computed_field

from rawreporter.schemas.finding_reference import FindingReferenceRead
from rawreporter.schemas.report_section import ReportSectionRead
from rawreporter.utils.enums import SeverityEnum


class FindingBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    report_id: uuid.UUID
    section_id: uuid.UUID
    library_finding_id: uuid.UUID | None = None
    title: str
    summary: str = ""
    observation: str = ""
    description_technical: str = ""
    description_executive: str = ""
    severity_default: SeverityEnum
    severity_override: SeverityEnum | None = None
    cvss_score_default: float | None = None
    cvss_score_override: float | None = None
    recommendation: str = ""
    remediation_steps: str = ""
    remediation_steps_enabled: bool = True
    is_placement_override: bool = False
    override_justification: str | None = None
    position: int = 0
    is_ot_specific: bool = False
    ref_cve_enabled: bool = False
    ref_cwe_enabled: bool = False
    ref_cisa_enabled: bool = False
    ref_nist_enabled: bool = False
    ref_nvd_enabled: bool = False
    ref_manufacturer_enabled: bool = False


class FindingCreate(FindingBase):
    pass


class FindingUpdate(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    title: str | None = None
    summary: str | None = None
    observation: str | None = None
    recommendation: str | None = None
    remediation_steps: str | None = None
    remediation_steps_enabled: bool | None = None
    cvss_score_override: float | None = None
    severity_override: SeverityEnum | None = None
    override_justification: str | None = None
    ref_cve_enabled: bool | None = None
    ref_cwe_enabled: bool | None = None
    ref_cisa_enabled: bool | None = None
    ref_nist_enabled: bool | None = None
    ref_nvd_enabled: bool | None = None
    ref_manufacturer_enabled: bool | None = None


class FindingRefUpsert(BaseModel):
    ref_type: str
    identifier: str
    url: str | None = None
    description: str | None = None
    is_visible: bool = True


class FindingSeverityUpdate(BaseModel):
    new_severity: SeverityEnum


class FindingMoveRequest(BaseModel):
    target_section_id: uuid.UUID
    new_position: int


class FindingReorderRequest(BaseModel):
    new_position: int


class FindingRead(FindingBase):
    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
    references: list[FindingReferenceRead] = []

    @computed_field
    @property
    def severity_effective(self) -> SeverityEnum:
        return (
            self.severity_override
            if self.severity_override is not None
            else self.severity_default
        )


class FindingsBySectionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    section: ReportSectionRead
    findings: list[FindingRead]


class ImportResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    finding: FindingRead
    section: ReportSectionRead

"""
Seed script — creates test data for RAWReporter.

  5 clients
  5 engagements (one per client, one of each assessment type)
  10 reports  (2 per engagement / assessment type)
  15 library findings (3 per severity: critical, high, medium, low, informational)

Run from the backend directory:
    python seed_test_data.py
"""

import asyncio
from datetime import date

from rawreporter.database import AsyncSessionLocal

# Import all models so SQLAlchemy metadata is fully populated (FK resolution)
import rawreporter.auth.models  # noqa: F401
import rawreporter.models.audit_log  # noqa: F401
import rawreporter.models.client  # noqa: F401
import rawreporter.models.engagement  # noqa: F401
import rawreporter.models.evidence  # noqa: F401
import rawreporter.models.finding  # noqa: F401
import rawreporter.models.finding_reference  # noqa: F401
import rawreporter.models.library_finding  # noqa: F401
import rawreporter.models.library_finding_reference  # noqa: F401
import rawreporter.models.permission  # noqa: F401
import rawreporter.models.report  # noqa: F401
import rawreporter.models.report_default_template  # noqa: F401
import rawreporter.models.report_section  # noqa: F401
import rawreporter.models.role  # noqa: F401
import rawreporter.models.role_permission  # noqa: F401
import rawreporter.models.user_role  # noqa: F401

from rawreporter.models.client import Client
from rawreporter.models.engagement import Engagement
from rawreporter.models.library_finding import LibraryFinding
from rawreporter.models.report import Report
from rawreporter.services.report_service import seed_report_sections
from rawreporter.utils.enums import (
    EngagementStatusEnum,
    EngagementTypeEnum,
    ReportStatusEnum,
    SeverityEnum,
)

# ── Test clients ──────────────────────────────────────────────────────────────

CLIENTS = [
    {
        "name": "Apex Energy Group",
        "company_name": "Apex Energy Group LLC",
        "industry_vertical": "Oil & Gas",
        "primary_contact": "Sandra Hill",
        "contact_email": "sandra.hill@apexenergy.com",
    },
    {
        "name": "Meridian Water Authority",
        "company_name": "Meridian Water Authority",
        "industry_vertical": "Water & Wastewater",
        "primary_contact": "James Kowalski",
        "contact_email": "j.kowalski@meridianwater.gov",
    },
    {
        "name": "Nexus Manufacturing Co.",
        "company_name": "Nexus Manufacturing Co.",
        "industry_vertical": "Manufacturing",
        "primary_contact": "Priya Patel",
        "contact_email": "priya.patel@nexusmfg.com",
    },
    {
        "name": "Stonebridge Power",
        "company_name": "Stonebridge Power Inc.",
        "industry_vertical": "Electric Utilities",
        "primary_contact": "Marcus Reed",
        "contact_email": "m.reed@stonebridgepower.com",
    },
    {
        "name": "ClearPath Logistics",
        "company_name": "ClearPath Logistics Ltd.",
        "industry_vertical": "Transportation",
        "primary_contact": "Olivia Chen",
        "contact_email": "o.chen@clearpathlogistics.com",
    },
]

# ── Engagements — one per client, cycling through all 5 assessment types ──────

ENGAGEMENT_CONFIGS = [
    {
        "title": "2025 OT Vulnerability Assessment",
        "types": [EngagementTypeEnum.vulnerability_assessment],
        "status": EngagementStatusEnum.active,
        "start_date": date(2025, 1, 15),
        "end_date": date(2025, 3, 31),
    },
    {
        "title": "SCADA Penetration Test Q1 2025",
        "types": [EngagementTypeEnum.pentest],
        "status": EngagementStatusEnum.in_review,
        "start_date": date(2025, 2, 1),
        "end_date": date(2025, 4, 15),
    },
    {
        "title": "Enterprise Cyber Risk Assessment",
        "types": [EngagementTypeEnum.risk],
        "status": EngagementStatusEnum.active,
        "start_date": date(2025, 3, 1),
        "end_date": date(2025, 5, 30),
    },
    {
        "title": "NERC CIP Compliance Assessment",
        "types": [EngagementTypeEnum.compliance_assessment],
        "status": EngagementStatusEnum.delivered,
        "start_date": date(2024, 11, 1),
        "end_date": date(2025, 1, 31),
    },
    {
        "title": "ICS Security Gap Assessment",
        "types": [EngagementTypeEnum.gap_assessment],
        "status": EngagementStatusEnum.scoping,
        "start_date": date(2025, 4, 1),
        "end_date": date(2025, 6, 30),
    },
]

# ── Reports — 2 per engagement ────────────────────────────────────────────────

REPORT_PAIRS = [
    # Vulnerability Assessment reports
    ("VA Report — Apex Energy Group (Draft)",      ReportStatusEnum.draft),
    ("VA Report — Apex Energy Group (Review)",     ReportStatusEnum.review),
    # Pentest reports
    ("Pentest Report — Meridian Water Q1 2025",    ReportStatusEnum.editing),
    ("Pentest Report — Meridian Water (Final)",    ReportStatusEnum.final_review),
    # Risk Assessment reports
    ("Risk Assessment — Nexus Manufacturing",      ReportStatusEnum.draft),
    ("Risk Assessment — Nexus Manufacturing v2",   ReportStatusEnum.review),
    # Compliance Assessment reports
    ("NERC CIP Compliance Report 2024",            ReportStatusEnum.complete),
    ("NERC CIP Gap Findings Addendum",             ReportStatusEnum.editing),
    # Gap Assessment reports
    ("ICS Security Gap Report — ClearPath",        ReportStatusEnum.draft),
    ("ICS Gap Assessment — ClearPath (Review)",    ReportStatusEnum.review),
]

# ── Library findings — 3 per severity ────────────────────────────────────────

LIBRARY_FINDINGS = [
    # ── CRITICAL ──────────────────────────────────────────────────────────────
    {
        "severity": SeverityEnum.critical,
        "title": "Default Credentials on HMI Workstations",
        "summary": (
            "Human-Machine Interface (HMI) workstations were found to be using "
            "vendor-supplied default credentials. An attacker with network access "
            "could authenticate without any prior knowledge and gain full control "
            "over operational processes."
        ),
        "observation": (
            "During testing, three HMI workstations responded to login attempts "
            "using the credentials admin/admin and operator/operator. These "
            "credentials are publicly documented in vendor manuals."
        ),
        "recommendation": (
            "Immediately change all default credentials on HMI workstations. "
            "Enforce a strong password policy and implement multi-factor "
            "authentication where the platform supports it."
        ),
        "remediation_steps": (
            "1. Identify all HMI workstations using default credentials.\n"
            "2. Coordinate with the operations team to schedule change windows.\n"
            "3. Update credentials to unique, complex passwords.\n"
            "4. Document new credentials in a secured password vault.\n"
            "5. Verify login with new credentials and confirm no operational impact."
        ),
        "cvss_score_default": 9.8,
        "tags": ["HMI", "Authentication", "OT", "Default Credentials"],
        "is_ot_specific": True,
    },
    {
        "severity": SeverityEnum.critical,
        "title": "Unauthenticated Access to Engineering Workstation",
        "summary": (
            "An engineering workstation used for PLC programming was found to be "
            "accessible over the network without requiring authentication, exposing "
            "critical control logic to potential modification or exfiltration."
        ),
        "observation": (
            "The engineering workstation was reachable on TCP port 102 (S7comm) "
            "without any authentication challenge. Project files containing ladder "
            "logic could be read and written remotely."
        ),
        "recommendation": (
            "Restrict network access to engineering workstations using firewall "
            "rules. Enable authentication on all engineering software interfaces "
            "and disable unused remote protocols."
        ),
        "remediation_steps": (
            "1. Block inbound connections to port 102 at the firewall.\n"
            "2. Enable authentication within the engineering software configuration.\n"
            "3. Segment the engineering workstation on a dedicated VLAN.\n"
            "4. Implement host-based firewall rules as a secondary control.\n"
            "5. Review access logs for any unauthorized prior access."
        ),
        "cvss_score_default": 9.1,
        "tags": ["PLC", "Engineering Workstation", "S7comm", "OT"],
        "is_ot_specific": True,
    },
    {
        "severity": SeverityEnum.critical,
        "title": "Direct Internet Connectivity to OT Network",
        "summary": (
            "A direct routable path was identified between the corporate internet "
            "connection and the OT network, bypassing all perimeter security controls "
            "and exposing industrial control systems to external threats."
        ),
        "observation": (
            "A misconfigured firewall rule permitted unrestricted inbound traffic "
            "from any source to the OT VLAN subnet. This was confirmed by "
            "successfully routing traffic from an internet-hosted test system to "
            "a historian server within the OT environment."
        ),
        "recommendation": (
            "Immediately remove the permissive firewall rule and implement a "
            "deny-all inbound policy for the OT network. Establish a proper DMZ "
            "architecture with strict access controls."
        ),
        "remediation_steps": (
            "1. Identify and remove the misconfigured firewall rule.\n"
            "2. Conduct a full firewall rule audit across all zones.\n"
            "3. Implement a DMZ between corporate and OT networks.\n"
            "4. Deploy an IDS/IPS on the OT network boundary.\n"
            "5. Verify no other direct internet paths exist using network scanning."
        ),
        "cvss_score_default": 10.0,
        "tags": ["Firewall", "Network Segmentation", "Internet Exposure", "OT"],
        "is_ot_specific": True,
    },

    # ── HIGH ──────────────────────────────────────────────────────────────────
    {
        "severity": SeverityEnum.high,
        "title": "Unpatched Critical Vulnerabilities on SCADA Servers",
        "summary": (
            "SCADA servers were found running operating system and application "
            "software with known critical vulnerabilities that have publicly "
            "available exploits, significantly increasing the risk of compromise."
        ),
        "observation": (
            "Vulnerability scanning identified 14 CVEs rated Critical or High on "
            "two SCADA servers, including CVE-2021-34527 (PrintNightmare) and "
            "CVE-2020-0796 (SMBGhost), both with public exploit code available."
        ),
        "recommendation": (
            "Develop and implement a patch management program for OT systems. "
            "Prioritise patching of internet-exposed and network-accessible services. "
            "Where patching is not immediately possible, apply compensating controls."
        ),
        "remediation_steps": (
            "1. Catalogue all unpatched CVEs by severity and exploitability.\n"
            "2. Test patches in a non-production environment where possible.\n"
            "3. Apply critical patches within 30 days per the patching policy.\n"
            "4. Apply compensating controls (network isolation, monitoring) for systems that cannot be patched.\n"
            "5. Establish a recurring monthly patching review cycle."
        ),
        "cvss_score_default": 8.8,
        "tags": ["Patch Management", "SCADA", "CVE", "Vulnerability Management"],
        "is_ot_specific": True,
    },
    {
        "severity": SeverityEnum.high,
        "title": "Insufficient Network Segmentation Between IT and OT",
        "summary": (
            "The network boundary between the IT corporate environment and the OT "
            "operational environment was found to be inadequately segmented, allowing "
            "lateral movement from the IT network into OT systems."
        ),
        "observation": (
            "Assessment confirmed bidirectional routing between the IT LAN and OT "
            "network with no stateful firewall inspection. File-sharing protocols "
            "(SMB, NetBIOS) were reachable from IT hosts to OT servers."
        ),
        "recommendation": (
            "Implement a Purdue Model-aligned network architecture with stateful "
            "inspection at each zone boundary. Restrict cross-zone communication "
            "to only the minimum required data flows."
        ),
        "remediation_steps": (
            "1. Map all current IT-to-OT data flows and classify each as required or unnecessary.\n"
            "2. Deploy a next-generation firewall at the IT/OT boundary.\n"
            "3. Create explicit allow rules for required flows; deny all others.\n"
            "4. Disable SMB and NetBIOS at the OT network boundary.\n"
            "5. Conduct quarterly reviews of boundary rules."
        ),
        "cvss_score_default": 8.2,
        "tags": ["Network Segmentation", "IT/OT", "Lateral Movement", "Purdue Model"],
        "is_ot_specific": True,
    },
    {
        "severity": SeverityEnum.high,
        "title": "Cleartext Transmission of OT Protocol Data",
        "summary": (
            "Industrial control system communications were observed traversing "
            "the network in cleartext, allowing any host on the same network "
            "segment to intercept and potentially manipulate control commands."
        ),
        "observation": (
            "Packet capture confirmed that Modbus TCP communications between "
            "PLCs and the historian were unencrypted. Control setpoints and "
            "process values were readable in plaintext."
        ),
        "recommendation": (
            "Where protocol encryption is supported, enable it. Where it is not "
            "natively supported (e.g. legacy Modbus), implement network-level "
            "encryption using encrypted tunnels or VLANs with strict access controls."
        ),
        "remediation_steps": (
            "1. Identify all OT protocols in use and assess encryption support.\n"
            "2. Enable TLS/encryption on protocols that support it.\n"
            "3. For legacy protocols, isolate traffic to dedicated VLANs with strict ACLs.\n"
            "4. Evaluate encrypted tunnel solutions (e.g. IPSec) for high-risk links.\n"
            "5. Monitor for anomalous protocol traffic using an OT-aware IDS."
        ),
        "cvss_score_default": 7.5,
        "tags": ["Modbus", "Encryption", "Cleartext", "Protocol Security"],
        "is_ot_specific": True,
    },

    # ── MEDIUM ────────────────────────────────────────────────────────────────
    {
        "severity": SeverityEnum.medium,
        "title": "Lack of Multi-Factor Authentication for Remote Access",
        "summary": (
            "Remote access to OT systems relies solely on username and password "
            "authentication. The absence of multi-factor authentication (MFA) "
            "increases the risk of unauthorised access through credential theft or "
            "brute-force attacks."
        ),
        "observation": (
            "The VPN solution used for remote OT access was configured with "
            "password-only authentication. No MFA mechanism was enforced for "
            "any user account, including administrator accounts."
        ),
        "recommendation": (
            "Implement MFA for all remote access solutions connecting to OT "
            "environments. Prioritise privileged and administrative accounts."
        ),
        "remediation_steps": (
            "1. Assess the MFA capabilities of the current VPN solution.\n"
            "2. Select an appropriate MFA method (TOTP, hardware token, push notification).\n"
            "3. Enrol all remote access users in MFA.\n"
            "4. Update VPN configuration to enforce MFA at authentication.\n"
            "5. Revoke access for non-compliant accounts after grace period."
        ),
        "cvss_score_default": 6.5,
        "tags": ["MFA", "Remote Access", "VPN", "Authentication"],
        "is_ot_specific": False,
    },
    {
        "severity": SeverityEnum.medium,
        "title": "Inadequate Audit Logging on OT Assets",
        "summary": (
            "Audit logging was not consistently enabled across OT assets, limiting "
            "the ability to detect, investigate, and respond to security incidents "
            "within the operational environment."
        ),
        "observation": (
            "Of 22 OT assets reviewed, only 8 had audit logging enabled and "
            "forwarding events to a central log management system. PLC and RTU "
            "assets had no logging capability or configuration in place."
        ),
        "recommendation": (
            "Enable and centralise audit logging for all OT assets where technically "
            "feasible. For assets without native logging, deploy network-based "
            "monitoring to capture activity at the protocol level."
        ),
        "remediation_steps": (
            "1. Inventory all OT assets and document their logging capabilities.\n"
            "2. Enable local audit logging on all supported assets.\n"
            "3. Configure log forwarding to a centralised SIEM or log management system.\n"
            "4. Deploy an OT network monitoring solution for assets without logging.\n"
            "5. Define log retention policies meeting regulatory requirements."
        ),
        "cvss_score_default": 5.3,
        "tags": ["Logging", "Audit", "SIEM", "Monitoring", "OT"],
        "is_ot_specific": True,
    },
    {
        "severity": SeverityEnum.medium,
        "title": "Outdated Antivirus Signatures on Engineering Workstations",
        "summary": (
            "Engineering workstations were found running antivirus software with "
            "signature definitions that had not been updated in over 90 days, "
            "reducing the effectiveness of malware detection."
        ),
        "observation": (
            "Antivirus software on four engineering workstations had definitions "
            "dated more than 90 days old. One workstation had definitions from "
            "over 180 days ago. The update mechanism was manually managed with "
            "no automated update schedule."
        ),
        "recommendation": (
            "Implement automated antivirus signature update processes for all "
            "engineering workstations. Establish a maximum update lag policy "
            "(e.g. 7 days) and monitor compliance."
        ),
        "remediation_steps": (
            "1. Manually update antivirus definitions on all affected workstations immediately.\n"
            "2. Configure automatic update schedules for antivirus software.\n"
            "3. If workstations are air-gapped, establish an offline update process.\n"
            "4. Set alerts for definitions older than 7 days.\n"
            "5. Include antivirus currency in the monthly vulnerability review."
        ),
        "cvss_score_default": 5.0,
        "tags": ["Antivirus", "Endpoint Protection", "Engineering Workstation"],
        "is_ot_specific": True,
    },

    # ── LOW ───────────────────────────────────────────────────────────────────
    {
        "severity": SeverityEnum.low,
        "title": "Insecure USB Port Policy on OT Workstations",
        "summary": (
            "USB ports on OT workstations were not restricted by policy or "
            "technical control, allowing any removable media to be connected "
            "and potentially introducing malware or facilitating data exfiltration."
        ),
        "observation": (
            "During physical inspection, USB ports on control room workstations "
            "were found active and accessible. No group policy or endpoint "
            "control tool was configured to restrict removable media use."
        ),
        "recommendation": (
            "Disable unused USB ports through group policy or endpoint management "
            "tools. Where USB access is operationally required, implement "
            "application whitelisting for approved devices only."
        ),
        "remediation_steps": (
            "1. Identify workstations where USB access is operationally required.\n"
            "2. Disable USB storage on all workstations where it is not required.\n"
            "3. Implement removable media whitelisting for authorised devices.\n"
            "4. Physically block unused USB ports with port blockers as a supplementary control.\n"
            "5. Establish a removable media usage procedure and train staff."
        ),
        "cvss_score_default": 4.0,
        "tags": ["USB", "Removable Media", "Endpoint", "Physical Security"],
        "is_ot_specific": False,
    },
    {
        "severity": SeverityEnum.low,
        "title": "Lack of Asset Inventory for OT Environment",
        "summary": (
            "A comprehensive, up-to-date asset inventory for the OT environment "
            "was not maintained, hindering vulnerability management, incident "
            "response, and change management activities."
        ),
        "observation": (
            "The organisation could not produce an accurate inventory of OT assets "
            "during the assessment. An outdated spreadsheet was provided that "
            "was missing 30% of the assets identified during network discovery."
        ),
        "recommendation": (
            "Establish and maintain a formal OT asset register. Use passive network "
            "discovery tools to automatically detect and catalogue OT assets. "
            "Review and update the inventory on a quarterly basis."
        ),
        "remediation_steps": (
            "1. Conduct a full passive network scan to enumerate all OT assets.\n"
            "2. Record each asset with: IP, MAC, hostname, firmware version, owner, and criticality.\n"
            "3. Integrate asset discovery with an OT-aware asset management platform.\n"
            "4. Assign asset ownership and review responsibilities.\n"
            "5. Schedule quarterly asset inventory reviews."
        ),
        "cvss_score_default": 3.5,
        "tags": ["Asset Inventory", "Asset Management", "OT", "Visibility"],
        "is_ot_specific": True,
    },
    {
        "severity": SeverityEnum.low,
        "title": "No Formal OT Incident Response Plan",
        "summary": (
            "The organisation lacked a documented incident response plan specific "
            "to the OT environment, increasing the risk of delayed or ineffective "
            "response to cyber incidents affecting operational systems."
        ),
        "observation": (
            "Interviews with operations and IT staff confirmed that no OT-specific "
            "incident response plan existed. The existing IT incident response "
            "procedure had not been adapted for OT scenarios or constraints."
        ),
        "recommendation": (
            "Develop and implement an OT-specific incident response plan that "
            "accounts for operational constraints, safety implications, and the "
            "unique nature of ICS incidents. Conduct annual tabletop exercises."
        ),
        "remediation_steps": (
            "1. Review existing IT incident response plan for applicability to OT.\n"
            "2. Engage OT operations staff in developing OT-specific playbooks.\n"
            "3. Define OT incident severity levels and escalation paths.\n"
            "4. Include steps for isolating affected OT segments without disrupting operations.\n"
            "5. Conduct a tabletop exercise within 6 months of plan completion."
        ),
        "cvss_score_default": 3.1,
        "tags": ["Incident Response", "OT", "Governance", "Policy"],
        "is_ot_specific": True,
    },

    # ── INFORMATIONAL ─────────────────────────────────────────────────────────
    {
        "severity": SeverityEnum.informational,
        "title": "OT Security Awareness Training Not Formalised",
        "summary": (
            "No formal OT-specific security awareness training programme was in "
            "place for staff with access to industrial control systems. General "
            "IT security training was available but did not address OT-specific "
            "threats and procedures."
        ),
        "observation": (
            "Interviews with operations staff revealed limited awareness of OT "
            "cyber threats such as phishing targeting control system operators, "
            "removable media risks, and insider threat indicators specific to "
            "the OT environment."
        ),
        "recommendation": (
            "Develop and deliver OT-specific security awareness training for all "
            "staff with access to industrial systems. Include content on phishing, "
            "removable media, social engineering, and OT incident reporting."
        ),
        "remediation_steps": (
            "1. Define target audience for OT security awareness training.\n"
            "2. Develop or procure OT-specific training content.\n"
            "3. Deliver initial training to all target staff within 6 months.\n"
            "4. Schedule annual refresher training.\n"
            "5. Track completion and report to management."
        ),
        "cvss_score_default": None,
        "tags": ["Security Awareness", "Training", "OT", "Human Factor"],
        "is_ot_specific": True,
    },
    {
        "severity": SeverityEnum.informational,
        "title": "OT Cybersecurity Policy Not Documented",
        "summary": (
            "The organisation did not have a documented OT cybersecurity policy "
            "defining security requirements, responsibilities, and acceptable use "
            "for the industrial control system environment."
        ),
        "observation": (
            "A review of governance documentation confirmed no OT-specific "
            "cybersecurity policy existed. Relevant IT policies did not address "
            "OT constraints such as availability prioritisation, patching windows, "
            "or change management for control systems."
        ),
        "recommendation": (
            "Develop an OT cybersecurity policy aligned with IEC 62443 or NIST "
            "SP 800-82 principles. Obtain executive sponsorship and publish "
            "the policy to all relevant staff."
        ),
        "remediation_steps": (
            "1. Review applicable standards (IEC 62443, NIST SP 800-82, NERC CIP) for policy requirements.\n"
            "2. Draft OT cybersecurity policy with input from operations, IT, and management.\n"
            "3. Submit policy for legal and executive review.\n"
            "4. Publish policy and communicate to all affected staff.\n"
            "5. Schedule annual policy reviews and updates."
        ),
        "cvss_score_default": None,
        "tags": ["Policy", "Governance", "IEC 62443", "NIST SP 800-82", "OT"],
        "is_ot_specific": True,
    },
    {
        "severity": SeverityEnum.informational,
        "title": "Wireless Access Points Identified in Proximity to OT Network",
        "summary": (
            "Wireless access points were identified in areas adjacent to the OT "
            "environment. While no direct connectivity to OT systems was confirmed, "
            "the presence of wireless infrastructure near operational areas "
            "introduces potential risk vectors."
        ),
        "observation": (
            "Two wireless access points were observed physically mounted in the "
            "control room corridor. Signal strength was sufficient to reach the "
            "control room floor. The access points were associated with the "
            "corporate Wi-Fi network."
        ),
        "recommendation": (
            "Review the placement and necessity of wireless access points near "
            "OT environments. Ensure wireless networks are logically separated "
            "from OT systems. Consider signal containment measures where wireless "
            "is required near sensitive areas."
        ),
        "remediation_steps": (
            "1. Survey wireless access point placement and coverage near OT areas.\n"
            "2. Confirm no logical connectivity exists between wireless and OT networks.\n"
            "3. Evaluate relocating access points away from OT areas where possible.\n"
            "4. Implement wireless intrusion detection to alert on rogue access points.\n"
            "5. Document approved wireless infrastructure as part of the asset inventory."
        ),
        "cvss_score_default": None,
        "tags": ["Wireless", "Wi-Fi", "Physical Security", "OT", "Observation"],
        "is_ot_specific": False,
    },
]


# ── Seed function ─────────────────────────────────────────────────────────────

async def seed() -> None:
    async with AsyncSessionLocal() as session:
        print("Seeding test data…")

        # 1. Clients
        print("  Creating 5 clients…")
        clients: list[Client] = []
        for data in CLIENTS:
            client = Client(**data)
            session.add(client)
            clients.append(client)
        await session.flush()

        # 2. Engagements — one per client, one of each type
        print("  Creating 5 engagements…")
        engagements: list[Engagement] = []
        for client, cfg in zip(clients, ENGAGEMENT_CONFIGS):
            eng = Engagement(
                client_id=client.id,
                title=cfg["title"],
                types=[t.value for t in cfg["types"]],
                status=cfg["status"],
                start_date=cfg["start_date"],
                end_date=cfg["end_date"],
            )
            session.add(eng)
            engagements.append(eng)
        await session.flush()

        # 3. Reports — 2 per engagement (pairs list is ordered to match engagements)
        print("  Creating 10 reports with seeded sections…")
        report_index = 0
        for eng in engagements:
            eng_type = EngagementTypeEnum(eng.types[0])
            for _ in range(2):
                title, report_status = REPORT_PAIRS[report_index]
                report = Report(
                    engagement_id=eng.id,
                    title=title,
                    status=report_status,
                    types=eng.types,
                    start_date=eng.start_date,
                    end_date=eng.end_date,
                )
                session.add(report)
                await session.flush()
                await seed_report_sections(report.id, eng_type, session)
                report_index += 1

        # 4. Library findings — 3 per severity (15 total)
        print("  Creating 15 library findings (3 per severity)…")
        for data in LIBRARY_FINDINGS:
            finding = LibraryFinding(
                title=data["title"],
                summary=data["summary"],
                observation=data["observation"],
                recommendation=data["recommendation"],
                remediation_steps=data["remediation_steps"],
                severity=data["severity"],
                cvss_score_default=data["cvss_score_default"],
                tags=data["tags"],
                is_ot_specific=data["is_ot_specific"],
                remediation_steps_enabled=True,
            )
            session.add(finding)

        await session.commit()
        print("Done. Test data seeded successfully.")
        print(f"  {len(clients)} clients")
        print(f"  {len(engagements)} engagements")
        print(f"  {report_index} reports (sections auto-seeded per engagement type)")
        print(f"  {len(LIBRARY_FINDINGS)} library findings")


if __name__ == "__main__":
    asyncio.run(seed())

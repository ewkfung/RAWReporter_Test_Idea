import { create } from "zustand";
import type { Finding, ReportSection } from "../types/models";

interface ReportBuilderState {
  activeReportId: string | null;
  sections: ReportSection[];
  findingsBySection: Record<string, Finding[]>;

  setReport: (
    id: string,
    sections: ReportSection[],
    findingsBySection: Record<string, Finding[]>
  ) => void;

  moveSection: (fromIndex: number, toIndex: number) => void;

  moveFinding: (findingId: string, targetSectionId: string, newPosition: number) => void;

  reorderFinding: (findingId: string, newPosition: number) => void;

  updateFinding: (finding: Finding) => void;

  removeFinding: (findingId: string) => void;

  addFindings: (sectionId: string, findings: Finding[]) => void;

  reset: () => void;
}

export const useReportBuilderStore = create<ReportBuilderState>((set) => ({
  activeReportId: null,
  sections: [],
  findingsBySection: {},

  setReport: (id, sections, findingsBySection) =>
    set({ activeReportId: id, sections, findingsBySection }),

  moveSection: (fromIndex, toIndex) =>
    set((state) => {
      const sections = [...state.sections];
      const [moved] = sections.splice(fromIndex, 1);
      sections.splice(toIndex, 0, moved);
      return { sections };
    }),

  moveFinding: (findingId, targetSectionId, newPosition) =>
    set((state) => {
      const fbs = { ...state.findingsBySection };

      // Find and remove from current section
      let movingFinding: Finding | undefined;
      for (const sectionId of Object.keys(fbs)) {
        const idx = fbs[sectionId].findIndex((f) => f.id === findingId);
        if (idx !== -1) {
          movingFinding = fbs[sectionId][idx];
          fbs[sectionId] = fbs[sectionId].filter((f) => f.id !== findingId);
          break;
        }
      }
      if (!movingFinding) return state;

      // Insert into target section at newPosition
      const updated = { ...movingFinding, section_id: targetSectionId };
      const target = [...(fbs[targetSectionId] ?? [])];
      target.splice(newPosition - 1, 0, updated);
      fbs[targetSectionId] = target.map((f, i) => ({ ...f, position: i + 1 }));

      return { findingsBySection: fbs };
    }),

  reorderFinding: (findingId, newPosition) =>
    set((state) => {
      const fbs = { ...state.findingsBySection };
      for (const sectionId of Object.keys(fbs)) {
        const idx = fbs[sectionId].findIndex((f) => f.id === findingId);
        if (idx !== -1) {
          const findings = [...fbs[sectionId]];
          const [f] = findings.splice(idx, 1);
          findings.splice(newPosition - 1, 0, f);
          fbs[sectionId] = findings.map((fi, i) => ({ ...fi, position: i + 1 }));
          break;
        }
      }
      return { findingsBySection: fbs };
    }),

  updateFinding: (finding) =>
    set((state) => {
      const fbs = { ...state.findingsBySection };
      for (const sectionId of Object.keys(fbs)) {
        const idx = fbs[sectionId].findIndex((f) => f.id === finding.id);
        if (idx !== -1) {
          // If section changed, move it
          if (finding.section_id !== sectionId) {
            fbs[sectionId] = fbs[sectionId].filter((f) => f.id !== finding.id);
            const target = [...(fbs[finding.section_id] ?? [])];
            target.push(finding);
            fbs[finding.section_id] = target.sort((a, b) => a.position - b.position);
          } else {
            fbs[sectionId] = fbs[sectionId].map((f) => (f.id === finding.id ? finding : f));
          }
          break;
        }
      }
      return { findingsBySection: fbs };
    }),

  removeFinding: (findingId) =>
    set((state) => {
      const fbs = { ...state.findingsBySection };
      for (const sectionId of Object.keys(fbs)) {
        const idx = fbs[sectionId].findIndex((f) => f.id === findingId);
        if (idx !== -1) {
          fbs[sectionId] = fbs[sectionId].filter((f) => f.id !== findingId);
          break;
        }
      }
      return { findingsBySection: fbs };
    }),

  addFindings: (sectionId, findings) =>
    set((state) => {
      const existing = state.findingsBySection[sectionId] ?? [];
      const merged = [...existing, ...findings].sort((a, b) => a.position - b.position);
      return {
        findingsBySection: { ...state.findingsBySection, [sectionId]: merged },
      };
    }),

  reset: () =>
    set({ activeReportId: null, sections: [], findingsBySection: {} }),
}));

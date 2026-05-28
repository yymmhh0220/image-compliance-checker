import { create } from 'zustand';
import type { ComplianceReport } from '../types';

export interface ReportState {
  // State
  reports: Map<string, ComplianceReport>;
  isAnalyzing: boolean;

  // Actions
  setReport: (imageId: string, report: ComplianceReport) => void;
  removeReport: (imageId: string) => void;
  setAnalyzing: (isAnalyzing: boolean) => void;
}

export const useReportStore = create<ReportState>((set) => ({
  reports: new Map(),
  isAnalyzing: false,

  setReport: (imageId, report) =>
    set((state) => {
      const newReports = new Map(state.reports);
      newReports.set(imageId, report);
      return { reports: newReports };
    }),

  removeReport: (imageId) =>
    set((state) => {
      const newReports = new Map(state.reports);
      newReports.delete(imageId);
      return { reports: newReports };
    }),

  setAnalyzing: (isAnalyzing) =>
    set({ isAnalyzing }),
}));

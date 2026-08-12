import type { AppRole } from "@/hooks/use-role";

export const ADVANCE_TYPES = [
  { value: "salary", label: "Salary Advance" },
  { value: "emergency", label: "Emergency Advance" },
  { value: "festival", label: "Festival Advance" },
  { value: "tool", label: "Tool Advance" },
  { value: "travel", label: "Travel Advance" },
] as const;

export type AdvanceType = typeof ADVANCE_TYPES[number]["value"];

export const advanceTypeLabel = (v?: string | null) =>
  ADVANCE_TYPES.find(t => t.value === v)?.label ?? (v ?? "—");

/**
 * Approval matrix
 *   ≤ ₹5,000              → Labour Incharge
 *   ₹5,001 – ₹20,000      → Project Manager
 *   > ₹20,000             → HR + Accounts (both required, sequentially)
 */
export interface ApprovalStep {
  step: number;
  role: AppRole;
  label: string;
}

export function requiredApprovals(amount: number): ApprovalStep[] {
  if (!amount || amount <= 0) return [];
  if (amount <= 5000) return [{ step: 1, role: "labour_incharge", label: "Labour Incharge" }];
  if (amount <= 20000) return [{ step: 1, role: "project_manager", label: "Project Manager" }];
  return [
    { step: 1, role: "hr", label: "HR" },
    { step: 2, role: "accounts", label: "Accounts" },
  ];
}

/** Given the approvals already recorded, return the next required step (or null when complete). */
export function nextApprovalStep(
  amount: number,
  approvals: Array<{ step: number; decision: string }>,
): ApprovalStep | null {
  const required = requiredApprovals(amount);
  const approved = approvals.filter(a => a.decision === "approved").map(a => a.step);
  return required.find(s => !approved.includes(s.step)) ?? null;
}

export function advanceStatusTone(s: string): "success" | "warning" | "danger" | "neutral" {
  if (s === "approved" || s === "disbursed" || s === "repaid") return "success";
  if (s === "rejected") return "danger";
  return "warning";
}

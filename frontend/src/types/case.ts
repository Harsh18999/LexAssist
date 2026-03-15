export type CaseStatus = "pending" | "disposed" | "dismissed" | "allowed" | "stay_granted" | "withdrawn" | "settled";
export type CasePriority = "low" | "normal" | "high" | "urgent";
export type CourtLevel = "district" | "sessions" | "high_court" | "supreme_court" | "tribunal" | "";
export type CaseType = "criminal" | "civil" | "administrative" | "other";
export type PartyType = "plaintiff" | "defendant" | "complainant" | "accused" | "petitioner" | "respondent";

export interface Case {
    id: string;
    client: string;
    client_name: string;
    case_title: string;
    case_number: string;
    cnr_number: string;
    case_type: CaseType;
    act_name: string;
    primary_section: string;
    filing_date: string | null;
    registration_date: string | null;
    current_stage: string;
    status: CaseStatus;
    priority_level: CasePriority;
    limitation_end_date: string | null;
    court_level: CourtLevel;
    description: string;
    created_at: string;
    updated_at: string;
}

export type CaseCreatePayload = Omit<Case, "id" | "created_at" | "updated_at" | "client_name">;

export interface CaseCourtDetail {
    id: string;
    case: string;
    court_name: string;
    court_complex: string;
    judge_name: string;
    bench_type: string;
    courtroom_number: string;
    state: string;
    district: string;
}

export interface CaseParty {
    id: string;
    case: string;
    party_name: string;
    party_type: PartyType;
    contact_number: string;
    email: string;
    address: string;
}

export interface CaseStatusHistory {
    id: string;
    case: string;
    status: string;
    remarks: string;
    updated_by: number | null;
    updated_at: string;
}

export interface CaseStage {
    id: string;
    case: string;
    stage_name: string;
    started_at: string | null;
    ended_at: string | null;
    notes: string;
}

export interface CaseAppeal {
    id: string;
    parent_case: string;
    appeal_case: string;
    appeal_level: string;
    filed_on: string | null;
}

export interface CaseFinancialSummary {
    id?: number;
    case: string;
    total_fee: string;
    total_received: string;
    total_expenses: string;
    outstanding_amount: string;
}

export const STATUS_LABELS: Record<CaseStatus, string> = {
    pending: "Pending",
    disposed: "Disposed",
    dismissed: "Dismissed",
    allowed: "Allowed",
    stay_granted: "Stay Granted",
    withdrawn: "Withdrawn",
    settled: "Settled",
};

export const STATUS_COLORS: Record<CaseStatus, string> = {
    pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    disposed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    dismissed: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
    allowed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
    stay_granted: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    withdrawn: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    settled: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
};

export const PRIORITY_LABELS: Record<CasePriority, string> = {
    low: "Low",
    normal: "Normal",
    high: "High",
    urgent: "Urgent",
};

export const PRIORITY_COLORS: Record<CasePriority, string> = {
    low: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    normal: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    high: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

export const COURT_LEVEL_LABELS: Record<string, string> = {
    district: "District Court",
    sessions: "Sessions Court",
    high_court: "High Court",
    supreme_court: "Supreme Court",
    tribunal: "Tribunal",
};

export const CASE_TYPE_LABELS: Record<CaseType, string> = {
    criminal: "Criminal",
    civil: "Civil",
    administrative: "Administrative",
    other: "Other",
};

export const PARTY_TYPE_LABELS: Record<PartyType, string> = {
    plaintiff: "Plaintiff",
    defendant: "Defendant",
    complainant: "Complainant",
    accused: "Accused",
    petitioner: "Petitioner",
    respondent: "Respondent",
};

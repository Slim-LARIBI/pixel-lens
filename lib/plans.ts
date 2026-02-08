import { WorkspacePlan, ScanProfile } from "@prisma/client";

export interface PlanLimits {
  name: string;
  scansPerMonth: number;
  allowedProfiles: ScanProfile[];
  canCreateShareLinks: boolean;
  canPasswordProtect: boolean;
  canCustomizeBranding: boolean;
  canExport: boolean;
  canCompareScans: boolean;
  maxTeamMembers: number;
  price: {
    monthly: number;
    yearly: number;
  };
}

export const PLAN_LIMITS: Record<WorkspacePlan, PlanLimits> = {
  [WorkspacePlan.FREE]: {
    name: "Free",
    scansPerMonth: 5,
    allowedProfiles: [ScanProfile.QUICK],
    canCreateShareLinks: false,
    canPasswordProtect: false,
    canCustomizeBranding: false,
    canExport: false,
    canCompareScans: false,
    maxTeamMembers: 1,
    price: {
      monthly: 0,
      yearly: 0,
    },
  },
  [WorkspacePlan.STARTER]: {
    name: "Starter",
    scansPerMonth: 50,
    allowedProfiles: [ScanProfile.QUICK, ScanProfile.STANDARD],
    canCreateShareLinks: true,
    canPasswordProtect: false,
    canCustomizeBranding: true,
    canExport: true,
    canCompareScans: false,
    maxTeamMembers: 3,
    price: {
      monthly: 49,
      yearly: 490,
    },
  },
  [WorkspacePlan.PRO]: {
    name: "Pro",
    scansPerMonth: 300,
    allowedProfiles: [ScanProfile.QUICK, ScanProfile.STANDARD, ScanProfile.DEEP],
    canCreateShareLinks: true,
    canPasswordProtect: true,
    canCustomizeBranding: true,
    canExport: true,
    canCompareScans: true,
    maxTeamMembers: 10,
    price: {
      monthly: 149,
      yearly: 1490,
    },
  },
};

export function getPlanLimits(plan: WorkspacePlan): PlanLimits {
  return PLAN_LIMITS[plan];
}

export function canUseProfile(plan: WorkspacePlan, profile: ScanProfile): boolean {
  return PLAN_LIMITS[plan].allowedProfiles.includes(profile);
}

import { ResidentProfile } from "./types";

/**
 * Prototype stand-in for a logged-in resident. In production this comes from
 * auth / the property's resident roster, so name and unit are never retyped.
 */
export const DEMO_RESIDENT: ResidentProfile = {
  name: "Jordan Lee",
  unit: "Apt 3B",
  property: "Peachtree Commons, Atlanta GA",
  phone: "(404) 555-0134",
};

/** Shown in the red emergency banner. Replace per property. */
export const EMERGENCY_LINE = "(404) 555-0199";

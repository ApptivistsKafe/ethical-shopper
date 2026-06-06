import type { CategoryId } from './types.js'

export interface TaxonomyEntry {
  id: CategoryId
  label: string
  /** Default weight in the rollup. Not required to be 1.0; relative values matter. */
  defaultWeight: number
  /**
   * Rubric text injected into the scoring prompt.
   * Provides anchor examples for Poor/Concerning/Mixed/Good/Excellent so the model
   * scores consistently across companies and over time.
   */
  rubric: string
}

export const TAXONOMY: TaxonomyEntry[] = [
  {
    id: 'labor',
    label: 'Labor & Workers',
    defaultWeight: 1.0,
    rubric: `Score the company's treatment of its workers.
Poor: Documented union-busting, unsafe conditions, wage theft, child labor, or illegal labor practices.
Concerning: Below-market wages, significant worker safety incidents, or union suppression without documented illegality.
Mixed: Some controversies balanced by corrective action or above-average compensation for the industry.
Good: Competitive wages, safe conditions, no major labor controversies.
Excellent: Industry-leading wages and benefits, proactive safety programs, supports worker organizing.
Return null (neutral) if no notable positive or negative labor record is found.`,
  },
  {
    id: 'climate',
    label: 'Climate & Environment',
    defaultWeight: 1.0,
    rubric: `Score the company's environmental and climate impact.
Poor: Major ongoing environmental violations, significant greenhouse gas emissions without mitigation, or active lobbying against climate policy.
Concerning: Above-average environmental footprint or greenwashing without substantive action.
Mixed: Notable environmental issues alongside genuine mitigation efforts.
Good: Meets or exceeds industry standards; credible sustainability commitments.
Excellent: Recognized climate leader; verified emissions reductions; actively advances environmental policy.
Return null (neutral) if no notable environmental record is found.`,
  },
  {
    id: 'political_giving',
    label: 'Political & Civic Giving',
    defaultWeight: 1.5,
    rubric: `Score the company's political donations and civic giving against principles of democracy,
civil rights, rule of law, anti-corruption, and scientific integrity.
Evaluate whether the company's giving advances or undermines voting rights, election integrity,
civil liberties, and evidence-based policy. Frame around progressive principles — support for
candidates and causes that protect democratic institutions and civil rights — not party labels.
Poor: Significant funding of anti-democratic candidates/causes, voter suppression efforts, or anti-civil-rights organizations.
Concerning: Substantial support for candidates with documented anti-civil-rights or anti-democracy records.
Mixed: Donations split between pro- and anti-progressive candidates without a clear pattern, or minimal political activity.
Good: Primarily supports candidates with strong civil rights and democratic records.
Excellent: Actively invests in civic engagement, voting access, and pro-democracy causes.
Return null (neutral) if no notable political giving is found.`,
  },
  {
    id: 'animal_welfare',
    label: 'Animal Welfare',
    defaultWeight: 1.0,
    rubric: `Score the company's treatment of animals in its operations and supply chain.
Poor: Documented systemic cruelty, factory farming practices with no improvement, or animal testing without necessity.
Concerning: Industry-standard animal use without meaningful welfare improvements.
Mixed: Some welfare concerns with credible improvement programs.
Good: Above-average animal welfare standards; third-party certifications.
Excellent: Industry leader; cruelty-free certified or significant animal welfare advocacy.
Return null (neutral) if the company's operations do not significantly involve animals.`,
  },
  {
    id: 'data_privacy_surveillance',
    label: 'Data Privacy & Surveillance',
    defaultWeight: 1.0,
    rubric: `Score the company's data privacy practices and cooperation with surveillance.
Poor: Major documented data breaches without accountability, selling user data without consent, or active cooperation with authoritarian surveillance programs.
Concerning: Weak privacy practices, opaque data use, or significant regulatory violations.
Mixed: Mixed record with some privacy protections and some controversies.
Good: Strong privacy policies, transparent data use, prompt breach response.
Excellent: Privacy-first design, minimal data collection, transparency reports, resists government overreach.
Return null (neutral) if no notable privacy record is found.`,
  },
  {
    id: 'governance_anticompetitive',
    label: 'Corporate Governance',
    defaultWeight: 1.0,
    rubric: `Score the company's corporate governance and competitive practices.
Poor: Documented fraud, price-fixing, monopolistic abuse, or regulatory capture.
Concerning: Aggressive anti-competitive practices or significant governance failures.
Mixed: Some governance concerns without systemic patterns.
Good: Transparent governance, fair competitive practices, responsive to stakeholders.
Excellent: Industry leader in governance transparency and ethical competitive conduct.
Return null (neutral) if no notable governance record is found.`,
  },
  {
    id: 'supply_chain',
    label: 'Supply Chain',
    defaultWeight: 1.0,
    rubric: `Score the company's supply chain transparency and labor/environmental standards upstream.
Poor: Documented use of forced labor, child labor, or significant human rights abuses in the supply chain.
Concerning: Opaque supply chain with known risk factors and no substantive audit program.
Mixed: Some supply chain transparency with gaps or unresolved issues.
Good: Regular audits, supplier code of conduct, responds to violations.
Excellent: Fully transparent supply chain, proactive risk mitigation, public reporting.
Return null (neutral) if supply chain ethics is not a significant factor for this company type.`,
  },
]

/** Look up a taxonomy entry by ID. Throws if not found (indicates a code bug). */
export function getTaxonomyEntry(id: CategoryId): TaxonomyEntry {
  const entry = TAXONOMY.find((e) => e.id === id)
  if (!entry) throw new Error(`Unknown category ID: ${id}`)
  return entry
}

/** All category IDs in taxonomy order. */
export const ALL_CATEGORY_IDS: CategoryId[] = TAXONOMY.map((e) => e.id)

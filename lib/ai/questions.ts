export const AI_QUESTIONS = [
  {
    id: 'fraud_red_flags',
    label: 'Top Red Flags This Period',
    icon: '🚨',
    category: 'Fraud & Audit',
    dataSources: ['audit_details', 'audit_summary'],
    prompt: `Analyze this audit data and identify the top fraud red flags.
Focus on: repeat offenders, cash transactions, high amounts, patterns.
Be specific with manager names, store numbers, dollar amounts.
List top 5 red flags in order of severity.`,
  },
  {
    id: 'cash_fraud',
    label: 'Cash Order Fraud Risk',
    icon: '💵',
    category: 'Fraud & Audit',
    dataSources: ['audit_details'],
    prompt: `Analyze cash order cancellations, voids, and bad orders.
Cash transactions have no digital trail — highest fraud risk.
Who is processing the most cash voids? Which stores?
Are there patterns (time of day, day of week, same manager)?`,
  },
  {
    id: 'stores_getting_worse',
    label: 'Stores Getting Worse',
    icon: '📈',
    category: 'Fraud & Audit',
    dataSources: ['audit_details'],
    prompt: `Compare current period vs last period audit data by store.
Which stores increased in bad orders, cancellations, or refunds?
Show percentage change. Flag stores with >20% increase.
What might explain the worsening performance?`,
  },
  {
    id: 'manager_incidents',
    label: 'Manager Incident Analysis',
    icon: '👤',
    category: 'Fraud & Audit',
    dataSources: ['audit_details'],
    prompt: `Rank all managers by total incidents (bad orders + zeroed + canceled + refunds).
For top 5 managers: show incident count, total amount, types of incidents.
Flag any manager appearing across multiple audit types.
Are any managers self-approving their own voids?`,
  },
  {
    id: 'worst_smg_stores',
    label: 'Worst SMG Scores',
    icon: '⭐',
    category: 'Guest Experience',
    dataSources: ['smg_scores'],
    prompt: `Analyze SMG guest satisfaction scores by store.
Which stores have the lowest scores? What categories are failing?
Compare to previous period. Which stores improved or declined?
What is the #1 complaint category overall?`,
  },
  {
    id: 'customer_complaints',
    label: 'Top Customer Complaints',
    icon: '📉',
    category: 'Guest Experience',
    dataSources: ['smg_scores', 'smg_comments'],
    prompt: `Analyze customer feedback and SMG comment data.
What are customers complaining about most?
Are complaints correlated with specific stores or managers?
What themes appear in negative reviews?
What are customers praising?`,
  },
  {
    id: 'sales_targets',
    label: 'Sales Target Performance',
    icon: '💰',
    category: 'Sales & Performance',
    dataSources: ['live_kpi'],
    prompt: `Analyze sales performance across all stores.
Which stores are hitting targets? Which are missing?
What is the gap between best and worst performing store?
Are there any concerning trends in the data?`,
  },
  {
    id: 'yoy_trend',
    label: 'Year Over Year Trend',
    icon: '📊',
    category: 'Sales & Performance',
    dataSources: ['live_kpi', 'audit_summary'],
    prompt: `Compare current performance to last year.
Which metrics improved? Which declined?
Which stores show the most improvement year over year?
Overall business health assessment.`,
  },
  {
    id: 'offers_working',
    label: 'What Offers Are Working?',
    icon: '✅',
    category: 'Offers & Specials',
    dataSources: ['specials', 'specials_history'],
    prompt: `Analyze current and recent specials/offers data.
Which offers have the highest redemption or engagement?
Which promotions correlate with better sales performance?
What types of offers resonate with customers?`,
  },
  {
    id: 'offers_not_working',
    label: 'What Offers Are Failing?',
    icon: '❌',
    category: 'Offers & Specials',
    dataSources: ['specials', 'specials_history'],
    prompt: `Analyze which offers are underperforming.
Low redemption rates, no impact on sales, customer complaints.
Which promotions should be discontinued or reworked?
Recommend improvements based on the data.`,
  },
  {
    id: 'full_health_report',
    label: 'Full Store Health Report',
    icon: '🏥',
    category: 'Operations Health',
    dataSources: ['audit_details', 'smg_scores', 'live_kpi', 'specials'],
    prompt: `Generate a comprehensive operations health report for all stores.

Cover these sections:
1. OVERALL HEALTH SCORE (Good/Warning/Critical per store)
2. TOP FRAUD RISKS (specific names and amounts)
3. GUEST EXPERIENCE (SMG highlights and concerns)
4. SALES PERFORMANCE (hitting targets or not)
5. OFFERS EFFECTIVENESS (what's working)
6. TOP 3 IMMEDIATE ACTIONS NEEDED

Be specific, actionable, and concise. Use store numbers and names.`,
  },
] as const

export type AIQuestionId = (typeof AI_QUESTIONS)[number]['id']

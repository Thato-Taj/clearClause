// Generated from backend/src/engine/analyze.js normaliseResult() — a fictional gym contract used for the demo report.
import type { AnalysisResult } from './types';

export const EXAMPLE_REPORT: AnalysisResult = {
  "version": 1,
  "isLegalDocument": true,
  "title": "PulseFit Gyms — Membership Agreement (example)",
  "documentType": "Service Agreement",
  "language": "English",
  "mode": "consumer",
  "summary": "This is a gym contract that locks you in for three years and makes it very hard to leave. It lets the gym give your details to advertisers and change your fees whenever it wants. It also says the gym is not responsible if you get hurt, even when staff are careless. Several of these parts go against South African law, so they may not hold up — but you should not have to fight over them.",
  "verdict": "Don’t sign this as it is. Ask for a 24-month or monthly contract, a separate “no” option for marketing, and a card instead of your fingerprint. If they refuse, look at another gym.",
  "positives": [
    "The monthly fee and debit-order date are stated clearly.",
    "It explains how to freeze your membership for medical reasons."
  ],
  "clauses": [
    {
      "id": "c1",
      "reference": "Clause 11.3",
      "title": "Your details are given to advertisers without really asking you",
      "quote": "By signing this agreement you consent to PulseFit sharing your personal information with its marketing partners, who may contact you by SMS, e-mail or telephone.",
      "quoteVerified": true,
      "severity": "violation",
      "severityLabel": "Breaks the law",
      "acts": [
        {
          "act": "POPIA",
          "section": "s 69"
        },
        {
          "act": "POPIA",
          "section": "s 11"
        }
      ],
      "explanation": "A company may only send you marketing by SMS, e-mail or phone if you clearly said yes to it. Hiding this “yes” inside the contract you must sign to join is not a free choice, so it is not real consent.",
      "action": "Ask PulseFit to remove this clause or give you a separate tick-box to say no. If you get marketing you did not agree to, you can complain to the Information Regulator."
    },
    {
      "id": "c2",
      "reference": "Clause 3.1",
      "title": "You are locked in for three years and can’t cancel",
      "quote": "This agreement runs for a fixed period of 36 months and may not be cancelled by the member before the end of this period.",
      "quoteVerified": true,
      "severity": "violation",
      "severityLabel": "Breaks the law",
      "acts": [
        {
          "act": "CPA",
          "section": "s 14"
        }
      ],
      "explanation": "Fixed-term consumer contracts may not be longer than 24 months unless there is a good, proven reason. You are also allowed to cancel at any time by giving 20 business days’ notice, paying only a reasonable cancellation fee.",
      "action": "Ask for a 24-month or month-to-month contract. If you want to leave, give written notice — the law lets you cancel even if this clause says you cannot."
    },
    {
      "id": "c3",
      "reference": "Clause 14.2",
      "title": "The gym is not responsible even when staff are seriously careless",
      "quote": "PulseFit shall not be liable for any injury, loss or damage suffered by the member on the premises, howsoever arising, including as a result of the gross negligence of PulseFit or its staff.",
      "quoteVerified": true,
      "severity": "violation",
      "severityLabel": "Breaks the law",
      "acts": [
        {
          "act": "CPA",
          "section": "s 51(1)(c)"
        },
        {
          "act": "CPA",
          "section": "s 49"
        }
      ],
      "explanation": "“Gross negligence” means very careless behaviour, like ignoring a broken machine. A business is not allowed to make you give up your right to claim for that. Risky terms like this must also be pointed out to you clearly before you sign.",
      "action": "Do not rely on this clause — it is probably not valid. If you are hurt because of serious carelessness, keep evidence and contact the National Consumer Commission or an attorney."
    },
    {
      "id": "c4",
      "reference": "Clause 6.4",
      "title": "Your fingerprint is required with no other option",
      "quote": "Access to all clubs is by fingerprint scan only.",
      "quoteVerified": true,
      "severity": "concern",
      "severityLabel": "Unfair or risky",
      "acts": [
        {
          "act": "POPIA",
          "section": "s 26"
        },
        {
          "act": "POPIA",
          "section": "s 27"
        }
      ],
      "explanation": "Your fingerprint is “special personal information” because it identifies your body. Companies need a strong reason and your consent to use it, and they must explain how they keep it safe. The contract does neither.",
      "action": "Ask for a card or app instead of your fingerprint, and ask how your fingerprint data is stored and when it will be deleted."
    },
    {
      "id": "c5",
      "reference": "Clause 8.1",
      "title": "Prices and rules can change whenever the gym wants",
      "quote": "PulseFit may amend the membership fees and these terms at any time at its sole discretion.",
      "quoteVerified": true,
      "severity": "concern",
      "severityLabel": "Unfair or risky",
      "acts": [
        {
          "act": "CPA",
          "section": "s 48"
        }
      ],
      "explanation": "This lets the gym change the deal after you signed, without asking you. Terms that are this one-sided can be unfair under the Consumer Protection Act.",
      "action": "Ask that price changes are limited to once a year, with at least one month’s written notice, and that you may cancel without a penalty if you don’t accept them."
    },
    {
      "id": "c6",
      "reference": "Clause 11.6",
      "title": "Your information is kept forever",
      "quote": "Member records are retained indefinitely for business purposes.",
      "quoteVerified": true,
      "severity": "concern",
      "severityLabel": "Unfair or risky",
      "acts": [
        {
          "act": "POPIA",
          "section": "s 14"
        }
      ],
      "explanation": "Companies may only keep your personal information for as long as they need it. “Indefinitely” means they never plan to delete it, even after you leave.",
      "action": "Ask how long they keep your records after you cancel. You can ask them to delete your information once your membership ends."
    },
    {
      "id": "c7",
      "reference": "Clause 5.2",
      "title": "An “admin fee” with no amount",
      "quote": "A reasonable administration fee may be charged from time to time.",
      "quoteVerified": true,
      "severity": "vague",
      "severityLabel": "Unclear wording",
      "acts": [
        {
          "act": "CPA",
          "section": "s 22"
        }
      ],
      "explanation": "The contract does not say how much the fee is or when you will pay it. Consumer contracts must be written so you can understand what you will be charged.",
      "action": "Ask PulseFit to write the exact fee and when it applies into the contract before you sign."
    },
    {
      "id": "c8",
      "reference": "Clause 11.4",
      "title": "Who are the “trusted third parties”?",
      "quote": "We may share information with trusted third parties where necessary.",
      "quoteVerified": true,
      "severity": "vague",
      "severityLabel": "Unclear wording",
      "acts": [
        {
          "act": "POPIA",
          "section": "s 18"
        }
      ],
      "explanation": "You have the right to know who receives your information and why. “Trusted third parties” and “where necessary” do not tell you either.",
      "action": "Ask for a list of the types of companies that get your information and the reason for each."
    }
  ],
  "applicableActs": [
    "POPIA",
    "CPA",
    "ECTA"
  ],
  "scores": {
    "overall": 94,
    "band": "critical",
    "bandLabel": "Critical risk",
    "counts": {
      "violation": 3,
      "concern": 3,
      "vague": 2
    },
    "perAct": {
      "POPIA": {
        "applicable": true,
        "score": 69,
        "band": "high",
        "counts": {
          "violation": 1,
          "concern": 2,
          "vague": 1
        }
      },
      "CPA": {
        "applicable": true,
        "score": 81,
        "band": "critical",
        "counts": {
          "violation": 2,
          "concern": 1,
          "vague": 1
        }
      },
      "NCA": {
        "applicable": false,
        "score": null,
        "band": null,
        "counts": null
      },
      "ECTA": {
        "applicable": true,
        "score": 0,
        "band": "clear",
        "counts": {
          "violation": 0,
          "concern": 0,
          "vague": 0
        }
      },
      "BCEA": {
        "applicable": false,
        "score": null,
        "band": null,
        "counts": null
      },
      "LRA": {
        "applicable": false,
        "score": null,
        "band": null,
        "counts": null
      },
      "RHA": {
        "applicable": false,
        "score": null,
        "band": null,
        "counts": null
      }
    }
  },
  "source": {
    "kind": "pdf",
    "truncated": false,
    "characters": 813
  },
  "model": "gemini-3.5-flash",
  "analysedAt": "2026-11-20T09:30:00.000Z"
}
;

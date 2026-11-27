import type { Metadata } from 'next';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Privacy notice',
  description: 'How ClearClause handles your personal information under POPIA.',
};

// NOTE: Have this notice reviewed by an attorney before launch, and register your
// Information Officer with the Information Regulator (POPIA s 55, s 56).
const SECTIONS: { h: string; p: string[] }[] = [
  {
    h: 'The short version',
    p: [
      'We read your document to check it, then throw the document away. We never sell your information and we never use it for advertising.',
      'If you are signed in, we keep the report (not the document) so you can find it later. You can delete any report, or everything, at any time.',
    ],
  },
  {
    h: 'What we collect and why',
    p: [
      'Account details: your name and e-mail address from Google sign-in, so we can save your reports and apply your plan.',
      'Documents you check: processed only to produce your report, then discarded. Reports contain short quotes from the clauses we flag.',
      'Usage records: the times of your recent checks, so we can apply plan limits (for example 3 checks every 14 days). For people who are not signed in, and for WhatsApp and Telegram users, we store a one-way scrambled code (a “hash”) instead of your IP address, phone number or chat ID.',
      'Chat settings: your preferred language for the WhatsApp or Telegram bot, stored against that same scrambled code.',
    ],
  },
  {
    h: 'Who helps us process it',
    p: [
      'Google: sign-in (Firebase Authentication), storage of saved reports (Cloud Firestore, Johannesburg region), and AI analysis of documents (Gemini API, on a paid plan under which Google does not use your content to train its models). AI analysis may happen outside South Africa; Google is bound by data-protection terms that give protection similar to POPIA (POPIA s 72).',
      'Meta (WhatsApp) and Telegram: only if you choose to use our bots. Their own privacy policies apply to messages you send through their apps.',
      'Our hosting provider, which runs the ClearClause servers.',
    ],
  },
  {
    h: 'How long we keep it',
    p: [
      'Documents: not kept. Reports: until you delete them or close your account. Usage records: deleted automatically within 35 days. Connection codes: deleted after 15 minutes.',
    ],
  },
  {
    h: 'Your rights',
    p: [
      'Under POPIA you may ask what information we hold about you, ask us to correct or delete it, and object to how we use it. You can delete everything yourself on your Account page, or e-mail us.',
      `If you are unhappy with how we handle your information, please contact us first at ${SITE.contactEmail}. You may also complain to the Information Regulator (inforegulator.org.za).`,
    ],
  },
  {
    h: 'Security',
    p: [
      'All traffic is encrypted. Only our servers can write to the database, and you can only read your own reports. Access keys are stored as one-way hashes.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-serif text-4xl font-bold tracking-tight sm:text-5xl">Privacy notice</h1>
      <p className="mt-3 text-ink-3">Last updated 27 November 2026</p>
      {SECTIONS.map((s) => (
        <section key={s.h} className="mt-10">
          <h2 className="font-serif text-2xl font-bold">{s.h}</h2>
          {s.p.map((para) => (
            <p key={para} className="mt-3 text-[1.05rem] leading-relaxed text-ink-2">
              {para}
            </p>
          ))}
        </section>
      ))}
      <p className="mt-12 border-t border-line pt-6 text-ink-3">
        Questions? E-mail <a className="underline" href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
      </p>
    </div>
  );
}

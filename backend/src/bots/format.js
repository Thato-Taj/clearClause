import { ACTS } from '../engine/acts.js';
import { usageText } from '../services/util.js';

const MAX_MESSAGE = 3800; // both platforms allow 4096; leave headroom

const ICON = { violation: '🔴', concern: '🟠', vague: '🟡' };

/**
 * Style adapters. Telegram uses HTML parse mode; WhatsApp uses its own *bold* / _italic_ markup.
 */
const styles = {
  telegram: {
    esc: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
    bold: (s) => `<b>${s}</b>`,
    italic: (s) => `<i>${s}</i>`,
    link: (label, url) => `<a href="${url}">${label}</a>`,
  },
  whatsapp: {
    // Neutralise characters that would toggle WhatsApp formatting inside user/AI text.
    esc: (s) => String(s).replace(/([*_~`])/g, '​$1​'),
    bold: (s) => `*${s}*`,
    italic: (s) => `_${s}_`,
    link: (label, url) => `${label}: ${url}`,
  },
};

const bar = (score) => {
  const filled = Math.round(score / 10);
  return '▰'.repeat(filled) + '▱'.repeat(10 - filled);
};

const truncate = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);

/**
 * @returns {string[]} messages, each under the platform limit
 */
export function formatReport(result, { style: styleName, reportUrl = null, quota = null, maxFindings = 8 }) {
  const s = styles[styleName];
  const { scores } = result;

  if (!result.isLegalDocument) {
    return [
      `${s.bold('This does not look like a contract or terms and conditions.')}\n\n${s.esc(result.summary)}\n\nSend me the terms as a PDF, Word file, photo, link or pasted text.`,
    ];
  }

  const header = [
    `⚖️ ${s.bold('ClearClause report')}`,
    `${s.bold(s.esc(result.title))} · ${s.esc(result.documentType)}`,
    '',
    `${s.bold(`Risk score: ${scores.overall}/100`)} — ${s.esc(scores.bandLabel)}`,
    s.italic('0 means we found no problems. The higher the number, the less this document follows the law.'),
    '',
    `${ICON.violation} ${scores.counts.violation} break the law   ${ICON.concern} ${scores.counts.concern} unfair or risky   ${ICON.vague} ${scores.counts.vague} unclear`,
  ];

  const actLines = result.applicableActs.map((id) => {
    const a = scores.perAct[id];
    return `${bar(a.score)} ${a.score} ${s.esc(ACTS[id].short)}`;
  });
  if (actLines.length) header.push('', s.bold('Score per law'), ...actLines);

  header.push('', s.bold('In short'), s.esc(result.summary));

  const findings = result.clauses.slice(0, maxFindings).map((c, i) => {
    const laws = c.acts.map((a) => `${ACTS[a.act].short}${a.section ? ` ${a.section}` : ''}`).join(', ');
    return [
      `${ICON[c.severity]} ${s.bold(`${i + 1}. ${s.esc(c.title)}`)}`,
      `${s.esc(c.severityLabel)} · ${s.esc(c.reference)}`,
      c.quote ? s.italic(`“${s.esc(truncate(c.quote, 220))}”`) : null,
      s.esc(c.explanation),
      `👉 ${s.esc(c.action)}`,
      laws ? `Law: ${s.esc(laws)}` : null,
    ]
      .filter(Boolean)
      .join('\n');
  });

  const footer = [s.bold('Our advice'), s.esc(result.verdict)];
  const more = result.clauses.length - maxFindings;
  if (more > 0) footer.push('', `+ ${more} more finding${more === 1 ? '' : 's'} in the full report.`);
  if (reportUrl) footer.push('', s.link('Open the full report', reportUrl));
  if (quota && quota.limit !== -1) footer.push('', s.esc(usageText(quota)));
  footer.push('', s.italic('ClearClause gives guidance, not legal advice.'));

  // Pack blocks into as few messages as possible without splitting a block.
  const blocks = [header.join('\n'), ...(findings.length ? [s.bold('What we found'), ...findings] : [s.bold('We found no problem clauses.')]), footer.join('\n')];
  const messages = [];
  let current = '';
  for (const block of blocks) {
    const piece = truncate(block, MAX_MESSAGE);
    if (current && current.length + piece.length + 2 > MAX_MESSAGE) {
      messages.push(current);
      current = piece;
    } else {
      current = current ? `${current}\n\n${piece}` : piece;
    }
  }
  if (current) messages.push(current);
  return messages;
}

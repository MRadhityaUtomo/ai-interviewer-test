/**
 * Jaksel & Bilingual (Indonesian - English) Code-Switching Phonetic Normalizer
 *
 * Web Speech API (Google Speech engine on 'id-ID') often phonetically misspells
 * common English words and "Bahasa Jaksel" expressions used in modern professional
 * and tech interviews. This dictionary normalizes those phonetic outputs into
 * their proper English spellings while preserving surrounding Indonesian sentences.
 */

interface ReplacementRule {
    pattern: RegExp;
    replacement: string;
}

const JAKSEL_RULES: ReplacementRule[] = [
    // Common Jaksel Connectors & Discourse Markers
    { pattern: /\b(wich is|wis is|wic is|wicis)\b/gi, replacement: 'which is' },
    { pattern: /\b(beysikali|besikeli|besikli|basicaly)\b/gi, replacement: 'basically' },
    { pattern: /\b(aksyuali|aksyeli|eksuali|eksyuali|actuly)\b/gi, replacement: 'actually' },
    { pattern: /\b(litereli|literli|letereli)\b/gi, replacement: 'literally' },
    { pattern: /\b(et lis|etlist|atlis)\b/gi, replacement: 'at least' },
    { pattern: /\b(in tem of|in term op|interm of)\b/gi, replacement: 'in terms of' },
    { pattern: /\b(mek ses|mek sens|make sens|makesens)\b/gi, replacement: 'make sense' },
    { pattern: /\b(poin of yu|point of yu|point of view)\b/gi, replacement: 'point of view' },
    { pattern: /\b(wort it|worthit|wortit)\b/gi, replacement: 'worth it' },
    { pattern: /\b(so far so gut|so far so gud)\b/gi, replacement: 'so far so good' },
    { pattern: /\b(by the wey|bay the wey|bay dewex|btw)\b/gi, replacement: 'by the way' },
    { pattern: /\b(anywey|eniwey|eniwei)\b/gi, replacement: 'anyway' },
    { pattern: /\b(somehow|samhaw|samhow)\b/gi, replacement: 'somehow' },
    { pattern: /\b(in the end|in di en)\b/gi, replacement: 'in the end' },
    { pattern: /\b(probabli|probli)\b/gi, replacement: 'probably' },
    { pattern: /\b(definetli|definiti)\b/gi, replacement: 'definitely' },
    { pattern: /\b(honestly|onesli|onestli)\b/gi, replacement: 'honestly' },
    { pattern: /\b(meanwhile|minwail)\b/gi, replacement: 'meanwhile' },

    // Professional & Workplace Expressions
    { pattern: /\b(konsen|konsem|concerm)\b/gi, replacement: 'concern' },
    { pattern: /\b(preper|preperkan|priper)\b/gi, replacement: 'prefer' },
    { pattern: /\b(dedlen|detlen|deadlin)\b/gi, replacement: 'deadline' },
    { pattern: /\b(deliferabel|deliverabel|deliperabel)\b/gi, replacement: 'deliverable' },
    { pattern: /\b(delifer|deliper)\b/gi, replacement: 'deliver' },
    { pattern: /\b(insait|insite|insaet)\b/gi, replacement: 'insight' },
    { pattern: /\b(fidbek|fitbek|feedbac)\b/gi, replacement: 'feedback' },
    { pattern: /\b(polow ap|polo ap|folow up|folo up|followup)\b/gi, replacement: 'follow up' },
    { pattern: /\b(dip daif|dip daiv|dip dive|dipdayv)\b/gi, replacement: 'deep dive' },
    { pattern: /\b(henson|hens on|hen on)\b/gi, replacement: 'hands-on' },
    { pattern: /\b(on trek|on track|ontrek)\b/gi, replacement: 'on track' },
    { pattern: /\b(of trek|off track|oftrek)\b/gi, replacement: 'off track' },
    { pattern: /\b(tek awey|tek ewey|tekaway)\b/gi, replacement: 'takeaway' },
    { pattern: /\b(tred of|tredop|trade of)\b/gi, replacement: 'trade-off' },
    { pattern: /\b(pes pes|pes peys|fastpes|fast pes)\b/gi, replacement: 'fast-paced' },
    { pattern: /\b(skilset|skil set)\b/gi, replacement: 'skillset' },
    { pattern: /\b(kalcer fit|kalcur fit|kultur fit)\b/gi, replacement: 'culture fit' },
    { pattern: /\b(brekdown|brek down)\b/gi, replacement: 'breakdown' },
    { pattern: /\b(alin|alain|alaign)\b/gi, replacement: 'align' },
    { pattern: /\b(alainmen|alinmen)\b/gi, replacement: 'alignment' },
    { pattern: /\b(aprup|aprupval|eprup)\b/gi, replacement: 'approve' },
    { pattern: /\b(aprufal|eprufal)\b/gi, replacement: 'approval' },
    { pattern: /\b(brifing|brif)\b/gi, replacement: 'briefing' },
    { pattern: /\b(brenstorming|brenstorm)\b/gi, replacement: 'brainstorming' },
    { pattern: /\b(standap|stan ap)\b/gi, replacement: 'standup' },
    { pattern: /\b(ketcep|ketsap miting|ketcap)\b/gi, replacement: 'catch up' },
    { pattern: /\b(sink ap|singkap|sinkap)\b/gi, replacement: 'sync up' },
    { pattern: /\b(onboarding|on bording)\b/gi, replacement: 'onboarding' },
    { pattern: /\b(offboarding|of bording)\b/gi, replacement: 'offboarding' },
    { pattern: /\b(bornout|bernaut|bernot)\b/gi, replacement: 'burnout' },
    { pattern: /\b(oper tingking|opertingking)\b/gi, replacement: 'overthinking' },

    // Tech & Engineering Vocabularies
    { pattern: /\b(strakcer|strakcur|strakter)\b/gi, replacement: 'structure' },
    { pattern: /\b(arkitektur|arsitektur|arkitekcur)\b/gi, replacement: 'architecture' },
    { pattern: /\b(bek en|bekend|bek end)\b/gi, replacement: 'backend' },
    { pattern: /\b(fron en|fronent|front end)\b/gi, replacement: 'frontend' },
    { pattern: /\b(pul rikues|pul rekues|pulrikues|pr)\b/gi, replacement: 'pull request' },
    { pattern: /\b(merj|merd)\b/gi, replacement: 'merge' },
    { pattern: /\b(diploy|diploimen|deploi)\b/gi, replacement: 'deploy' },
    { pattern: /\b(prodaksyen|prodaksin|prod)\b/gi, replacement: 'production' },
    { pattern: /\b(stejing|stejin)\b/gi, replacement: 'staging' },
    { pattern: /\b(enpairemen|enpayremen)\b/gi, replacement: 'environment' },
    { pattern: /\b(freimwok|fremwok)\b/gi, replacement: 'framework' },
    { pattern: /\b(kod rebyu|kod repyu|kod review)\b/gi, replacement: 'code review' },
    { pattern: /\b(performa|performen)\b/gi, replacement: 'performance' },
    { pattern: /\b(skalabilitas|skelabiliti)\b/gi, replacement: 'scalability' },
    { pattern: /\b(men ten|mentenis|menten)\b/gi, replacement: 'maintain' },
    { pattern: /\b(moniter|monitering)\b/gi, replacement: 'monitoring' },
    { pattern: /\b(troubel syuting|trabel syuting|trabel syut)\b/gi, replacement: 'troubleshooting' },
    { pattern: /\b(bok|bag|bagz)\b/gi, replacement: 'bug' },
    { pattern: /\b(picing|pic deck|picdek)\b/gi, replacement: 'pitch deck' },
    { pattern: /\b(kpi|key peformans|key performan)\b/gi, replacement: 'KPI' },
    { pattern: /\b(okr|o key ar)\b/gi, replacement: 'OKR' },
];

/**
 * Normalizes mixed Indonesian-English (Bahasa Jaksel) speech recognition output.
 * Preserves casing context where appropriate.
 */
export function normalizeJakselSpeech(text: string): string {
    if (!text) return '';

    let normalized = text;
    for (const rule of JAKSEL_RULES) {
        normalized = normalized.replace(rule.pattern, rule.replacement);
    }

    return normalized;
}

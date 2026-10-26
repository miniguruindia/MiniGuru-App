"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.htmlToText = htmlToText;
// backend/src/utils/htmlToText.ts
// Plain-text twin of an HTML email. Mail with both an HTML and a text part
// looks more genuine to spam filters, and is readable in plain mail apps.
function htmlToText(html) {
    return String(html || '')
        .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, '')
        .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, url, label) => {
        const t = String(label).replace(/<[^>]+>/g, '').trim();
        return t ? `${t}: ${url}` : url;
    })
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|tr|h[1-6]|table)>/gi, '\n')
        .replace(/<\/t[dh]>/gi, '  ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#8377;/g, 'Rs ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#\d+;/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

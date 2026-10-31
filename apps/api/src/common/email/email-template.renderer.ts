import type { RenderedEmail, SendEmailInput } from './email.types.js';
import {
  escapeHtml,
  requiredText,
  type TemplateContent,
} from './email-template-helpers.js';
import { sellerAccountInvitation } from './templates/seller-account-invitation.js';
import { sellerEmailVerification } from './templates/seller-email-verification.js';
import { sellerApplicationApproved } from './templates/seller-application-approved.js';
import { sellerApplicationAccessCode } from './templates/seller-application-access-code.js';
import { sellerApplicationReceived } from './templates/seller-application-received.js';
import { sellerApplicationRejected } from './templates/seller-application-rejected.js';
import { sellerApplicationResubmitted } from './templates/seller-application-resubmitted.js';
import { sellerContactEmailChanged } from './templates/seller-contact-email-changed.js';
import { sellerCorrectionsRequested } from './templates/seller-corrections-requested.js';

/**
 * Explicit template registry: no arbitrary file paths, dynamic imports or
 * caller-supplied HTML. New email types are registered here.
 */
export function renderEmailTemplate(input: SendEmailInput): RenderedEmail {
  const reference = requiredText(input.data?.referenceCode, 'referenceCode');
  let content: TemplateContent;

  switch (input.template) {
    case 'seller-email-verification':
      content = sellerEmailVerification(input.data);
      break;
    case 'seller-application-approved':
      content = sellerApplicationApproved(input.data);
      break;
    case 'seller-application-received':
      content = sellerApplicationReceived(input.data);
      break;
    case 'seller-application-resubmitted':
      content = sellerApplicationResubmitted(input.data);
      break;
    case 'seller-corrections-requested':
      content = sellerCorrectionsRequested(input.data);
      break;
    case 'seller-application-rejected':
      content = sellerApplicationRejected(input.data);
      break;
    case 'seller-account-invitation':
      content = sellerAccountInvitation(input.data);
      break;
    case 'seller-application-access-code':
      content = sellerApplicationAccessCode(input.data);
      break;
    case 'seller-contact-email-changed':
      content = sellerContactEmailChanged();
      break;
    default:
      throw new Error('Unknown email template');
  }

  const heading = requiredText(input.subject, 'subject');
  const text = `Lemekinaye Seller Application: ${reference}\n\n${content.details}` +
    (content.action ? `\n\n${content.action.label}: ${content.action.url}` : '');

  // Dynamic fields and links are HTML-escaped, with a safe URL scheme check
  // performed by each template that includes a call-to-action link.
  const html =
    '<!doctype html><html><body style="margin:0;padding:24px;background:#f8fafc;' +
    'font-family:Arial,Helvetica,sans-serif;color:#0f172a">' +
    '<div style="max-width:600px;margin:auto;padding:28px;background:#fff;' +
    'border:1px solid #e2e8f0;border-radius:12px">' +
    '<p style="margin:0 0 14px;color:#a71920;font-size:14px;font-weight:700">LEMEKINAYE</p>' +
    `<h1 style="font-size:22px;margin:0 0 16px">${escapeHtml(heading)}</h1>` +
    `<p style="font-size:14px;color:#475569">Application reference: <strong>${escapeHtml(reference)}</strong></p>` +
    `<p style="white-space:pre-line;font-size:15px;line-height:1.7">${escapeHtml(content.details)}</p>` +
    (content.action
      ? `<p><a href="${escapeHtml(content.action.url)}" style="display:inline-block;padding:12px 18px;` +
        'background:#a71920;color:#fff;text-decoration:none;border-radius:6px">' +
        `${escapeHtml(content.action.label)}</a></p>`
      : '') +
    (content.action && content.showActionUrl
      ? '<p style="font-size:13px;line-height:1.6">If the button does not work, copy and paste this link:</p>' +
        '<p style="font-size:13px;overflow-wrap:anywhere;word-break:break-all">' +
        `<a href="${escapeHtml(content.action.url)}">${escapeHtml(content.action.url)}</a></p>`
      : '') +
    '<p style="font-size:12px;color:#64748b">Lemekinaye Seller Services</p>' +
    '</div></body></html>';

  return { text, html };
}

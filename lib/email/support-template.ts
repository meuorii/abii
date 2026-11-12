import "server-only";

type SupportEmailInput = {
  category: string;
  name: string;
  email: string;
  message: string;
  submittedAt: Date;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

export function renderSupportEmail(input: SupportEmailInput) {
  const category = escapeHtml(input.category);
  const name = escapeHtml(input.name);
  const email = escapeHtml(input.email);
  const message = escapeHtml(input.message).replace(/\r?\n/g, "<br>");
  const submittedAt = escapeHtml(input.submittedAt.toISOString());
  const subject = `[Abii Support] ${input.category}`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#fff7f9;color:#2f2930;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff;border:1px solid #e8e2e5;border-radius:16px"><tr><td style="padding:28px 30px 16px"><p style="margin:0;color:#e9577d;font-size:12px;font-weight:bold;letter-spacing:1.2px">ABII SUPPORT</p><h1 style="margin:10px 0 22px;font-size:24px;line-height:1.2">New support message</h1><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-size:14px;line-height:1.6"><tr><td style="padding:8px 0;color:#756b72;width:100px">Category</td><td style="padding:8px 0;font-weight:bold">${category}</td></tr><tr><td style="padding:8px 0;color:#756b72">Name</td><td style="padding:8px 0">${name}</td></tr><tr><td style="padding:8px 0;color:#756b72">Email</td><td style="padding:8px 0"><a href="mailto:${email}" style="color:#e9577d">${email}</a></td></tr></table><h2 style="margin:22px 0 8px;font-size:16px">Message</h2><p style="margin:0;white-space:normal;overflow-wrap:anywhere;font-size:15px;line-height:1.7">${message}</p><p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e8e2e5;color:#756b72;font-size:12px">Submitted ${submittedAt}</p></td></tr></table></td></tr></table></body></html>`;
  const text = `ABII SUPPORT\nNew support message\n\nCategory: ${input.category}\nName: ${input.name}\nEmail: ${input.email}\n\nMessage:\n${input.message}\n\nSubmitted: ${input.submittedAt.toISOString()}`;
  return { subject, html, text };
}

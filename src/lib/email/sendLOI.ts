import { Resend } from "resend";
import type { LOISection } from "@/types";

export async function sendLOIEmail(params: {
  toEmail: string;
  toName: string;
  dealName: string;
  subject: string;
  coverNote: string;
  sections: LOISection[];
  fromEmail?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!process.env.RESEND_API_KEY) {
    return { success: false, error: "RESEND_API_KEY not configured" };
  }
  try {
    // Instantiated lazily — a module-scope client throws at build time
    // when the env var is absent
    const resend = new Resend(process.env.RESEND_API_KEY);
    const loiHTML = buildLOIEmailHTML(params.sections);

    await resend.emails.send({
      from:
        params.fromEmail ??
        process.env.RESEND_FROM_EMAIL ??
        "loi@dealdesk.app",
      to: params.toEmail,
      subject: params.subject,
      html: `
        <div style="font-family: Georgia, serif; max-width: 600px;
          margin: 0 auto; padding: 24px;">
          <p style="white-space: pre-line; margin-bottom: 32px;">
            ${params.coverNote}
          </p>
          <hr style="border: none; border-top: 1px solid #e6e3dc;
            margin: 24px 0;">
          <p style="font-size: 11px; color: #9b978f; margin-bottom: 24px;">
            LETTER OF INTENT — ${params.dealName.toUpperCase()}
          </p>
          ${loiHTML}
        </div>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error("[sendLOIEmail] error:", error);
    return { success: false, error: String(error) };
  }
}

function buildLOIEmailHTML(sections: LOISection[]): string {
  return [...sections]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(
      (s) => `
      <div style="margin-bottom: 20px;">
        <p style="font-size: 9px; font-weight: 600; letter-spacing: .08em;
          color: #9b978f; text-transform: uppercase; margin-bottom: 4px;">
          ${s.label}
        </p>
        <p style="font-size: 13px; line-height: 1.7; color: #23211d;">
          ${s.content.replace(/\n/g, "<br>")}
        </p>
      </div>
    `
    )
    .join("");
}

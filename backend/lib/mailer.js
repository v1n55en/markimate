// Modul Pengiriman Email Transaksional Markimate Bilingual (EN & ID) (PRD F3 Langkah 2)
import dotenv from 'dotenv';
import { getAppUrl } from './config.js';
dotenv.config();

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

/**
 * Normalisasi locale ('id' atau 'en', default 'id')
 */
export function normalizeLocale(locale) {
  if (typeof locale === 'string' && locale.toLowerCase().startsWith('en')) {
    return 'en';
  }
  return 'id';
}

/**
 * Format tanggal untuk email sesuai locale
 */
export function formatEmailDate(date, locale = 'id') {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return String(date);
  const lang = normalizeLocale(locale);
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'id-ID', {
    timeZone: 'Asia/Jakarta',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(d);
}

/**
 * Format template email bermerek Markimate (bilingual)
 */
export function renderEmailTemplate({ title, contentHtml, actionUrl, actionText, locale = 'id' }) {
  const lang = normalizeLocale(locale);
  const isEn = lang === 'en';

  const copyLinkPrompt = isEn
    ? 'If the button above does not work, copy and open the following link in your browser:'
    : 'Jika tombol di atas tidak dapat diklik, salin dan buka tautan berikut di browser Anda:';

  const footerNotice = isEn
    ? 'If you did not request this email, you can safely ignore it.'
    : 'Jika Anda tidak meminta email ini, Anda dapat mengabaikannya dengan aman.';

  const buttonBlock = actionUrl && actionText ? `
    <div style="margin: 32px 0; text-align: center;">
      <a href="${actionUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block;">
        ${actionText}
      </a>
    </div>
    <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin-top: 24px; word-break: break-all;">
      ${copyLinkPrompt}<br/>
      <a href="${actionUrl}" style="color: #2563eb;">${actionUrl}</a>
    </p>
  ` : '';

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title || 'Markimate'}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #0f172a;">
  <div style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
    <!-- Header -->
    <div style="padding: 24px 32px; border-bottom: 1px solid #f1f5f9; background-color: #ffffff;">
      <div style="font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">
        Markimate <span style="font-size: 12px; font-weight: 500; color: #64748b; margin-left: 6px;">powered by 3our</span>
      </div>
    </div>
    
    <!-- Body Content -->
    <div style="padding: 32px; font-size: 15px; line-height: 1.6; color: #334155;">
      ${contentHtml}
      ${buttonBlock}
    </div>

    <!-- Footer -->
    <div style="padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.5;">
      <p style="margin: 0 0 8px 0;">${footerNotice}</p>
      <p style="margin: 0;">&copy; ${new Date().getFullYear()} Markimate · powered by 3our</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Mengirim email transaksional melalui Resend REST API
 */
export async function sendMail({ to, subject, html, text, actionUrl, actionText, locale = 'id', tag = 'auth' }) {
  if (!to) return { success: false, error: 'Recipient email required' };

  const lang = normalizeLocale(locale);
  const isDevLog = process.env.MAIL_DEV_LOG === 'true' || process.env.NODE_ENV === 'test';
  const mailFrom = process.env.MAIL_FROM || process.env.EMAIL_FROM || 'Markimate <noreply@mail.markimate.com>';
  const resendApiKey = process.env.RESEND_API_KEY;

  const contentHtml = html || (text ? `<p>${text.replace(/\n/g, '<br/>')}</p>` : '');
  const fullHtml = renderEmailTemplate({ title: subject, contentHtml, actionUrl, actionText, locale: lang });
  const fullText = text || (actionUrl ? `${subject}\n\n${actionUrl}` : subject);

  if (isDevLog || !resendApiKey) {
    log(`[MAIL-DEV-LOG] To: ${to} | Subject: "${subject}" | Lang: ${lang} | Tag: ${tag}${actionUrl ? ` | Link: ${actionUrl}` : ''}`);
    return { success: true, simulated: true, actionUrl, locale: lang, subject, html: fullHtml, text: fullText };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: mailFrom,
        to: [to],
        subject,
        text: fullText,
        html: fullHtml,
        tags: [
          { name: 'category', value: tag },
          { name: 'locale', value: lang }
        ]
      })
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      log(`[MAIL-WARN] Resend returned status ${res.status}: ${JSON.stringify(data)}`);
      return { success: false, error: data?.message || `Resend error ${res.status}`, data };
    }

    log(`[MAIL-SENT] Email terkirim via Resend ke ${to} (id: ${data?.id})`);
    return { success: true, id: data?.id };
  } catch (err) {
    log(`[MAIL-ERR] Gagal menghubungi Resend API: ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * 1. Kirim email verifikasi pendaftaran akun baru
 */
export async function sendVerificationEmail({ to, token, locale = 'id' }) {
  const lang = normalizeLocale(locale);
  const isEn = lang === 'en';
  const appUrl = getAppUrl();
  const verifyUrl = `${appUrl}/verify?token=${encodeURIComponent(token)}`;

  const subject = isEn
    ? 'Verify Your Email Address — Markimate'
    : 'Verifikasi Alamat Email Anda — Markimate';

  const html = isEn ? `
    <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0;">Welcome to Markimate</h2>
    <p>Hello,</p>
    <p>Thank you for creating an account with Markimate. Please verify your email address to activate your 7-day free trial (300 credits).</p>
    <p>This verification link is valid for <strong>24 hours</strong>. Click the button below to confirm your account:</p>
  ` : `
    <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0;">Selamat Datang di Markimate</h2>
    <p>Halo,</p>
    <p>Terima kasih telah mendaftar di Markimate. Silakan verifikasi alamat email Anda untuk mengaktifkan uji coba gratis 7 hari (300 kredit).</p>
    <p>Tautan verifikasi ini berlaku selama <strong>24 jam</strong>. Klik tombol di bawah ini untuk mengonfirmasi akun Anda:</p>
  `;

  return sendMail({
    to,
    subject,
    html,
    actionUrl: verifyUrl,
    actionText: isEn ? 'Verify My Email' : 'Verifikasi Email Saya',
    locale: lang,
    tag: 'email_verification'
  });
}

/**
 * 2. Kirim email tautan reset kata sandi
 */
export async function sendPasswordResetEmail({ to, token, locale = 'id' }) {
  const lang = normalizeLocale(locale);
  const isEn = lang === 'en';
  const appUrl = getAppUrl();
  const resetUrl = `${appUrl}/reset?token=${encodeURIComponent(token)}`;

  const subject = isEn
    ? 'Reset Your Account Password — Markimate'
    : 'Atur Ulang Kata Sandi Akun Anda — Markimate';

  const html = isEn ? `
    <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0;">Password Reset Request</h2>
    <p>Hello,</p>
    <p>We received a request to reset the password for your Markimate account associated with this email address.</p>
    <p>This link is valid for <strong>30 minutes</strong> for your account security. Click the button below to choose a new password:</p>
  ` : `
    <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0;">Permintaan Atur Ulang Kata Sandi</h2>
    <p>Halo,</p>
    <p>Kami menerima permintaan untuk mengatur ulang kata sandi akun Markimate yang terdaftar dengan email ini.</p>
    <p>Tautan ini hanya berlaku selama <strong>30 menit</strong> demi keamanan akun Anda. Klik tombol di bawah untuk membuat kata sandi baru:</p>
  `;

  return sendMail({
    to,
    subject,
    html,
    actionUrl: resetUrl,
    actionText: isEn ? 'Reset Password' : 'Atur Ulang Kata Sandi',
    locale: lang,
    tag: 'password_reset'
  });
}

/**
 * 3. Kirim notifikasi konfirmasi bahwa password telah diubah
 */
export async function sendPasswordChangedNotice({ to, locale = 'id' }) {
  const lang = normalizeLocale(locale);
  const isEn = lang === 'en';

  const subject = isEn
    ? 'Security Notice: Your Markimate Password Was Changed'
    : 'Keamanan: Kata Sandi Akun Markimate Telah Diubah';

  const html = isEn ? `
    <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0;">Account Security Notification</h2>
    <p>Hello,</p>
    <p>The password for your Markimate account was recently changed. All active sessions on other devices have been automatically revoked for your security.</p>
    <p>If you did not perform this change, please contact Markimate support immediately or use the password recovery feature.</p>
  ` : `
    <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0;">Pemberitahuan Keamanan Akun</h2>
    <p>Halo,</p>
    <p>Kata sandi untuk akun Markimate Anda baru saja berhasil diubah. Seluruh sesi login di perangkat lain telah dicabut secara otomatis demi keamanan akun Anda.</p>
    <p>Jika Anda tidak merasa melakukan perubahan ini, segera hubungi tim bantuan Markimate atau gunakan fitur pemulihan kata sandi.</p>
  `;

  return sendMail({
    to,
    subject,
    html,
    locale: lang,
    tag: 'security_notice'
  });
}

/**
 * 4. Kirim verifikasi ke alamat email baru
 */
export async function sendEmailChangeVerification({ to, token, locale = 'id' }) {
  const lang = normalizeLocale(locale);
  const isEn = lang === 'en';
  const appUrl = getAppUrl();
  const verifyUrl = `${appUrl}/verify?token=${encodeURIComponent(token)}`;

  const subject = isEn
    ? 'Confirm Your New Email Address — Markimate'
    : 'Konfirmasi Alamat Email Baru — Markimate';

  const html = isEn ? `
    <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0;">Confirm Email Address Change</h2>
    <p>Hello,</p>
    <p>This email address was registered as the new address for your Markimate account.</p>
    <p>Click the button below to confirm and activate this email address:</p>
  ` : `
    <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0;">Konfirmasi Perubahan Alamat Email</h2>
    <p>Halo,</p>
    <p>Alamat email ini didaftarkan sebagai email baru untuk akun Markimate Anda.</p>
    <p>Klik tombol di bawah untuk mengonfirmasi dan mengaktifkan alamat email baru ini:</p>
  `;

  return sendMail({
    to,
    subject,
    html,
    actionUrl: verifyUrl,
    actionText: isEn ? 'Confirm Email Address' : 'Konfirmasi Alamat Email',
    locale: lang,
    tag: 'email_change_verify'
  });
}

/**
 * 5. Kirim notifikasi peringatan ke alamat email lama
 */
export async function sendEmailChangeNoticeToOldEmail({ to, newEmail, locale = 'id' }) {
  const lang = normalizeLocale(locale);
  const isEn = lang === 'en';

  const subject = isEn
    ? 'Security Notice: Markimate Email Address Change Request'
    : 'Keamanan: Permintaan Perubahan Alamat Email Markimate';

  const html = isEn ? `
    <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0;">Account Email Change Notification</h2>
    <p>Hello,</p>
    <p>We received a request to change your Markimate account email address to <strong>${newEmail}</strong>.</p>
    <p>A verification email has been sent to the new address. If you did not make this request, please secure your account immediately.</p>
  ` : `
    <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0;">Pemberitahuan Perubahan Email Akun</h2>
    <p>Halo,</p>
    <p>Kami menerima permintaan untuk mengubah alamat email akun Markimate Anda menjadi <strong>${newEmail}</strong>.</p>
    <p>Sebuah email verifikasi telah dikirimkan ke alamat email baru tersebut. Jika Anda tidak merasa melakukan perubahan ini, segera amankan akun Anda.</p>
  `;

  return sendMail({
    to,
    subject,
    html,
    locale: lang,
    tag: 'security_notice'
  });
}

/**
 * 6. Kirim email undangan bergabung ke workspace
 */
export async function sendWorkspaceInviteEmail({ to, workspaceName, inviterName, inviteLink, role, locale = 'id' }) {
  const lang = normalizeLocale(locale);
  const isEn = lang === 'en';

  const roleLabel = isEn
    ? (role === 'admin' ? 'Admin' : 'Viewer')
    : (role === 'admin' ? 'Admin' : 'Peninjau');

  const subject = isEn
    ? `Invitation to Join Workspace "${workspaceName}" — Markimate`
    : `Undangan Bergabung ke Workspace "${workspaceName}" — Markimate`;

  const html = isEn ? `
    <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0;">Team Collaboration Invitation</h2>
    <p>Hello,</p>
    <p><strong>${inviterName || 'A team member'}</strong> has invited you to join workspace <strong>${workspaceName}</strong> on Markimate as <strong>${roleLabel}</strong>.</p>
    <p>This invitation is valid for <strong>7 days</strong>. Click the button below to accept and start collaborating:</p>
  ` : `
    <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0;">Undangan Kolaborasi Tim</h2>
    <p>Halo,</p>
    <p><strong>${inviterName || 'Seorang anggota tim'}</strong> telah mengundang Anda untuk bergabung ke workspace <strong>${workspaceName}</strong> di Markimate sebagai <strong>${roleLabel}</strong>.</p>
    <p>Undangan ini berlaku selama <strong>7 hari</strong>. Klik tombol di bawah untuk menerima undangan dan mulai berkolaborasi:</p>
  `;

  return sendMail({
    to,
    subject,
    html,
    actionUrl: inviteLink,
    actionText: isEn ? 'Accept Invitation' : 'Terima Undangan',
    locale: lang,
    tag: 'workspace_invite'
  });
}

/**
 * 7. Kirim email pemberitahuan jadwal penghapusan akun
 */
export async function sendAccountDeletionScheduledEmail({ to, scheduledDate, locale = 'id' }) {
  const lang = normalizeLocale(locale);
  const isEn = lang === 'en';
  const formattedDate = formatEmailDate(scheduledDate, lang);

  const subject = isEn
    ? `Account Scheduled for Deletion on ${formattedDate} — Markimate`
    : `Akun dijadwalkan dihapus pada ${formattedDate} — Markimate`;

  const html = isEn ? `
    <h2 style="font-size: 18px; font-weight: 700; color: #dc2626; margin-top: 0;">Account Deletion Schedule</h2>
    <p>Hello,</p>
    <p>Your request to delete your Markimate account has been received. Your account is scheduled for permanent deletion on <strong>${formattedDate}</strong> (30 days from now).</p>
    <p>During this grace period:</p>
    <ul>
      <li>All active sessions on all devices have been revoked for your security.</li>
      <li>All scheduled automated content workflows have been paused.</li>
    </ul>
    <p><strong>Changed your mind?</strong> You can cancel deletion anytime before the date above simply by signing back into Markimate and selecting <em>Cancel Deletion</em>.</p>
  ` : `
    <h2 style="font-size: 18px; font-weight: 700; color: #dc2626; margin-top: 0;">Jadwal Penghapusan Akun</h2>
    <p>Halo,</p>
    <p>Permintaan penghapusan akun Markimate Anda telah diterima. Akun Anda dijadwalkan untuk dihapus permanen pada <strong>${formattedDate}</strong> (30 hari dari sekarang).</p>
    <p>Selama periode tenggang ini:</p>
    <ul>
      <li>Seluruh sesi aktif di semua perangkat telah dicabut demi keamanan.</li>
      <li>Seluruh jadwal penulisan artikel dan riset topik otomatis telah dihentikan.</li>
    </ul>
    <p><strong>Berubah pikiran?</strong> Anda dapat membatalkan penghapusan kapan saja sebelum tanggal di atas cukup dengan mencoba masuk (login) kembali ke Markimate dan memilih opsi <em>Batalkan Penghapusan</em>.</p>
  `;

  return sendMail({
    to,
    subject,
    html,
    locale: lang,
    tag: 'account_deletion_scheduled'
  });
}

/**
 * 8. Kirim email konfirmasi akun dan data telah dihapus permanen
 */
export async function sendAccountPurgedEmail({ to, locale = 'id' }) {
  const lang = normalizeLocale(locale);
  const isEn = lang === 'en';

  const subject = isEn
    ? 'Your Account and Data Have Been Deleted — Markimate'
    : 'Akun & data Anda sudah dihapus — Markimate';

  const html = isEn ? `
    <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0;">Account Permanently Deleted</h2>
    <p>Hello,</p>
    <p>The 30-day grace period has ended and all your Markimate account data, along with workspace settings, keywords, articles, and CMS connections, have been permanently deleted from our systems.</p>
    <p>Thank you for using Markimate. If you wish to use our services in the future, you are always welcome to register a new account.</p>
  ` : `
    <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0;">Akun Telah Dihapus Permanen</h2>
    <p>Halo,</p>
    <p>Periode 30 hari telah berakhir dan seluruh data akun Markimate Anda beserta data workspace, kata kunci, artikel, dan koneksi CMS telah dihapus permanen dari sistem kami.</p>
    <p>Terima kasih telah pernah menggunakan layanan Markimate. Jika di masa mendatang Anda ingin kembali, Anda selalu dipersilakan mendaftar akun baru.</p>
  `;

  return sendMail({
    to,
    subject,
    html,
    locale: lang,
    tag: 'account_purged'
  });
}

/**
 * 9. Kirim email notifikasi top-up credit berhasil (PRD F14 §4 Langkah 4)
 */
export async function sendTopupSuccessEmail({ to, invoiceNumber, packageName, credits, amount, locale = 'id' }) {
  const lang = normalizeLocale(locale);
  const isEn = lang === 'en';
  const formattedAmount = 'Rp' + Number(amount || 0).toLocaleString('id-ID');

  const subject = isEn
    ? `Credit Top-Up Successful (${invoiceNumber}) — Markimate`
    : `Top-up Kredit Berhasil (${invoiceNumber}) — Markimate`;

  const html = isEn ? `
    <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0;">Top-Up Payment Successful!</h2>
    <p>Hello,</p>
    <p>Your payment for <strong>${packageName}</strong> (${formattedAmount}) has been confirmed successfully.</p>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0 0 8px;"><strong>Invoice:</strong> ${invoiceNumber}</p>
      <p style="margin: 0 0 8px;"><strong>Credits Added:</strong> +${Number(credits || 0).toLocaleString()} credits</p>
      <p style="margin: 0;"><strong>Validity:</strong> 365 days</p>
    </div>
    <p>The credits are now ready to use across all your AI marketing modules in Markimate.</p>
  ` : `
    <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0;">Pembayaran Top-Up Berhasil!</h2>
    <p>Halo,</p>
    <p>Pembayaran Anda untuk <strong>${packageName}</strong> (${formattedAmount}) telah berhasil dikonfirmasi.</p>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0 0 8px;"><strong>Invoice:</strong> ${invoiceNumber}</p>
      <p style="margin: 0 0 8px;"><strong>Kredit Ditambahkan:</strong> +${Number(credits || 0).toLocaleString()} kredit</p>
      <p style="margin: 0;"><strong>Masa Berlaku:</strong> 365 hari</p>
    </div>
    <p>Kredit telah langsung masuk ke dompet workspace Anda dan siap digunakan di seluruh modul AI Markimate.</p>
  `;

  return sendMail({
    to,
    subject,
    html,
    locale: lang,
    tag: 'topup_success'
  });
}

/**
 * 10. Kirim email konfirmasi paket langganan aktif (PRD F14 §4 Langkah 5)
 */
export async function sendSubscriptionSuccessEmail({ to, invoiceNumber, planName, periodDays, amount, endsAt, locale = 'id' }) {
  const lang = normalizeLocale(locale);
  const isEn = lang === 'en';
  const formattedAmount = 'Rp' + Number(amount || 0).toLocaleString('id-ID');
  const formattedEndDate = formatEmailDate(endsAt, lang);

  const subject = isEn
    ? `Subscription Activated: ${planName} (${invoiceNumber}) — Markimate`
    : `Paket Langganan Aktif: ${planName} (${invoiceNumber}) — Markimate`;

  const html = isEn ? `
    <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0;">Subscription Activated!</h2>
    <p>Hello,</p>
    <p>Your payment for <strong>${planName}</strong> (${formattedAmount}) has been verified successfully.</p>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0 0 8px;"><strong>Invoice:</strong> ${invoiceNumber}</p>
      <p style="margin: 0 0 8px;"><strong>Package:</strong> ${planName}</p>
      <p style="margin: 0 0 8px;"><strong>Duration:</strong> ${periodDays || 30} days</p>
      <p style="margin: 0;"><strong>Active Until:</strong> ${formattedEndDate}</p>
    </div>
    <p>All included AI modules have been enabled for your workspace.</p>
  ` : `
    <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0;">Paket Langganan Aktif!</h2>
    <p>Halo,</p>
    <p>Pembayaran Anda untuk paket <strong>${planName}</strong> (${formattedAmount}) telah berhasil diverifikasi.</p>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
      <p style="margin: 0 0 8px;"><strong>Invoice:</strong> ${invoiceNumber}</p>
      <p style="margin: 0 0 8px;"><strong>Paket:</strong> ${planName}</p>
      <p style="margin: 0 0 8px;"><strong>Durasi:</strong> ${periodDays || 30} hari</p>
      <p style="margin: 0;"><strong>Aktif Hingga:</strong> ${formattedEndDate}</p>
    </div>
    <p>Seluruh modul AI yang termasuk dalam paket telah diaktifkan untuk workspace Anda.</p>
  `;

  return sendMail({
    to,
    subject,
    html,
    locale: lang,
    tag: 'subscription_success'
  });
}

/**
 * 11. Kirim email pengingat perpanjangan langganan (PRD F14 §4 Langkah 5)
 */
export async function sendSubscriptionRenewalReminderEmail({ to, planName, endsAt, daysRemaining, renewUrl, locale = 'id' }) {
  const lang = normalizeLocale(locale);
  const isEn = lang === 'en';
  const formattedEndDate = formatEmailDate(endsAt, lang);

  const subject = isEn
    ? `Action Required: Renew Your ${planName} Subscription (${daysRemaining} Days Left) — Markimate`
    : `Pengingat Perpanjangan: Paket ${planName} Berakhir dalam ${daysRemaining} Hari — Markimate`;

  const html = isEn ? `
    <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0;">Subscription Renewal Reminder</h2>
    <p>Hello,</p>
    <p>Your subscription for <strong>${planName}</strong> will expire on <strong>${formattedEndDate}</strong> (${daysRemaining} days remaining).</p>
    <p>Markimate does not automatically charge your payment method. To ensure uninterrupted access to your AI marketing team and scheduled tasks, please renew your subscription below:</p>
  ` : `
    <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0;">Pengingat Perpanjangan Paket</h2>
    <p>Halo,</p>
    <p>Masa aktif paket <strong>${planName}</strong> Anda akan berakhir pada <strong>${formattedEndDate}</strong> (${daysRemaining} hari lagi).</p>
    <p>Markimate tidak memotong otomatis kartu/rekening Anda. Untuk memastikan tim AI Anda tetap aktif menulis dan memantau iklan tanpa terputus, silakan perpanjang paket Anda melalui tombol di bawah:</p>
  `;

  return sendMail({
    to,
    subject,
    html,
    actionUrl: renewUrl,
    actionText: isEn ? 'Renew Subscription' : 'Perpanjang Paket',
    locale: lang,
    tag: 'subscription_renewal_reminder'
  });
}


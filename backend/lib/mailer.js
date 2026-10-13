// Modul Pengiriman Email Transaksional Markimate (Resend REST API)
import dotenv from 'dotenv';
dotenv.config();

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

/**
 * Format template email bermerek Markimate
 */
export function renderEmailTemplate({ title, contentHtml, actionUrl, actionText }) {
  const buttonBlock = actionUrl && actionText ? `
    <div style="margin: 32px 0; text-align: center;">
      <a href="${actionUrl}" style="background-color: #2563eb; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block;">
        ${actionText}
      </a>
    </div>
    <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin-top: 24px; word-break: break-all;">
      Jika tombol di atas tidak dapat diklik, salin dan buka tautan berikut di browser Anda:<br/>
      <a href="${actionUrl}" style="color: #2563eb;">${actionUrl}</a>
    </p>
  ` : '';

  return `<!DOCTYPE html>
<html lang="id">
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
        Markimate <span style="font-size: 12px; font-weight: 500; color: #64748b; margin-left: 6px;">powered by 3Our</span>
      </div>
    </div>
    
    <!-- Body Content -->
    <div style="padding: 32px; font-size: 15px; line-height: 1.6; color: #334155;">
      ${contentHtml}
      ${buttonBlock}
    </div>

    <!-- Footer -->
    <div style="padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.5;">
      <p style="margin: 0 0 8px 0;">Jika kamu tidak meminta email ini, kamu bisa mengabaikannya dengan aman.</p>
      <p style="margin: 0;">&copy; ${new Date().getFullYear()} Markimate · Powered by 3Our Indonesia</p>
    </div>
  </div>
</body>
</html>`;
}

/**
 * Mengirim email transaksional melalui Resend REST API
 */
export async function sendMail({ to, subject, html, text, actionUrl, actionText, tag = 'auth' }) {
  if (!to) return { success: false, error: 'Recipient email required' };

  const isDevLog = process.env.MAIL_DEV_LOG === 'true' || process.env.NODE_ENV === 'test';
  const mailFrom = process.env.MAIL_FROM || process.env.EMAIL_FROM || 'Markimate <noreply@mail.markimate.io>';
  const resendApiKey = process.env.RESEND_API_KEY;

  const contentHtml = html || (text ? `<p>${text.replace(/\n/g, '<br/>')}</p>` : '');
  const fullHtml = renderEmailTemplate({ title: subject, contentHtml, actionUrl, actionText });
  const fullText = text || (actionUrl ? `${subject}\n\nBuka tautan berikut:\n${actionUrl}` : subject);

  // Jika mode dev log aktif (atau test), log link langsung ke console
  if (isDevLog || !resendApiKey) {
    log(`[MAIL-DEV-LOG] To: ${to} | Subject: "${subject}" | Tag: ${tag}${actionUrl ? ` | Link: ${actionUrl}` : ''}`);
    return { success: true, simulated: true, actionUrl };
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
        tags: [{ name: 'category', value: tag }]
      })
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      log(`[MAIL-WARN] Resend returned status ${res.status}: ${JSON.stringify(data)}`);
      // Jangan gagalkan alur jika domain belum terverifikasi di Resend (misal 403)
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
 * Kirim email tautan reset kata sandi
 */
export async function sendPasswordResetEmail({ to, token }) {
  const appUrl = (process.env.APP_URL || 'https://markimate-three.vercel.app').replace(/\/+$/, '');
  const resetUrl = `${appUrl}/reset?token=${encodeURIComponent(token)}`;

  return sendMail({
    to,
    subject: 'Atur Ulang Kata Sandi Akun Anda — Markimate',
    contentHtml: `
      <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0;">Permintaan Atur Ulang Kata Sandi</h2>
      <p>Halo,</p>
      <p>Kami menerima permintaan untuk mengatur ulang kata sandi akun Markimate yang terdaftar dengan email ini.</p>
      <p>Tautan ini hanya berlaku selama <strong>30 menit</strong> demi keamanan akun Anda. Klik tombol di bawah untuk membuat kata sandi baru:</p>
    `,
    actionUrl: resetUrl,
    actionText: 'Atur Ulang Kata Sandi',
    tag: 'password_reset'
  });
}

/**
 * Kirim notifikasi konfirmasi bahwa password telah diubah
 */
export async function sendPasswordChangedNotice({ to }) {
  return sendMail({
    to,
    subject: 'Keamanan: Kata Sandi Akun Markimate Telah Diubah',
    contentHtml: `
      <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0;">Pemberitahuan Keamanan Akun</h2>
      <p>Halo,</p>
      <p>Kata sandi untuk akun Markimate Anda baru saja berhasil diubah. Seluruh sesi login di perangkat lain telah dicabut secara otomatis demi keamanan akun Anda.</p>
      <p>Jika Anda tidak merasa melakukan perubahan ini, segera hubungi tim bantuan Markimate atau gunakan fitur pemulihan kata sandi.</p>
    `,
    tag: 'security_notice'
  });
}

/**
 * Kirim verifikasi ke alamat email baru
 */
export async function sendEmailChangeVerification({ to, token }) {
  const appUrl = (process.env.APP_URL || 'https://markimate-three.vercel.app').replace(/\/+$/, '');
  const verifyUrl = `${appUrl}/verify?token=${encodeURIComponent(token)}`;

  return sendMail({
    to,
    subject: 'Konfirmasi Alamat Email Baru — Markimate',
    contentHtml: `
      <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0;">Konfirmasi Perubahan Alamat Email</h2>
      <p>Halo,</p>
      <p>Alamat email ini didaftarkan sebagai email baru untuk akun Markimate Anda.</p>
      <p>Klik tombol di bawah untuk mengonfirmasi dan mengaktifkan alamat email baru ini:</p>
    `,
    actionUrl: verifyUrl,
    actionText: 'Konfirmasi Alamat Email',
    tag: 'email_change_verify'
  });
}

/**
 * Kirim notifikasi peringatan ke alamat email lama
 */
export async function sendEmailChangeNoticeToOldEmail({ to, newEmail }) {
  return sendMail({
    to,
    subject: 'Keamanan: Permintaan Perubahan Alamat Email Markimate',
    contentHtml: `
      <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0;">Pemberitahuan Perubahan Email Akun</h2>
      <p>Halo,</p>
      <p>Kami menerima permintaan untuk mengubah alamat email akun Markimate Anda menjadi <strong>${newEmail}</strong>.</p>
      <p>Sebuah email verifikasi telah dikirimkan ke alamat email baru tersebut. Jika Anda tidak merasa melakukan perubahan ini, segera amankan akun Anda atau hubungi dukungan 3Our.</p>
    `,
    tag: 'security_notice'
  });
}

/**
 * Kirim email undangan bergabung ke workspace
 */
export async function sendWorkspaceInviteEmail({ to, workspaceName, inviterName, inviteLink, role }) {
  const roleLabel = role === 'admin' ? 'Admin' : 'Viewer (Pengamat)';
  return sendMail({
    to,
    subject: `Undangan Bergabung ke Workspace "${workspaceName}" — Markimate`,
    html: `
      <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0;">Undangan Kolaborasi Tim</h2>
      <p>Halo,</p>
      <p><strong>${inviterName || 'Seorang anggota tim'}</strong> telah mengundang Anda untuk bergabung ke workspace <strong>${workspaceName}</strong> di Markimate sebagai <strong>${roleLabel}</strong>.</p>
      <p>Undangan ini berlaku selama <strong>7 hari</strong>. Klik tombol di bawah untuk menerima undangan dan mulai berkolaborasi:</p>
    `,
    actionUrl: inviteLink,
    actionText: 'Terima Undangan',
    tag: 'workspace_invite'
  });
}

/**
 * Kirim email pemberitahuan jadwal penghapusan akun (PRD F1+F2 Langkah 8)
 */
export async function sendAccountDeletionScheduledEmail({ to, scheduledDate }) {
  return sendMail({
    to,
    subject: `Akun dijadwalkan dihapus pada ${scheduledDate} — Markimate`,
    contentHtml: `
      <h2 style="font-size: 18px; font-weight: 700; color: #dc2626; margin-top: 0;">Jadwal Penghapusan Akun</h2>
      <p>Halo,</p>
      <p>Permintaan penghapusan akun Markimate Anda telah diterima. Akun Anda dijadwalkan untuk dihapus permanen pada <strong>${scheduledDate}</strong> (30 hari dari sekarang).</p>
      <p>Selama periode tenggang ini:</p>
      <ul>
        <li>Seluruh sesi aktif di semua perangkat telah dicabut demi keamanan.</li>
        <li>Seluruh jadwal penulisan artikel dan riset topik otomatis telah dihentikan.</li>
      </ul>
      <p><strong>Berubah pikiran?</strong> Anda dapat membatalkan penghapusan kapan saja sebelum tanggal di atas cukup dengan mencoba masuk (login) kembali ke Markimate dan memilih opsi <em>Batalkan Penghapusan</em>.</p>
    `,
    tag: 'account_deletion_scheduled'
  });
}

/**
 * Kirim email konfirmasi akun dan data telah dihapus permanen (PRD F1+F2 Langkah 8)
 */
export async function sendAccountPurgedEmail({ to }) {
  return sendMail({
    to,
    subject: 'Akun & data kamu sudah dihapus — Markimate',
    contentHtml: `
      <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 0;">Akun Telah Dihapus</h2>
      <p>Halo,</p>
      <p>Periode 30 hari telah berakhir dan seluruh data akun Markimate Anda beserta data workspace, kata kunci, artikel, dan koneksi CMS telah dihapus permanen dari sistem kami.</p>
      <p>Terima kasih telah pernah menggunakan layanan Markimate. Jika di masa mendatang Anda ingin kembali, Anda selalu dipersilakan mendaftar akun baru.</p>
    `,
    tag: 'account_purged'
  });
}



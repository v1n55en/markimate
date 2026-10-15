import { LanguageToggle } from '../../context/LanguageContext';

/**
 * Layout pembungkus untuk seluruh rute otentikasi (login, register, forgot, reset, verify, invite)
 * Menyediakan satu toggle bahasa (.lang-toggle) di pojok kanan atas layar dengan touch target >= 44px
 */
export default function AuthLayout({ children }) {
  return (
    <div className="auth-layout-wrapper">
      <div className="auth-header-toggle">
        <LanguageToggle />
      </div>
      {children}
    </div>
  );
}

// frontend/src/pages/ads/AdsDeckSettings.jsx
// Deck Google Slides milik user per template (PRD F5 opsi A):
// salin template Markimate → bagikan ke email layanan (Viewer) → tempel URL → cek → pakai.

import { useEffect, useState } from 'react';
import { Presentation, ExternalLink, Copy, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { useLanguage } from '../../i18n/LanguageContext';
import { getDeckConfig, checkDeck, saveTemplate } from '../../ads/adsApi';

const ISSUE_KEYS = [
  'unknown_layout',
  'duplicate_layout',
  'unknown_placeholder',
  'missing_placeholder',
  'chart_in_group',
  'not_image',
  'not_table',
  'table_too_small',
  'missing_alt',
  'no_layouts'
];

export default function AdsDeckSettings({ template, pageTypes, onSaved }) {
  const { t } = useLanguage();
  const [config, setConfig] = useState(null);
  const [url, setUrl] = useState('');
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const currentId = template?.spec?.deck?.presentationId || null;
  const isSystem = Boolean(template?.is_system);

  useEffect(() => {
    let alive = true;
    getDeckConfig()
      .then((c) => alive && setConfig(c))
      .catch(() => alive && setConfig({}));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    setUrl('');
    setResult(null);
    setError('');
  }, [template?.id]);

  const handleCheck = async () => {
    setChecking(true);
    setResult(null);
    setError('');
    try {
      const res = await checkDeck(url, [...new Set(pageTypes)]);
      setResult(res.deck);
    } catch (err) {
      setError(err.message || t('common.error'));
    } finally {
      setChecking(false);
    }
  };

  const persist = async (presentationId) => {
    setSaving(true);
    setError('');
    try {
      const spec = { ...template.spec, deck: presentationId ? { presentationId } : null };
      const res = await saveTemplate({ spec }, template.id);
      setResult(null);
      setUrl('');
      onSaved?.(res.template, presentationId ? t('ads.deck.savedSuccess') : t('ads.deck.removedSuccess'));
    } catch (err) {
      setError(err.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText(config.serviceEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const issueText = (i) => {
    const key = ISSUE_KEYS.includes(i.code) ? i.code : 'unknown';
    const text = t(`ads.deck.issues.${key}`, { detail: i.detail || '', layout: i.layout || '' });
    return i.slide ? `${t('ads.deck.slideLabel', { n: i.slide })}: ${text}` : text;
  };

  return (
    <div className="ads-deck">
      <div className="ads-deck-head">
        <Presentation size={18} color="var(--accent-cyan)" />
        <h4 className="ads-deck-title">{t('ads.deck.heading')}</h4>
      </div>

      <div className="ads-deck-current">
        {currentId ? (
          <>
            <span className="ads-badge ads-badge-active">{t('ads.deck.usingCustom')}</span>
            <a
              className="ads-deck-link"
              href={`https://docs.google.com/presentation/d/${currentId}/edit`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span>{t('ads.deck.openDeck')}</span>
              <ExternalLink size={13} />
            </a>
          </>
        ) : (
          <span className="ads-badge ads-badge-system">{t('ads.deck.usingDefault')}</span>
        )}
      </div>

      {isSystem ? (
        <p className="ads-form-help">{t('ads.deck.systemNotice')}</p>
      ) : (
        <>
          <ol className="ads-deck-steps">
            <li>
              <span>{t('ads.deck.step1')}</span>
              {config?.templateCopyUrl && (
                <a className="ads-btn ads-btn-secondary ads-deck-btn" href={config.templateCopyUrl} target="_blank" rel="noopener noreferrer">
                  <Copy size={14} />
                  <span>{t('ads.deck.copyTemplateBtn')}</span>
                </a>
              )}
            </li>
            <li>
              <span>{t('ads.deck.step2')}</span>
              {config?.serviceEmail && (
                <button type="button" className="ads-deck-email" onClick={handleCopyEmail} title={t('ads.deck.copyEmail')}>
                  <code>{config.serviceEmail}</code>
                  {copied ? <CheckCircle2 size={14} color="#10b981" /> : <Copy size={14} />}
                </button>
              )}
            </li>
            <li>
              <span>{t('ads.deck.step3')}</span>
            </li>
          </ol>

          <div className="ads-form-group">
            <label className="ads-form-label" htmlFor="ads-deck-url">{t('ads.deck.urlLabel')}</label>
            <div className="ads-deck-row">
              <input
                id="ads-deck-url"
                type="url"
                inputMode="url"
                className="ads-input"
                placeholder="https://docs.google.com/presentation/d/…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
              <button
                type="button"
                className="ads-btn ads-btn-secondary ads-deck-btn"
                onClick={handleCheck}
                disabled={!url.trim() || checking}
              >
                {checking ? <RefreshCw size={14} className="spin" /> : null}
                <span>{t('ads.deck.checkBtn')}</span>
              </button>
            </div>
            <span className="ads-form-help">{t('ads.deck.help')}</span>
          </div>

          {error && (
            <div className="ads-deck-msg ads-deck-msg-error">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className={`ads-deck-msg ${result.ready && !result.issues.length ? 'ads-deck-msg-ok' : 'ads-deck-msg-warn'}`}>
              <div className="ads-deck-msg-body">
                <strong>{t('ads.deck.checkOk', { title: result.title || '—', count: result.layouts.length })}</strong>
                {result.missingRequired.length > 0 && (
                  <span>{t('ads.deck.missingForTemplate', { types: result.missingRequired.join(', ') })}</span>
                )}
                {result.issues.length > 0 && (
                  <ul className="ads-deck-issues">
                    {result.issues.map((i, idx) => (
                      <li key={idx}>{issueText(i)}</li>
                    ))}
                  </ul>
                )}
                {result.ready && !result.issues.length && <span>{t('ads.deck.allGood')}</span>}
              </div>
              <button
                type="button"
                className="ads-btn ads-btn-primary ads-deck-btn"
                onClick={() => persist(result.presentationId)}
                disabled={saving || result.layouts.length === 0}
              >
                <span>{t('ads.deck.useBtn')}</span>
              </button>
            </div>
          )}

          {currentId && (
            <button type="button" className="ads-btn ads-btn-secondary ads-deck-btn" onClick={() => persist(null)} disabled={saving}>
              <span>{t('ads.deck.removeBtn')}</span>
            </button>
          )}
        </>
      )}
    </div>
  );
}

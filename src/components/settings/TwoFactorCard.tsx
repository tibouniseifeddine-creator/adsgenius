import React, { useEffect, useState } from 'react';
import * as QRCode from 'qrcode';
import { ShieldCheck, ShieldOff, Copy, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { apiFetch } from '../../lib/api';

// See audit finding P12 -- account takeover from a leaked/guessed password
// was previously stopped only by rate limiting, never by a second factor.
// This card is the Settings-page half of TOTP-based 2FA; the login-time half
// lives in Auth.tsx / AuthContext.tsx's verifyTwoFactorLogin.
//
// State machine: idle (status.enabled === false) -> "setting up" (secret
// issued by /2fa/setup, not yet active) -> "showing recovery codes" (just
// turned on, codes shown exactly once) -> enabled (status.enabled === true).
export function TwoFactorCard() {
  const [status, setStatus] = useState<{ enabled: boolean; recoveryCodesRemaining: number } | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  const [settingUp, setSettingUp] = useState(false);
  const [setupSecret, setSetupSecret] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  const [disablePassword, setDisablePassword] = useState('');
  const [disabling, setDisabling] = useState(false);
  const [disableError, setDisableError] = useState<string | null>(null);

  const [regenCode, setRegenCode] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);
  const [showRegenForm, setShowRegenForm] = useState(false);

  const loadStatus = () => {
    setLoadingStatus(true);
    apiFetch<{ enabled: boolean; recoveryCodesRemaining: number }>('/api/auth/2fa/status')
      .then(setStatus)
      .catch(() => setStatus(null))
      .finally(() => setLoadingStatus(false));
  };

  useEffect(loadStatus, []);

  const startSetup = async () => {
    setSetupError(null);
    try {
      const data = await apiFetch<{ secret: string; otpauthUrl: string }>('/api/auth/2fa/setup', { method: 'POST' });
      setSetupSecret(data.secret);
      setQrDataUrl(await QRCode.toDataURL(data.otpauthUrl, { width: 220, margin: 1 }));
      setSettingUp(true);
    } catch (e) {
      setSetupError(e instanceof Error ? e.message : 'Failed to start two-factor setup');
    }
  };

  const cancelSetup = () => {
    setSettingUp(false);
    setSetupSecret(null);
    setQrDataUrl(null);
    setVerifyCode('');
    setSetupError(null);
  };

  const confirmSetup = async () => {
    setVerifying(true);
    setSetupError(null);
    try {
      const data = await apiFetch<{ enabled: boolean; recoveryCodes: string[] }>('/api/auth/2fa/verify', { body: { code: verifyCode } });
      setRecoveryCodes(data.recoveryCodes);
      cancelSetup();
      loadStatus();
    } catch (e) {
      setSetupError(e instanceof Error ? e.message : 'Invalid code');
    } finally {
      setVerifying(false);
    }
  };

  const copyRecoveryCodes = async () => {
    if (!recoveryCodes) return;
    try {
      await navigator.clipboard.writeText(recoveryCodes.join('\n'));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can fail (permissions, insecure context) -- the codes
      // are still visible on screen to copy manually, so this is non-fatal.
    }
  };

  const disable = async () => {
    setDisabling(true);
    setDisableError(null);
    try {
      await apiFetch('/api/auth/2fa/disable', { body: { password: disablePassword } });
      setDisablePassword('');
      loadStatus();
    } catch (e) {
      setDisableError(e instanceof Error ? e.message : 'Failed to disable two-factor authentication');
    } finally {
      setDisabling(false);
    }
  };

  const regenerateRecoveryCodes = async () => {
    setRegenerating(true);
    setRegenError(null);
    try {
      const data = await apiFetch<{ recoveryCodes: string[] }>('/api/auth/2fa/recovery-codes', { body: { code: regenCode } });
      setRecoveryCodes(data.recoveryCodes);
      setRegenCode('');
      setShowRegenForm(false);
      loadStatus();
    } catch (e) {
      setRegenError(e instanceof Error ? e.message : 'Invalid code');
    } finally {
      setRegenerating(false);
    }
  };

  return (
    <Card title="Two-Factor Authentication" icon={<ShieldCheck className="w-5 h-5" />}>
      <div className="space-y-4">
        {/* Recovery codes are only ever available right after enabling or
            regenerating -- never retrievable again afterwards, so this panel
            takes over the whole card until the user dismisses it. */}
        {recoveryCodes ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              Save these recovery codes somewhere safe. Each one can be used once to sign in if you lose access to your authenticator app.
              <strong> They will not be shown again.</strong>
            </p>
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3 font-mono text-sm">
              {recoveryCodes.map(code => <span key={code}>{code}</span>)}
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={copyRecoveryCodes}>
                {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                {copied ? 'Copied' : 'Copy codes'}
              </Button>
              <Button size="sm" onClick={() => setRecoveryCodes(null)}>I've saved these codes</Button>
            </div>
          </div>
        ) : loadingStatus ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : settingUp ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">Scan this QR code with an authenticator app (Google Authenticator, Authy, 1Password, etc.), then enter the 6-digit code it shows.</p>
            {qrDataUrl && <img src={qrDataUrl} alt="Two-factor setup QR code" className="mx-auto rounded-lg border border-gray-200" width={220} height={220} />}
            {setupSecret && (
              <p className="text-center text-xs text-gray-500">
                Can't scan it? Enter this key manually: <span className="font-mono tracking-wider">{setupSecret}</span>
              </p>
            )}
            <Input label="6-digit code" inputMode="numeric" maxLength={6} value={verifyCode}
              onChange={e => setVerifyCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" />
            {setupError && <p className="flex items-center gap-1.5 text-sm text-red-600"><AlertCircle className="w-4 h-4" />{setupError}</p>}
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={cancelSetup}>Cancel</Button>
              <Button size="sm" onClick={confirmSetup} loading={verifying} disabled={verifyCode.length !== 6}>Verify & enable</Button>
            </div>
          </div>
        ) : status?.enabled ? (
          <div className="space-y-4">
            <p className="flex items-center gap-1.5 text-sm text-emerald-600"><Check className="w-4 h-4" />Two-factor authentication is enabled.</p>
            <p className="text-sm text-gray-500">{status.recoveryCodesRemaining} unused recovery code{status.recoveryCodesRemaining === 1 ? '' : 's'} remaining.</p>

            {showRegenForm ? (
              <div className="space-y-2 rounded-lg border border-gray-200 p-3">
                <Input label="Current 6-digit code" inputMode="numeric" maxLength={6} value={regenCode}
                  onChange={e => setRegenCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" />
                {regenError && <p className="flex items-center gap-1.5 text-sm text-red-600"><AlertCircle className="w-4 h-4" />{regenError}</p>}
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => { setShowRegenForm(false); setRegenCode(''); setRegenError(null); }}>Cancel</Button>
                  <Button size="sm" onClick={regenerateRecoveryCodes} loading={regenerating} disabled={regenCode.length !== 6}>Generate new codes</Button>
                </div>
              </div>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setShowRegenForm(true)}><RefreshCw className="w-4 h-4 mr-2" />Regenerate recovery codes</Button>
            )}

            <div className="space-y-2 rounded-lg border border-gray-200 p-3">
              <Input label="Current password" type="password" value={disablePassword} onChange={e => setDisablePassword(e.target.value)} />
              {disableError && <p className="flex items-center gap-1.5 text-sm text-red-600"><AlertCircle className="w-4 h-4" />{disableError}</p>}
              <Button variant="danger" size="sm" onClick={disable} loading={disabling} disabled={!disablePassword}>
                <ShieldOff className="w-4 h-4 mr-2" />Disable two-factor authentication
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Add an extra layer of security: after your password, you'll also need a code from an authenticator app to sign in.</p>
            {setupError && <p className="flex items-center gap-1.5 text-sm text-red-600"><AlertCircle className="w-4 h-4" />{setupError}</p>}
            <Button size="sm" onClick={startSetup}>Enable two-factor authentication</Button>
          </div>
        )}
      </div>
    </Card>
  );
}

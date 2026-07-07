import type { SaveAccountResult, SwitchAccountResult } from '@/lib/bridge';

export const normalizeSwitchAccountResult = (value: unknown): SwitchAccountResult => {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as Partial<SwitchAccountResult> & {
        success?: boolean;
        requiresManualLaunch?: boolean;
        error?: string;
      };

      return {
        Success: Boolean(parsed.Success ?? parsed.success),
        RequiresManualLaunch: Boolean(parsed.RequiresManualLaunch ?? parsed.requiresManualLaunch),
        Error: parsed.Error ?? parsed.error ?? '',
      };
    } catch {}
  }

  if (typeof value === 'boolean') {
    return {
      Success: value,
      RequiresManualLaunch: false,
      Error: value ? '' : 'switch_failed',
    };
  }

  return {
    Success: false,
    RequiresManualLaunch: false,
    Error: 'invalid_result',
  };
};

export const normalizeSaveAccountResult = (value: unknown): SaveAccountResult => {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as Partial<SaveAccountResult> & {
        success?: boolean;
        sessionStateSaved?: boolean;
        error?: string;
      };
      const success = Boolean(parsed.Success ?? parsed.success);

      return {
        Success: success,
        SessionStateSaved: Boolean(parsed.SessionStateSaved ?? parsed.sessionStateSaved ?? success),
        Error: parsed.Error ?? parsed.error ?? '',
      };
    } catch {}
  }

  if (typeof value === 'boolean') {
    return {
      Success: value,
      SessionStateSaved: value,
      Error: value ? '' : 'save_failed',
    };
  }

  return {
    Success: false,
    SessionStateSaved: false,
    Error: 'invalid_result',
  };
};

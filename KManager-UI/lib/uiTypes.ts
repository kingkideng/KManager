export type TopNotice = {
  id: number;
  type: 'success' | 'warning' | 'error';
  message: string;
};

export type HelpTab = 'first' | 'upgrade' | 'faq';

export type ConfirmDialog = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
};

export const HELP_TABS: { id: HelpTab; label: string }[] = [
  { id: 'first', label: '首次使用' },
  { id: 'upgrade', label: '旧版升级' },
  { id: 'faq', label: '常见问题' },
];

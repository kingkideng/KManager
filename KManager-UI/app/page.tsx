'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { getBridge, type Account, type Group } from '@/lib/bridge';
import {
  DEFAULT_GROUP_ID,
  EXPANDED_GROUPS_KEY,
  HELP_SEEN_KEY,
  HELP_SEEN_VERSION,
  MAX_AVATAR_BYTES,
  REPOSITORY_URL,
} from '@/lib/appConfig';
import {
  ACCOUNT_REGIONS,
  DEFAULT_ACCOUNT_REGION,
  UNTAGGED_ACCOUNT_REGION,
  getAccountRegionBadgeClass,
  getAccountRegionLabel,
  isAccountRegionTagged,
  normalizeAccountRegion,
} from '@/lib/accountRegions';
import { normalizeSaveAccountResult, normalizeSwitchAccountResult } from '@/lib/bridgeResults';
import { HELP_TABS, type ConfirmDialog, type HelpTab, type TopNotice } from '@/lib/uiTypes';
import { KLogoBrand } from '@/components/KLogoBrand';
import { Toggle } from '@/components/Toggle';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play, Copy, Trash2, X, Sparkles, PlusCircle, Plus,
  Loader2, Check, AlertCircle, Moon, Sun, ChevronDown,
  ChevronRight, FolderPlus, MoreHorizontal, Pencil, Github, Minus,
  ImagePlus, HelpCircle
} from 'lucide-react';

export default function App() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [autoStart, setAutoStart] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isHelpRequired, setIsHelpRequired] = useState(false);
  const [helpTab, setHelpTab] = useState<HelpTab>('first');
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialog | null>(null);
  const [modalMode, setModalMode] = useState<'select' | 'save' | 'edit'>('select');
  const [isDarkMode, setIsDarkMode] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : true
  );
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [remark, setRemark] = useState('');
  const [battleTag, setBattleTag] = useState('');
  const [saveGroupId, setSaveGroupId] = useState(DEFAULT_GROUP_ID);
  const [accountRegion, setAccountRegion] = useState(DEFAULT_ACCOUNT_REGION);
  const [loginRegion, setLoginRegion] = useState(UNTAGGED_ACCOUNT_REGION);
  const [accountAvatarDataUrl, setAccountAvatarDataUrl] = useState('');
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [topNotice, setTopNotice] = useState<TopNotice | null>(null);
  const [switchingAccountId, setSwitchingAccountId] = useState<string | null>(null);
  const [openAccountMenuId, setOpenAccountMenuId] = useState<string | null>(null);
  const [draggingAccountId, setDraggingAccountId] = useState<string | null>(null);
  const expandedInitialized = useRef(false);
  const noticeIdRef = useRef(0);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const showTopNotice = (message: string, type: TopNotice['type'] = 'warning') => {
    noticeIdRef.current += 1;
    setTopNotice({ id: noticeIdRef.current, type, message });
  };

  const activeAccount = accounts[0] ?? null;
  const activeGroupId = activeAccount?.GroupId || DEFAULT_GROUP_ID;

  const orderedGroups = useMemo(() => {
    const next = [...groups];
    if (!next.some(group => group.Id === DEFAULT_GROUP_ID)) {
      next.unshift({ Id: DEFAULT_GROUP_ID, Name: '默认分组', CreatedAt: new Date(0).toISOString() });
    }
    return next.sort((a, b) => {
      if (a.Id === DEFAULT_GROUP_ID) return -1;
      if (b.Id === DEFAULT_GROUP_ID) return 1;
      return new Date(a.CreatedAt).getTime() - new Date(b.CreatedAt).getTime();
    });
  }, [groups]);

  const accountsByGroup = useMemo(() => {
    const validGroupIds = new Set(orderedGroups.map(group => group.Id));
    const buckets: Record<string, Account[]> = {};
    for (const group of orderedGroups) buckets[group.Id] = [];
    for (const account of accounts) {
      const groupId = validGroupIds.has(account.GroupId) ? account.GroupId : DEFAULT_GROUP_ID;
      buckets[groupId] = buckets[groupId] || [];
      buckets[groupId].push(account);
    }
    return buckets;
  }, [accounts, orderedGroups]);

  const visibleAccounts = useMemo(() => {
    return accounts.filter(account => expandedGroupIds.has(account.GroupId || DEFAULT_GROUP_ID));
  }, [accounts, expandedGroupIds]);

  const visibleAccountIds = useMemo(() => visibleAccounts.map(account => account.Id).join('|'), [visibleAccounts]);

  const loadData = async () => {
    try {
      const bridge = getBridge();
      const [accountsJson, groupsJson] = await Promise.all([
        bridge.GetAccounts(),
        bridge.GetGroups(),
      ]);
      const nextGroups = (JSON.parse(groupsJson) as Group[]).map(group => ({
        ...group,
        Name: group.Name || '未命名分组',
      }));
      const validGroupIds = new Set(nextGroups.map(group => group.Id));
      validGroupIds.add(DEFAULT_GROUP_ID);
      const nextAccounts = (JSON.parse(accountsJson) as Account[])
        .map(account => {
          const storedAvatar = typeof window !== 'undefined'
            ? localStorage.getItem('avatar_' + account.Id)
            : null;

          return {
            ...account,
            GroupId: account.GroupId && validGroupIds.has(account.GroupId) ? account.GroupId : DEFAULT_GROUP_ID,
            Region: normalizeAccountRegion(account.Region),
            AvatarDataUrl: account.AvatarDataUrl || storedAvatar || '',
          };
        })
        .sort((a, b) => new Date(b.LastUsed).getTime() - new Date(a.LastUsed).getTime());

      setGroups(nextGroups);
      setAccounts(nextAccounts);

      if (!expandedInitialized.current) {
        let restored: string[] | null = null;
        try {
          restored = JSON.parse(localStorage.getItem(EXPANDED_GROUPS_KEY) || 'null');
        } catch {}

        const fallbackGroupId = nextAccounts[0]?.GroupId || DEFAULT_GROUP_ID;
        const restoredSet = new Set((restored || []).filter(id => validGroupIds.has(id)));
        setExpandedGroupIds(restoredSet.size > 0 ? restoredSet : new Set([fallbackGroupId]));
        expandedInitialized.current = true;
      }
    } catch (e) {
      console.error('Failed to load data', e);
    }
  };

  useEffect(() => {
    const matchMedia = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    matchMedia.addEventListener('change', handleChange);

    const init = async () => {
      try {
        const bridge = getBridge();
        await loadData();
        const auto = await bridge.GetAutoStart();
        setAutoStart(auto);
        try {
          if (localStorage.getItem(HELP_SEEN_KEY) !== HELP_SEEN_VERSION) {
            setHelpTab('first');
            setIsHelpRequired(true);
            setIsHelpOpen(true);
          }
        } catch {}
      } catch (e) {
        console.error('Core init failed', e);
      } finally {
        setLoading(false);
      }
    };
    init();
    return () => matchMedia.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    if (!expandedInitialized.current) return;
    localStorage.setItem(EXPANDED_GROUPS_KEY, JSON.stringify([...expandedGroupIds]));
  }, [expandedGroupIds]);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;

      setAvatars(prev => {
        let changed = false;
        const next = { ...prev };
        for (const account of visibleAccounts) {
          if (!next[account.Id]) {
            const stored = localStorage.getItem('avatar_' + account.Id);
            if (stored) {
              next[account.Id] = stored;
              changed = true;
            }
          }
        }
        return changed ? next : prev;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [visibleAccountIds, visibleAccounts]);

  useEffect(() => {
    if (!topNotice || topNotice.type !== 'success') return;

    const timer = window.setTimeout(() => {
      setTopNotice(current => current?.id === topNotice.id ? null : current);
    }, 4200);

    return () => window.clearTimeout(timer);
  }, [topNotice]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  const openHelp = (tab: HelpTab = 'faq') => {
    setIsHelpRequired(false);
    setHelpTab(tab);
    setIsHelpOpen(true);
  };

  const closeHelp = () => {
    if (isHelpRequired) return;
    setIsHelpOpen(false);
  };

  const finishRequiredHelp = () => {
    try {
      localStorage.setItem(HELP_SEEN_KEY, HELP_SEEN_VERSION);
    } catch {}
    setIsHelpRequired(false);
    setIsHelpOpen(false);
  };

  const advanceRequiredHelp = () => {
    if (helpTab === 'first') {
      setHelpTab('upgrade');
      return;
    }

    if (helpTab === 'upgrade') {
      setHelpTab('faq');
      return;
    }

    finishRequiredHelp();
  };

  const confirmCurrentDialog = async () => {
    const action = confirmDialog?.onConfirm;
    if (!action) return;

    setConfirmDialog(null);
    await action();
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const ensureGroupExpanded = (groupId: string) => {
    setExpandedGroupIds(prev => {
      if (prev.has(groupId)) return prev;
      const next = new Set(prev);
      next.add(groupId);
      return next;
    });
  };

  const resetAccountForm = () => {
    setEditingAccountId(null);
    setRemark('');
    setBattleTag('');
    setAccountRegion(DEFAULT_ACCOUNT_REGION);
    setLoginRegion(UNTAGGED_ACCOUNT_REGION);
    setAccountAvatarDataUrl('');
    setSaveError(null);
    if (avatarInputRef.current) {
      avatarInputRef.current.value = '';
    }
  };

  const chooseAvatar = () => {
    avatarInputRef.current?.click();
  };

  const clearAvatar = () => {
    setAccountAvatarDataUrl('');
    if (avatarInputRef.current) {
      avatarInputRef.current.value = '';
    }
  };

  const handleAvatarFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setSaveError('请选择图片文件作为头像。');
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      setSaveError('头像图片过大，请选择 700KB 以下的图片。');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setAccountAvatarDataUrl(result);
      setSaveError(null);
    };
    reader.onerror = () => setSaveError('头像读取失败，请换一张图片。');
    reader.readAsDataURL(file);
  };

  const createGroup = async () => {
    const name = window.prompt('输入新分组名称');
    if (!name?.trim()) return;

    try {
      const bridge = getBridge();
      const groupJson = await bridge.CreateGroup(name.trim());
      const group = JSON.parse(groupJson) as Group | null;
      if (group?.Id) {
        ensureGroupExpanded(group.Id);
        setSaveGroupId(group.Id);
      }
      await loadData();
    } catch {
      window.alert('创建分组失败');
    }
  };

  const renameGroup = async (group: Group) => {
    if (group.Id === DEFAULT_GROUP_ID) return;
    const name = window.prompt('输入新的分组名称', group.Name);
    if (!name?.trim() || name.trim() === group.Name) return;

    try {
      const bridge = getBridge();
      const success = await bridge.RenameGroup(group.Id, name.trim());
      if (!success) {
        window.alert('重命名失败，可能存在同名分组。');
        return;
      }
      await loadData();
    } catch {
      window.alert('重命名失败');
    }
  };

  const deleteGroup = (group: Group) => {
    if (group.Id === DEFAULT_GROUP_ID) return;

    setConfirmDialog({
      title: '删除分组',
      message: `确定要删除“${group.Name}”分组吗？组内账号会移动到默认分组，账号本身不会被删除。`,
      confirmLabel: '删除分组',
      danger: true,
      onConfirm: async () => {
        try {
          const bridge = getBridge();
          const success = await bridge.DeleteGroup(group.Id);
          if (!success) {
            showTopNotice('删除分组失败，请稍后重试。', 'error');
            return;
          }
          setExpandedGroupIds(prev => {
            const next = new Set(prev);
            next.delete(group.Id);
            next.add(DEFAULT_GROUP_ID);
            return next;
          });
          await loadData();
        } catch {
          showTopNotice('删除分组失败，请稍后重试。', 'error');
        }
      },
    });
  };

  const requestDeleteAccount = (account: Account) => {
    setOpenAccountMenuId(null);
    setConfirmDialog({
      title: '删除账号',
      message: `确定要删除“${account.Remark || '未命名账号'}”这个账号记录吗？这只会删除 KManager 里的记录，不会删除战网账号。`,
      confirmLabel: '删除账号',
      danger: true,
      onConfirm: () => deleteAccount(account.Id),
    });
  };

  const showLegacyAccountReminder = (account?: Account) => {
    setConfirmDialog({
      title: '补全旧账号信息',
      message: '已按旧版方式打开战网。\n\n请先确认这个账号已经在战网里登录成功。\n\n登录成功后，点击“去编辑区服”，选择亚服、美服、欧服或国服并保存。\n\n保存区服后，再从账号卡片菜单点击“更新登录状态”。',
      confirmLabel: '去编辑区服',
      cancelLabel: '稍后处理',
      onConfirm: () => {
        if (account) {
          openEditAccount(account);
          return;
        }

        showTopNotice('请在账号卡片菜单里选择“编辑信息”，补充区服后再更新登录状态。', 'warning');
      },
    });
  };

  const legacyAccountSwitchFailed = (error?: string) => error === 'untagged_region';

  const showSwitchFailure = (error?: string) => {
    if (legacyAccountSwitchFailed(error)) {
      showTopNotice('这个旧账号还没有区服信息。已保留旧版数据，请先用“编辑信息”补充区服后再切换。', 'warning');
      return;
    }

    showTopNotice('切换失败：未找到账号配置，或未能确认战网已完全退出。', 'error');
  };

  const moveAccountToGroup = async (accountId: string, groupId: string) => {
    const account = accounts.find(item => item.Id === accountId);
    if (!account || account.GroupId === groupId) {
      setOpenAccountMenuId(null);
      return;
    }

    setOpenAccountMenuId(null);
    ensureGroupExpanded(groupId);
    setAccounts(prev => prev.map(item => item.Id === accountId ? { ...item, GroupId: groupId } : item));

    try {
      const bridge = getBridge();
      const success = await bridge.MoveAccountToGroup(accountId, groupId);
      if (!success) {
        await loadData();
      }
    } catch {
      await loadData();
    }
  };

  const openEditAccount = (account: Account) => {
    setOpenAccountMenuId(null);
    setEditingAccountId(account.Id);
    setRemark(account.Remark || '');
    setBattleTag(account.Username || '');
    setSaveGroupId(account.GroupId || DEFAULT_GROUP_ID);
    setAccountRegion(normalizeAccountRegion(account.Region));
    setAccountAvatarDataUrl(account.AvatarDataUrl || avatars[account.Id] || '');
    setSaveError(null);
    setModalMode('edit');
    setIsModalOpen(true);
  };

  const updateAccountInfo = async () => {
    if (!editingAccountId) return;

    setSaveError(null);
    setSaveLoading(true);
    try {
      const bridge = getBridge();
      const nextRemark = remark.trim() || '未命名账号';
      const nextBattleTag = battleTag.trim();
      const targetGroupId = orderedGroups.some(group => group.Id === saveGroupId) ? saveGroupId : DEFAULT_GROUP_ID;
      const targetRegion = normalizeAccountRegion(accountRegion);
      const currentAccount = accounts.find(account => account.Id === editingAccountId);
      if (!isAccountRegionTagged(targetRegion)) {
        setSaveError('请先为这个账号选择区服。');
        return;
      }

      const success = await bridge.UpdateAccountInfo(editingAccountId, nextRemark, nextBattleTag, targetRegion, accountAvatarDataUrl);
      if (!success) {
        setSaveError('保存失败，请确认账号记录仍然存在。');
        return;
      }

      if (currentAccount && currentAccount.GroupId !== targetGroupId) {
        const moved = await bridge.MoveAccountToGroup(editingAccountId, targetGroupId);
        if (!moved) {
          setSaveError('账号信息已保存，但移动分组失败。');
          await loadData();
          return;
        }
      }

      setAccounts(prev => prev.map(account => account.Id === editingAccountId
        ? { ...account, Remark: nextRemark, Username: nextBattleTag, GroupId: targetGroupId, Region: targetRegion, AvatarDataUrl: accountAvatarDataUrl }
        : account));
      if (accountAvatarDataUrl) {
        localStorage.setItem('avatar_' + editingAccountId, accountAvatarDataUrl);
      } else {
        localStorage.removeItem('avatar_' + editingAccountId);
      }
      setAvatars(prev => {
        const next = { ...prev };
        if (accountAvatarDataUrl) {
          next[editingAccountId] = accountAvatarDataUrl;
        } else {
          delete next[editingAccountId];
        }
        return next;
      });
      ensureGroupExpanded(targetGroupId);
      setIsModalOpen(false);
      resetAccountForm();
      showTopNotice('账号信息已保存。', 'success');
      await loadData();
    } catch {
      setSaveError('发生了未知错误');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDrop = async (groupId: string, e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    const accountId = e.dataTransfer.getData('text/plain') || draggingAccountId;
    setDraggingAccountId(null);
    if (accountId) {
      await moveAccountToGroup(accountId, groupId);
    }
  };

  const handleToggleAutoStart = async (enabled: boolean) => {
    setAutoStart(enabled);
    try {
      const bridge = getBridge();
      await bridge.SetAutoStart(enabled);
    } catch {}
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const switchAccount = async (id: string) => {
    if (switchingAccountId) return;

    const targetAccount = accounts.find(account => account.Id === id);
    setTopNotice(null);
    setSwitchingAccountId(id);

    try {
      const bridge = getBridge();
      const switchResult = normalizeSwitchAccountResult(
        typeof bridge.SwitchAccountDetailed === 'function'
          ? await bridge.SwitchAccountDetailed(id)
          : await bridge.SwitchAccount(id)
      );

      if (!switchResult.Success) {
        showSwitchFailure(switchResult.Error);
        await loadData();
        return;
      }

      await loadData();
      if (switchResult.Error === 'untagged_region') {
        showLegacyAccountReminder(targetAccount);
        return;
      }

      if (switchResult.RequiresManualLaunch) {
        showTopNotice('这个账号还没有完整登录态快照，已打开对应区服登录页。登录成功后在卡片菜单点“更新登录状态”。', 'warning');
      }
    } catch {
      showTopNotice('切换失败：自动关闭战网后未能完成配置替换，请稍后重试。', 'error');
    } finally {
      setSwitchingAccountId(null);
    }
  };

  const refreshAccountSession = async (id: string) => {
    setOpenAccountMenuId(null);
    setTopNotice(null);

    try {
      const bridge = getBridge();
      const refreshed = typeof bridge.RefreshAccountSessionState === 'function'
        ? await bridge.RefreshAccountSessionState(id)
        : false;

      if (!refreshed) {
        showTopNotice('更新登录状态失败：请确认战网已登录，并允许 KManager 先关闭战网后采集状态。', 'error');
        return;
      }

      showTopNotice('已更新该账号登录状态。若战网原本打开，KManager 已重新打开。', 'success');
      await loadData();
    } catch {
      showTopNotice('更新登录状态失败：请稍后重试。', 'error');
    }
  };

  const deleteAccount = async (id: string) => {
    setOpenAccountMenuId(null);
    setTimeout(async () => {
      try {
        const bridge = getBridge();
        await bridge.DeleteAccount(id);
        localStorage.removeItem('avatar_' + id);
        setAccounts(prev => prev.filter(account => account.Id !== id));
        setAvatars(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        showTopNotice('账号记录已删除。', 'success');
      } catch {
        showTopNotice('删除账号失败，请稍后重试。', 'error');
      }
    }, 150);
  };

  const minimizeApp = async () => {
    try {
      const bridge = getBridge();
      await bridge.MinimizeApp();
    } catch {}
  };

  const closeApp = async () => {
    const bridge = getBridge();
    await bridge.CloseApp();
  };

  const openRepository = async () => {
    const bridge = getBridge();
    try {
      if (bridge.OpenExternalUrl) {
        const opened = await bridge.OpenExternalUrl(REPOSITORY_URL);
        if (opened) return;
      }
    } catch {}

    window.open(REPOSITORY_URL, '_blank', 'noopener,noreferrer');
  };

  const loginNewAccount = async () => {
    const targetRegion = normalizeAccountRegion(loginRegion);
    if (!isAccountRegionTagged(targetRegion)) {
      showTopNotice('请先选择要登录的区服。', 'warning');
      return;
    }

    const bridge = getBridge();
    const success = await bridge.AddNewAccount(targetRegion);
    if (!success) {
      showTopNotice('打开登录页失败：请确认战网已关闭或稍后重试。', 'error');
      return;
    }

    setIsModalOpen(false);
    resetAccountForm();
    showTopNotice(`已清空状态并打开${getAccountRegionLabel(targetRegion)}登录页。`, 'success');
  };

  const saveCurrentAccount = async () => {
    setSaveError(null);
    setSaveLoading(true);
    try {
      const bridge = getBridge();
      const targetGroupId = orderedGroups.some(group => group.Id === saveGroupId) ? saveGroupId : DEFAULT_GROUP_ID;
      const targetRegion = normalizeAccountRegion(accountRegion);
      if (!isAccountRegionTagged(targetRegion)) {
        setSaveError('请先为这个账号选择区服。');
        return;
      }

      const saveResult = normalizeSaveAccountResult(
        typeof bridge.SaveCurrentAccountToGroupDetailed === 'function'
          ? await bridge.SaveCurrentAccountToGroupDetailed(
              remark.trim() || '新账号',
              battleTag.trim(),
              targetGroupId,
              targetRegion,
              accountAvatarDataUrl
            )
          : await bridge.SaveCurrentAccountToGroup(
              remark.trim() || '新账号',
              battleTag.trim(),
              targetGroupId,
              targetRegion,
              accountAvatarDataUrl
            )
      );
      if (saveResult.Success) {
        setIsModalOpen(false);
        resetAccountForm();
        ensureGroupExpanded(targetGroupId);
        showTopNotice(
          saveResult.SessionStateSaved
            ? '已保存账号和登录状态。若战网原本打开，KManager 已重新打开。'
            : '账号已保存，但未采集到完整登录状态；切换时可能需要重新登录后更新状态。',
          saveResult.SessionStateSaved ? 'success' : 'warning'
        );
        await loadData();
      } else {
        setSaveError('保存失败：未找到战网配置文件。请先登录一次战网后再保存。');
      }
    } catch {
      setSaveError('发生了未知错误');
    } finally {
      setSaveLoading(false);
    }
  };

  const openModal = () => {
    setModalMode('select');
    setEditingAccountId(null);
    setRemark('');
    setBattleTag('');
    setSaveGroupId(expandedGroupIds.has(activeGroupId) ? activeGroupId : DEFAULT_GROUP_ID);
    setAccountRegion(DEFAULT_ACCOUNT_REGION);
    setLoginRegion(UNTAGGED_ACCOUNT_REGION);
    setAccountAvatarDataUrl('');
    setSaveError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saveLoading) return;
    setIsModalOpen(false);
    resetAccountForm();
  };

  const submitAccountForm = () => {
    if (modalMode === 'edit') {
      updateAccountInfo();
      return;
    }
    saveCurrentAccount();
  };

  if (loading) {
    return (
      <div className={`w-full h-screen flex items-center justify-center border-t shadow-2xl ${isDarkMode ? 'bg-[#050505] border-white/5' : 'bg-[#FAFAFC] border-black/5'}`}>
        <Loader2 className={`w-6 h-6 animate-spin ${isDarkMode ? 'text-white/40' : 'text-black/40'}`} />
      </div>
    );
  }

  return (
    <div className={`w-full h-screen flex flex-col font-sans relative border-t shadow-2xl overflow-hidden transition-colors duration-500 ease-in-out ${isDarkMode ? 'dark bg-[#050505] text-[#F5F5F7] border-white/5' : 'bg-[#FAFAFC] text-[#1D1D1F] border-black/5'}`}>
      
      <header 
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest('.no-drag')) return;
          try { getBridge().DragWindow(); } catch {}
        }}
        className={`drag-region h-14 flex-shrink-0 flex items-center justify-between px-5 backdrop-blur-xl border-b z-10 sticky top-0 transition-colors duration-500 ${isDarkMode ? 'bg-black/40 border-white/5' : 'bg-white/60 border-black/5'}`}
      >
        <div className="flex items-center space-x-3">
          <div className="flex space-x-1.5 opacity-80">
            <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]"></div>
          </div>
          <div className={`h-3 w-[1px] mx-1 ${isDarkMode ? 'bg-white/10' : 'bg-black/10'}`}></div>
          <span className={`text-[11px] font-semibold tracking-widest uppercase italic select-none ${isDarkMode ? 'text-white/50' : 'text-black/40'}`}>
            KMANAGER
          </span>
        </div>
        <div className="window-controls no-drag flex items-center gap-4">
          <button
            onClick={() => openHelp()}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-95 ${isDarkMode ? 'text-white/40 hover:text-white hover:bg-white/10' : 'text-black/40 hover:text-black hover:bg-black/5'}`}
            title="帮助"
            aria-label="打开帮助"
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={toggleTheme}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-95 ${isDarkMode ? 'text-white/40 hover:text-white hover:bg-white/10' : 'text-black/40 hover:text-black hover:bg-black/5'}`}
            title="切换主题"
          >
            {isDarkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
          
          <label className="flex items-center gap-2 cursor-pointer group">
            <Toggle checked={autoStart} onChange={handleToggleAutoStart} />
            <span className={`text-[10px] font-medium transition-colors uppercase tracking-widest select-none ${isDarkMode ? 'text-white/40 group-hover:text-white/80' : 'text-black/40 group-hover:text-black/80'}`}>
              开机自启
            </span>
          </label>
          <button
            onClick={minimizeApp}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-90 ${isDarkMode ? 'text-white/40 hover:text-white hover:bg-white/10' : 'text-black/40 hover:text-black hover:bg-black/5'}`}
            title="最小化"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={closeApp}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-90 ${isDarkMode ? 'text-white/40 hover:text-white hover:bg-white/10 text-red-500' : 'text-black/40 hover:bg-black/5 hover:text-black text-red-600'}`}
            title="关闭页面"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {topNotice && (
          <motion.div
            key={topNotice.id}
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="fixed left-1/2 top-16 z-40 w-[calc(100%-48px)] max-w-[660px] -translate-x-1/2 pointer-events-none no-drag"
          >
            <div className={`pointer-events-auto flex items-center gap-3 rounded-[18px] border px-4 py-3 text-[13px] font-semibold shadow-2xl backdrop-blur-2xl ${
              topNotice.type === 'success'
                ? (isDarkMode ? 'border-[#28C840]/25 bg-[#0D1F13]/95 text-[#C7F8D4] shadow-black/30' : 'border-[#28C840]/25 bg-white/95 text-[#126B2D] shadow-black/10')
                : topNotice.type === 'error'
                  ? (isDarkMode ? 'border-[#FF5F57]/25 bg-[#2A1111]/95 text-[#FFC7C3] shadow-black/30' : 'border-[#FF5F57]/25 bg-white/95 text-[#B42318] shadow-black/10')
                  : (isDarkMode ? 'border-[#FEBC2E]/25 bg-[#261E0B]/95 text-[#FFE6A3] shadow-black/30' : 'border-[#FEBC2E]/30 bg-white/95 text-[#805400] shadow-black/10')
            }`}>
              {topNotice.type === 'success' ? (
                <Check className="h-4 w-4 flex-shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
              )}
              <span className="min-w-0 flex-1 leading-snug">{topNotice.message}</span>
              <button
                type="button"
                onClick={() => setTopNotice(null)}
                className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full transition-colors ${
                  isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'
                }`}
                aria-label="关闭提示"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-50 backdrop-blur-md flex items-end sm:items-center justify-center no-drag ${isDarkMode ? 'bg-black/75' : 'bg-black/35'}`}
          >
            <div className="absolute inset-0" onClick={() => setConfirmDialog(null)} />
            <motion.div
              initial={{ y: 18, opacity: 0, scale: 0.96 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 18, opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
              transition={{ type: "spring", damping: 24, stiffness: 320 }}
              className={`relative z-10 w-full sm:max-w-[360px] rounded-t-[26px] sm:rounded-[24px] border p-6 shadow-2xl ${
                isDarkMode ? 'bg-[#18181A] border-white/10' : 'bg-white border-black/5'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className={`text-[17px] font-semibold tracking-tight ${isDarkMode ? 'text-white' : 'text-black'}`}>
                    {confirmDialog.title}
                  </h3>
                  <p className={`mt-2 whitespace-pre-line text-[13px] leading-relaxed ${isDarkMode ? 'text-white/60' : 'text-black/60'}`}>
                    {confirmDialog.message}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className={`w-7 h-7 rounded-full flex flex-shrink-0 items-center justify-center transition-colors ${
                    isDarkMode ? 'bg-white/5 hover:bg-white/10 text-white/50' : 'bg-black/5 hover:bg-black/10 text-black/50'
                  }`}
                  aria-label="关闭确认框"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmDialog(null)}
                  className={`rounded-[14px] px-4 py-3 text-[13px] font-semibold transition-colors ${
                    isDarkMode ? 'bg-white/5 hover:bg-white/10 text-white/80' : 'bg-black/5 hover:bg-black/10 text-black/75'
                  }`}
                >
                  {confirmDialog.cancelLabel || '取消'}
                </button>
                <button
                  type="button"
                  onClick={confirmCurrentDialog}
                  className={`rounded-[14px] px-4 py-3 text-[13px] font-semibold transition-colors active:scale-[0.98] ${
                    confirmDialog.danger
                      ? 'bg-[#FF5F57] text-white hover:bg-[#E84E48]'
                      : (isDarkMode ? 'bg-white text-black hover:bg-[#E5E5E7]' : 'bg-black text-white hover:bg-[#1D1D1F]')
                  }`}
                >
                  {confirmDialog.confirmLabel}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isHelpOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-50 backdrop-blur-md flex items-end sm:items-center justify-center no-drag ${isDarkMode ? 'bg-black/80' : 'bg-black/40'}`}
          >
            <div className="absolute inset-0" onClick={closeHelp} />
            <motion.div
              initial={{ y: "20%", opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: "20%", opacity: 0, scale: 0.95, transition: { ease: "anticipate", duration: 0.2 } }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={`w-full sm:max-w-[430px] rounded-t-[28px] sm:rounded-[28px] shadow-2xl border relative z-10 flex flex-col m-0 sm:m-4 max-h-[86vh] overflow-hidden ${
                isDarkMode ? 'bg-[#18181A] border-white/10' : 'bg-white border-black/5'
              }`}
            >
              <div className="px-6 pt-6 pb-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className={`text-[18px] font-semibold tracking-tight ${isDarkMode ? 'text-white' : 'text-black'}`}>
                      KManager 使用指南
                    </h3>
                    <p className={`mt-1 text-[12px] leading-relaxed ${isDarkMode ? 'text-white/45' : 'text-black/45'}`}>
                      {isHelpRequired ? '请按顺序读完三部分，再开始使用。' : '常见问题和处理方法。'}
                    </p>
                  </div>
                  {!isHelpRequired && (
                    <button
                      type="button"
                      onClick={closeHelp}
                      className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                        isDarkMode ? 'bg-white/5 hover:bg-white/10 text-white/50' : 'bg-black/5 hover:bg-black/10 text-black/50'
                      }`}
                      aria-label="关闭帮助"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className={`mt-5 grid grid-cols-3 gap-1 rounded-[14px] p-1 ${isDarkMode ? 'bg-white/5' : 'bg-black/[0.04]'}`}>
                  {HELP_TABS.map(tab => {
                    const selected = helpTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        disabled={isHelpRequired}
                        onClick={() => setHelpTab(tab.id)}
                        className={`rounded-[10px] px-2 py-2 text-[12px] font-semibold transition-colors ${
                          selected
                            ? (isDarkMode ? 'bg-white text-black' : 'bg-black text-white')
                            : isHelpRequired
                              ? (isDarkMode ? 'text-white/35' : 'text-black/35')
                              : (isDarkMode ? 'text-white/50 hover:text-white hover:bg-white/5' : 'text-black/50 hover:text-black hover:bg-black/5')
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="overflow-y-auto hide-scrollbar px-6 pb-6">
                {helpTab === 'first' && (
                  <div className={`space-y-4 text-[13px] leading-relaxed ${isDarkMode ? 'text-white/78' : 'text-black/72'}`}>
                    <div>
                      <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-black'}`}>保存第一个账号</p>
                      <p className="mt-1">先打开官方战网客户端，登录你要保存的账号。回到 KManager，点击右上角“添加账号”，选择“保存当前状态”，填写备注、战网 ID、分组和区服后保存。</p>
                    </div>
                    <div>
                      <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-black'}`}>保存更多账号</p>
                      <p className="mt-1">点击“添加账号”里的“前往登录新号”，选择区服后登录另一个战网账号。登录成功后回到 KManager，再保存当前状态。</p>
                    </div>
                    <div>
                      <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-black'}`}>切换账号</p>
                      <p className="mt-1">双击账号卡片，或点击卡片底部按钮。KManager 会关闭战网、替换本地登录配置，然后重新打开战网。会话有效时通常可以直接进入登录状态。</p>
                    </div>
                    <div>
                      <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-black'}`}>管理账号</p>
                      <p className="mt-1">卡片左上角菜单可以编辑信息、更新登录状态、删除记录和移动分组。拖动卡片也可以移动到其他分组。</p>
                    </div>
                  </div>
                )}

                {helpTab === 'upgrade' && (
                  <div className={`space-y-3 text-[13px] leading-relaxed ${isDarkMode ? 'text-white/78' : 'text-black/72'}`}>
                    <p>1. 从旧版本升级后，已保存的账号会保留，不需要删除重建。</p>
                    <p>2. 没有区服标签的旧账号会显示“待标记区服”，仍会先按旧版方式打开战网，方便你登录上去。</p>
                    <p>3. 登录成功后，请在账号卡片菜单里选择“编辑信息”，补充亚服、美服、欧服或国服。</p>
                    <p>4. 补充区服后，再点一次“更新登录状态”，新版跨区切换逻辑才会更稳定。</p>
                    <p>5. 如果旧账号打开后要求密码或验证，按战网官方流程登录成功后再更新状态即可。</p>
                  </div>
                )}

                {helpTab === 'faq' && (
                  <div className={`space-y-4 text-[13px] leading-relaxed ${isDarkMode ? 'text-white/78' : 'text-black/72'}`}>
                    <div>
                      <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-black'}`}>保存或更新后战网被关闭了怎么办？</p>
                      <p className="mt-1">这是采集登录状态需要的步骤。KManager 会在保存或更新结束后，自动重新打开原本已经打开的战网。</p>
                    </div>
                    <div>
                      <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-black'}`}>保存后仍然需要验证怎么办？</p>
                      <p className="mt-1">请按战网官方流程完成验证并登录成功，然后回到 KManager 重新保存一次，或在账号卡片菜单里点“更新登录状态”。</p>
                    </div>
                    <div>
                      <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-black'}`}>遇到 2400 怎么处理？</p>
                      <p className="mt-1">请手动关闭战网，再重新打开战网并输入密码登录。登录成功后回到 KManager，重新保存或更新该账号登录状态。</p>
                    </div>
                    <div>
                      <p className={`font-semibold ${isDarkMode ? 'text-white' : 'text-black'}`}>旧账号显示“待标记区服”怎么办？</p>
                      <p className="mt-1">这是旧版本账号缺少区服信息。可以先登录此号，登录成功后编辑账号补充区服，并更新登录状态。</p>
                    </div>
                  </div>
                )}
              </div>

              <div className={`border-t px-6 py-4 ${isDarkMode ? 'border-white/10' : 'border-black/5'}`}>
                {isHelpRequired ? (
                  <button
                    type="button"
                    onClick={advanceRequiredHelp}
                    className={`w-full rounded-[14px] px-4 py-3 text-[13px] font-semibold transition-all active:scale-[0.98] ${
                      isDarkMode ? 'bg-white text-black hover:bg-[#E5E5E7]' : 'bg-black text-white hover:bg-[#1D1D1F]'
                    }`}
                  >
                    {helpTab === 'faq' ? '开始使用' : '下一步'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={closeHelp}
                    className={`w-full rounded-[14px] px-4 py-3 text-[13px] font-semibold transition-colors ${
                      isDarkMode ? 'bg-white/5 hover:bg-white/10 text-white/80' : 'bg-black/5 hover:bg-black/10 text-black/75'
                    }`}
                  >
                    我知道了
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="flex-1 overflow-y-auto hide-scrollbar px-6 pt-8 pb-32 relative z-10">
        <div className="flex justify-between items-end mb-8 pt-2">
          <div>
            <h1 className="text-3xl font-bold tracking-tight mb-1">战网账号管家</h1>
            <p className={`text-sm ${isDarkMode ? 'text-white/40' : 'text-black/40'}`}>按分组管理并无缝切换登录配置</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={createGroup} className={`px-3 py-2 font-semibold rounded-[14px] flex items-center space-x-2 border active:scale-95 transition-all text-sm no-drag ${isDarkMode ? 'bg-white/5 text-white border-white/10 hover:bg-white/10' : 'bg-white text-black border-black/10 hover:bg-black/5'}`}>
              <FolderPlus className="w-4 h-4 stroke-[2.4]" />
              <span>新建分组</span>
            </button>
            <button onClick={openModal} className={`px-4 py-2 font-semibold rounded-[14px] flex items-center space-x-2 border active:scale-95 transition-all text-sm no-drag ${isDarkMode ? 'bg-white text-black border-white/10 hover:bg-[#E5E5E7]' : 'bg-black text-white border-black/10 hover:bg-[#1D1D1F]'}`}>
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>添加账号</span>
            </button>
          </div>
        </div>

        {accounts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center min-h-[300px] text-center"
          >
            <div className={`w-16 h-16 mb-5 rounded-[20px] flex items-center justify-center relative overflow-hidden border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'}`}>
              <Sparkles className={`w-6 h-6 relative z-10 ${isDarkMode ? 'text-white/30' : 'text-black/30'}`} />
            </div>
            <h2 className={`font-medium mb-1 group select-none text-lg ${isDarkMode ? 'text-white/90' : 'text-black/90'}`}>
              未找到账号记录
            </h2>
            <p className={`text-sm leading-relaxed mx-auto select-none max-w-[260px] mt-2 ${isDarkMode ? 'text-white/40' : 'text-black/40'}`}>
              请在战网客户端成功登录后，点击右上方添加您的当前登录配置。
            </p>
          </motion.div>
        ) : (
          <div className="space-y-5">
            {orderedGroups.map((group) => {
              const groupAccounts = accountsByGroup[group.Id] || [];
              const expanded = expandedGroupIds.has(group.Id);
              const hasActive = activeGroupId === group.Id;

              return (
                <section
                  key={group.Id}
                  onDragOver={(e) => {
                    if (draggingAccountId) e.preventDefault();
                  }}
                  onDrop={(e) => handleDrop(group.Id, e)}
                  className={`rounded-[24px] border transition-colors ${isDarkMode ? 'border-white/5 bg-white/[0.015]' : 'border-black/5 bg-black/[0.015]'}`}
                >
                  <div className={`flex items-center justify-between px-4 py-3 ${isDarkMode ? 'border-white/5' : 'border-black/5'} ${expanded ? 'border-b' : ''}`}>
                    <button
                      onClick={() => toggleGroup(group.Id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left no-drag"
                    >
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isDarkMode ? 'bg-white/5 text-white/60' : 'bg-white text-black/50 shadow-sm'}`}>
                        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </span>
                      <span className="min-w-0">
                        <span className={`block truncate text-[15px] font-bold ${isDarkMode ? 'text-white/90' : 'text-black/90'}`}>{group.Name}</span>
                        <span className={`text-[11px] font-medium ${isDarkMode ? 'text-white/35' : 'text-black/35'}`}>{groupAccounts.length} 个账号</span>
                      </span>
                      {hasActive && (
                        <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] font-bold uppercase rounded-full tracking-widest">
                          Active
                        </span>
                      )}
                    </button>
                    <div className="flex items-center gap-1 no-drag">
                      {group.Id !== DEFAULT_GROUP_ID && (
                        <>
                          <button
                            onClick={() => renameGroup(group)}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isDarkMode ? 'text-white/40 hover:text-white hover:bg-white/10' : 'text-black/40 hover:text-black hover:bg-black/5'}`}
                            title="重命名分组"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteGroup(group)}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isDarkMode ? 'text-red-400/70 hover:bg-red-500/10' : 'text-red-500/70 hover:bg-red-500/10'}`}
                            title="删除分组"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <AnimatePresence initial={false}>
                    {expanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        {groupAccounts.length === 0 ? (
                          <div className={`m-4 rounded-[18px] border border-dashed py-8 text-center text-[12px] font-medium ${isDarkMode ? 'border-white/10 text-white/30' : 'border-black/10 text-black/30'}`}>
                            拖动账号到这里，或通过卡片菜单移动到此分组。
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 p-4">
                            <AnimatePresence mode="popLayout">
                              {groupAccounts.map((acc, index) => {
                                const isActive = activeAccount?.Id === acc.Id;
                                const avatar = acc.AvatarDataUrl || avatars[acc.Id];
                                const regionTagged = isAccountRegionTagged(acc.Region);
                                
                                return (
                                  <motion.div
                                    layout
                                    draggable
                                    initial={{ opacity: 0, y: 15, scale: 0.98 }}
                                    animate={{ opacity: draggingAccountId === acc.Id ? 0.45 : 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
                                    transition={{ type: 'spring', bounce: 0.2, duration: 0.4, delay: index * 0.03 }}
                                    key={acc.Id}
                                    onDragStartCapture={(e: DragEvent<HTMLDivElement>) => {
                                      setDraggingAccountId(acc.Id);
                                      e.dataTransfer.setData('text/plain', acc.Id);
                                      e.dataTransfer.effectAllowed = 'move';
                                    }}
                                    onDragEndCapture={() => setDraggingAccountId(null)}
                                    onDoubleClick={() => switchAccount(acc.Id)}
                                    onContextMenu={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setOpenAccountMenuId(acc.Id);
                                    }}
                                    className={`relative group/card rounded-[32px] p-6 border flex flex-col items-center justify-between transition-all duration-300 aspect-[3/4] min-h-[280px] max-h-[360px] select-none ${
                                      isDarkMode 
                                        ? (isActive ? 'bg-white/5 border-white/10 hover:bg-white/[0.08] ring-1 ring-white/10 shadow-emerald-500/5' : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]') 
                                        : (isActive ? 'bg-white border-black/10 hover:border-black/20 ring-1 ring-black/5 shadow-lg shadow-black/5' : 'bg-black/[0.02] border-black/5 hover:bg-white hover:shadow-sm')
                                    }`}
                                  >
                                    <div className="absolute top-5 left-5 z-30 no-drag">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setOpenAccountMenuId(openAccountMenuId === acc.Id ? null : acc.Id);
                                        }}
                                        className={`w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-all ${isDarkMode ? 'bg-black/30 text-white/50 hover:text-white hover:bg-white/10' : 'bg-white/80 text-black/40 hover:text-black hover:bg-black/5'}`}
                                        title="账号操作"
                                      >
                                        <MoreHorizontal className="w-4 h-4" />
                                      </button>
                                      {openAccountMenuId === acc.Id && (
                                        <div className={`absolute left-0 top-9 w-44 rounded-[14px] border p-1 shadow-xl backdrop-blur-xl ${isDarkMode ? 'bg-[#18181A]/95 border-white/10' : 'bg-white/95 border-black/10'}`}>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              openEditAccount(acc);
                                            }}
                                            className={`w-full rounded-[10px] px-3 py-2 text-left text-[12px] font-semibold transition-colors ${isDarkMode ? 'hover:bg-white/10 text-white/90' : 'hover:bg-black/5 text-black/90'}`}
                                          >
                                            编辑信息
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              refreshAccountSession(acc.Id);
                                            }}
                                            className={`w-full rounded-[10px] px-3 py-2 text-left text-[12px] font-semibold transition-colors ${isDarkMode ? 'hover:bg-white/10 text-white/90' : 'hover:bg-black/5 text-black/90'}`}
                                          >
                                            更新登录状态
                                          </button>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              requestDeleteAccount(acc);
                                            }}
                                            className={`w-full rounded-[10px] px-3 py-2 text-left text-[12px] font-semibold transition-colors ${isDarkMode ? 'hover:bg-red-500/10 text-red-300' : 'hover:bg-red-50 text-red-600'}`}
                                          >
                                            删除账号
                                          </button>
                                          <div className={`my-1 h-px ${isDarkMode ? 'bg-white/10' : 'bg-black/10'}`} />
                                          <div className={`px-3 py-1 text-[10px] font-bold tracking-widest uppercase ${isDarkMode ? 'text-white/35' : 'text-black/35'}`}>
                                            移动到分组
                                          </div>
                                          {orderedGroups.map(targetGroup => (
                                            <button
                                              key={targetGroup.Id}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                moveAccountToGroup(acc.Id, targetGroup.Id);
                                              }}
                                              disabled={targetGroup.Id === acc.GroupId}
                                              className={`w-full truncate rounded-[10px] px-3 py-2 text-left text-[12px] font-medium transition-colors disabled:opacity-35 ${isDarkMode ? 'hover:bg-white/10 text-white/80' : 'hover:bg-black/5 text-black/80'}`}
                                            >
                                              {targetGroup.Name}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    {isActive && (
                                      <div className="absolute top-5 right-5 z-10 pointer-events-none">
                                        <div className="px-2.5 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[9px] font-bold uppercase rounded-full tracking-widest backdrop-blur-md">Active</div>
                                      </div>
                                    )}
                                    
                                    <div className="flex flex-col items-center gap-3 w-full mt-4 relative z-10 flex-1">
                                      <div className="relative no-drag">
                                        <div className={`w-24 h-24 flex items-center justify-center flex-shrink-0 ${
                                          avatar 
                                            ? `rounded-[32px] border overflow-hidden shadow-lg ${isDarkMode 
                                                ? (isActive ? 'bg-[#002FA7]/20 border-[#002FA7]/40 shadow-[0_0_15px_rgba(0,47,167,0.3)]' : 'bg-[#1C1C1E] border-white/10') 
                                                : (isActive ? 'bg-[#002FA7]/10 border-[#002FA7]/30 shadow-inner' : 'bg-zinc-100 border-black/5')}`
                                            : 'overflow-visible drop-shadow-xl'
                                        }`}>
                                          {avatar ? (
                                            <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                                          ) : (
                                            <div className="flex items-center justify-center h-full w-full">
                                              <KLogoBrand isActive={isActive} isDarkMode={isDarkMode} />
                                            </div>
                                          )}
                                        </div>
                                      </div>

                                      <div className="w-full text-center px-1 mt-3 flex-1 flex flex-col justify-center">
                                        <div className={`mx-auto mb-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${getAccountRegionBadgeClass(acc.Region, isDarkMode)}`}>
                                          {!regionTagged && <AlertCircle className="w-3 h-3" />}
                                          {getAccountRegionLabel(acc.Region)}
                                        </div>
                                        <h3 className={`text-[16px] font-bold truncate tracking-tight ${isDarkMode ? 'text-white/90' : 'text-black/90'}`}>{acc.Remark}</h3>
                                        {acc.Username ? (
                                          <div className="flex justify-center mt-1.5">
                                            <button
                                              onClick={(e) => { e.stopPropagation(); copyToClipboard(acc.Username, acc.Id); }}
                                              className="flex items-center gap-1.5 group/copy text-center transition-colors px-2 py-0.5 rounded-md hover:bg-black/5 dark:hover:bg-white/5 no-drag"
                                              title="点击复制"
                                            >
                                              <span className={`text-[12px] font-mono truncate tracking-tight transition-colors ${isDarkMode ? 'text-white/40 group-hover/copy:text-white/80' : 'text-black/40 group-hover/copy:text-black/80'}`}>
                                                {acc.Username}
                                              </span>
                                              {copiedId === acc.Id ? (
                                                <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                                              ) : (
                                                <Copy className={`w-3 h-3 opacity-0 group-hover/copy:opacity-100 transition-opacity flex-shrink-0 ${isDarkMode ? 'text-white/30' : 'text-black/30'}`} />
                                              )}
                                            </button>
                                          </div>
                                        ) : (
                                          <div className="h-[24px] mt-1.5" />
                                        )}
                                      </div>
                                    </div>

                                    <div className="w-full flex-col flex gap-2 mt-2 relative z-20">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); switchAccount(acc.Id); }}
                                        disabled={switchingAccountId !== null}
                                        className={`w-full py-3 rounded-[16px] font-semibold text-[13px] flex justify-center items-center gap-2 active:scale-[0.96] transition-all no-drag disabled:cursor-wait disabled:opacity-60 ${
                                          isActive 
                                            ? (isDarkMode ? 'bg-white hover:bg-[#E5E5E7] text-black shadow-lg' : 'bg-black text-white hover:bg-[#1D1D1F] shadow-md') 
                                            : (isDarkMode ? 'bg-white/5 hover:bg-white/10 border border-white/5 text-white/90' : 'bg-white border border-black/10 hover:bg-black/5 text-black hover:shadow-sm')
                                        }`}
                                      >
                                        {switchingAccountId === acc.Id ? (
                                          <>
                                            <Loader2 className="w-[13px] h-[13px] animate-spin" />
                                            <span>切换中</span>
                                          </>
                                        ) : isActive && regionTagged ? (
                                          <>
                                            <Play className={`w-[12px] h-[12px] fill-current opacity-80`} />
                                            <span>立即进入</span>
                                          </>
                                        ) : !regionTagged ? (
                                          <span>登录此号</span>
                                        ) : (
                                          <span>切换此号</span>
                                        )}
                                      </button>
                                      
                                      {!isActive && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            requestDeleteAccount(acc);
                                          }}
                                          className={`w-full py-2 text-[11px] font-medium flex items-center justify-center rounded-[16px] active:scale-[0.95] opacity-0 group-hover/card:opacity-100 transition-all no-drag ${
                                            isDarkMode ? 'text-red-400 hover:bg-red-500/10' : 'text-red-500 hover:bg-red-500/10'
                                          }`}
                                          title="删除账号"
                                        >
                                          <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                                          删除记录
                                        </button>
                                      )}
                                    </div>
                                  </motion.div>
                                );
                              })}
                            </AnimatePresence>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </section>
              );
            })}
          </div>
        )}
      </main>

      <button
        onClick={openRepository}
        className={`fixed bottom-4 right-5 z-30 no-drag flex items-center gap-2 rounded-full border px-3 py-2 text-[12px] font-semibold tracking-tight backdrop-blur-xl transition-all active:scale-95 ${
          isDarkMode
            ? 'bg-white/[0.06] text-white/60 border-white/10 hover:bg-white/10 hover:text-white shadow-lg shadow-black/20'
            : 'bg-white/80 text-black/55 border-black/10 hover:bg-white hover:text-black shadow-lg shadow-black/5'
        }`}
        title="Open KManager on GitHub"
        aria-label="Open KManager GitHub repository"
      >
        <Github className="w-3.5 h-3.5" />
        <span>@Jayden</span>
      </button>

      <div className={`fixed inset-0 pointer-events-none ring-[40px] inset-shadow-xl z-0 transition-colors duration-500 ${isDarkMode ? 'ring-black/20' : 'ring-white/40'}`}></div>

      <AnimatePresence>
        {isModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-50 backdrop-blur-md flex items-end sm:items-center justify-center no-drag ${isDarkMode ? 'bg-black/80' : 'bg-black/40'}`}
          >
            <div className="absolute inset-0" onClick={closeModal} />

            <motion.div
              initial={{ y: "20%", opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: "20%", opacity: 0, scale: 0.95, transition: { ease: "anticipate", duration: 0.2 } }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={`w-full sm:max-w-[340px] rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl border relative z-10 flex flex-col m-0 sm:m-4 max-h-[90vh] ${
                isDarkMode ? 'bg-[#18181A] border-white/10' : 'bg-white border-black/5'
              }`}
            >
              <div className={`w-12 h-1.5 rounded-full mx-auto mb-6 sm:hidden ${isDarkMode ? 'bg-white/10' : 'bg-black/10'}`} />
              
              <div className="flex justify-between items-center mb-6">
                <h3 className={`text-[18px] font-semibold tracking-tight ${isDarkMode ? 'text-white' : 'text-black'}`}>
                  {modalMode === 'select' ? '选择操作' : modalMode === 'edit' ? '编辑账号' : '录入账号'}
                </h3>
                <button 
                  onClick={closeModal}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                    isDarkMode ? 'bg-white/5 hover:bg-white/10 text-white/50' : 'bg-black/5 hover:bg-black/10 text-black/50'
                  }`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {modalMode === 'select' ? (
                <div className="flex flex-col gap-3">
                  <button
                    onClick={() => setModalMode('save')}
                    className={`flex items-center gap-4 p-4 rounded-[20px] transition-colors border border-transparent active:scale-[0.98] group text-left ${
                      isDarkMode ? 'bg-white/5 hover:bg-white/10 hover:border-white/10' : 'bg-black/[0.02] hover:bg-black/5 hover:border-black/10'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-[14px] flex flex-shrink-0 items-center justify-center text-emerald-500 border ${
                      isDarkMode ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-emerald-50 border-emerald-100'
                    }`}>
                      <Sparkles className="w-4 h-4 flex-shrink-0" />
                    </div>
                    <div>
                      <div className={`font-semibold text-[14px] ${isDarkMode ? 'text-white/90' : 'text-black/90'}`}>
                        保存当前状态
                      </div>
                      <div className={`text-[12px] mt-0.5 leading-tight pr-2 ${isDarkMode ? 'text-white/40' : 'text-black/40'}`}>
                        关闭战网后采集当前登录状态并保存。
                      </div>
                    </div>
                  </button>

                  <div
                    className={`p-4 rounded-[20px] transition-colors border border-transparent ${
                      isDarkMode ? 'bg-white/5 hover:bg-white/10 hover:border-white/10' : 'bg-black/[0.02] hover:bg-black/5 hover:border-black/10'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-[14px] flex flex-shrink-0 items-center justify-center border ${
                        isDarkMode ? 'bg-white/5 text-white/80 border-white/10' : 'bg-white text-black/80 border-black/10 shadow-sm'
                      }`}>
                        <PlusCircle className="w-4 h-4 flex-shrink-0" />
                      </div>
                      <div>
                        <div className={`font-semibold text-[14px] ${isDarkMode ? 'text-white/90' : 'text-black/90'}`}>
                          前往登录新号
                        </div>
                        <div className={`text-[12px] mt-0.5 leading-tight pr-2 ${isDarkMode ? 'text-white/40' : 'text-black/40'}`}>
                          清空状态并进入指定区服登录页。
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4">
                      {ACCOUNT_REGIONS.map(region => {
                        const selected = loginRegion === region.value;
                        return (
                          <button
                            key={region.value}
                            type="button"
                            onClick={() => setLoginRegion(region.value)}
                            className={`rounded-[12px] border px-3 py-2 text-[12px] font-bold transition-all active:scale-[0.97] ${getAccountRegionBadgeClass(region.value, isDarkMode)} ${
                              selected ? 'ring-2 ring-[#5FE8FF]/35 opacity-100' : 'opacity-70 hover:opacity-100'
                            }`}
                          >
                            {region.label}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={loginNewAccount}
                      className={`mt-3 w-full py-3 rounded-[14px] font-semibold text-[13px] active:scale-[0.98] transition-all ${
                        isAccountRegionTagged(loginRegion)
                          ? (isDarkMode ? 'bg-white text-black hover:bg-[#E5E5E7]' : 'bg-black text-white hover:bg-[#1D1D1F]')
                          : (isDarkMode ? 'bg-white/10 text-white/45 hover:bg-white/15' : 'bg-black/5 text-black/45 hover:bg-black/10')
                      }`}
                    >
                      {isAccountRegionTagged(loginRegion) ? `打开${getAccountRegionLabel(loginRegion)}登录页` : '选择区服后打开登录页'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col flex-1">
                  <div className="space-y-5 mb-2">
                    <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 flex-shrink-0 overflow-hidden rounded-[20px] border ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-black/[0.03] border-black/10'}`}>
                        {accountAvatarDataUrl ? (
                          <img src={accountAvatarDataUrl} alt="账号头像" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center scale-75">
                            <KLogoBrand isActive={true} isDarkMode={isDarkMode} />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <label className={`block text-[11px] font-bold tracking-wider uppercase mb-2 ${isDarkMode ? 'text-white/40' : 'text-black/40'}`}>
                          账号头像
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={chooseAvatar}
                            className={`px-3 py-2 rounded-[12px] text-[12px] font-semibold inline-flex items-center gap-1.5 transition-colors ${
                              isDarkMode ? 'bg-white/5 hover:bg-white/10 text-white/80' : 'bg-black/5 hover:bg-black/10 text-black/75'
                            }`}
                          >
                            <ImagePlus className="w-3.5 h-3.5" />
                            选择
                          </button>
                          {accountAvatarDataUrl && (
                            <button
                              type="button"
                              onClick={clearAvatar}
                              className={`px-3 py-2 rounded-[12px] text-[12px] font-semibold transition-colors ${
                                isDarkMode ? 'bg-red-500/10 hover:bg-red-500/15 text-red-300' : 'bg-red-50 hover:bg-red-100 text-red-600'
                              }`}
                            >
                              移除
                            </button>
                          )}
                        </div>
                        <input
                          ref={avatarInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          onChange={handleAvatarFileChange}
                          className="hidden"
                        />
                      </div>
                    </div>
                    <div>
                      <label className={`block text-[11px] font-bold tracking-wider uppercase mb-2 ml-1 ${isDarkMode ? 'text-white/40' : 'text-black/40'}`}>
                        账号备注
                      </label>
                      <input
                        autoFocus
                        value={remark}
                        onChange={(e) => setRemark(e.target.value)}
                        placeholder="例如: 国服大骑士"
                        className={`w-full px-4 py-3.5 rounded-[16px] border transition-all text-[14px] font-medium outline-none ${
                          isDarkMode 
                            ? 'bg-white/5 border-white/10 focus:bg-white/10 focus:border-white/20 text-white placeholder:text-white/30' 
                            : 'bg-white border-black/10 focus:border-black/20 focus:ring-4 focus:ring-black/5 text-black placeholder:text-black/30 shadow-inner'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[11px] font-bold tracking-wider uppercase mb-2 ml-1 ${isDarkMode ? 'text-white/40' : 'text-black/40'}`}>
                        战网ID <span className="opacity-60 font-normal normal-case tracking-normal">(选填)</span>
                      </label>
                      <input
                        value={battleTag}
                        onChange={(e) => setBattleTag(e.target.value)}
                        placeholder="例如: Player#1234"
                        className={`w-full px-4 py-3.5 rounded-[16px] border transition-all text-[14px] outline-none font-mono font-medium ${
                          isDarkMode 
                            ? 'bg-white/5 border-white/10 focus:bg-white/10 focus:border-white/20 text-white placeholder:text-white/30' 
                            : 'bg-white border-black/10 focus:border-black/20 focus:ring-4 focus:ring-black/5 text-black placeholder:text-black/30 shadow-inner'
                        }`}
                      />
                    </div>
                    <div>
                      <label className={`block text-[11px] font-bold tracking-wider uppercase mb-2 ml-1 ${isDarkMode ? 'text-white/40' : 'text-black/40'}`}>
                        {modalMode === 'edit' ? '所属分组' : '保存到分组'}
                      </label>
                      <select
                        value={saveGroupId}
                        onChange={(e) => setSaveGroupId(e.target.value)}
                        className={`w-full px-4 py-3.5 rounded-[16px] border transition-all text-[14px] outline-none font-medium ${
                          isDarkMode 
                            ? 'bg-[#18181A] border-white/10 focus:bg-white/10 focus:border-white/20 text-white' 
                            : 'bg-white border-black/10 focus:border-black/20 focus:ring-4 focus:ring-black/5 text-black shadow-inner'
                        }`}
                      >
                        {orderedGroups.map(group => (
                          <option key={group.Id} value={group.Id}>{group.Name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={`block text-[11px] font-bold tracking-wider uppercase mb-2 ml-1 ${isDarkMode ? 'text-white/40' : 'text-black/40'}`}>
                        服务器
                      </label>
                      <select
                        value={accountRegion}
                        onChange={(e) => setAccountRegion(normalizeAccountRegion(e.target.value))}
                        className={`w-full px-4 py-3.5 rounded-[16px] border transition-all text-[14px] outline-none font-medium ${
                          isDarkMode
                            ? 'bg-[#18181A] border-white/10 focus:bg-white/10 focus:border-white/20 text-white'
                            : 'bg-white border-black/10 focus:border-black/20 focus:ring-4 focus:ring-black/5 text-black shadow-inner'
                        }`}
                      >
                        {!isAccountRegionTagged(accountRegion) && (
                          <option value="">请选择区服</option>
                        )}
                        {ACCOUNT_REGIONS.map(region => (
                          <option key={region.value} value={region.value}>{region.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <AnimatePresence>
                    {saveError && (
                      <motion.div
                        initial={{ opacity: 0, height: 0, marginTop: 0 }}
                        animate={{ opacity: 1, height: "auto", marginTop: 12 }}
                        exit={{ opacity: 0, height: 0, marginTop: 0 }}
                        className="text-[12px] text-[#FF3B30] flex items-center gap-1.5 overflow-hidden font-medium bg-[#FF3B30]/10 border border-[#FF3B30]/20 p-3 rounded-[12px]"
                      >
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>{saveError}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex gap-3 mt-8 pb-1">
                    <button
                      onClick={() => {
                        if (modalMode === 'edit') {
                          closeModal();
                        } else {
                          setModalMode('select');
                        }
                      }}
                      className={`px-4 py-3.5 rounded-[16px] font-semibold text-[13px] transition-colors active:scale-[0.98] w-[30%] border ${
                        isDarkMode ? 'bg-white/5 hover:bg-white/10 text-white/80 border-white/5' : 'bg-black/5 hover:bg-black/10 text-black/80 border-transparent hover:border-black/5'
                      }`}
                      type="button"
                    >
                      {modalMode === 'edit' ? '取消' : '返回'}
                    </button>
                    <button
                      onClick={submitAccountForm}
                      disabled={saveLoading}
                      className={`flex-1 px-4 py-3.5 rounded-[16px] font-semibold text-[13px] transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                        isDarkMode ? 'bg-white hover:bg-[#E5E5E7] text-black shadow-lg shadow-white/20' : 'bg-black hover:bg-[#1D1D1F] text-white shadow-lg shadow-black/20'
                      }`}
                      type="submit"
                    >
                      {saveLoading ? (
                        <>
                          <Loader2 className={`w-4 h-4 animate-spin ${isDarkMode ? 'text-black/60' : 'text-white/60'}`} />
                          <span>处理中...</span>
                        </>
                      ) : (
                        modalMode === 'edit' ? '保存修改' : '确定保存'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

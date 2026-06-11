'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { getBridge, Account, Group } from '@/lib/bridge';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play, Copy, Trash2, X, Sparkles, PlusCircle, Plus,
  Loader2, Check, AlertCircle, Moon, Sun, ChevronDown,
  ChevronRight, FolderPlus, MoreHorizontal, Pencil
} from 'lucide-react';

const DEFAULT_GROUP_ID = 'default';
const EXPANDED_GROUPS_KEY = 'kmanager_expanded_groups';

const KLogoBrand = ({ isActive, isDarkMode }: { isActive: boolean; isDarkMode: boolean }) => (
  <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" className={`w-[115%] h-[115%] transition-all duration-500 origin-center ${!isActive ? 'opacity-40 grayscale saturate-0 scale-90' : 'scale-100'}`}>
    <defs>
      <linearGradient id="bgGradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#1e5cb3" />
        <stop offset="100%" stopColor="#081e47" />
      </linearGradient>

      <linearGradient id="metalK" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="25%" stopColor="#e2e8f0" />
        <stop offset="50%" stopColor="#94a3b8" />
        <stop offset="60%" stopColor="#f8fafc" />
        <stop offset="85%" stopColor="#64748b" />
        <stop offset="100%" stopColor="#1e293b" />
      </linearGradient>

      <linearGradient id="silverRim" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="100%" stopColor="#475569" />
      </linearGradient>

      <filter id="bgShadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="6" stdDeviation="6" floodOpacity={isDarkMode ? "0.8" : "0.3"} floodColor="#000"/>
      </filter>

      <filter id="kBevelLight" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.4" floodColor="#000" result="shadow" />
        <feDropShadow dx="0" dy="0" stdDeviation="6" floodOpacity="0.7" floodColor="#00e5ff" result="glow" />
        <feMerge result="outer">
          <feMergeNode in="shadow" />
          <feMergeNode in="glow" />
        </feMerge>

        <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur" />
        <feSpecularLighting in="blur" surfaceScale="5" specularConstant="1.2" specularExponent="20" lightingColor="#ffffff" result="specular">
          <fePointLight x="20" y="10" z="40" />
        </feSpecularLighting>
        <feComposite in="specular" in2="SourceAlpha" operator="in" result="specular" />

        <feMerge>
          <feMergeNode in="outer" />
          <feMergeNode in="SourceGraphic" />
          <feMergeNode in="specular" />
        </feMerge>
      </filter>

      <filter id="kBevelDark" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="8" stdDeviation="6" floodOpacity="0.8" floodColor="#000" result="shadow" />
        <feDropShadow dx="0" dy="0" stdDeviation="12" floodOpacity="0.9" floodColor="#0ea5e9" result="glow" />
        <feMerge result="outer">
          <feMergeNode in="shadow" />
          <feMergeNode in="glow" />
        </feMerge>

        <feGaussianBlur in="SourceAlpha" stdDeviation="2.5" result="blur" />
        <feSpecularLighting in="blur" surfaceScale="6" specularConstant="1.5" specularExponent="30" lightingColor="#ffffff" result="specular">
          <fePointLight x="20" y="0" z="50" />
        </feSpecularLighting>
        <feComposite in="specular" in2="SourceAlpha" operator="in" result="specular" />

        <feMerge>
          <feMergeNode in="outer" />
          <feMergeNode in="SourceGraphic" />
          <feMergeNode in="specular" />
        </feMerge>
      </filter>
    </defs>

    <rect x="8" y="8" width="84" height="84" rx="22" 
          fill="url(#bgGradient)" 
          stroke="url(#silverRim)" strokeWidth="1"
          filter="url(#bgShadow)"
    />

    <g filter={isDarkMode ? "url(#kBevelDark)" : "url(#kBevelLight)"}>
      <path d="M 35 30 L 35 70 M 67 30 L 45 50 L 67 70"
            fill="none"
            stroke="url(#metalK)" 
            strokeWidth="16" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
      />
    </g>
  </svg>
);

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none ${
        checked ? 'bg-emerald-500' : 'bg-black/20 dark:bg-white/20'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-300 ease-in-out ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

export default function App() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [autoStart, setAutoStart] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'select' | 'save' | 'edit'>('select');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [remark, setRemark] = useState('');
  const [battleTag, setBattleTag] = useState('');
  const [saveGroupId, setSaveGroupId] = useState(DEFAULT_GROUP_ID);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [openAccountMenuId, setOpenAccountMenuId] = useState<string | null>(null);
  const [draggingAccountId, setDraggingAccountId] = useState<string | null>(null);
  const expandedInitialized = useRef(false);

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
        .map(account => ({
          ...account,
          GroupId: account.GroupId && validGroupIds.has(account.GroupId) ? account.GroupId : DEFAULT_GROUP_ID,
        }))
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
    setIsDarkMode(matchMedia.matches);
    const handleChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
    matchMedia.addEventListener('change', handleChange);

    const init = async () => {
      try {
        const bridge = getBridge();
        await loadData();
        const auto = await bridge.GetAutoStart();
        setAutoStart(auto);
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
  }, [visibleAccountIds, visibleAccounts]);

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
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

  const deleteGroup = async (group: Group) => {
    if (group.Id === DEFAULT_GROUP_ID) return;
    if (!window.confirm(`删除分组“${group.Name}”？组内账号会移动到默认分组。`)) return;

    try {
      const bridge = getBridge();
      const success = await bridge.DeleteGroup(group.Id);
      if (!success) {
        window.alert('删除分组失败');
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
      window.alert('删除分组失败');
    }
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
      const currentAccount = accounts.find(account => account.Id === editingAccountId);

      const success = await bridge.UpdateAccountInfo(editingAccountId, nextRemark, nextBattleTag);
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
        ? { ...account, Remark: nextRemark, Username: nextBattleTag, GroupId: targetGroupId }
        : account));
      ensureGroupExpanded(targetGroupId);
      setIsModalOpen(false);
      setEditingAccountId(null);
      setRemark('');
      setBattleTag('');
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
    try {
      const bridge = getBridge();
      await bridge.SwitchAccount(id);
      setAccounts(prev => {
        const next = prev.map(account => account.Id === id ? { ...account, LastUsed: new Date().toISOString() } : account);
        return next.sort((a, b) => new Date(b.LastUsed).getTime() - new Date(a.LastUsed).getTime());
      });
      setTimeout(() => loadData(), 2500);
    } catch {}
  };

  const deleteAccount = async (id: string) => {
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
      } catch {}
    }, 150);
  };

  const closeApp = async () => {
    const bridge = getBridge();
    await bridge.CloseApp();
  };

  const loginNewAccount = async () => {
    const bridge = getBridge();
    await bridge.AddNewAccount();
    setIsModalOpen(false);
  };

  const saveCurrentAccount = async () => {
    setSaveError(null);
    setSaveLoading(true);
    try {
      const bridge = getBridge();
      const targetGroupId = orderedGroups.some(group => group.Id === saveGroupId) ? saveGroupId : DEFAULT_GROUP_ID;
      const success = await bridge.SaveCurrentAccountToGroup(
        remark.trim() || '新账号',
        battleTag.trim(),
        targetGroupId
      );
      if (success) {
        setIsModalOpen(false);
        setEditingAccountId(null);
        setRemark('');
        setBattleTag('');
        ensureGroupExpanded(targetGroupId);
        await loadData();
      } else {
        setSaveError('保存失败，请确认您已在战网客户端完成登录。');
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
    setSaveError(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    if (saveLoading) return;
    setIsModalOpen(false);
    setEditingAccountId(null);
    setSaveError(null);
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
            onClick={closeApp}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-all active:scale-90 ${isDarkMode ? 'text-white/40 hover:text-white hover:bg-white/10 text-red-500' : 'text-black/40 hover:bg-black/5 hover:text-black text-red-600'}`}
            title="关闭页面"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

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
                                const avatar = avatars[acc.Id];
                                
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
                                        className={`w-full py-3 rounded-[16px] font-semibold text-[13px] flex justify-center items-center gap-2 active:scale-[0.96] transition-all no-drag ${
                                          isActive 
                                            ? (isDarkMode ? 'bg-white hover:bg-[#E5E5E7] text-black shadow-lg' : 'bg-black text-white hover:bg-[#1D1D1F] shadow-md') 
                                            : (isDarkMode ? 'bg-white/5 hover:bg-white/10 border border-white/5 text-white/90' : 'bg-white border border-black/10 hover:bg-black/5 text-black hover:shadow-sm')
                                        }`}
                                      >
                                        {isActive ? (
                                          <>
                                            <Play className={`w-[12px] h-[12px] fill-current opacity-80`} />
                                            <span>立即进入</span>
                                          </>
                                        ) : (
                                          <span>切换此号</span>
                                        )}
                                      </button>
                                      
                                      {!isActive && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (confirm('确定要删除这个账号记录吗？')) {
                                              deleteAccount(acc.Id);
                                            }
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
                        提取当前战网已登录的配置文件并永久保存。
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={loginNewAccount}
                    className={`flex items-center gap-4 p-4 rounded-[20px] transition-colors border border-transparent active:scale-[0.98] group text-left ${
                      isDarkMode ? 'bg-white/5 hover:bg-white/10 hover:border-white/10' : 'bg-black/[0.02] hover:bg-black/5 hover:border-black/10'
                    }`}
                  >
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
                        强制关闭当前战网，让你能够输入新的账密。
                      </div>
                    </div>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col flex-1">
                  <div className="space-y-5 mb-2">
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

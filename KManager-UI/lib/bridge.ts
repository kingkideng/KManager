export interface Account {
  Id: string;
  Remark: string;
  Username: string;
  LastUsed: string;
  GroupId: string;
  Region?: string;
  AvatarDataUrl?: string;
}

export interface Group {
  Id: string;
  Name: string;
  CreatedAt: string;
}

export interface SwitchAccountResult {
  Success: boolean;
  RequiresManualLaunch: boolean;
  Error?: string;
}

export interface SaveAccountResult {
  Success: boolean;
  SessionStateSaved: boolean;
  Error?: string;
}

class MockBridge {
  private accounts: Account[] = [
    { Id: '1', Remark: '我的大号', Username: 'Player#1234', LastUsed: new Date().toISOString(), GroupId: 'default' },
    { Id: '2', Remark: '休闲小号', Username: 'Noob#9876', LastUsed: new Date().toISOString(), GroupId: 'default' }
  ];
  private groups: Group[] = [
    { Id: 'default', Name: '默认分组', CreatedAt: new Date(0).toISOString() }
  ];
  private autoStart = false;

  async GetAccounts(): Promise<string> {
    return JSON.stringify(this.accounts);
  }

  async GetGroups(): Promise<string> {
    return JSON.stringify(this.groups);
  }

  async IsCoreReady(): Promise<boolean> {
    return true;
  }

  async GetCoreInitializationError(): Promise<string> {
    return '';
  }

  async CreateGroup(name: string): Promise<string> {
    const group = {
      Id: Math.random().toString(36).substring(7),
      Name: name.trim(),
      CreatedAt: new Date().toISOString(),
    };
    this.groups.push(group);
    return JSON.stringify(group);
  }

  async RenameGroup(id: string, name: string): Promise<boolean> {
    if (id === 'default') return false;
    const group = this.groups.find(g => g.Id === id);
    if (!group) return false;
    group.Name = name.trim();
    return true;
  }

  async DeleteGroup(id: string): Promise<boolean> {
    if (id === 'default') return false;
    this.groups = this.groups.filter(g => g.Id !== id);
    this.accounts = this.accounts.map(a => a.GroupId === id ? { ...a, GroupId: 'default' } : a);
    return true;
  }

  async MoveAccountToGroup(accountId: string, groupId: string): Promise<boolean> {
    const account = this.accounts.find(a => a.Id === accountId);
    if (!account) return false;
    account.GroupId = this.groups.some(g => g.Id === groupId) ? groupId : 'default';
    return true;
  }

  private normalizeRegion(region: string): string {
    return ['asia', 'americas', 'europe', 'cn'].includes(region) ? region : '';
  }

  async UpdateAccountInfo(accountId: string, remark: string, battleTag: string, region: string, avatarDataUrl: string): Promise<boolean> {
    const account = this.accounts.find(a => a.Id === accountId);
    if (!account) return false;
    account.Remark = remark.trim() || '未命名账号';
    account.Username = battleTag.trim();
    account.Region = this.normalizeRegion(region);
    account.AvatarDataUrl = avatarDataUrl || '';
    return true;
  }

  async SaveCurrentAccount(remark: string, battleTag: string, region: string, avatarDataUrl: string): Promise<boolean> {
    return this.SaveCurrentAccountToGroup(remark, battleTag, 'default', region, avatarDataUrl);
  }

  async SaveCurrentAccountDetailed(remark: string, battleTag: string, region: string, avatarDataUrl: string): Promise<string> {
    return this.SaveCurrentAccountToGroupDetailed(remark, battleTag, 'default', region, avatarDataUrl);
  }

  async SaveCurrentAccountToGroup(remark: string, battleTag: string, groupId: string, region: string, avatarDataUrl: string): Promise<boolean> {
    this.accounts.push({
      Id: Math.random().toString(36).substring(7),
      Remark: remark || '未命名账号',
      Username: battleTag,
      LastUsed: new Date().toISOString(),
      GroupId: this.groups.some(g => g.Id === groupId) ? groupId : 'default',
      Region: this.normalizeRegion(region),
      AvatarDataUrl: avatarDataUrl || '',
    });
    return true;
  }

  async SaveCurrentAccountToGroupDetailed(remark: string, battleTag: string, groupId: string, region: string, avatarDataUrl: string): Promise<string> {
    const success = await this.SaveCurrentAccountToGroup(remark, battleTag, groupId, region, avatarDataUrl);
    return JSON.stringify({
      Success: success,
      SessionStateSaved: success,
      Error: success ? '' : 'missing_config',
    });
  }

  async RefreshAccountSessionState(id: string): Promise<boolean> {
    const account = this.accounts.find(a => a.Id === id);
    if (!account) return false;
    account.LastUsed = new Date().toISOString();
    return true;
  }

  async RefreshAccountSessionStateDetailed(id: string): Promise<string> {
    const success = await this.RefreshAccountSessionState(id);
    return JSON.stringify({
      Success: success,
      SessionStateSaved: success,
      Error: success ? '' : 'missing_account',
    });
  }

  async SwitchAccount(id: string): Promise<boolean> {
    console.log('Switching to account', id);
    const idx = this.accounts.findIndex(a => a.Id === id);
    if (idx !== -1) {
      this.accounts[idx].LastUsed = new Date().toISOString();
    }
    return idx !== -1;
  }

  async SwitchAccountDetailed(id: string): Promise<string> {
    const success = await this.SwitchAccount(id);
    const account = this.accounts.find(a => a.Id === id);
    return JSON.stringify({
      Success: success,
      RequiresManualLaunch: false,
      Error: success ? (account?.Region ? '' : 'untagged_region') : 'missing_config',
    });
  }

  async DeleteAccount(id: string): Promise<void> {
    this.accounts = this.accounts.filter(a => a.Id !== id);
  }

  async AddNewAccount(region: string): Promise<boolean> {
    console.log('Mock: Opening Battle.net to add new account', this.normalizeRegion(region));
    return this.normalizeRegion(region) !== '';
  }

  async GetAutoStart(): Promise<boolean> {
    return this.autoStart;
  }

  async SetAutoStart(enabled: boolean): Promise<void> {
    this.autoStart = enabled;
    console.log('Mock: Auto start set to', enabled);
  }

  async OpenExternalUrl(url: string): Promise<boolean> {
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  }

  async CloseApp(): Promise<void> {
    console.log('Mock: Closing application...');
  }

  async DragWindow(): Promise<void> {
    console.log('Mock: Dragging window');
  }
}

export const getBridge = () => {
  if (typeof window !== 'undefined' && (window as any).chrome?.webview?.hostObjects?.bridge) {
    return (window as any).chrome.webview.hostObjects.bridge;
  }
  // Fallback for development/preview environment outside of WebView2 container
  if (typeof window !== 'undefined') {
    if (!(window as any).mockBridge) {
      (window as any).mockBridge = new MockBridge();
    }
    return (window as any).mockBridge;
  }
  return new MockBridge(); // For SSR
};

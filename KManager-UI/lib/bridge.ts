export interface Account {
  Id: string;
  Remark: string;
  Username: string;
  LastUsed: string;
  GroupId: string;
}

export interface Group {
  Id: string;
  Name: string;
  CreatedAt: string;
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

  async SaveCurrentAccount(remark: string, battleTag: string): Promise<boolean> {
    return this.SaveCurrentAccountToGroup(remark, battleTag, 'default');
  }

  async SaveCurrentAccountToGroup(remark: string, battleTag: string, groupId: string): Promise<boolean> {
    this.accounts.push({
      Id: Math.random().toString(36).substring(7),
      Remark: remark || '未命名账号',
      Username: battleTag,
      LastUsed: new Date().toISOString(),
      GroupId: this.groups.some(g => g.Id === groupId) ? groupId : 'default',
    });
    return true;
  }

  async SwitchAccount(id: string): Promise<void> {
    console.log('Switching to account', id);
    const idx = this.accounts.findIndex(a => a.Id === id);
    if (idx !== -1) {
      this.accounts[idx].LastUsed = new Date().toISOString();
    }
  }

  async DeleteAccount(id: string): Promise<void> {
    this.accounts = this.accounts.filter(a => a.Id !== id);
  }

  async AddNewAccount(): Promise<void> {
    console.log('Mock: Opening Battle.net to add new account');
  }

  async GetAutoStart(): Promise<boolean> {
    return this.autoStart;
  }

  async SetAutoStart(enabled: boolean): Promise<void> {
    this.autoStart = enabled;
    console.log('Mock: Auto start set to', enabled);
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

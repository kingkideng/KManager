export interface Account {
  Id: string;
  Remark: string;
  Username: string;
  LastUsed: string;
}

class MockBridge {
  private accounts: Account[] = [
    { Id: '1', Remark: '我的大号', Username: 'Player#1234', LastUsed: new Date().toISOString() },
    { Id: '2', Remark: '休闲小号', Username: 'Noob#9876', LastUsed: new Date().toISOString() }
  ];
  private autoStart = false;

  async GetAccounts(): Promise<string> {
    return JSON.stringify(this.accounts);
  }

  async SaveCurrentAccount(remark: string, battleTag: string): Promise<boolean> {
    this.accounts.push({
      Id: Math.random().toString(36).substring(7),
      Remark: remark || '未命名账号',
      Username: battleTag,
      LastUsed: new Date().toISOString(),
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

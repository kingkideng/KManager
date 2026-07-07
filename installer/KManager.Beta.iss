#define MyAppName "KManager Beta"
#define MyAppVersion "2.0-beta.6"
#define MyAppPublisher "kingkideng"
#define MyAppURL "https://github.com/kingkideng/KManager"
#define MyAppExeName "KManager-RegionSwitch-Test.exe"
#define PublishDir "..\..\TestBuild\KManager-RegionSwitch-Test"
#define OutputDir "..\..\TestBuild"

[Setup]
AppId=KManagerRegionSwitchBeta
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} version {#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}/releases
DefaultDirName={localappdata}\Programs\{#MyAppName}
DisableDirPage=no
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
AllowNoIcons=yes
OutputDir={#OutputDir}
OutputBaseFilename=KManager_Beta_Setup_v{#MyAppVersion}
SetupIconFile=..\KManager-Client\app-beta.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=yes
RestartApplications=no
VersionInfoVersion=2.0.0.6
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppName} Setup
VersionInfoProductName={#MyAppName}
VersionInfoProductVersion=2.0.0.6
UninstallDisplayIcon={app}\{#MyAppExeName}

[Languages]
Name: "chinesesimplified"; MessagesFile: "ChineseSimplified.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[InstallDelete]
Type: filesandordirs; Name: "{app}\wwwroot"
Type: filesandordirs; Name: "{app}\WebView2Cache"

[Files]
Source: "{#PublishDir}\*"; DestDir: "{app}"; Excludes: "Data\*;WebView2Cache\*"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{userdesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

#define MyAppName "KManager"
#define MyAppVersion "1.1.1"
#define MyAppPublisher "kingkideng"
#define MyAppURL "https://github.com/kingkideng/KManager"
#define MyAppExeName "KManager.exe"
#define PublishDir "..\KManager-Client\bin\Release\net8.0-windows\win-x64\publish"
#define OutputDir "..\..\ReleaseAssets"

[Setup]
AppId=KManager
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
OutputBaseFilename=KManager_Setup_v{#MyAppVersion}
SetupIconFile=..\KManager-Client\app.ico
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
CloseApplications=yes
RestartApplications=no
VersionInfoVersion=1.1.1.0
VersionInfoCompany={#MyAppPublisher}
VersionInfoDescription={#MyAppName} Setup
VersionInfoProductName={#MyAppName}
VersionInfoProductVersion={#MyAppVersion}
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

[Code]
var
  PreviousInstallDir: string;

function SamePath(Path1: string; Path2: string): Boolean;
begin
  Result := CompareText(RemoveBackslashUnlessRoot(Path1), RemoveBackslashUnlessRoot(Path2)) = 0;
end;

procedure CopyDirectoryIfMissing(SourceDir: string; DestDir: string);
var
  FindRec: TFindRec;
  SourcePath: string;
  DestPath: string;
begin
  if not DirExists(SourceDir) then
    Exit;

  ForceDirectories(DestDir);

  if FindFirst(AddBackslash(SourceDir) + '*', FindRec) then
  begin
    try
      repeat
        if (FindRec.Name <> '.') and (FindRec.Name <> '..') then
        begin
          SourcePath := AddBackslash(SourceDir) + FindRec.Name;
          DestPath := AddBackslash(DestDir) + FindRec.Name;

          if (FindRec.Attributes and FILE_ATTRIBUTE_DIRECTORY) <> 0 then
            CopyDirectoryIfMissing(SourcePath, DestPath)
          else if not FileExists(DestPath) then
            CopyFile(SourcePath, DestPath, False);
        end;
      until not FindNext(FindRec);
    finally
      FindClose(FindRec);
    end;
  end;
end;

function InitializeSetup(): Boolean;
begin
  PreviousInstallDir := '';
  RegQueryStringValue(
    HKCU,
    'Software\Microsoft\Windows\CurrentVersion\Uninstall\KManager_is1',
    'InstallLocation',
    PreviousInstallDir);
  Result := True;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  SourceDataDir: string;
  DestDataDir: string;
begin
  if CurStep <> ssPostInstall then
    Exit;

  if PreviousInstallDir = '' then
    Exit;

  if SamePath(PreviousInstallDir, ExpandConstant('{app}')) then
    Exit;

  SourceDataDir := AddBackslash(PreviousInstallDir) + 'Data';
  DestDataDir := ExpandConstant('{app}\Data');

  if DirExists(SourceDataDir) and not FileExists(AddBackslash(DestDataDir) + 'accounts.json') then
    CopyDirectoryIfMissing(SourceDataDir, DestDataDir);
end;

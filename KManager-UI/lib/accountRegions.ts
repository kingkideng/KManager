export const UNTAGGED_ACCOUNT_REGION = '';
export const DEFAULT_ACCOUNT_REGION = 'asia';

export const ACCOUNT_REGIONS = [
  { value: 'asia', label: '亚服' },
  { value: 'americas', label: '美服' },
  { value: 'europe', label: '欧服' },
  { value: 'cn', label: '国服' },
] as const;

export const normalizeAccountRegion = (region?: string) =>
  ACCOUNT_REGIONS.some(item => item.value === region) ? region! : UNTAGGED_ACCOUNT_REGION;

export const isAccountRegionTagged = (region?: string) =>
  normalizeAccountRegion(region) !== UNTAGGED_ACCOUNT_REGION;

export const getAccountRegionLabel = (region?: string) =>
  ACCOUNT_REGIONS.find(item => item.value === normalizeAccountRegion(region))?.label || '待标记区服';

export const getAccountRegionBadgeClass = (region: string | undefined, isDarkMode: boolean) => {
  switch (normalizeAccountRegion(region)) {
    case 'asia':
      return isDarkMode ? 'border-[#5FE8FF]/35 bg-[#5FE8FF]/[0.12] text-[#BFF8FF]' : 'border-[#0BBDE3]/30 bg-[#5FE8FF]/[0.14] text-[#007A96]';
    case 'americas':
      return isDarkMode ? 'border-[#168DFF]/40 bg-[#168DFF]/[0.18] text-[#9BD2FF]' : 'border-[#168DFF]/30 bg-[#168DFF]/[0.12] text-[#075DA8]';
    case 'europe':
      return isDarkMode ? 'border-[#8C7CFF]/40 bg-[#8C7CFF]/[0.18] text-[#D9D4FF]' : 'border-[#6D5BFF]/30 bg-[#8C7CFF]/[0.12] text-[#4B3BC6]';
    case 'cn':
      return isDarkMode ? 'border-[#F8FBFF]/30 bg-[#F8FBFF]/[0.10] text-[#F8FBFF]' : 'border-[#0B111A]/18 bg-[#0B111A]/[0.06] text-[#0B111A]';
    default:
      return isDarkMode ? 'border-[#F8FBFF]/18 bg-white/[0.06] text-[#D7E8F5]' : 'border-[#0B111A]/10 bg-[#0B111A]/[0.05] text-[#334155]';
  }
};

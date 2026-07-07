'use client';

type KLogoBrandProps = {
  isActive: boolean;
  isDarkMode: boolean;
};

export const KLogoBrand = ({ isActive, isDarkMode }: KLogoBrandProps) => (
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

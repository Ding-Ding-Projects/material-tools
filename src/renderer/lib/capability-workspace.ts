export type PlannedCapabilityLaneId = 'tweaks' | 'config' | 'updates' | 'microwin';

export interface PlannedCapabilityCard {
  id: string;
  title: string;
  titleYue: string;
  description: string;
  descriptionYue: string;
  readiness: 'metadata' | 'executor' | 'recovery';
}

export const PLANNED_CAPABILITY_CARDS: Readonly<Record<PlannedCapabilityLaneId, readonly PlannedCapabilityCard[]>> = {
  tweaks: [
    {
      id: 'privacy',
      title: 'Privacy and telemetry',
      titleYue: '私隱同遙測',
      description: 'Review the intended privacy impact before any registry or scheduled-task change is exposed.',
      descriptionYue: '任何登錄或排程工作變更推出前，先清楚檢視私隱影響。',
      readiness: 'metadata',
    },
    {
      id: 'interface',
      title: 'Explorer and desktop',
      titleYue: '檔案總管同桌面',
      description: 'Interface preferences will include detected state, exact affected values, and a reversible preview.',
      descriptionYue: '介面偏好會列出偵測狀態、實際受影響數值，同可還原預覽。',
      readiness: 'metadata',
    },
    {
      id: 'services',
      title: 'Services and power',
      titleYue: '服務同電源',
      description: 'Service and power-plan changes remain unavailable until dependency and restart effects are modeled.',
      descriptionYue: '服務同電源計劃變更，要等相依項目同重新啟動影響建模完成先會開放。',
      readiness: 'executor',
    },
    {
      id: 'rollback',
      title: 'Rollback evidence',
      titleYue: '還原證據',
      description: 'Every future tweak must prove its previous value was captured and can be restored independently.',
      descriptionYue: '每個未來調整都要證明已記錄舊值，而且可以獨立還原。',
      readiness: 'recovery',
    },
  ],
  config: [
    {
      id: 'features',
      title: 'Optional features',
      titleYue: '選用功能',
      description: 'Windows feature plans will detect support and prerequisites before showing an apply action.',
      descriptionYue: 'Windows 功能計劃會先偵測支援同先決條件，之後先顯示套用操作。',
      readiness: 'metadata',
    },
    {
      id: 'repairs',
      title: 'Repair tools',
      titleYue: '修復工具',
      description: 'DISM, SFC, and repair flows need streamed progress, cancellation, and honest partial results.',
      descriptionYue: 'DISM、SFC 同修復流程要有即時進度、取消，同誠實嘅部分結果。',
      readiness: 'executor',
    },
    {
      id: 'network',
      title: 'Network and DNS',
      titleYue: '網絡同 DNS',
      description: 'Provider choices will name the active adapter, current values, validation, and undo plan.',
      descriptionYue: '供應商選擇會列明使用中網絡卡、現有數值、驗證同復原計劃。',
      readiness: 'metadata',
    },
    {
      id: 'profiles',
      title: 'PowerShell profiles',
      titleYue: 'PowerShell 設定檔',
      description: 'Profile edits remain unavailable until file ownership, diff preview, and restore are verified.',
      descriptionYue: '設定檔編輯要等檔案擁有權、差異預覽同還原驗證完成先會開放。',
      readiness: 'recovery',
    },
  ],
  updates: [
    {
      id: 'default-policy',
      title: 'Default Windows policy',
      titleYue: 'Windows 預設原則',
      description: 'The current update policy must be detected before the default profile can be selected safely.',
      descriptionYue: '要先偵測目前更新原則，先可以安全揀選預設設定檔。',
      readiness: 'metadata',
    },
    {
      id: 'security-policy',
      title: 'Security-focused policy',
      titleYue: '安全優先原則',
      description: 'A security-focused profile will show exact deferrals and what continues to update.',
      descriptionYue: '安全優先設定檔會清楚列明延後內容，同邊啲更新仍然繼續。',
      readiness: 'metadata',
    },
    {
      id: 'feature-control',
      title: 'Feature update control',
      titleYue: '功能更新控制',
      description: 'Feature-version targeting needs operating-system support checks and restart-aware verification.',
      descriptionYue: '功能版本指定需要作業系統支援檢查，同留意重新啟動嘅驗證。',
      readiness: 'executor',
    },
    {
      id: 'update-recovery',
      title: 'Repair and rollback',
      titleYue: '修復同還原',
      description: 'Reset and rollback actions remain unavailable until recovery boundaries are independently proven.',
      descriptionYue: '重設同還原操作要等復原界線獨立證明完成先會開放。',
      readiness: 'recovery',
    },
  ],
  microwin: [
    {
      id: 'source-image',
      title: 'Choose a source image',
      titleYue: '選擇來源映像',
      description: 'The source ISO will be opened read-only, identified, and checked before a work copy is created.',
      descriptionYue: '來源 ISO 會以唯讀方式開啟、識別同檢查，之後先建立工作副本。',
      readiness: 'metadata',
    },
    {
      id: 'copy-staging',
      title: 'Stage an isolated copy',
      titleYue: '建立隔離副本',
      description: 'Original media is never modified; staging needs free-space checks and resumable progress.',
      descriptionYue: '原始媒體永遠唔會被修改；暫存要檢查空間同支援續傳進度。',
      readiness: 'executor',
    },
    {
      id: 'answer-file',
      title: 'Review unattended choices',
      titleYue: '檢視無人值守選項',
      description: 'Every answer-file value will be visible, validated, editable, and exportable before creation.',
      descriptionYue: '每個答案檔數值都會喺建立前顯示、驗證、編輯同匯出。',
      readiness: 'metadata',
    },
    {
      id: 'output-proof',
      title: 'Verify the output',
      titleYue: '驗證輸出',
      description: 'The final image needs hashes, boot-media checks, and a complete audit summary.',
      descriptionYue: '最終映像需要雜湊、開機媒體檢查，同完整稽核摘要。',
      readiness: 'recovery',
    },
  ],
};

export const CAPABILITY_READINESS_LABELS = {
  metadata: { en: 'Operation metadata required', yue: '需要操作中繼資料' },
  executor: { en: 'Safe executor required', yue: '需要安全執行器' },
  recovery: { en: 'Recovery proof required', yue: '需要復原證據' },
} as const;

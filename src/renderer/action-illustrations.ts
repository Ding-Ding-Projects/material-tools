import commandPaletteImage from './assets/action-illustrations/command-palette.webp';
import applicationsCatalogImage from './assets/action-illustrations/applications-catalog.webp';
import configImage from './assets/action-illustrations/config.webp';
import destructiveConfirmationImage from './assets/action-illustrations/destructive-confirmation.webp';
import installImage from './assets/action-illustrations/install.webp';
import microwinImage from './assets/action-illustrations/microwin.webp';
import notificationsImage from './assets/action-illustrations/notifications.webp';
import operationPlanImage from './assets/action-illustrations/operation-plan.webp';
import operationProgressImage from './assets/action-illustrations/operation-progress.webp';
import operationRecoveryImage from './assets/action-illustrations/operation-recovery.webp';
import overviewImage from './assets/action-illustrations/overview.webp';
import packageManagerReadinessImage from './assets/action-illustrations/package-manager-readiness.webp';
import privateVocabularyImage from './assets/action-illustrations/private-vocabulary.webp';
import regexBuilderImage from './assets/action-illustrations/regex-builder.webp';
import settingsImage from './assets/action-illustrations/settings.webp';
import tweaksImage from './assets/action-illustrations/tweaks.webp';
import updatesImage from './assets/action-illustrations/updates.webp';

export const FEATURE_PAGE_ILLUSTRATION_IDS = [
  'overview',
  'install',
  'tweaks',
  'config',
  'updates',
  'microwin',
  'settings',
] as const;

export const IMPLEMENTED_SURFACE_ILLUSTRATION_IDS = [
  'command-palette',
  'regex-builder',
  'notifications',
  'private-vocabulary',
  'applications-catalog',
  'package-manager-readiness',
  'operation-plan',
  'operation-progress',
  'operation-recovery',
] as const;

export const DOCUMENTED_ILLUSTRATION_EXCEPTIONS = {
  'destructive-confirmation': 'The destructive-action confirmation dialog is not implemented in the current foundation build, so its illustration is bundled but is not rendered in a fake or decorative flow.',
} as const;

export type FeaturePageIllustrationId = typeof FEATURE_PAGE_ILLUSTRATION_IDS[number];
export type ImplementedSurfaceIllustrationId = typeof IMPLEMENTED_SURFACE_ILLUSTRATION_IDS[number];
export type ActionIllustrationId = FeaturePageIllustrationId | ImplementedSurfaceIllustrationId | keyof typeof DOCUMENTED_ILLUSTRATION_EXCEPTIONS;
export type IllustrationLanguage = 'en' | 'yue' | 'both';

export const ACTION_ILLUSTRATION_BINDINGS = {
  featurePages: {
    overview: 'overview',
    install: 'install',
    tweaks: 'tweaks',
    config: 'config',
    updates: 'updates',
    microwin: 'microwin',
    settings: 'settings',
  },
  surfaces: {
    commandPalette: 'command-palette',
    regexBuilder: 'regex-builder',
    notifications: 'notifications',
    privateVocabulary: 'private-vocabulary',
    applicationsCatalog: 'applications-catalog',
    packageManagerReadiness: 'package-manager-readiness',
    operationPlan: 'operation-plan',
    operationProgress: 'operation-progress',
    operationRecovery: 'operation-recovery',
  },
} as const satisfies {
  featurePages: Record<FeaturePageIllustrationId, FeaturePageIllustrationId>;
  surfaces: Record<string, ImplementedSurfaceIllustrationId>;
};

interface ActionIllustrationDefinition {
  src: string;
  alt: {
    en: string;
    yue: string;
  };
}

export const ACTION_ILLUSTRATIONS: Readonly<Record<ActionIllustrationId, ActionIllustrationDefinition>> = {
  overview: {
    src: overviewImage,
    alt: {
      en: 'Tactile device inspection scene with a magnifying glass and system status cards',
      yue: '立體裝置檢查場景，用放大鏡查看電腦同系統狀態卡',
    },
  },
  install: {
    src: installImage,
    alt: {
      en: 'Tactile package conveyor showing install, upgrade, and remove choices',
      yue: '立體套件輸送帶，展示安裝、升級同移除選擇',
    },
  },
  tweaks: {
    src: tweaksImage,
    alt: {
      en: 'Tactile reversible tuning controls encircled by rollback arrows and a verification shield',
      yue: '立體可還原調整控制，外圍有回復箭嘴同驗證盾牌',
    },
  },
  config: {
    src: configImage,
    alt: {
      en: 'Tactile configuration toolkit fitting a puzzle piece into system controls',
      yue: '立體設定工具箱，將拼圖塊裝入系統控制組件',
    },
  },
  updates: {
    src: updatesImage,
    alt: {
      en: 'Tactile update timeline with forward, rollback, and verification paths',
      yue: '立體更新時間線，包含前進、回復同驗證路徑',
    },
  },
  microwin: {
    src: microwinImage,
    alt: {
      en: 'Tactile installation media flowing from an optical image to a USB drive',
      yue: '立體安裝媒體由光碟映像流向 USB 手指',
    },
  },
  settings: {
    src: settingsImage,
    alt: {
      en: 'Tactile appearance and layout controls for color, density, and arrangement',
      yue: '立體外觀同版面控制，用嚟調整顏色、密度同排列',
    },
  },
  'command-palette': {
    src: commandPaletteImage,
    alt: {
      en: 'Tactile search and command cards converging on a selected destination',
      yue: '立體搜尋同指令卡匯聚到已選目的地',
    },
  },
  'regex-builder': {
    src: regexBuilderImage,
    alt: {
      en: 'Tactile regular expression pattern pieces matching highlighted sample tokens',
      yue: '立體正規表示式圖樣組件，配對已標示嘅範例符號',
    },
  },
  notifications: {
    src: notificationsImage,
    alt: {
      en: 'Tactile notification cards flowing into a reviewable message tray',
      yue: '立體通知卡流入可以翻查嘅訊息托盤',
    },
  },
  'private-vocabulary': {
    src: privateVocabularyImage,
    alt: {
      en: 'Tactile private vocabulary file transferring approved wording into a local-only store marked with a padlock',
      yue: '立體私人詞彙檔案，將核准字句傳送到有掛鎖標記嘅本機專用儲存區',
    },
  },
  'applications-catalog': {
    src: applicationsCatalogImage,
    alt: {
      en: 'Tactile application catalog cards arranged around category, source, and status filters',
      yue: '立體應用程式目錄卡，圍繞分類、來源同狀態篩選器排列',
    },
  },
  'package-manager-readiness': {
    src: packageManagerReadinessImage,
    alt: {
      en: 'Tactile read-only package-manager detection scene showing verified and unavailable states',
      yue: '立體唯讀套件管理器偵測場景，顯示已驗證同不可用狀態',
    },
  },
  'operation-plan': {
    src: operationPlanImage,
    alt: {
      en: 'Tactile selected applications flowing into a review plan without executing changes',
      yue: '立體已選應用程式流入審核計劃，但未執行任何變更',
    },
  },
  'operation-progress': {
    src: operationProgressImage,
    alt: {
      en: 'Tactile operation timeline with measurable progress, cancellation, and verification stages',
      yue: '立體操作時間線，包含可量度進度、取消同驗證階段',
    },
  },
  'operation-recovery': {
    src: operationRecoveryImage,
    alt: {
      en: 'Tactile recovery path returning a changed system state to its recorded baseline',
      yue: '立體復原路徑，將已變更系統狀態還原到已記錄基準',
    },
  },
  'destructive-confirmation': {
    src: destructiveConfirmationImage,
    alt: {
      en: 'Tactile two-key confirmation controls, full-range slider, and emergency exit',
      yue: '立體雙重確認掣、全程滑桿同緊急離開出口',
    },
  },
};

export function actionIllustrationAlt(id: ActionIllustrationId, language: IllustrationLanguage): string {
  const { en, yue } = ACTION_ILLUSTRATIONS[id].alt;
  if (language === 'yue') return yue;
  if (language === 'both') return `${en} · ${yue}`;
  return en;
}

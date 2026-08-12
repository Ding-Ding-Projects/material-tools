export type FeatureIllustrationSurface =
  | 'feature-overview'
  | 'feature-applications'
  | 'feature-tweaks'
  | 'feature-config'
  | 'feature-updates'
  | 'feature-automation'
  | 'feature-creator'
  | 'feature-settings'
  | 'feature-notifications'
  | 'feature-private-vocabulary';

export type OverlayIllustrationSurface =
  | 'sheet-mobile-navigation'
  | 'panel-tab-discovery'
  | 'dialog-tab-context'
  | 'dialog-group-picker'
  | 'dialog-appearance-editor'
  | 'dialog-command-palette'
  | 'popover-regex-builder'
  | 'sheet-private-vocabulary'
  | 'notification-toast';

export type ActionIllustrationSurface = FeatureIllustrationSurface | OverlayIllustrationSurface;

export interface ActionIllustrationBinding {
  src: string;
  altEnglish: string;
  altCantonese: string;
}

// Hand-written on purpose. The companion test requires an exact binding for each rendered
// feature destination and each implemented overlay or message surface.
export const requiredFeatureIllustrationSurfaces: readonly FeatureIllustrationSurface[] = [
  'feature-overview',
  'feature-applications',
  'feature-tweaks',
  'feature-config',
  'feature-updates',
  'feature-automation',
  'feature-creator',
  'feature-settings',
  'feature-notifications',
  'feature-private-vocabulary',
];

export const requiredOverlayIllustrationSurfaces: readonly OverlayIllustrationSurface[] = [
  'sheet-mobile-navigation',
  'panel-tab-discovery',
  'dialog-tab-context',
  'dialog-group-picker',
  'dialog-appearance-editor',
  'dialog-command-palette',
  'popover-regex-builder',
  'sheet-private-vocabulary',
  'notification-toast',
];

const overview = new URL('./assets/action-illustrations/overview.webp', import.meta.url).href;
const install = new URL('./assets/action-illustrations/install.webp', import.meta.url).href;
const tweaks = new URL('./assets/action-illustrations/tweaks.webp', import.meta.url).href;
const config = new URL('./assets/action-illustrations/config.webp', import.meta.url).href;
const updates = new URL('./assets/action-illustrations/updates.webp', import.meta.url).href;
const microwin = new URL('./assets/action-illustrations/microwin.webp', import.meta.url).href;
const settings = new URL('./assets/action-illustrations/settings.webp', import.meta.url).href;
const privateVocabulary = new URL('./assets/action-illustrations/private-vocabulary.webp', import.meta.url).href;
const commandPalette = new URL('./assets/action-illustrations/command-palette.webp', import.meta.url).href;
const regexBuilder = new URL('./assets/action-illustrations/regex-builder.webp', import.meta.url).href;
const notifications = new URL('./assets/action-illustrations/notifications.webp', import.meta.url).href;

export const actionIllustrationBindings: Record<ActionIllustrationSurface, ActionIllustrationBinding> = {
  'feature-overview': {
    src: overview,
    altEnglish: 'Illustration of a Windows setup workflow moving from applications through delivery.',
    altCantonese: 'Windows 設定流程由應用程式一路去到交付嘅插圖。',
  },
  'feature-applications': {
    src: install,
    altEnglish: 'Illustration of selecting and installing applications from a managed package list.',
    altCantonese: '由管理套件清單揀選同安裝應用程式嘅插圖。',
  },
  'feature-tweaks': {
    src: tweaks,
    altEnglish: 'Illustration of adjusting grouped Windows settings and power controls.',
    altCantonese: '調校分組 Windows 設定同電源控制嘅插圖。',
  },
  'feature-config': {
    src: config,
    altEnglish: 'Illustration of configuration files, repair tools, and system controls.',
    altCantonese: '設定檔、修復工具同系統控制嘅插圖。',
  },
  'feature-updates': {
    src: updates,
    altEnglish: 'Illustration of Windows updates moving through a controlled update policy.',
    altCantonese: 'Windows 更新經受控更新策略處理嘅插圖。',
  },
  'feature-automation': {
    src: config,
    altEnglish: 'Illustration of exporting a repeatable configuration for automated Windows setup.',
    altCantonese: '匯出可重複使用設定去自動化 Windows 設定嘅插圖。',
  },
  'feature-creator': {
    src: microwin,
    altEnglish: 'Illustration of creating a customized Windows 11 installation image.',
    altCantonese: '建立自訂 Windows 11 安裝映像嘅插圖。',
  },
  'feature-settings': {
    src: settings,
    altEnglish: 'Illustration of personalizing the site theme, layout, language, and density.',
    altCantonese: '自訂網站主題、版面、語言同密度嘅插圖。',
  },
  'feature-notifications': {
    src: notifications,
    altEnglish: 'Illustration of non-blocking messages collected in notification history.',
    altCantonese: '非阻塞訊息收集喺通知記錄嘅插圖。',
  },
  'feature-private-vocabulary': {
    src: privateVocabulary,
    altEnglish: 'Illustration of loading a private vocabulary JSON file into local browser storage.',
    altCantonese: '將私人詞彙 JSON 檔案載入本機瀏覽器儲存空間嘅插圖。',
  },
  'sheet-mobile-navigation': {
    src: overview,
    altEnglish: 'Illustration of navigating the Windows setup feature map on a narrow screen.',
    altCantonese: '喺窄螢幕瀏覽 Windows 設定功能地圖嘅插圖。',
  },
  'panel-tab-discovery': {
    src: commandPalette,
    altEnglish: 'Illustration of searching across tabs, groups, and destinations.',
    altCantonese: '搜尋分頁、群組同目的地嘅插圖。',
  },
  'dialog-tab-context': {
    src: settings,
    altEnglish: 'Illustration of organizing and personalizing a selected tab.',
    altCantonese: '整理同自訂所選分頁嘅插圖。',
  },
  'dialog-group-picker': {
    src: commandPalette,
    altEnglish: 'Illustration of finding a destination group before moving a tab.',
    altCantonese: '移動分頁之前尋找目的地群組嘅插圖。',
  },
  'dialog-appearance-editor': {
    src: settings,
    altEnglish: 'Illustration of editing an element color, shape, and emphasis.',
    altCantonese: '編輯元素顏色、形狀同強調效果嘅插圖。',
  },
  'dialog-command-palette': {
    src: commandPalette,
    altEnglish: 'Illustration of searching commands and opening an exact destination.',
    altCantonese: '搜尋指令並開啟準確目的地嘅插圖。',
  },
  'popover-regex-builder': {
    src: regexBuilder,
    altEnglish: 'Illustration of building a regular expression and matching sample text.',
    altCantonese: '建立正則表達式並配對範例文字嘅插圖。',
  },
  'sheet-private-vocabulary': {
    src: privateVocabulary,
    altEnglish: 'Illustration of choosing and validating a private local vocabulary file.',
    altCantonese: '揀選同驗證私人本機詞彙檔案嘅插圖。',
  },
  'notification-toast': {
    src: notifications,
    altEnglish: 'Illustration of a non-blocking notification arriving without interrupting the current task.',
    altCantonese: '非阻塞通知到達而唔會打斷目前工作嘅插圖。',
  },
};

export const articleIllustrationSurfaces = {
  applications: 'feature-applications',
  tweaks: 'feature-tweaks',
  config: 'feature-config',
  updates: 'feature-updates',
  automation: 'feature-automation',
  creator: 'feature-creator',
} as const satisfies Record<string, FeatureIllustrationSurface>;

export function illustrationSurfaceForArticle(articleId: string): FeatureIllustrationSurface {
  const surface = articleIllustrationSurfaces[articleId as keyof typeof articleIllustrationSurfaces];
  if (!surface) throw new Error(`No action illustration is registered for article ${articleId}.`);
  return surface;
}

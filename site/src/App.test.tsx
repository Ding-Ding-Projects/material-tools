import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import App from './App';
import { STORAGE_KEY } from './storage';
import { MAX_PRIVATE_VOCABULARY_BYTES } from './vocabulary';
import { clearPrivateVocabulary, PRIVATE_VOCABULARY_KEY } from './vocabulary';

describe('Material Tools Pages shell', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('collapses navigation into a vertical M3 drawer on narrow screens', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
    render(<App />);
    const opener = screen.getByRole('button', { name: 'Open navigation' });
    expect(opener).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('navigation', { name: 'Feature tabs' })).not.toBeInTheDocument();
    fireEvent.click(opener);
    expect(screen.getByRole('navigation', { name: 'Feature tabs' })).toBeInTheDocument();
    expect(screen.getByRole('tablist', { name: '' })).toHaveAttribute('aria-orientation', 'vertical');
    expect(screen.getAllByRole('button', { name: 'Close navigation' })).toHaveLength(2);
    expect(screen.getByText('Verified unsigned installer details')).toBeInTheDocument();
  });

  it('links the verified unsigned Windows installer from the home surface', () => {
    render(<App />);
    const download = screen.getByRole('link', { name: 'Download 0.1.0 for Windows (x64)' });
    expect(download).toHaveAttribute('href', 'https://github.com/Ding-Ding-Projects/material-tools/releases/download/build-0.1.0.18/MaterialTools-Setup-0.1.0-x64.exe');
    expect(download).toHaveClass('installer-download');
    expect(download.querySelectorAll(':scope > span')).toHaveLength(3);
    expect(screen.getByText(/Verified build-0\.1\.0\.18/)).toHaveTextContent('SHA-256 b7cc69e61c7c6a9ea6cd089f517afd24f295d4f24b5d2af864588d2c14d0b6b3');
  });

  it('opens the global command palette with Ctrl+Shift+F', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'Private vocabulary: Original wording' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'F', ctrlKey: true, shiftKey: true });
    expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeInTheDocument();
    expect(screen.getByLabelText('Commands and destinations')).toBeInTheDocument();
  });

  it('keeps private-vocabulary status, upload, and recovery reachable from the compact header control', async () => {
    render(<App />);
    const trigger = screen.getByRole('button', { name: 'Private vocabulary: Original wording' });
    fireEvent.click(trigger);
    const panel = screen.getByRole('dialog', { name: 'Private vocabulary' });
    expect(screen.getByLabelText('Upload private vocabulary JSON file')).toBeInTheDocument();
    expect(screen.getByText('No file is loaded, so shipped wording remains unchanged.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear local vocabulary' })).toBeDisabled();
    fireEvent.keyDown(panel, { key: 'Escape' });
    await waitFor(() => expect(trigger).toHaveFocus());

    fireEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Private vocabulary' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('keeps arrow-key focus on the selected tab instead of racing back to the panel', async () => {
    render(<App />);
    const applications = screen.getByRole('tab', { name: 'Applications' });
    applications.focus();
    fireEvent.keyDown(applications, { key: 'ArrowDown' });
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Tweaks' })).toHaveFocus());
  });

  it('gives a tab context panel its own search and anchored regex builder', () => {
    render(<App />);
    fireEvent.contextMenu(screen.getByRole('tab', { name: 'Applications' }));
    expect(screen.getByRole('dialog', { name: 'Applications tab' })).toBeInTheDocument();
    expect(screen.getByLabelText('Applications tab actions')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open anchored regex builder for Applications tab actions' }));
    expect(screen.getByRole('dialog', { name: 'Regex builder for Applications tab actions' })).toBeInTheDocument();
  });

  it('ships four independent tab-discovery searches with anchored builders', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Tab discovery' }));
    for (const label of ['Current tab strip', 'Current tab group', 'Tab groups by name', 'Master tab search']) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: `Open anchored regex builder for ${label}` })).toBeInTheDocument();
    }
  });

  it('opens a searchable group picker with its own anchored builder', () => {
    render(<App />);
    fireEvent.contextMenu(screen.getByRole('tab', { name: 'Applications' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Move… into group…/ }));
    expect(screen.getByRole('dialog', { name: 'Move into group' })).toBeInTheDocument();
    expect(screen.getByLabelText('Move into group actions')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open anchored regex builder for Move into group actions' })).toBeInTheDocument();
  });

  it('persists tab pinning and presents it after remount', async () => {
    const first = render(<App />);
    fireEvent.contextMenu(screen.getByRole('tab', { name: 'Applications' }));
    fireEvent.click(screen.getByRole('menuitem', { name: /Pin tab/ }));
    await waitFor(() => expect(window.localStorage.getItem(STORAGE_KEY)).toContain('"pinned":true'));
    first.unmount();
    render(<App />);
    expect(screen.getByRole('tab', { name: /Applications Pinned/ })).toBeInTheDocument();
  });

  it('forces English and omits playful controls while School mode is active', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: /Settings Pinned/ }));
    const mode = screen.getByRole('checkbox', { name: 'Enable School mode' });
    fireEvent.click(mode);
    expect(screen.getByText('School mode is active')).toBeInTheDocument();
    expect(screen.queryByText('English funny level')).not.toBeInTheDocument();
  });

  it('gives settings and color editing their own anchored regex builders', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: /Settings Pinned/ }));
    expect(screen.getByLabelText('Settings on this page')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open anchored regex builder for Settings on this page' })).toBeInTheDocument();
    expect(screen.getByLabelText('Accent seed color editor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open anchored regex builder for Accent seed color editor' })).toBeInTheDocument();
    expect(screen.getByLabelText('Private vocabulary JSON file')).toBeInTheDocument();
    expect(screen.getByText('Original wording active')).toBeInTheDocument();
  });

  it('keeps a tabbable selected tab when the active group collapses', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: 'Applications' }));
    fireEvent.click(screen.getByRole('button', { name: 'Toggle Start here group' }));
    const overview = screen.getByRole('tab', { name: /Overview Pinned/ });
    expect(overview).toHaveAttribute('aria-selected', 'true');
    expect(overview).toHaveAttribute('tabindex', '0');
    expect(screen.queryByRole('tab', { name: 'Applications' })).not.toBeInTheDocument();
  });

  it('restores focus to the command-palette opener after closing', async () => {
    render(<App />);
    const opener = screen.getByRole('button', { name: /Command palette/ });
    opener.focus();
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(opener).toHaveFocus());
  });

  it('wires every funny level and derives readable text from a custom accent', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: /Settings Pinned/ }));
    fireEvent.change(screen.getByRole('slider', { name: 'English funny level' }), { target: { value: '5' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'HEX color' }), { target: { value: '#ffffff' } });
    await waitFor(() => {
      const primary = document.documentElement.style.getPropertyValue('--md-sys-color-primary');
      const onPrimary = document.documentElement.style.getPropertyValue('--md-sys-color-on-primary');
      expect(primary).not.toBe('#ffffff');
      expect(onPrimary).not.toBe('');
    });
    fireEvent.click(screen.getByRole('tab', { name: /Overview Pinned/ }));
    expect(screen.getByText(/fake moustache/)).toBeInTheDocument();
  });

  it('localizes the always-visible private vocabulary upload', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: /Settings Pinned/ }));
    fireEvent.click(screen.getByRole('button', { name: '廣東話' }));
    fireEvent.click(screen.getByRole('button', { name: '私人詞彙: 使用原本文案' }));
    expect(screen.getByLabelText('上載私人詞彙 JSON 檔案')).toBeInTheDocument();
    expect(screen.getByLabelText('私人詞彙 JSON 檔案')).toBeInTheDocument();
  });

  it('shows a bounded upload error and clears it without caching a payload', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: /Settings Pinned/ }));
    const oversized = new File([new Uint8Array(MAX_PRIVATE_VOCABULARY_BYTES + 1)], 'private.json', { type: 'application/json' });
    fireEvent.change(screen.getByLabelText('Private vocabulary JSON file'), { target: { files: [oversized] } });
    expect(screen.getByRole('alert')).toHaveTextContent('larger than the 64 KiB local limit');
    fireEvent.click(screen.getByRole('button', { name: 'Clear local vocabulary' }));
    expect(screen.getByText('Original wording active')).toBeInTheDocument();
  });

  it('uses correct singular and plural private-vocabulary upload copy', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: /Settings Pinned/ }));
    const input = screen.getByLabelText('Private vocabulary JSON file');
    const vocabularyFile = (replacements: Record<string, string>) => {
      const file = new File([''], 'private.json', { type: 'application/json' });
      Object.defineProperty(file, 'text', {
        value: async () => JSON.stringify({ version: 1, replacements, required_phrases: {} }),
      });
      return file;
    };

    fireEvent.change(input, { target: { files: [vocabularyFile({ Alpha: 'Beta' })] } });
    expect(await screen.findByText('Loaded 1 replacement entry into this browser only.')).toBeInTheDocument();

    fireEvent.change(input, { target: { files: [vocabularyFile({ Alpha: 'Beta', Gamma: 'Delta' })] } });
    expect(await screen.findByText('Loaded 2 replacement entries into this browser only.')).toBeInTheDocument();
  });

  it('reports file-read and cache-write failures without replacing the active vocabulary', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: /Settings Pinned/ }));
    const input = screen.getByLabelText('Private vocabulary JSON file');
    const unreadable = new File([''], 'private.json', { type: 'application/json' });
    Object.defineProperty(unreadable, 'text', { value: async () => { throw new DOMException('read denied'); } });
    fireEvent.change(input, { target: { files: [unreadable] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('could not be read and cached');
    expect(window.localStorage.getItem(PRIVATE_VOCABULARY_KEY)).toBeNull();

    const originalSetItem = window.localStorage.setItem.bind(window.localStorage);
    vi.spyOn(window.localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === PRIVATE_VOCABULARY_KEY) throw new DOMException('quota denied');
      return originalSetItem(key, value);
    });
    const valid = new File([''], 'private.json', { type: 'application/json' });
    Object.defineProperty(valid, 'text', {
      value: async () => JSON.stringify({ version: 1, replacements: { Alpha: 'Beta' }, required_phrases: {} }),
    });
    fireEvent.change(input, { target: { files: [valid] } });
    expect(await screen.findByRole('alert')).toHaveTextContent('previous local vocabulary remains active');
    expect(window.localStorage.getItem(PRIVATE_VOCABULARY_KEY)).toBeNull();
  });

  it('reports a cache-clear failure in the active language and preserves the cached document', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: /Settings Pinned/ }));
    const input = screen.getByLabelText('Private vocabulary JSON file');
    const valid = new File([''], 'private.json', { type: 'application/json' });
    Object.defineProperty(valid, 'text', {
      value: async () => JSON.stringify({ version: 1, replacements: { Alpha: 'Beta' }, required_phrases: {} }),
    });
    fireEvent.change(input, { target: { files: [valid] } });
    expect(await screen.findByText('Loaded 1 replacement entry into this browser only.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '廣東話' }));
    const originalRemoveItem = window.localStorage.removeItem.bind(window.localStorage);
    vi.spyOn(window.localStorage, 'removeItem').mockImplementation((key) => {
      if (key === PRIVATE_VOCABULARY_KEY) throw new DOMException('storage denied');
      return originalRemoveItem(key);
    });
    fireEvent.click(screen.getByRole('button', { name: '清除本機私人詞彙' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('未能清除本機私人詞彙快取。現有文案仍然生效。');
    expect(window.localStorage.getItem(PRIVATE_VOCABULARY_KEY)).not.toBeNull();
  });

  it('applies a validated private vocabulary to visible copy and accessible names, then restores originals on clear', async () => {
    window.localStorage.setItem(PRIVATE_VOCABULARY_KEY, JSON.stringify({
      version: 1,
      replacements: {
        'Windows setup, mapped': 'Neutral setup wording',
        'Open navigation': 'Open neutral navigation',
      },
      required_phrases: {},
    }));
    render(<App />);

    expect(screen.getByText('Neutral setup wording')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open neutral navigation' })).toBeInTheDocument();

    clearPrivateVocabulary();
    await waitFor(() => expect(screen.getByText('Windows setup, mapped')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Open navigation' })).toBeInTheDocument();
  });

  it('keeps a React language update when it equals the previous vocabulary rendering', async () => {
    window.localStorage.setItem(PRIVATE_VOCABULARY_KEY, JSON.stringify({
      version: 1,
      replacements: {
        'Windows setup, mapped': 'Windows 設定，一目了然',
      },
      required_phrases: {},
    }));
    render(<App />);

    expect(screen.getByText('Windows 設定，一目了然')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /Settings Pinned/ }));
    fireEvent.click(screen.getByRole('button', { name: '廣東話' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '廣東話' })).toHaveAttribute('aria-pressed', 'true'));

    clearPrivateVocabulary();
    await waitFor(() => expect(screen.getByText('Windows 設定，一目了然')).toBeInTheDocument());
    expect(screen.queryByText('Windows setup, mapped')).not.toBeInTheDocument();
  });

  it('keeps release identifiers, hashes, notification kinds, and timestamps factual', () => {
    window.localStorage.setItem(PRIVATE_VOCABULARY_KEY, JSON.stringify({
      version: 1,
      replacements: {
        '0.1.0': 'changed version',
        'build-0.1.0.16': 'changed build',
        '4fe6f78b800a7ec3184df74afca06ba05d1acf6010fedc7ecfbd039a0da615a4': 'changed hash',
        info: 'changed kind',
        '2026': 'changed year',
      },
      required_phrases: {},
    }));
    render(<App />);

    expect(screen.getByRole('link', { name: 'Download 0.1.0 for Windows (x64)' })).toBeInTheDocument();
    expect(screen.getByText(/Verified build-0\.1\.0\.18/)).toHaveTextContent('SHA-256 b7cc69e61c7c6a9ea6cd089f517afd24f295d4f24b5d2af864588d2c14d0b6b3');
    fireEvent.click(screen.getByRole('tab', { name: 'Notifications' }));
    expect(screen.getByText('info')).toBeInTheDocument();
    expect(document.querySelector('time')).toHaveTextContent('2026');
    expect(document.body).not.toHaveTextContent('changed build');
    expect(document.body).not.toHaveTextContent('changed hash');
    expect(document.body).not.toHaveTextContent('changed kind');
    expect(document.body).not.toHaveTextContent('changed year');
  });

  it('applies chained vocabulary mappings exactly once to the local preview', async () => {
    window.localStorage.setItem(PRIVATE_VOCABULARY_KEY, JSON.stringify({
      version: 1,
      replacements: {
        'Windows setup, mapped.': 'First-pass preview',
        'First-pass preview': 'Cascaded preview',
      },
      required_phrases: {},
    }));
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: /Settings Pinned/ }));

    const preview = screen.getByText('Local preview').closest('p');
    expect(preview).not.toBeNull();
    await waitFor(() => expect(preview).toHaveTextContent('First-pass preview'));
    expect(preview).not.toHaveTextContent('Cascaded preview');
  });

  it('finds visible replacement terms from every vocabulary-aware search owner', async () => {
    window.localStorage.setItem(PRIVATE_VOCABULARY_KEY, JSON.stringify({
      version: 1,
      replacements: {
        Applications: 'Programs',
        'Start here': 'Begin here',
        'Open private vocabulary upload': 'Open wording upload',
        'Pin tab': 'Fasten tab',
        'Corner radius': 'Roundness',
        Language: 'Voice',
        Hue: 'Chroma',
        'Welcome to Material Tools': 'Greetings from Material Tools',
      },
      required_phrases: {},
    }));
    render(<App />);

    fireEvent.keyDown(window, { key: 'F', ctrlKey: true, shiftKey: true });
    const palette = screen.getByRole('dialog', { name: 'Command palette' });
    fireEvent.change(within(palette).getByLabelText('Commands and destinations'), { target: { value: 'wording upload' } });
    await waitFor(() => expect(within(palette).getByRole('button', { name: /Open wording upload/ })).toBeInTheDocument());
    fireEvent.click(within(palette).getByRole('button', { name: 'Close' }));

    fireEvent.click(screen.getByRole('button', { name: 'Tab discovery' }));
    const discovery = screen.getByLabelText('Tab discovery');
    for (const label of ['Current tab strip', 'Current tab group', 'Master tab search']) {
      const input = within(discovery).getByLabelText(label);
      fireEvent.change(input, { target: { value: 'Programs' } });
      await waitFor(() => expect(within(input.closest('article') as HTMLElement).getByRole('button', { name: /Programs/ })).toBeInTheDocument());
    }
    const groupInput = within(discovery).getByLabelText('Tab groups by name');
    fireEvent.change(groupInput, { target: { value: 'Begin here' } });
    await waitFor(() => expect(within(groupInput.closest('article') as HTMLElement).getByRole('button', { name: /Begin here/ })).toBeInTheDocument());
    fireEvent.click(within(discovery).getByRole('button', { name: 'Close' }));

    fireEvent.contextMenu(screen.getByRole('tab', { name: 'Programs' }));
    let menu = await screen.findByRole('dialog', { name: 'Programs tab' });
    fireEvent.change(within(menu).getByLabelText('Programs tab actions'), { target: { value: 'Fasten' } });
    await waitFor(() => expect(within(menu).getByRole('menuitem', { name: /Fasten tab/ })).toBeInTheDocument());
    fireEvent.click(within(menu).getByRole('button', { name: 'Close' }));

    fireEvent.contextMenu(screen.getByRole('tab', { name: 'Programs' }));
    menu = await screen.findByRole('dialog', { name: 'Programs tab' });
    fireEvent.click(within(menu).getByRole('menuitem', { name: /Edit tab appearance/ }));
    const appearance = screen.getByRole('dialog', { name: 'Appearance editor for tab:applications' });
    fireEvent.change(within(appearance).getByLabelText('Appearance editor settings'), { target: { value: 'Roundness' } });
    await waitFor(() => expect(within(appearance).getByRole('slider', { name: 'Roundness' })).toBeInTheDocument());
    fireEvent.click(within(appearance).getByRole('button', { name: 'Close' }));

    fireEvent.click(screen.getByRole('tab', { name: /Settings Pinned/ }));
    const settingsSearch = screen.getByLabelText('Settings on this page');
    fireEvent.change(settingsSearch, { target: { value: 'Voice' } });
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Voice and voice' })).toBeInTheDocument());
    fireEvent.change(settingsSearch, { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Accent seed color editor'), { target: { value: 'Chroma' } });
    await waitFor(() => expect(screen.getByRole('slider', { name: 'Chroma' })).toBeInTheDocument());

    fireEvent.click(screen.getByRole('tab', { name: 'Notifications' }));
    fireEvent.change(screen.getByLabelText('Notification history'), { target: { value: 'Greetings' } });
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Greetings from Material Tools' })).toBeInTheDocument());
  });

  it('suppresses private-vocabulary controls and palette references while School mode is active, then restores them', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: /Settings Pinned/ }));
    expect(screen.getByLabelText('Private vocabulary JSON file')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable School mode' }));
    await waitFor(() => expect(screen.queryByLabelText('Private vocabulary JSON file')).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /Private vocabulary:/ })).not.toBeInTheDocument();
    expect(screen.queryByText('Bounded local-only private vocabulary upload and reset')).not.toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'F', ctrlKey: true, shiftKey: true });
    expect(screen.queryByText('Open private vocabulary upload')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    fireEvent.click(screen.getByRole('checkbox', { name: 'Enable School mode' }));
    await waitFor(() => expect(screen.getByLabelText('Private vocabulary JSON file')).toBeInTheDocument());
  });
});

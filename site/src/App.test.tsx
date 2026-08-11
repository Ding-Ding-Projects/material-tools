import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import App from './App';
import { STORAGE_KEY } from './storage';
import { MAX_PRIVATE_VOCABULARY_BYTES } from './vocabulary';

describe('Material Tools Pages shell', () => {
  beforeEach(() => window.localStorage.clear());

  it('links the verified unsigned Windows installer from the home surface', () => {
    render(<App />);
    const download = screen.getByRole('link', { name: 'Download 0.1.0 for Windows (x64)' });
    expect(download).toHaveAttribute('href', 'https://github.com/Ding-Ding-Projects/material-tools/releases/download/build-0.1.0.15/MaterialTools-Setup-0.1.0-x64.exe');
    expect(screen.getByText(/Verified build-0\.1\.0\.15/)).toHaveTextContent('SHA-256 9b348c48b2fe0bdca6e7465820fef90226e88b9651f31143fa675e50efac2d54');
  });

  it('opens the global command palette with Ctrl+Shift+F', () => {
    render(<App />);
    expect(screen.getByLabelText('Upload private vocabulary JSON file')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'F', ctrlKey: true, shiftKey: true });
    expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeInTheDocument();
    expect(screen.getByLabelText('Commands and destinations')).toBeInTheDocument();
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
    expect(screen.getByLabelText('Accent color editor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open anchored regex builder for Accent color editor' })).toBeInTheDocument();
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
    await waitFor(() => expect(document.documentElement.style.getPropertyValue('--md-sys-color-on-primary')).toBe('#000000'));
    fireEvent.click(screen.getByRole('tab', { name: /Overview Pinned/ }));
    expect(screen.getByText(/fake moustache/)).toBeInTheDocument();
  });

  it('localizes the always-visible private vocabulary upload', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('tab', { name: /Settings Pinned/ }));
    fireEvent.click(screen.getByRole('button', { name: '廣東話' }));
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
});

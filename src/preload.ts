import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, type MaterialToolsBridge } from './shared/contracts';

const bridge: MaterialToolsBridge = {
  getSystemSummary: () => ipcRenderer.invoke(IPC_CHANNELS.getSystemSummary),
  minimizeWindow: () => ipcRenderer.send(IPC_CHANNELS.minimizeWindow),
  toggleMaximizeWindow: () => ipcRenderer.send(IPC_CHANNELS.toggleMaximizeWindow),
  closeWindow: () => ipcRenderer.send(IPC_CHANNELS.closeWindow),
};

contextBridge.exposeInMainWorld('materialTools', Object.freeze(bridge));

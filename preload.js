const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  people: {
    list: () => ipcRenderer.invoke('people:list'),
    add: (name, relation) => ipcRenderer.invoke('people:add', name, relation),
    delete: (id) => ipcRenderer.invoke('people:delete', id),
  },
  promises: {
    list: () => ipcRenderer.invoke('promises:list'),
    add: (data) => ipcRenderer.invoke('promises:add', data),
    update: (id, data) => ipcRenderer.invoke('promises:update', id, data),
    delete: (id) => ipcRenderer.invoke('promises:delete', id),
  },
  steps: {
    list: (promise_id) => ipcRenderer.invoke('steps:list', promise_id),
    add: (promise_id, data) => ipcRenderer.invoke('steps:add', promise_id, data),
    update: (id, data) => ipcRenderer.invoke('steps:update', id, data),
    toggle: (id) => ipcRenderer.invoke('steps:toggle', id),
    delete: (id) => ipcRenderer.invoke('steps:delete', id),
  },
  todos: {
    byDate: (date) => ipcRenderer.invoke('todos:byDate', date),
    history: () => ipcRenderer.invoke('todos:history'),
    upcoming: () => ipcRenderer.invoke('todos:upcoming'),
    tomorrow: () => ipcRenderer.invoke('todos:tomorrow'),
    habits: () => ipcRenderer.invoke('todos:habits'),
    past: () => ipcRenderer.invoke('todos:past'),
    add: (data) => ipcRenderer.invoke('todos:add', data),
    toggle: (id, date) => ipcRenderer.invoke('todos:toggle', id, date),
    snooze: (id, newDate) => ipcRenderer.invoke('todos:snooze', id, newDate),
    delete: (id, opts) => ipcRenderer.invoke('todos:delete', id, opts),
    update: (id, data) => ipcRenderer.invoke('todos:update', id, data),
  },
  integrity: {
    score: () => ipcRenderer.invoke('integrity:score'),
    monthly: () => ipcRenderer.invoke('integrity:monthly'),
  },
  streak: {
    stats: () => ipcRenderer.invoke('streak:stats'),
    rescue: (date) => ipcRenderer.invoke('streak:rescue', date),
  }
})

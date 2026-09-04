import create from 'zustand';

export const useToast = create((set) => ({
  toasts: [],

  addToast: (message, type = 'success', duration = 3000) => {
    const id = Date.now();
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }]
    }));

    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({
          toasts: state.toasts.filter(t => t.id !== id)
        }));
      }, duration);
    }

    return id;
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter(t => t.id !== id)
    }));
  },

  clearToasts: () => set({ toasts: [] })
}));

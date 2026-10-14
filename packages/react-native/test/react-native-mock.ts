type Listener = (s: string) => void;
const listeners = new Set<Listener>();

export const AppState = {
  addEventListener(_: string, l: Listener) {
    listeners.add(l);
    return { remove: () => listeners.delete(l) };
  },
  emit(s: string) {
    for (const l of [...listeners]) l(s);
  },
};
export const Platform = { OS: "android" };
export const NativeModules: Record<string, unknown> = {};

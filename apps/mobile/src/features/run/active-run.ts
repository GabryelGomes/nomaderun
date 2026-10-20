/** Corrida em gravação neste processo (para não ser tratada como interrompida). */
let current: string | null = null;
export const activeRunId = () => current;
export const setActiveRunId = (id: string | null) => {
  current = id;
};

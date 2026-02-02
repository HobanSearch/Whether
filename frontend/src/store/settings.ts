import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TemperatureUnit = 'C' | 'F';

interface SettingsState {
    temperatureUnit: TemperatureUnit;
    setTemperatureUnit: (unit: TemperatureUnit) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            temperatureUnit: 'C', // Default to Celsius per PRD
            setTemperatureUnit: (unit) => set({ temperatureUnit: unit }),
        }),
        { name: 'whether-settings' }
    )
);

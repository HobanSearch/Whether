import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface FavoritesState {
    favoriteLocations: string[];
    addFavorite: (code: string) => void;
    removeFavorite: (code: string) => void;
    toggleFavorite: (code: string) => void;
    isFavorite: (code: string) => boolean;
}

export const useFavoritesStore = create<FavoritesState>()(
    persist(
        (set, get) => ({
            favoriteLocations: [],
            addFavorite: (code) =>
                set((state) => ({
                    favoriteLocations: state.favoriteLocations.includes(code)
                        ? state.favoriteLocations
                        : [...state.favoriteLocations, code],
                })),
            removeFavorite: (code) =>
                set((state) => ({
                    favoriteLocations: state.favoriteLocations.filter((c) => c !== code),
                })),
            toggleFavorite: (code) => {
                const { favoriteLocations } = get();
                if (favoriteLocations.includes(code)) {
                    set({ favoriteLocations: favoriteLocations.filter((c) => c !== code) });
                } else {
                    set({ favoriteLocations: [...favoriteLocations, code] });
                }
            },
            isFavorite: (code) => get().favoriteLocations.includes(code),
        }),
        { name: 'whether-favorites' }
    )
);

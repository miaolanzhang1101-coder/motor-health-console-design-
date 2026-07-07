export interface Motor {
  id: string;
  name: string;
  vibration: number; // latest normalized deviation index, 0-100
  currentDraw: number; // latest normalized deviation index, 0-100
  vibrationHistory: number[];
  currentHistory: number[];
}

export type ViewKey = 'fleet' | 'inspector' | 'setup' | 'ai';
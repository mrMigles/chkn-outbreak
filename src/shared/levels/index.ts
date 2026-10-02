import type { LevelScript } from './types';
import arena from './arena';
import office from './office';
import lab from './lab';
import factory from './factory';
import boss from './boss';

export const LEVELS: Record<string, LevelScript> = { arena, office, lab, factory, boss };
export const FIRST_LEVEL = 'office';

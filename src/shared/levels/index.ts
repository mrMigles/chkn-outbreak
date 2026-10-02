import type { LevelScript } from './types';
import arena from './arena';
import office from './office';
import office7 from './office7';
import lab from './lab';
import factory from './factory';
import boss from './boss';
import office8 from './office8';
import office11 from './office11';
import cafe12 from './cafe12';
import street1 from './street1';
import street2 from './street2';

export const LEVELS: Record<string, LevelScript> = { arena, office, office7, office8, office11, cafe12, street1, street2, lab, factory, boss };
export const FIRST_LEVEL = 'office';

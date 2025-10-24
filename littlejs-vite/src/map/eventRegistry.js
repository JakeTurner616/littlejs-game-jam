// src/map/eventRegistry.js
'use strict';

/**
 * EventRegistry — centralized modular event hub
 * ---------------------------------------------
 * ✅ Each event is now its own file in /src/events/
 * ✅ Automatically imported and registered by name
 * ✅ Cleaner, more maintainable structure for dialogue and triggers
 *
 * Example file structure:
 *   src/events/doorTeleport1.js
 *   src/events/windowScene1.js
 *   src/events/witchSpawn.js
 *
 * Each event module must export:
 *   export const event = {
 *     id: 'door_teleport_1',
 *     description: 'Short summary...',
 *     async execute(scene, player) { ... }
 *   }
 */

import { event as doorTeleport1 } from '../events/doorTeleport1.js';
import { event as windowScene1 } from '../events/windowScene1.js';

export const EventRegistry = Object.freeze({
  [doorTeleport1.id]: doorTeleport1,
  [windowScene1.id]: windowScene1,
});
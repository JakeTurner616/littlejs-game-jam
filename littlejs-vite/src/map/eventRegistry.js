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
 *   src/events/doorTeleport2.js
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
import { event as doorTeleport2 } from '../events/doorTeleport2.js';
import { event as doorTeleport_main_room } from '../events/doorTeleport_main_room.js';
import { event as doorTeleport_side_room } from '../events/doorTeleport_side_room.js';
import { event as windowScene1 } from '../events/windowScene1.js';

export const EventRegistry = Object.freeze({
  [doorTeleport1.id]: doorTeleport1,
  [doorTeleport2.id]: doorTeleport2,
  [doorTeleport_main_room.id]: doorTeleport_main_room,
  [doorTeleport_side_room.id]: doorTeleport_side_room,
  [windowScene1.id]: windowScene1,
});

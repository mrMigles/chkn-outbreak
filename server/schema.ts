import { Schema, MapSchema, type } from '@colyseus/schema';

export class LobbyPlayer extends Schema {
  @type('string') id = '';
  @type('string') name = '';
  @type('number') slot = 0;
  @type('boolean') ready = false;
  @type('boolean') host = false;
  @type('boolean') connected = true;
}

/** Lobby / meta state (Colyseus schema). The world itself is sent as snapshots. */
export class RoomState extends Schema {
  @type('string') code = '';
  @type('string') phase = 'lobby'; // lobby | playing | between | over
  @type('string') level = '';
  @type({ map: LobbyPlayer }) players = new MapSchema<LobbyPlayer>();
}

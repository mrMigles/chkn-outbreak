import { Schema, MapSchema, type } from '@colyseus/schema';

export class LobbyPlayer extends Schema {
  @type('string') id = '';
  @type('string') name = '';
  @type('number') slot = 0;
  @type('string') look = '';
  @type('boolean') ready = false;
  @type('boolean') host = false;
  @type('boolean') connected = true;
  /** achievements in the player's own record (lobby badge) */
  @type('number') ach = 0;
}

/** Lobby / meta state (Colyseus schema). The world itself is sent as snapshots. */
export class RoomState extends Schema {
  @type('string') code = '';
  @type('string') phase = 'lobby'; // lobby | playing | between | defeat | over
  @type('string') reason = '';
  @type('string') level = '';
  /** Telegram chat room: the chat's title (empty for ordinary rooms). */
  @type('string') chat = '';
  /** level of the saved progress the host can continue ('' = nothing saved) */
  @type('string') saved = '';
  /** Telegram chat room: «Призвать чат» is offered */
  @type('boolean') summon = false;
  @type({ map: LobbyPlayer }) players = new MapSchema<LobbyPlayer>();
}

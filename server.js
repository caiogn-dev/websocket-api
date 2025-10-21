// server.js
const WebSocket = require("ws");

const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

/**
 * Lista de pontos de spawn predefinidos.
 * Cada ponto tem uma posição (pos) e uma rotação (rot).
 */
const spawnPoints = [
  { pos: [0, 0, 5], rot: [0, Math.PI, 0] },
  { pos: [5, 0, 0], rot: [0, -Math.PI / 2, 0] },
  { pos: [-5, 0, 0], rot: [0, Math.PI / 2, 0] },
  { pos: [0, 0, -5], rot: [0, 0, 0] },
  { pos: [3, 0, 3], rot: [0, -Math.PI / 4, 0] },
  { pos: [-3, 0, -3], rot: [0, (3 * Math.PI) / 4, 0] },
];

/**
 * players: {
 * <id>: { id, name, x, y, z, rx, ry, rz, updatedAt }
 * }
 */
const players = {};

function broadcastJSON(msg, excludeWs = null) {
  const data = JSON.stringify(msg);
  wss.clients.forEach((c) => {
    if (c.readyState === WebSocket.OPEN && c !== excludeWs) {
      c.send(data);
    }
  });
}

wss.on("connection", (ws) => {
  ws.id = null;

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch (err) {
      console.warn("invalid message", raw);
      return;
    }

    if (msg.type === "join") {
      // msg: { type: "join", id, name }
      // A posição inicial é agora controlada pelo servidor.

      const playerCount = Object.keys(players).length;
      const spawnPoint = spawnPoints[playerCount % spawnPoints.length];

      ws.id = msg.id;
      players[msg.id] = {
        id: msg.id,
        name: msg.name || "anon",
        x: spawnPoint.pos[0],
        y: spawnPoint.pos[1],
        z: spawnPoint.pos[2],
        rx: spawnPoint.rot[0],
        ry: spawnPoint.rot[1],
        rz: spawnPoint.rot[2],
        updatedAt: Date.now(),
      };
      // send snapshot to the new client
      ws.send(JSON.stringify({ type: "snapshot", players }));
      // notify others
      broadcastJSON({ type: "playerJoined", player: players[msg.id] }, ws);
      console.log("join", msg.id, "at", spawnPoint.pos);
    } else if (msg.type === "state") {
      // msg: { type: "state", id, x,y,z, rx,ry,rz, v }
      if (!msg.id || !players[msg.id]) return;
      const p = players[msg.id];
      p.x = msg.x;
      p.y = msg.y;
      p.z = msg.z;
      p.rx = msg.rx;
      p.ry = msg.ry;
      p.rz = msg.rz;
      p.v = msg.v;
      p.updatedAt = Date.now();
      // broadcast to others (could throttle)
      broadcastJSON({ type: "update", player: p }, ws);
    }
  });

  ws.on("close", () => {
    if (ws.id) {
      delete players[ws.id];
      broadcastJSON({ type: "playerLeft", id: ws.id });
      console.log("left", ws.id);
    }
  });

  ws.on("error", (err) => console.warn("ws err", err));
});

console.log("WebSocket server running on port", PORT);
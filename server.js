// server.js
const WebSocket = require("ws");
const PORT = process.env.PORT || 8080;
const wss = new WebSocket.Server({ port: PORT });

/**
 * players: {
 *   <id>: { id, name, x, y, z, rx, ry, rz, updatedAt }
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
      // msg: { type: "join", id, name, x, y, z, rx, ry, rz }
      ws.id = msg.id;
      players[msg.id] = {
        id: msg.id,
        name: msg.name || "anon",
        x: msg.x,
        y: msg.y,
        z: msg.z,
        rx: msg.rx,
        ry: msg.ry,
        rz: msg.rz,
        updatedAt: Date.now(),
      };
      // send snapshot to the new client
      ws.send(JSON.stringify({ type: "snapshot", players }));
      // notify others
      broadcastJSON({ type: "playerJoined", player: players[msg.id] }, ws);
      console.log("join", msg.id);
    } else if (msg.type === "state") {
      // msg: { type: "state", id, x,y,z, rx,ry,rz, v }
      if (!msg.id) return;
      const p = players[msg.id] || { id: msg.id, name: "anon" };
      p.x = msg.x; p.y = msg.y; p.z = msg.z;
      p.rx = msg.rx; p.ry = msg.ry; p.rz = msg.rz;
      p.v = msg.v;
      p.updatedAt = Date.now();
      players[msg.id] = p;
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

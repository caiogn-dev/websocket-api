 // server.js
    2 const WebSocket = require("ws");
    3 const PORT = process.env.PORT || 8080;
    4 const wss = new WebSocket.Server({ port: PORT });       
    5 
    6 /**
    7  * Lista de pontos de spawn predefinidos.
    8  * Cada ponto tem uma posição (pos) e uma rotação (rot).
    9  */
   10 const spawnPoints = [
   11   { pos: [0, 0, 5], rot: [0, Math.PI, 0] },
   12   { pos: [5, 0, 0], rot: [0, -Math.PI / 2, 0] },
   13   { pos: [-5, 0, 0], rot: [0, Math.PI / 2, 0] },
   14   { pos: [0, 0, -5], rot: [0, 0, 0] },
   15   { pos: [3, 0, 3], rot: [0, -Math.PI / 4, 0] },
   16   { pos: [-3, 0, -3], rot: [0, (3 * Math.PI) / 4, 0] },
   17 ];
   18 
   19 /**
   20  * players: {
   21  *   <id>: { id, name, x, y, z, rx, ry, rz, updatedAt }
   22  * }
   23  */
   24 const players = {};
   25 
   26 function broadcastJSON(msg, excludeWs = null) {
   27   const data = JSON.stringify(msg);
   28   wss.clients.forEach((c) => {
   29     if (c.readyState === WebSocket.OPEN && c !== excludeWs) {
   30       c.send(data);
   31     }
   32   });
   33 }
   34 
   35 wss.on("connection", (ws) => {
   36   ws.id = null;
   37 
   38   ws.on("message", (raw) => {
   39     let msg;
   40     try {
   41       msg = JSON.parse(raw);
   42     } catch (err) {
   43       console.warn("invalid message", raw);
   44       return;
   45     }
   46 
   47     if (msg.type === "join") {
   48       // msg: { type: "join", id, name }
   49       // A posição inicial é agora controlada pelo servidor.
   50 
   51       const playerCount = Object.keys(players).length;
   52       const spawnPoint = spawnPoints[playerCount % spawnPoints.length];
   53 
   54       ws.id = msg.id;
   55       players[msg.id] = {
   56         id: msg.id,
   57         name: msg.name || "anon",
   58         x: spawnPoint.pos[0],
   59         y: spawnPoint.pos[1],
   60         z: spawnPoint.pos[2],
   61         rx: spawnPoint.rot[0],
   62         ry: spawnPoint.rot[1],
   63         rz: spawnPoint.rot[2],
   64         updatedAt: Date.now(),
   65       };
   66       // send snapshot to the new client
   67       ws.send(JSON.stringify({ type: "snapshot", players }));
   68       // notify others
   69       broadcastJSON({ type: "playerJoined", player: players[msg.id] }, ws);
   70       console.log("join", msg.id, "at", spawnPoint.pos);
   71     } else if (msg.type === "state") {
   72       // msg: { type: "state", id, x,y,z, rx,ry,rz, v }
   73       if (!msg.id || !players[msg.id]) return;
   74       const p = players[msg.id];
   75       p.x = msg.x; p.y = msg.y; p.z = msg.z;
   76       p.rx = msg.rx; p.ry = msg.ry; p.rz = msg.rz;
   77       p.v = msg.v;
   78       p.updatedAt = Date.now();
   79       // broadcast to others (could throttle)
   80       broadcastJSON({ type: "update", player: p }, ws);
   81     }
   82   });
   83 
   84   ws.on("close", () => {
   85     if (ws.id) {
   86       delete players[ws.id];
   87       broadcastJSON({ type: "playerLeft", id: ws.id });
   88       console.log("left", ws.id);
   89     }
   90   });
   91 
   92   ws.on("error", (err) => console.warn("ws err", err));
   93 });
   94 
   95 console.log("WebSocket server running on port", PORT);
    
import express from "express";
import http from "http";
import { Server } from "socket.io";
import { instrument } from "@socket.io/admin-ui";
// import WebSocket from "ws";

const app = express();

app.set("view engine", "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public")); // give permission to access /public folder to user
app.get("/", (req, res) => res.render("home"));
app.get("/*", (req, res) => res.redirect("/"));

const httpserver = http.createServer(app); // web Server
const wsServer = new Server(httpserver, {
  cors: {
    origin: ["https://admin.socket.io"],
    credentials: true,
  },
});

instrument(wsServer, {
  auth: false,
});

function publicRooms() {
  const {
    sockets: {
      adapter: { sids, rooms },
    },
  } = wsServer;
  const publicRooms = [];
  rooms.forEach((_, key) => {
    if (sids.get(key) === undefined) {
      publicRooms.push(key);
    }
  });
  return publicRooms;
}

function countRoom(roomName) {
  return wsServer.sockets.adapter.rooms.get(roomName)?.size;
}

wsServer.on("connection", (socket) => {
  socket["nickname"] = "ano";
  socket.onAny((event) => {
    // middleware
    console.log(`Socket event: ${event}`);
  });

  socket.on("enter_room", (roomName, done) => {
    socket.join(roomName);
    done();
    socket.to(roomName).emit("welcome", socket.nickname, countRoom(roomName));
    wsServer.sockets.emit("room_change", publicRooms());
  });

  socket.on("disconnecting", () => {
    socket.rooms.forEach((room) =>
      socket.to(room).emit("bye", socket.nickname, countRoom(room) - 1)
    );

    socket.on("disconnect", () => {
      wsServer.sockets.emit("room_change", publicRooms());
    });
  });

  socket.on("new_message", (msg, roomName, done) => {
    socket.to(roomName).emit("new_message", `${socket.nickname}: ${msg}`);
    done();
  });

  socket.on("nickname", (nickname) => {
    socket["nickname"] = nickname;
  });
});

// const wss = new WebSocket.Server({ server }); // webSocket Server
// const sockets = [];

// wss.on("connection", (socket) => {
//   sockets.push(socket);
//   socket["nickname"] = "Anon";
//   socket.send("hello");
//   socket.on("close", () => console.log("Disconnected from the brow ser"));
//   socket.on("message", (message) => {
//     const packet = JSON.parse(message);

//     switch (packet.type) {
//       case "new_message":
//         console.log(packet.payload);
//         sockets.forEach((aSocket) => {
//           aSocket.send(`${socket["nickname"]}: ${packet.payload}`);
//         });
//         break;
//       case "nickname":
//         socket["nickname"] = packet.payload;
//         break;
//     }
//   });
//   console.log(socket);
// });

httpserver.listen(3000);

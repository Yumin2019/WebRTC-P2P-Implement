import express from "express";
import http from "http";
import SocketIO from "socket.io";
// import WebSocket from "ws";

const app = express();

app.set("view engine", "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public")); // give permission to access /public folder to user
app.get("/", (req, res) => res.render("home"));
app.get("/*", (req, res) => res.redirect("/"));

const httpserver = http.createServer(app); // web Server
const wsServer = SocketIO(httpserver);

wsServer.on("connection", (socket) => {
  socket["nickname"] = "ano";
  socket.onAny((event) => {
    // middleware
    console.log(`Socket event: ${event}`);
  });
  socket.on("enter_room", (roomName, done) => {
    socket.join(roomName);
    done();
    socket.to(roomName).emit("welcome", socket.nickname);
  });

  socket.on("disconnecting", () => {
    socket.rooms.forEach((room) =>
      socket.to(room).emit("bye", socket.nickname)
    );
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

import http from "http";
import SocketIO from "socket.io";
import express from "express";

const app = express();
app.set("view engine", "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));
app.get("/", (_, res) => res.render("home"));
app.get("/*", (_, res) => res.redirect("/"));

const httpServer = http.createServer(app);
const wsServer = SocketIO(httpServer);

wsServer.on("connection", (socket) => {
  socket.on("join_room", (roomName) => {
    socket.join(roomName);
    socket.to(roomName).emit("welcome", socket.id);
  });

  socket.on("offer", (offer, toId) => {
    socket.to(toId).emit("offer", offer, socket.id);
  });

  socket.on("answer", (answer, toId) => {
    socket.to(toId).emit("answer", answer, socket.id);
  });

  socket.on("ice", (ice, toId) => {
    socket.to(toId).emit("ice", ice, socket.id);
  });

  socket.on("disconnecting", () => {
    let rooms = socket.rooms;
    rooms.delete(socket.id);

    let id = socket.id;
    console.log(`${id} left room`);
    console.log(rooms);

    rooms.forEach((room) => {
      socket.to(room).emit("bye", id);
    });
  });
});

const handleListen = () => console.log(`Listening on http://localhost:3000`);
httpServer.listen(3000, handleListen);

import express from "express";
import http from "http";
import WebSocket from "ws";

const app = express();

app.set("view engine", "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public")); // give permission to access /public folder to user
app.get("/", (req, res) => res.render("home"));
app.get("/*", (req, res) => res.redirect("/"));

const server = http.createServer(app); // web Server
const wss = new WebSocket.Server({ server }); // webSocket Server

const sockets = [];

wss.on("connection", (socket) => {
  sockets.push(socket);
  socket["nickname"] = "Anon";
  socket.send("hello");
  socket.on("close", () => console.log("Disconnected from the brow ser"));
  socket.on("message", (message) => {
    const packet = JSON.parse(message);

    switch (packet.type) {
      case "new_message":
        console.log(packet.payload);
        sockets.forEach((aSocket) => {
          aSocket.send(`${socket["nickname"]}: ${packet.payload}`);
        });
        break;
      case "nickname":
        socket["nickname"] = packet.payload;
        break;
    }
  });
  console.log(socket);
});

server.listen(3000);

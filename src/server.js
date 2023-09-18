import http from "http";
import SocketIO from "socket.io";
import express from "express";
import wrtc from "wrtc";

const app = express();
app.set("view engine", "pug");
app.set("views", __dirname + "/views");
app.use("/public", express.static(__dirname + "/public"));
app.get("/", (_, res) => res.render("home"));
app.get("/*", (_, res) => res.redirect("/"));

const httpServer = http.createServer(app);
const wsServer = SocketIO(httpServer);

// Client의 recvPeerMap에 대응된다.
// Map<sendPeerId, Map<recvPeerId, PeerConnection>>();
let sendPeerMap = new Map();

// Client의 SendPeer에 대응된다.
// Map<peerId, PeerConnection>
let recvPeerMap = new Map();

// 특정 room의 user Stream을 처리하기 위한 Map
// Map<roomName, Map<socketId, Stream>>(); Stream = data.streams[0]
let streamMap = new Map();

function getUserRoomList(socket) {
  let rooms = socket.rooms;
  rooms.delete(socket.id);
  return [...rooms];
}

wsServer.on("connection", (socket) => {
  socket.on("join_room", (roomName) => {
    let room = wsServer.sockets.adapter.rooms.get(roomName);
    let idList = room ? [...room] : [];

    console.log(idList);
    socket.emit("user_list", idList);

    console.log("join_room id = " + socket.id);
    socket.join(roomName);
  });

  socket.on("recvOffer", async (offer, sendId) => {
    console.log(`got recvOffer from ${socket.id}`);

    // recvPeer에 대응하여 sendPeer를 생성한다.
    createSendPeer(sendId);
    createSendAnswer(offer, sendId);
  });

  socket.on("recvCandidate", async (candidate, sendId) => {
    if (candidate) {
      sendPeerMap.get(sendId).get(socket.id).addIceCandidate(candidate);
    }
  });

  socket.on("sendOffer", (offer) => {
    console.log(`got sendOffer from ${socket.id}`);

    createRecvPeer();
    createRecvAnswer(offer);
  });

  socket.on("sendCandidate", async (candidate) => {
    if (candidate) {
      recvPeerMap.get(socket.id).addIceCandidate(candidate);
    }
  });

  socket.on("disconnecting", () => {
    let rooms = getUserRoomList(socket);
    let id = socket.id;

    console.log(`${id} left room`);
    console.log(rooms);

    if (sendPeerMap.has(id)) {
      sendPeerMap.get(id).forEach((value, key) => {
        value.close();
      });

      sendPeerMap.delete(id);
    }

    if (recvPeerMap.has(id)) {
      recvPeerMap.get(id).close();
      recvPeerMap.delete(id);
    }

    rooms.forEach((room) => {
      socket.to(room).emit("bye", id);

      if (streamMap.has(room)) {
        streamMap.get(room).delete(id);
      }
    });
  });

  function createRecvPeer() {
    let recvPeer = new wrtc.RTCPeerConnection({
      iceServers: [
        {
          urls: ["turn:13.250.13.83:3478?transport=udp"],
          username: "YzYNCouZM1mhqhmseWk6",
          credential: "YzYNCouZM1mhqhmseWk6",
        },
      ],
    });

    recvPeer.addEventListener("icecandidate", (data) => {
      console.log(`sent sendCandidate to client ${socket.id}`);
      socket.emit("sendCandidate", data.candidate);
    });

    recvPeer.addEventListener("track", (data) => {
      console.log("recvPeer track");
      let rooms = getUserRoomList(socket);
      console.log(rooms);

      if (!streamMap.has(rooms[0])) {
        streamMap.set(rooms[0], new Map());
      }

      if (streamMap.get(rooms[0]).has(socket.id)) {
        return;
      }

      // Stream 정보를 추가하고 다른 클라에게 알린다.
      streamMap.get(rooms[0]).set(socket.id, data.streams[0]);
      socket.to(rooms[0]).emit("newStream", socket.id);
    });

    recvPeerMap.set(socket.id, recvPeer);
  }

  async function createRecvAnswer(offer) {
    let recvPeer = recvPeerMap.get(socket.id);

    recvPeer.setRemoteDescription(offer);
    const answer = await recvPeer.createAnswer({
      offerToReceiveVideo: true,
      offerToReceiveAudio: true,
    });
    recvPeer.setLocalDescription(answer);

    console.log(`sent the sendAnswer to ${socket.id}`);
    socket.emit("sendAnswer", answer);
  }

  function createSendPeer(sendId) {
    let sendPeer = new wrtc.RTCPeerConnection({
      iceServers: [
        {
          urls: ["turn:13.250.13.83:3478?transport=udp"],
          username: "YzYNCouZM1mhqhmseWk6",
          credential: "YzYNCouZM1mhqhmseWk6",
        },
      ],
    });

    sendPeer.addEventListener("icecandidate", (data) => {
      console.log(`sent recvCandidate to client ${socket.id}`);
      socket.emit("recvCandidate", data.candidate, sendId);
    });

    let rooms = getUserRoomList(socket);
    let stream = streamMap.get(rooms[0]).get(sendId);

    stream.getTracks().forEach((track) => {
      sendPeer.addTrack(track, stream);
    });

    if (!sendPeerMap.has(sendId)) {
      sendPeerMap.set(sendId, new Map());
    }

    sendPeerMap.get(sendId).set(socket.id, sendPeer);
  }

  async function createSendAnswer(offer, sendId) {
    let sendPeer = sendPeerMap.get(sendId).get(socket.id);

    sendPeer.setRemoteDescription(offer);
    const answer = await sendPeer.createAnswer({
      offerToReceiveVideo: false,
      offerToReceiveAudio: false,
    });
    sendPeer.setLocalDescription(answer);

    console.log(`sent the recvAnswer to ${socket.id}`);
    socket.emit("recvAnswer", answer, sendId);
  }
});

const handleListen = () => console.log(`Listening on http://localhost:3000`);
httpServer.listen(3000, handleListen);

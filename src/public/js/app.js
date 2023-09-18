const socket = io();

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camearsSelect = document.getElementById("cameras");
const streamDiv = document.querySelector("#myStream");

let myStream;
let isMuted = true;
let isCameraOn = false;
let roomName;

// 서버에서 넘겨주는 Downlink를 처리하기 위한 Map
// Map<socketId, PeerConnection>
let recvPeerMap = new Map();

// 서버에 미디어 정보를 넘기기 위한 Peer
let sendPeer;

async function getCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === "videoinput");

    const currentCamera = myStream.getVideoTracks()[0];
    cameras.forEach((camera) => {
      const option = document.createElement("option");
      option.value = camera.deviceId;
      option.innerText = camera.label;
      if (currentCamera.label === camera.lable) {
        option.selected = true;
      }
      camearsSelect.appendChild(option);
    });

    console.log(cameras);
  } catch (e) {
    console.log(e);
  }
}

async function getMedia(deviceId) {
  const initialConstraint = {
    audio: true,
    video: { facingMdoe: "user" },
  };

  const cameraConstraints = {
    audio: true,
    video: { deviceId: { exact: deviceId } },
  };

  try {
    myStream = await navigator.mediaDevices.getUserMedia(
      deviceId ? cameraConstraints : initialConstraint
    );
    myFace.srcObject = myStream;
    if (!deviceId) {
      await getCameras();
    }
  } catch (e) {
    console.log(e);
  }
}

function handleMuteClick() {
  myStream.getAudioTracks().forEach((track) => {
    track.enabled = !track.enabled;
  });
  if (isMuted) {
    muteBtn.innerText = "UnMute";
    isMuted = false;
  } else {
    muteBtn.innerText = "Mute";
    isMuted = true;
  }
}

function handleCameraClick() {
  myStream.getVideoTracks().forEach((track) => {
    track.enabled = !track.enabled;
  });

  if (isCameraOn) {
    cameraBtn.innerText = "Turn Camera Off";
    isCameraOn = false;
  } else {
    cameraBtn.innerText = "Turn Camera On";
    isCameraOn = true;
  }
}

async function handleCameaChange() {
  await getMedia(camearsSelect.value);
  if (sendPeer) {
    const videoTrack = myStream.getVideoTracks()[0];
    const videoSender = sendPeer
      .getSenders()
      .find((sender) => sender.track.kind === "video");

    videoSender.replaceTrack(videoTrack);
  }
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camearsSelect.addEventListener("input", handleCameaChange);

// Welcome Form (join a room)
const welcomeDiv = document.getElementById("welcome");
const callDiv = document.getElementById("call");

callDiv.hidden = true;

async function initCall() {
  callDiv.hidden = false;
  welcomeDiv.hidden = true;
  await getMedia();
}

async function handleWelcomeSubmit(event) {
  event.preventDefault();
  const input = welcomeForm.querySelector("input");
  await initCall();
  socket.emit("join_room", input.value);
  roomName = input.value;
  input.value = "";
}

const welcomeForm = welcomeDiv.querySelector("form");
welcomeForm.addEventListener("submit", handleWelcomeSubmit);

// Socket code
socket.on("user_list", (idList) => {
  console.log("user_list = " + idList.toString());

  // 아이디 정보를 바탕으로 recvPeer를 생성한다.
  idList.forEach((id) => {
    createRecvPeer(id);
    creatRecvOffer(id);
  });

  // sendPeer를 생성한다.
  createSendPeer();
  createSendOffer();
});

socket.on("recvCandidate", async (candidate, sendId) => {
  console.log("got recvCandidate from server");
  recvPeerMap.get(sendId).addIceCandidate(candidate);
});

socket.on("sendCandidate", async (candidate) => {
  console.log("got sendCandidate from server");
  sendPeer.addIceCandidate(candidate);
});

socket.on("newStream", (id) => {
  console.log(`newStream id=${id}`);
  createRecvPeer(id);
  creatRecvOffer(id);
});

async function createSendOffer() {
  console.log(`createSendOffer`);
  const offer = await sendPeer.createOffer({
    offerToReceiveVideo: false,
    offerToReceiveAudio: false,
  });

  sendPeer.setLocalDescription(offer);
  socket.emit("sendOffer", offer);
}

function createSendPeer() {
  sendPeer = new RTCPeerConnection({
    iceServers: [
      {
        urls: ["turn:13.250.13.83:3478?transport=udp"],
        username: "YzYNCouZM1mhqhmseWk6",
        credential: "YzYNCouZM1mhqhmseWk6",
      },
    ],
  });

  sendPeer.addEventListener("icecandidate", (data) => {
    console.log(`sent sendCandidate to server`);
    socket.emit("sendCandidate", data.candidate);
  });

  if (myStream) {
    myStream.getTracks().forEach((track) => {
      sendPeer.addTrack(track, myStream);
    });

    console.log("add local stream");
  } else {
    console.log("no local stream");
  }
}

function createRecvPeer(sendId) {
  recvPeerMap.set(
    sendId,
    new RTCPeerConnection({
      iceServers: [
        {
          urls: ["turn:13.250.13.83:3478?transport=udp"],
          username: "YzYNCouZM1mhqhmseWk6",
          credential: "YzYNCouZM1mhqhmseWk6",
        },
      ],
    })
  );

  recvPeerMap.get(sendId).addEventListener("icecandidate", (data) => {
    console.log(`sent recvCandidate to server`);
    socket.emit("recvCandidate", data.candidate, sendId);
  });

  recvPeerMap.get(sendId).addEventListener("track", (data) => {
    handleTrack(data, sendId);
  });
}

async function creatRecvOffer(sendId) {
  console.log(`createRecvOffer sendId = ${sendId}`);
  const offer = await recvPeerMap.get(sendId).createOffer({
    offerToReceiveVideo: true,
    offerToReceiveAudio: true,
  });

  recvPeerMap.get(sendId).setLocalDescription(offer);

  console.log(`send recvOffer to server`);
  socket.emit("recvOffer", offer, sendId);
}

socket.on("sendAnswer", async (answer) => {
  console.log("got sendAnswer from server");
  sendPeer.setRemoteDescription(answer);
});

socket.on("recvAnswer", async (answer, sendId) => {
  console.log("got recvAnswer from server");
  recvPeerMap.get(sendId).setRemoteDescription(answer);
});

socket.on("bye", (fromId) => {
  // 나간 유저의 정보를 없앤다.
  console.log("bye " + fromId);
  recvPeerMap.get(fromId).close();
  recvPeerMap.delete(fromId);

  let video = document.getElementById(`${fromId}`);
  streamDiv.removeChild(video);
});

// RTC code
function handleTrack(data, sendId) {
  let video = document.getElementById(`${sendId}`);
  if (!video) {
    video = document.createElement("video");
    video.id = sendId;
    video.width = 100;
    video.height = 100;
    video.autoplay = true;
    video.playsInline = true;

    streamDiv.appendChild(video);
  }

  console.log(`handleTrack from ${sendId}`);
  video.srcObject = data.streams[0];
}

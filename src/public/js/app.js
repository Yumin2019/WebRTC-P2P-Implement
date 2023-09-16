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
let peerMap = new Map();

async function getCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = await devices.filter(
      (device) => device.kind === "videoinput"
    );

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
  peerMap.forEach((peerConnection) => {
    if (peerConnection) {
      const videoTrack = myStream.getVideoTracks()[0];
      const videoSender = peerConnection
        .getSenders()
        .find((sender) => sender.track.kind === "video");

      videoSender.replaceTrack(videoTrack);
    }
  });
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
socket.on("welcome", async (fromId) => {
  console.log(`${fromId} joined`);

  // 새로 들어온 Client와 Connection을 생성한다. (offer를 생성하는 쪽)
  makeConnection(fromId);
  console.log(`made connection with ${fromId}`);

  const offer = await peerMap[fromId].createOffer();
  peerMap[fromId].setLocalDescription(offer);

  console.log(`sent to the offer to ${fromId}`);
  socket.emit("offer", offer, fromId);
});

socket.on("offer", async (offer, fromId) => {
  console.log(`got offer from ${fromId}`);

  // 새로 들어온 Client와 Connection을 생성한다. (offer를 받는 쪽)
  makeConnection(fromId);
  console.log(`made connection with ${fromId}`);

  peerMap[fromId].setRemoteDescription(offer);
  const answer = await peerMap[fromId].createAnswer();
  peerMap[fromId].setLocalDescription(answer);

  console.log(`sent the answer to ${fromId}`);
  socket.emit("answer", answer, fromId);
});

socket.on("answer", (answer, fromId) => {
  console.log(`received the answer from ${fromId}`);
  peerMap[fromId].setRemoteDescription(answer);
});

socket.on("ice", (ice, fromId) => {
  console.log(`received ice from ${fromId}`);
  peerMap[fromId].addIceCandidate(ice);
});

socket.on("disconnecting", (roomName) => {
  // 종료 전에 exit_room 이벤트를 발생시킨다.
  socket.emit("exit_room", roomName);
});

socket.on("bye", (fromId) => {
  console.log("BYE !!! " + fromId);
  // 나간 유저의 정보를 없앤다.
  peerMap[fromId] = undefined;

  let video = document.getElementById(`${fromId}`);
  streamDiv.removeChild(video);
});

// RTC code
function makeConnection(fromId) {
  peerMap[fromId] = new RTCPeerConnection({
    iceServers: [
      {
        urls: ["turn:13.250.13.83:3478?transport=udp"],
        username: "YzYNCouZM1mhqhmseWk6",
        credential: "YzYNCouZM1mhqhmseWk6",
      },
    ],
  });

  peerMap[fromId].addEventListener("icecandidate", (data) => {
    handleIce(data, fromId);
  });
  peerMap[fromId].addEventListener("addstream", (data) => {
    handleAddStream(data, fromId);
  });
  peerMap[fromId].addEventListener("track", (data) => {
    handleTrack(data, fromId);
  });

  myStream
    .getTracks()
    .forEach((track) => peerMap[fromId].addTrack(track, myStream));
}

function handleIce(data, fromId) {
  // send candidates to other browser
  console.log(`sent candidate to ${fromId}`);
  socket.emit("ice", data.candidate, fromId);
}

function handleAddStream(data, fromId) {
  let video = document.getElementById(`${fromId}`);
  if (!video) {
    video = document.createElement("video");
    video.id = fromId;
    video.width = 100;
    video.height = 100;
    video.autoplay = true;
    video.playsInline = true;

    streamDiv.appendChild(video);
  }

  console.log(`handleAddStream from ${fromId}`);
  video.srcObject = data.stream;
}

function handleTrack(data, fromId) {
  let video = document.getElementById(`${fromId}`);
  if (!video) {
    video = document.createElement("video");
    video.id = fromId;
    video.width = 100;
    video.height = 100;
    video.autoplay = true;
    video.playsInline = true;

    streamDiv.appendChild(video);
  }

  console.log(`handleTrack from ${fromId}`);
  video.srcObject = data.streams[0];
}

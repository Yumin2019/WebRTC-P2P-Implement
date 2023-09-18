const socket = io();

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camearsSelect = document.getElementById("cameras");

let myStream;
let isMuted = true;
let isCameraOn = false;
let roomName;
let myPeerConnection;

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
  if (myPeerConnection) {
    const videoTrack = myStream.getVideoTracks()[0];
    const videoSender = myPeerConnection
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
  makeConnection();
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
socket.on("welcome", async () => {
  console.log("someone joined");

  // 먼저 방에 있던 클라가 이벤트를 받는다.
  const offer = await myPeerConnection.createOffer();
  myPeerConnection.setLocalDescription(offer);
  console.log("sent to the offer");
  socket.emit("offer", offer, roomName);
});

socket.on("offer", async (offer) => {
  myPeerConnection.setRemoteDescription(offer);
  const answer = await myPeerConnection.createAnswer();
  myPeerConnection.setLocalDescription(answer);
  socket.emit("answer", answer, roomName);
  console.log("sent the answer");
});

socket.on("answer", (answer) => {
  console.log("received the answer");
  myPeerConnection.setRemoteDescription(answer);
});

socket.on("ice", (ice) => {
  console.log("received ice");
  myPeerConnection.addIceCandidate(ice);
});

// RTC code
function makeConnection() {
  myPeerConnection = new RTCPeerConnection({
    iceServers: [
      {
        urls: ["turn:13.250.13.83:3478?transport=udp"],
        username: "YzYNCouZM1mhqhmseWk6",
        credential: "YzYNCouZM1mhqhmseWk6",
      },
    ],
  });
  myPeerConnection.addEventListener("track", handleTrack);
  myPeerConnection.addEventListener("icecandidate", handleIce);
  myStream
    .getTracks()
    .forEach((track) => myPeerConnection.addTrack(track, myStream));
}

function handleIce(data) {
  // send candidates to other browser
  console.log("sent candidate");
  socket.emit("ice", data.candidate, roomName);
}

function handleTrack(data) {
  console.log("handle track");
  const peerFace = document.querySelector("#peerFace");
  peerFace.srcObject = data.streams[0];
}

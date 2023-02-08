'use strict';

var isChannelReady = false;
var isInitiator = false;
var isStarted = false;
var localStream;
var pc;
var remoteStream;
var turnReady;
var pcConfig = {
  iceServers: [
  {
    "urls": 'turn:43.200.182.153:3478?transport=tcp',
    "username":"jsheo",
    "credential":"jsheo"
  }//,
  ]//,
  //sdpSemantics: 'unified-plan'
};
/*
var pcConfig = {
      iceServers: [{
        urls: ['stun:stun.stunprotocol.org:3478']
      }]//,
      //sdpSemantics: 'unified-plan'
    }
*/
// Set up audio and video regardless of what devices are present.
var sdpConstraints = {
  offerToReceiveVideo: true
};

/////////////////////////////////////////////

var room = 'foo';
// Could prompt for room name:
// room = prompt('Enter room name:');

var socket = io.connect();

if (room !== '') {
  socket.emit('client join', room);
  console.log('Attempted to join room', room);
}
socket.on('camera ready', () => {
  isChannelReady = true;
  isInitiator = true;
  maybeStart();  
});
socket.on('answer', function(n, sdp) {
  console.log('set remote');
  // replace pc to pcList[n] later.
  pc.setRemoteDescription(new RTCSessionDescription(sdp));
});
socket.on('created', function(room) {
  console.log('Created room ' + room);
  isInitiator = true;
});

socket.on('full', function(room) {
  console.log('Room ' + room + ' is full');
});

socket.on('join', function (room){
  console.log('Another peer made a request to join room ' + room);
  console.log('This peer is the initiator of room ' + room + '!');
  isChannelReady = true;
});

socket.on('joined', function(room) {
  console.log('joined: ' + room);
  isChannelReady = true;
});

socket.on('log', function(array) {
  console.log.apply(console, array);
});

////////////////////////////////////////////////

function sendMessage(message) {
  console.log('Client sending message: ', message);
  socket.emit('message', message);
}

// This client receives a message
socket.on('message', function(message) {
  console.log('Client received message:', message);
  if (message === 'got user media') {
    maybeStart();
  } else if (message.type === 'offer') {
    console.log('offer!!!!!');
    if (!isInitiator && !isStarted) {
      maybeStart();
    }
    console.log(message);
    console.log('set remote');
    pc.setRemoteDescription(new RTCSessionDescription(message));
    doAnswer(message);
  } else if (message.type === 'answer' && isStarted) {
    console.log('set remote');
    pc.setRemoteDescription(new RTCSessionDescription(message));
  } else if (message.type === 'candidate' && isStarted) {
    var candidate = new RTCIceCandidate({
      sdpMLineIndex: message.label,
      candidate: message.candidate
    });
    console.log('add ice candidate');
    console.log('signalingState:', pc.signalingState);
    console.log('ice candidate added:',candidate);
    pc.addIceCandidate(candidate);
  } else if (message === 'bye' && isStarted) {
    handleRemoteHangup();
  }
});

////////////////////////////////////////////////////

var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');

// navigator.mediaDevices.getUserMedia({
//   audio: false,
//   video: true
// })
// .then(gotStream)
// .catch(function(e) {
//   alert('getUserMedia() error: ' + e.name);
// });
gotStream();
function gotStream() {
  console.log('Adding local stream.');
  // localStream = stream;
  // localVideo.srcObject = stream;
  sendMessage('got user media');
  if (isInitiator) {
    maybeStart();
  }
}

var constraints = {
  video: true
};

console.log('Getting user media with constraints', constraints);

// if (location.hostname == 'localhost') {
//   requestTurn(
///    'https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913'
//  );
//}

function maybeStart() {
  console.log('>>>>>>> maybeStart() ', isStarted, localStream, isChannelReady);
  if (!isStarted && isChannelReady) {
    console.log('>>>>>> creating peer connection');
    createPeerConnection();
    // pc.addStream(localStream);
    pc.addTransceiver('video');
    pc.getTransceivers().forEach(t => t.direction = 'recvonly');
    isStarted = true;
    console.log('isInitiator', isInitiator);
    if (isInitiator) {
      //doCall();
      setLocalAndGatherCandidates();
    }
  }
}

window.onbeforeunload = function() {
  sendMessage('bye');
};

/////////////////////////////////////////////////////////

function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(pcConfig);
    pc.onicecandidate = handleIceCandidate2;
    pc.onaddstream = handleRemoteStreamAdded;
    pc.onremovestream = handleRemoteStreamRemoved;
    console.log('Created RTCPeerConnnection');
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
    return;
  }
}

var ice_candidates = [];
function handleIceCandidate2(event) {
  console.log('ice candidate event: ', event);
  if (event.candidate) {
    ice_candidates.push(event.candidate.candidate);
  } else {
    console.log('End of candidates.');
    ice_candidates.push('end-of-candidates');
    var sessionDescription = pc.localDescription;
    for (let i=0;i<ice_candidates.length;i++) {
      sessionDescription.sdp += 'a=' + ice_candidates[i] + '\r\n';
    }
    pc.setLocalDescription(sessionDescription);
    //sendMessage(sessionDescription);
    const n = 0; // the order of player
    const m = 0; // the order of stream
    socket.emit('offer', (n, m, sessionDescription));
  }
}
function handleIceCandidate(event) {
  console.log('icecandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate
    });
  } else {
    console.log('End of candidates.');
  }
}

function handleCreateOfferError(event) {
  console.log('createOffer() error: ', event);
}

function doCall() {
  console.log('Sending offer to peer');
  pc.createOffer(setLocalAndSendMessage, handleCreateOfferError, sdpConstraints);
}

function setLocalAndGatherCandidates() {
  console.log('Gathering candidates by settign local description');
  const offer = pc.createOffer(sdpConstraints);
  pc.setLocalDescription(offer);
}

function doAnswer(message) {
  console.log('Sending answer to peer.');
  //const m_line = 'm='+message.sdp.split('m=')[1].split('\r\n')[0]
  //console.log(m_line);
  //const sdp = new RTCSessionDescription({
  //  type: "answer",
  //  sdp: "v=0\r\no=- 0 0 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\na=recvonly\r\n" + m_line + "\r\n"
  //});
  //pc.setLocalDescription(message.sdp);
  //console.log('set Local and Send echo message', message.sdp);
  //sendMessage(sdp);
  pc.addTransceiver('video', {direction: 'recvonly'});
  pc.createAnswer().then(
    setLocalAndSendMessage,
    onCreateSessionDescriptionError
  );
}

function setLocalAndSendMessage(sessionDescription) {
  console.log('set local');
  //sendMessage(sessionDescription);
  pc.setLocalDescription(sessionDescription)
      .then(() => {
      console.log('setLocalAndSendMessage sending message', sessionDescription);
      sendMessage(sessionDescription);
      });
}

function onCreateSessionDescriptionError(error) {
  trace('Failed to create session description: ' + error.toString());
}

function requestTurn(turnURL) {
  var turnExists = false;
  for (var i in pcConfig.iceServers) {
    if (pcConfig.iceServers[i].urls.substr(0, 5) === 'turn:') {
      turnExists = true;
      turnReady = true;
      break;
    }
  }
  console.log('turn exists: ', turnExists)
  if (!turnExists) {
    console.log('Getting TURN server from ', turnURL);
    // No TURN server. Get one from computeengineondemand.appspot.com:
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
      if (xhr.readyState === 4 && xhr.status === 200) {
        var turnServer = JSON.parse(xhr.responseText);
        console.log('Got TURN server: ', turnServer);
        pcConfig.iceServers.push({
          'urls': 'turn:' + turnServer.username + '@' + turnServer.turn,
          'credential': turnServer.password
        });
        turnReady = true;
      }
    };
    xhr.open('GET', turnURL, true);
    xhr.send();
  }
}

function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.');
  remoteStream = event.stream;
  remoteVideo.srcObject = remoteStream;
  console.log('remoteVideo.srcObject', remoteVideo.srcObject);
  remoteVideo.play();
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
}

function hangup() {
  console.log('Hanging up.');
  stop();
  sendMessage('bye');
}

function handleRemoteHangup() {
  console.log('Session terminated.');
  stop();
  isInitiator = false;
}

function stop() {
  isStarted = false;
  pc.close();
  pc = null;
}

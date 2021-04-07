// Adapted from https://github.com/shanet/WebRTC-Example

var localVid = $("#localVideo");
var remoteVid = $("#remoteVideo");
var btn1 = $("#btn-client1");
var btn2 = $("#btn-client2");
var theInput = $("#msgInput");
var callBtn = $("#btn-call");
var msgDiv = $("#msgDiv");
var bbles = $("#bubbles");
var peekABoo = $("#peek-a-boo");

var localStream;
var peerConnection;
var serverConnection;

var $body = $("body");

bbles.hide();
peekABoo.hide();


const peerConnectionConfig = {
    iceServers: [
        { urls: "stun:stun.stunprotocol.org:3478" },
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },
        { urls: "stun:stun.ekiga.net" },
        { urls: "stun:stun.fwdnet.net" },
        { urls: "stun:stun.ideasip.com" },
        { urls: "stun:stun.iptel.org" },
    ],
};

const MessageType = {
    SERVER_INFO: 0,
    CLIENT1: 1,
    CLIENT2: 2,
    CALL_REQUEST: 3,
};


btn1.on("click", () => {
    getWebcam();
    btn2.prop("disabled", true);
    destination = "wss://" + location.host + "/client1";
    serverConnection = new WebSocket(destination);
    serverConnection.onmessage = handleMessage;
    bbles.show();
    peekABoo.show();
});

bbles.on("click", () => {
    serverConnection.send(
        JSON.stringify({
            type: MessageType.CLIENT1,
            message: "bubble",
        })
    );

});


btn2.on("click", () => {
    getWebcam();
    btn1.prop("disabled", true);
    destination = "wss://" + location.host + "/client2";
    serverConnection = new WebSocket(destination);
    serverConnection.onmessage = handleMessage;
    btn1.hide();
    btn2.hide();
    callBtn.hide();
});

peekABoo.on("click", () => {
    serverConnection.send(
        JSON.stringify({
            type: MessageType.CLIENT1,
            message: "peekaboo",
        })
    );
});

callBtn.on("click", () => {
    start(true);
    btn1.css("display", "none");
    btn2.css("display", "none");
    callBtn.css("display", "none");
});

function getWebcam() {
    if (navigator.getUserMedia) {
        navigator.getUserMedia({
                video: true,
                audio: true,
            },
            (stream) => {
                // success
                localStream = stream;
                localVid.prop("srcObject", stream);
            },
            (error) => {
                // error
                console.error(error);
            }
        );
    } else {
        alert("Your browser does not support getUserMedia API");
    }
}

function start(isCaller) {
    peerConnection = new RTCPeerConnection(peerConnectionConfig);
    peerConnection.onicecandidate = gotIceCandidate;
    peerConnection.ontrack = gotRemoteStream;
    peerConnection.addStream(localStream);

    if (isCaller) {
        peerConnection.createOffer().then(createdDescription).catch(errorHandler); // using chained Promises for async
    }
}

function gotIceCandidate(event) {
    if (event.candidate != null) {
        serverConnection.send(
            JSON.stringify({
                type: MessageType.CALL_REQUEST,
                ice: event.candidate,
                message: "Sending ICE candidate",
            })
        );
    }
}

function createdDescription(description) {
    console.log("got description");

    peerConnection
        .setLocalDescription(description)
        .then(() => {
            serverConnection.send(
                JSON.stringify({
                    type: MessageType.CALL_REQUEST,
                    sdp: peerConnection.localDescription,
                    message: "Requesting call",
                })
            );
        })
        .catch(errorHandler);
}

function gotRemoteStream(event) {
    console.log("got remote stream");
    remoteVid.prop("srcObject", event.streams[0]);
    msgDiv.html("Connected to peer.");
    callBtn.css("display", "none");
}

function handleMessage(mEvent) {
    var msg = JSON.parse(mEvent.data);

    switch (msg.type) {
        case MessageType.SERVER_INFO:
            msgDiv.html(msg.message);
            break;

            // Message came from Client 1, Handle as Client2
        case MessageType.CLIENT1:
            $body.on('click', '.bubble', function(){
               $(this).addClass('is-popping'); 
               var audio = new Audio("bubblePopping.mp3");
                audio.play();
            });
            $body.on('transitioned', '.bubble', function(){
                $(this).remove(); 
             
             });
            switch (msg.message){
                case "peekaboo":
                    var a = new Audio("rattle.mp3");
                    var x = Math.floor(Math.random() * 256);
                    var y = Math.floor(Math.random() * 256);
                    var z = Math.floor(Math.random() * 256);
                    var bgColor = "rgb(" + x + "," + y + "," + z + ")";
                    $body.css("background-color", bgColor);
                    a.play();
                    break;

                case "bubble":
                    var $bubbbles;
                    
                    $bubbbles = $('<div>');
                    $bubbbles.addClass('bubble');
                    $bubbbles.css({
                        'top': Math.random() * (document.documentElement.clientHeight -100),
                        'left': Math.random() * (document.documentElement.clientHeight - 100)
                    })
                    $body.append($bubbbles);
                    break;
                }
            break;

            // Message came from Client 2, Handle as Client1
        case MessageType.CLIENT2:
            break;

        case MessageType.CALL_REQUEST:
            if (!peerConnection) {
                msgDiv.html("Receiving Call!");
                start(false);
            }

            // Are we on the SDP stage or the ICE stage of the handshake?
            if (msg.sdp) {
                peerConnection
                    .setRemoteDescription(new RTCSessionDescription(msg.sdp))
                    .then(() => {
                        // Only create answers in response to offers
                        if (msg.sdp.type == "offer") {
                            peerConnection
                                .createAnswer()
                                .then(createdDescription)
                                .catch(errorHandler);
                        }
                    })
                    .catch(errorHandler);
            } else if (msg.ice) {
                peerConnection
                    .addIceCandidate(new RTCIceCandidate(msg.ice))
                    .catch(errorHandler);
            }
        default:
            break;
    }
}

function errorHandler(error) {
    console.error(error);
}
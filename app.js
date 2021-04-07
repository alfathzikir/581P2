const path = require("path");
const express = require("express");
const ws = require("ws");
const { sign } = require("crypto");
const PORT = process.env.PORT || 5000;
const DOMAIN = "https://alfathproject2.herokuapp.com/";

var app = express();

const MessageType = {
    SERVER_INFO: 0,
    CLIENT1: 1,
    CLIENT2: 2,
    CALL_REQUEST: 3
};

var wsServer = new ws.Server({ noServer: true });
app
    .use(express.static(path.join(__dirname, "public")))
    .use(function(req, res, next) {
        res.header("Access-Control-Allow-Origin", DOMAIN);
        res.header(
            "Access-Control-Allow-Headers",
            "Origin, X-Requested-With, Content-Type, Accept"
        );
        next();
    })
    .get("/", (req, res) => {
        res.sendFile(path.join(__dirname, "public/pages/index.html"));
    })
    .get("/model", (req, res) => {
        res.sendFile(path.join(__dirname, "public/pages/index.html"));
    })
    .listen(PORT)
    .on("upgrade", (request, socket, head) => {
        wsServer.handleUpgrade(request, socket, head, (socket) => {
            wsServer.emit("connection", socket, request);
        });
    });

var clients = {}; // iterating over object key:value pairs => object[key] returns key's value

wsServer.on("connection", (socket, request) => {
    // route to endpoint handlers
    switch (request.url) {
        case "/client1":
            if (!clients.client1) {
                console.log("Client 1 Connected");
                clients.client1 = socket;
                socket.send(
                    JSON.stringify({
                        type: MessageType.SERVER_INFO,
                        message: "Connected to server. Waiting for peer..."
                    })
                );
            } else {
                socket.close(1013, "Client 1 already taken. Try again later.");
            }
            break;

        case "/client2":
            if (!clients.client2) {
                console.log("Client 2 Connected");
                clients.client2 = socket;
                socket.send(
                    JSON.stringify({
                        type: MessageType.SERVER_INFO,
                        message: "Connected to server. Waiting for peer..."
                    })
                );
            } else {
                socket.close(1013, "Client 2 already taken. Try again later.");
            }
            break;

        default:
            console.log("default");
            socket.close(1000, "Endpoint Not Found");
            break;
    }

    // handle and route messages to endpoint handlers
    socket.onmessage = (mEvent) => {
        var msg = JSON.parse(mEvent.data);
        switch (request.url) {
            case "/client1": //tut5exB
                if (clients.client2 != undefined) { // clients2 exists, forward the message
                    console.log("Forwarded message from Client 1 to Client 2");
                    console.log(msg);
                    clients.client2.send(JSON.stringify(msg));
                } else {
                    clients.client1.send(
                        JSON.stringify({
                            type: MessageType.SERVER_INFO,
                            message: "Waiting for Client2 to connect..."
                        })
                    );
                }
                break;

            case "/client2": //tut5exc
                if (clients.client1 != undefined) {
                    console.log("Forwarded message from Client 2 to Client 1");
                    console.log(msg);
                    clients.client1.send(JSON.stringify(msg)); // clients1 exists, forward the message
                } else {
                    clients.client2.send(
                        JSON.stringify({
                            type: MessageType.SERVER_INFO,
                            message: "Waiting for Client1 to connect..."
                        })
                    );
                }
                break;

            default:
                socket.close(1000, "Endpoint Not Found");
                break;
        }
    };
    socket.onclose = (e) => {
        console.log("Socket closed: " + e.code + " " + e.reason); // debug message to confirm closed socket.
        clearInterval(interval); // stop heartbeat for this socket

        if (e.code == 1001) {
            // code 1001: client closed socket, disconnect all clients and delete them
            for (var s in clients) {
                clients[s].close(4000, "Peer disconnected");
                clients[s] = undefined;
            }
        }
    };

    // establish ping-pong heartbeats
    socket.isAlive = true;
    socket.on("pong", () => {
        // ping-pong heartbeat
        console.log("pong at " + request.url);
        socket.isAlive = true; // a successful ping-pong means connection is still alive
    });

    var interval = setInterval(() => {
        if (socket.isAlive === false) {
            // didn't get a pong back within 10s
            socket.terminate(); // kill the socket in cold blood
            clients[
                request.url.slice(1) /* remove the / from the endpoint name */
            ] = undefined;
            return;
        }

        socket.isAlive = false; // first assume connection is dead
        socket.ping(); // do the "heartbeat" to 'revive' it
    }, 10000); // 10s
});
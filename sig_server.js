'use strict';

var os = require('os');
var nodeStatic = require('node-static');
var http = require('http');
var socketIO = require('socket.io');
var fileServer = new(nodeStatic.Server)();
var app = http.createServer(function(req, res) {
  fileServer.serve(req, res);
}).listen(8080);

var io = socketIO.listen(app);
io.sockets.on('connection', function(socket) {

  // convenience function to log server messages on the client
  function log() {
    var array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }
  function findRoomsFromSocketId(socketId) {
    let rooms = Array.from(Object.keys(io.sockets.adapter.sids[socketId]));
    rooms = rooms.filter(room => room !== socketId);
    return rooms
  }


  socket.on('message', function(message) {
    log('Client said: ', message);
    // for a real app, would be room-only (not broadcast)
    socket.broadcast.emit('message', message);
    console.log('message: ', message);  
  });
  socket.on('camera join', function(room) {
    console.log('A camera has joined to room: ' + room);
    socket.join(room);
    io.sockets.adapter.rooms[room].camera = socket.id;
    io.sockets.in(room).emit('camera ready');
    console.log('Current Room State: ',io.sockets.adapter.rooms);
  }); 
  socket.on('client join', function(room) {
    console.log('a client has joined to room ' + room);
    socket.join(room);
    if (io.sockets.adapter.rooms[room].camera) {
      io.to(socket.id).emit('camera ready');
    }
    console.log('Current Room State: ', io.sockets.adapter.rooms);

  });
  socket.on('offer', function (params) {
    const n = params[0];
    const m = params[1];
    const sdp = params[2];
    console.log('recieved offer');
    const rooms = findRoomsFromSocketId(socket.id);
    for (let i=0;i<rooms.length;i++) {
      var room = rooms[i]
      if (socket.id in io.sockets.adapter.rooms[room].sockets) {
	console.log('emit offer to camera in room', room);
	io.sockets.in(room).emit('offer', [socket.id, n, m, sdp]);
	break;
      }
    }
  });
  socket.on('answer', function (params) {
    const socketId = params[0];
    const n = params[1];
    const sdp = params[2];
    console.log('received answer');
    io.to(socketId).emit('answer', [n, sdp]);
  });
  socket.on('bye', ()=> {
    const rooms = findRoomsFromSocketId(socket.id);
    var cameras = [];
    for (let i=0;i<rooms.length;i++) {
      var room = rooms[i];
      var camera = io.sockets.adapter.rooms[room].camera
      if (camera) {
	cameras.push(camera);
      }
    }
    console.log('rooms:',rooms);
    if (socket.id in cameras) {
      console.log('received bye from camera');
      io.socket.in(room).emit('bye');
    } else {
      console.log('received bye from client');
      // do nothing to the RTSPtoWeb. hope it processes discconnection well.
    }
    console.log('Current Sids State: ', io.sockets.adapter.sids);
    console.log('Current Room State: ', io.sockets.adapter.rooms);
  });
  /*
  socket.on('create or join', function(room) {
    console.log('create or join: ', room);  
    log('Received request to create or join room ' + room);
    socket.join(room);
    
    var clientsInRoom = io.sockets.adapter.rooms[room];
    var numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
    log('Room ' + room + ' now has ' + numClients + ' client(s)');
    if (numClients === 0) {
      socket.join(room);
      log('Client ID ' + socket.id + ' created room ' + room);
      socket.emit('created', room, socket.id);

    } else if (numClients === 1 || numClients === 2) {
      log('Client ID ' + socket.id + ' joined room ' + room);
      io.sockets.in(room).emit('join', room);
      socket.join(room);
      socket.emit('joined', room, socket.id);
      io.sockets.in(room).emit('ready');
    } else { // max two clients
      socket.emit('full', room);
    }
  });*/

  socket.on('ipaddr', function() {
    var ifaces = os.networkInterfaces();
    for (var dev in ifaces) {
      ifaces[dev].forEach(function(details) {
        if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
          socket.emit('ipaddr', details.address);
        }
      });
    }
  });
});

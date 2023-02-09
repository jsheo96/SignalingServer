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
  function findRoomsFromSocketId(socketId) {
    let rooms = Array.from(Object.keys(io.sockets.adapter.sids[socketId]));
    rooms = rooms.filter(room => room !== socketId);
    return rooms
  }
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
  socket.on('disconnecting', () => {
    for (let room in socket.rooms) {
      // When camera is disconnected then discard the camera in the room
      if (socket.id === io.sockets.adapter.rooms[room].camera) {
        io.sockets.adapter.rooms[room].camera = undefined;
      }
    }
  });
  socket.on('disconnect', (reason) => {
    console.log('A socket has been disconnected:', reason);
    console.log('Current Room State: ', io.sockets.adapter.rooms);
  });
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

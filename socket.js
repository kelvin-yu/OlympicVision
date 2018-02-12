const videoProcessor = require('./video_module/video_processor.js');

let io;

exports.createIO = function(server){
    io = require('socket.io')(server);

    io.on('connection', (socket) => {
        let socketId = socket.id;

        socket.on('processVideo', onProcessVideo.bind(null, socketId));

        socket.on('disconnect', onDisconnect.bind(null, socketId));
    });
};

exports.broadcastTo = function(socketId, key, message){
    if(io.sockets.connected[socketId]){
        io.sockets.connected[socketId].emit(key, message);
    }
};

function onProcessVideo(socketId, url, acknowledge){
    console.log('video url: ', url);
    videoProcessor.processVideo(url, socketId);
    acknowledge('processing: ', url);
}

function onDisconnect(socketId){

}

//https://www.youtube.com/watch?v=VZvoufQy8qc
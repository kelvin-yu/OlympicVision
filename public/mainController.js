var app = angular.module('app');

app.controller('mainController', function($scope, socket){
    $scope.url = "";
    $scope.progress = [{value: 0, type: 'info'}, {value: 0, type: 'info'}, {value: 0, type: 'info'}]; //youtube, getFrames, process

    $scope.submitVideo = function(url){
        socket.emit('processVideo', url, function(result) {
            console.log('result: ', result);
        });
    };

    socket.on('progressUpdate', function(data){
        console.log('update: ', data);
        if(data.type === 'youtube'){
            $scope.progress[0].value = data.value;
        }
        else if(data.type === 'getFrames'){
            $scope.progress[1].value = data.value;
        }
        else if(data.type === 'process'){
            $scope.progress[2].value = data.value;
        }
    });

    socket.on('error', function(data) {

    });

    socket.on('processResult', function(data){
        console.log('done: ' + data);
    })
});

//https://www.youtube.com/watch?v=VZvoufQy8qc